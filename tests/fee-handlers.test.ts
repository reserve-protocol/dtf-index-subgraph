import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import {
  _handleProtocolFeePaid,
  _handleFolioFeePaid,
} from "../src/dtf/handlers";
import { StakingToken } from "../generated/schema";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "../src/utils/constants";
import { createTestDTF, createTestToken, createTestGovernance } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";

const DTF_ADDR = Address.fromString(
  "0xD577936364733a0f03ef92adf572EB4265Ccc4cc"
);
const GOVERNANCE_ADDR = Address.fromString(
  "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
);
const TIMELOCK_ADDR = Address.fromString(
  "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
);
const ST_TOKEN_ADDR = Address.fromString(
  "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
);
const RANDOM_RECIPIENT = Address.fromString(
  "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
);
const TOKEN_JAR_ADDR = Address.fromString(
  "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"
);

// Mock ERC20 for DTF token (used by getOrCreateToken in fee handlers)
mockERC20(DTF_ADDR, "DTF", "DTF Token", 18);
mockERC20(ST_TOKEN_ADDR, "stDTF", "Staked DTF", 18);

function createFeeEvent(timestamp: i32 = 86400): ethereum.Event {
  let event = newMockEvent();
  event.block.number = BigInt.fromI32(100);
  event.block.timestamp = BigInt.fromI32(timestamp);
  return event;
}

describe("_handleProtocolFeePaid", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
    createTestToken(DTF_ADDR);
  });

  test("adds amount to totalRevenue and protocolRevenue", () => {
    let event = createFeeEvent();
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(500), event);

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "totalRevenue", "500");
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "protocolRevenue",
      "500"
    );
  });

  test("accumulates across multiple calls", () => {
    let event1 = createFeeEvent();
    let event2 = createFeeEvent();
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(500), event1);
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(200), event2);

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "totalRevenue", "700");
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "protocolRevenue",
      "700"
    );
  });

  test("creates daily snapshot with protocol revenue", () => {
    let event = createFeeEvent();
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(300), event);

    let dayId = DTF_ADDR.toHexString() + "-1"; // 86400 / 86400 = 1
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyRevenue", "300");
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyProtocolRevenue",
      "300"
    );
  });

  test("creates hourly snapshot with protocol revenue", () => {
    let event = createFeeEvent();
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(300), event);

    let hourId = DTF_ADDR.toHexString() + "-24"; // 86400 / 3600 = 24
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlyRevenue", "300");
    assert.fieldEquals(
      "TokenHourlySnapshot",
      hourId,
      "hourlyProtocolRevenue",
      "300"
    );
  });

  test("creates monthly snapshot with cumulative revenue", () => {
    let event = createFeeEvent();
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(300), event);

    let monthId = DTF_ADDR.toHexString() + "-0"; // 86400 / 2592000 = 0
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "monthlyRevenue",
      "300"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeRevenue",
      "300"
    );
  });
});

describe("_handleFolioFeePaid", () => {
  beforeEach(() => {
    clearStore();
    createTestToken(DTF_ADDR);
    createTestToken(ST_TOKEN_ADDR);
  });

  test("non-governance recipient adds to externalRevenue", () => {
    let dtf = createTestDTF(DTF_ADDR);
    // No ownerGovernance set → all goes to external
    let event = createFeeEvent();
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(400), event);

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "totalRevenue", "400");
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "externalRevenue",
      "400"
    );
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "governanceRevenue",
      "0"
    );
  });

  test("governance token recipient adds to governanceRevenue", () => {
    let dtf = createTestDTF(DTF_ADDR);
    // Set up governance where .token points to ST_TOKEN_ADDR
    let governance = createTestGovernance(GOVERNANCE_ADDR, TIMELOCK_ADDR, ST_TOKEN_ADDR);
    dtf.ownerGovernance = governance.id;
    dtf.save();

    // Fee paid to the staking token address (governance token)
    let event = createFeeEvent();
    _handleFolioFeePaid(
      DTF_ADDR,
      ST_TOKEN_ADDR,
      BigInt.fromI32(600),
      event
    );

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "totalRevenue", "600");
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "governanceRevenue",
      "600"
    );
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "externalRevenue",
      "0"
    );
  });

  test("always adds to totalRevenue regardless of recipient type", () => {
    let dtf = createTestDTF(DTF_ADDR);
    let event1 = createFeeEvent();
    let event2 = createFeeEvent();

    // External fee
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(200), event1);
    // Another external fee
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(300), event2);

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "totalRevenue", "500");
  });

  test("creates daily snapshot with correct revenue type for external", () => {
    let dtf = createTestDTF(DTF_ADDR);
    let event = createFeeEvent();
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(400), event);

    let dayId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyRevenue", "400");
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyExternalRevenue",
      "400"
    );
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyGovernanceRevenue",
      "0"
    );
  });

  test("creates daily snapshot with correct revenue type for governance", () => {
    let dtf = createTestDTF(DTF_ADDR);
    let governance = createTestGovernance(GOVERNANCE_ADDR, TIMELOCK_ADDR, ST_TOKEN_ADDR);
    dtf.ownerGovernance = governance.id;
    dtf.save();

    let event = createFeeEvent();
    _handleFolioFeePaid(DTF_ADDR, ST_TOKEN_ADDR, BigInt.fromI32(400), event);

    let dayId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyGovernanceRevenue",
      "400"
    );
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyExternalRevenue",
      "0"
    );
  });

  test("tokenJar recipient adds to governanceRevenue", () => {
    let dtf = createTestDTF(DTF_ADDR);
    let governance = createTestGovernance(
      GOVERNANCE_ADDR,
      TIMELOCK_ADDR,
      ST_TOKEN_ADDR
    );
    dtf.ownerGovernance = governance.id;
    dtf.save();

    // Cache the vault's tokenJar on the StakingToken (done at creation in prod)
    let st = StakingToken.load(ST_TOKEN_ADDR.toHexString()) as StakingToken;
    st.tokenJar = TOKEN_JAR_ADDR.toHexString();
    st.save();

    let event = createFeeEvent();
    _handleFolioFeePaid(DTF_ADDR, TOKEN_JAR_ADDR, BigInt.fromI32(600), event);

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "governanceRevenue",
      "600"
    );
    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "externalRevenue", "0");

    let dayId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals(
      "TokenDailySnapshot",
      dayId,
      "dailyGovernanceRevenue",
      "600"
    );
  });

  test("recipient that is neither stToken nor tokenJar stays external", () => {
    let dtf = createTestDTF(DTF_ADDR);
    let governance = createTestGovernance(
      GOVERNANCE_ADDR,
      TIMELOCK_ADDR,
      ST_TOKEN_ADDR
    );
    dtf.ownerGovernance = governance.id;
    dtf.save();

    let st = StakingToken.load(ST_TOKEN_ADDR.toHexString()) as StakingToken;
    st.tokenJar = TOKEN_JAR_ADDR.toHexString();
    st.save();

    let event = createFeeEvent();
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(250), event);

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "externalRevenue", "250");
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "governanceRevenue",
      "0"
    );
  });
});

