import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
} from "matchstick-as/assembly/index";
import {
  getOrCreateStakingToken,
} from "../src/utils/getters";
import { _handleOwnershipTransferred } from "../src/staking-token/handlers";
import { createMockedFunction } from "matchstick-as/assembly/index";
import { newMockEvent } from "matchstick-as/assembly/index";
import { ethereum } from "@graphprotocol/graph-ts";
import { mockERC20 } from "./helpers/mock-erc20";
import { mockStakingVault, mockVaultTokenJar } from "./helpers/mock-staking-vault";

const ST_TOKEN = Address.fromString(
  "0xEE00000000000000000000000000000000000001"
);
const RSR = Address.fromString("0x320623b8E4fF03373931769A31Fc52A4E78B5d70");
const ON_CHAIN_SUPPLY: i64 = 5555555555;

mockERC20(RSR, "RSR", "Reserve Rights", 18);
// Legacy / non-jar vault: tokenJar() reverts → StakingToken.tokenJar stays null
mockStakingVault(
  ST_TOKEN,
  "vlTEST",
  "Vote-Locked Test",
  18,
  BigInt.fromI64(ON_CHAIN_SUPPLY),
  RSR,
  null,
  null,
  null,
  null
);

const ST_TOKEN_WITH_JAR = Address.fromString(
  "0xEE00000000000000000000000000000000000002"
);
const JAR_ADDR = Address.fromString(
  "0xFF00000000000000000000000000000000000003"
);
mockStakingVault(
  ST_TOKEN_WITH_JAR,
  "vlJAR",
  "Vote-Locked Jar",
  18,
  BigInt.fromI64(ON_CHAIN_SUPPLY),
  null,
  null,
  null,
  null,
  null
);
mockVaultTokenJar(ST_TOKEN_WITH_JAR, JAR_ADDR);

const DEPLOYER = Address.fromString("0x7777777777777777777777777777777777777777");
const OWNER_TIMELOCK = Address.fromString("0x8888888888888888888888888888888888888888");
// Neither is a timelock: createGovernanceTimelock bails out on getMinDelay()
createMockedFunction(DEPLOYER, "getMinDelay", "getMinDelay():(uint256)").reverts();
createMockedFunction(OWNER_TIMELOCK, "getMinDelay", "getMinDelay():(uint256)").reverts();

function ownershipEvent(vault: Address): ethereum.Event {
  let event = newMockEvent();
  event.address = vault;
  return event;
}

describe("_handleOwnershipTransferred", () => {
  beforeEach(() => {
    clearStore();
  });

  test("the constructor's 0x0 → deployer transfer adds no legacy governance entry", () => {
    _handleOwnershipTransferred(Address.zero(), DEPLOYER, ownershipEvent(ST_TOKEN));
    assert.fieldEquals("StakingToken", ST_TOKEN.toHexString(), "legacyGovernance", "[]");

    _handleOwnershipTransferred(DEPLOYER, OWNER_TIMELOCK, ownershipEvent(ST_TOKEN));
    assert.fieldEquals(
      "StakingToken",
      ST_TOKEN.toHexString(),
      "legacyGovernance",
      "[" + DEPLOYER.toHexString() + "]"
    );
  });
});

describe("getOrCreateStakingToken", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates entity and seeds Token.totalSupply from chain on first discovery", () => {
    getOrCreateStakingToken(ST_TOKEN);

    assert.fieldEquals("StakingToken", ST_TOKEN.toHexString(), "id", ST_TOKEN.toHexString());
    assert.fieldEquals(
      "Token",
      ST_TOKEN.toHexString(),
      "totalSupply",
      ON_CHAIN_SUPPLY.toString()
    );
    // Default-initialized aggregates
    assert.fieldEquals("StakingToken", ST_TOKEN.toHexString(), "totalDelegates", "0");
    assert.fieldEquals(
      "StakingToken",
      ST_TOKEN.toHexString(),
      "underlying",
      RSR.toHexString()
    );
    assert.fieldEquals(
      "StakingToken",
      ST_TOKEN.toHexString(),
      "currentOptimisticDelegates",
      "0"
    );
  });

  test("idempotent — second call returns same entity without re-running setup", () => {
    const first = getOrCreateStakingToken(ST_TOKEN);
    first.totalDelegates = BigInt.fromI32(7);
    first.save();

    const second = getOrCreateStakingToken(ST_TOKEN);
    // Same entity, prior state preserved (no re-init)
    assert.bigIntEquals(second.totalDelegates, BigInt.fromI32(7));
  });

  test("resolves and caches the vault's tokenJar on creation", () => {
    getOrCreateStakingToken(ST_TOKEN_WITH_JAR);
    assert.fieldEquals(
      "StakingToken",
      ST_TOKEN_WITH_JAR.toHexString(),
      "tokenJar",
      JAR_ADDR.toHexString()
    );
  });
});
