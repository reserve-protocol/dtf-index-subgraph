import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, newMockEvent, test } from "matchstick-as/assembly/index";
import {
  DTF,
  GovernanceTimelock,
  TokenDailySnapshot,
  TokenHourlySnapshot,
  TokenMonthlySnapshot,
} from "../generated/schema";
import {
  _handleFolioFeePaid,
  _handleProtocolFeePaid,
  _handleRoleRevoked,
  _handleTradeAllowlistTokenAdded,
  _handleTradeAllowlistTokenRemoved,
} from "../src/dtf/handlers";
import { Role } from "../src/utils/constants";
import { createTestDTF, createTestGovernance, createTestToken } from "./helpers/mock-entities";

// 1.11.0 is grafted onto 1.10.2: DTFs indexed before the graft have no value for the list
// fields 1.11.0 added, so every handler that appends to them must start from an empty list.
const FOLIO = Address.fromString("0x1000000000000000000000000000000000000001");
const GOVERNOR = Address.fromString("0x4000000000000000000000000000000000000004");
const TIMELOCK = Address.fromString("0x5000000000000000000000000000000000000005");
const ST_TOKEN = Address.fromString("0x6000000000000000000000000000000000000006");
const TOKEN = Address.fromString("0x7000000000000000000000000000000000000007");

function createGraftedDTF(): DTF {
  const dtf = createTestDTF(FOLIO);
  dtf.legacyTradingGovernances = null;
  dtf.legacyAdminGovernances = null;
  dtf.tradeTokenAllowlist = null;
  dtf.save();
  return dtf;
}

describe("DTFs carried over by the 1.11.0 graft", () => {
  beforeEach(() => {
    clearStore();
  });

  test("a governance revoke starts the former-governance lists from empty", () => {
    createTestGovernance(GOVERNOR, TIMELOCK, ST_TOKEN);
    const timelock = GovernanceTimelock.load(TIMELOCK.toHexString())!;
    timelock.governance = GOVERNOR.toHexString();
    timelock.save();

    const dtf = createGraftedDTF();
    dtf.admins = [TIMELOCK.toHexString()];
    dtf.auctionApprovers = [TIMELOCK.toHexString()];
    dtf.save();
    assert.fieldEquals("DTF", FOLIO.toHexString(), "legacyAdminGovernances", "null");

    _handleRoleRevoked(FOLIO, Bytes.fromHexString(Role.DEFAULT_ADMIN), TIMELOCK);
    _handleRoleRevoked(FOLIO, Bytes.fromHexString(Role.REBALANCE_MANAGER), TIMELOCK);

    assert.fieldEquals("DTF", FOLIO.toHexString(), "legacyAdminGovernances", "[" + GOVERNOR.toHexString() + "]");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "legacyTradingGovernances", "[" + GOVERNOR.toHexString() + "]");
  });

  test("allowlist events start from an empty list", () => {
    createGraftedDTF();
    _handleTradeAllowlistTokenRemoved(FOLIO, TOKEN);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeTokenAllowlist", "[]");

    _handleTradeAllowlistTokenAdded(FOLIO, TOKEN);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeTokenAllowlist", "[" + TOKEN.toHexString() + "]");
  });
});

// 1.11.1 is grafted onto 1.11.0: the DTF and the snapshots written before the graft have no
// self-revenue value, so the first self fee must start them from zero.
describe("entities carried over by the 1.11.1 graft", () => {
  beforeEach(() => {
    clearStore();
  });

  test("the first self fee starts selfRevenue and the snapshot self fields from zero", () => {
    createTestToken(FOLIO);
    const dtf = createGraftedDTF();
    dtf.selfRevenue = null;
    dtf.save();

    const event = newMockEvent();
    event.block.timestamp = BigInt.fromI32(86400);
    // A pre-graft fee created today's snapshots; null their self fields like 1.11.0 left them.
    _handleProtocolFeePaid(FOLIO, BigInt.fromI32(500), event);
    const id = FOLIO.toHexString();
    const daily = TokenDailySnapshot.load(id + "-1")!;
    daily.dailySelfRevenue = null;
    daily.save();
    const hourly = TokenHourlySnapshot.load(id + "-24")!;
    hourly.hourlySelfRevenue = null;
    hourly.save();
    const monthly = TokenMonthlySnapshot.load(id + "-0")!;
    monthly.monthlySelfRevenue = null;
    monthly.cumulativeSelfRevenue = null;
    monthly.save();

    _handleFolioFeePaid(FOLIO, FOLIO, BigInt.fromI32(70), event);

    assert.fieldEquals("DTF", id, "selfRevenue", "70");
    assert.fieldEquals("DTF", id, "externalRevenue", "0");
    assert.fieldEquals("DTF", id, "totalRevenue", "570");
    assert.fieldEquals("TokenDailySnapshot", id + "-1", "dailySelfRevenue", "70");
    assert.fieldEquals("TokenHourlySnapshot", id + "-24", "hourlySelfRevenue", "70");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-0", "monthlySelfRevenue", "70");
    assert.fieldEquals("TokenMonthlySnapshot", id + "-0", "cumulativeSelfRevenue", "70");
  });
});
