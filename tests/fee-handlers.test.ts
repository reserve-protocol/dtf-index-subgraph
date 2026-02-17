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
});