describe("_handleFolioFeePaid: Folio 6.0 self fee", () => {
  beforeEach(() => {
    clearStore();
    createTestToken(DTF_ADDR);
    createTestToken(ST_TOKEN_ADDR);
    let dtf = createTestDTF(DTF_ADDR);
    let governance = createTestGovernance(
      GOVERNANCE_ADDR,
      TIMELOCK_ADDR,
      ST_TOKEN_ADDR
    );
    dtf.ownerGovernance = governance.id;
    dtf.save();
  });

  test("a fee paid to the Folio itself is selfRevenue, not externalRevenue, and stays in totalRevenue", () => {
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(500), createFeeEvent());
    _handleFolioFeePaid(DTF_ADDR, ST_TOKEN_ADDR, BigInt.fromI32(100), createFeeEvent());
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(150), createFeeEvent());
    // Folio 6.0: emit FolioFeePaid(address(this), selfShares)
    _handleFolioFeePaid(DTF_ADDR, DTF_ADDR, BigInt.fromI32(250), createFeeEvent());

    const id = DTF_ADDR.toHexString();
    assert.fieldEquals("DTF", id, "selfRevenue", "250");
    assert.fieldEquals("DTF", id, "externalRevenue", "150");
    assert.fieldEquals("DTF", id, "governanceRevenue", "100");
    assert.fieldEquals("DTF", id, "protocolRevenue", "500");
    // totalRevenue = protocol + governance + external + self
    assert.fieldEquals("DTF", id, "totalRevenue", "1000");

    const dayId = id + "-1";
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyRevenue", "1000");
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailySelfRevenue", "250");
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyExternalRevenue", "150");

    const hourId = id + "-24";
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlyRevenue", "1000");
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlySelfRevenue", "250");
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlyExternalRevenue", "150");

    const monthId = id + "-0";
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "monthlyRevenue", "1000");
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "monthlySelfRevenue", "250");
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "monthlyExternalRevenue", "150");
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "cumulativeSelfRevenue", "250");
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "cumulativeExternalRevenue", "150");
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "cumulativeRevenue", "1000");
  });

  test("self fees accumulate and the next month's snapshot carries the cumulative", () => {
    _handleFolioFeePaid(DTF_ADDR, DTF_ADDR, BigInt.fromI32(250), createFeeEvent());

    // First fee of the next month is a protocol fee: the snapshot is seeded from the DTF totals.
    const nextMonth = 2592000 + 86400;
    _handleProtocolFeePaid(DTF_ADDR, BigInt.fromI32(10), createFeeEvent(nextMonth));
    const id = DTF_ADDR.toHexString();
    assert.fieldEquals("TokenMonthlySnapshot", id + "-1", "monthlySelfRevenue", "0");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-1", "cumulativeSelfRevenue", "250");

    _handleFolioFeePaid(DTF_ADDR, DTF_ADDR, BigInt.fromI32(50), createFeeEvent(nextMonth));
    assert.fieldEquals("DTF", id, "selfRevenue", "300");
    assert.fieldEquals("DTF", id, "externalRevenue", "0");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-1", "monthlySelfRevenue", "50");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-1", "cumulativeSelfRevenue", "300");
    assert.fieldEquals("TokenDailySnapshot", id + "-" + (nextMonth / 86400).toString(), "dailySelfRevenue", "50");
  });

  test("new snapshots start the self-revenue fields at zero", () => {
    _handleFolioFeePaid(DTF_ADDR, RANDOM_RECIPIENT, BigInt.fromI32(150), createFeeEvent());

    const id = DTF_ADDR.toHexString();
    assert.fieldEquals("DTF", id, "selfRevenue", "0");
    assert.fieldEquals("TokenDailySnapshot", id + "-1", "dailySelfRevenue", "0");
    assert.fieldEquals("TokenHourlySnapshot", id + "-24", "hourlySelfRevenue", "0");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-0", "monthlySelfRevenue", "0");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-0", "cumulativeSelfRevenue", "0");
  });
});
