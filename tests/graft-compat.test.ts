import { Address, Bytes } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { DTF, GovernanceTimelock } from "../generated/schema";
import {
  _handleRoleRevoked,
  _handleTradeAllowlistTokenAdded,
  _handleTradeAllowlistTokenRemoved,
} from "../src/dtf/handlers";
import { Role } from "../src/utils/constants";
import { createTestDTF, createTestGovernance } from "./helpers/mock-entities";

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
