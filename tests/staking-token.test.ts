import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  createMockedFunction,
} from "matchstick-as/assembly/index";
import { getOrCreateStakingToken } from "../src/utils/getters";
import { mockERC20, mockERC20TotalSupply } from "./helpers/mock-erc20";

const ST_TOKEN = Address.fromString(
  "0xEE00000000000000000000000000000000000001"
);
const ON_CHAIN_SUPPLY: i64 = 5555555555;

mockERC20(ST_TOKEN, "vlTEST", "Vote-Locked Test", 18);
mockERC20TotalSupply(ST_TOKEN, BigInt.fromI64(ON_CHAIN_SUPPLY));
// Legacy / non-jar vault: tokenJar() reverts → StakingToken.tokenJar stays null
createMockedFunction(ST_TOKEN, "tokenJar", "tokenJar():(address)").reverts();

const ST_TOKEN_WITH_JAR = Address.fromString(
  "0xEE00000000000000000000000000000000000002"
);
const JAR_ADDR = Address.fromString(
  "0xFF00000000000000000000000000000000000003"
);
mockERC20(ST_TOKEN_WITH_JAR, "vlJAR", "Vote-Locked Jar", 18);
mockERC20TotalSupply(ST_TOKEN_WITH_JAR, BigInt.fromI64(ON_CHAIN_SUPPLY));
createMockedFunction(
  ST_TOKEN_WITH_JAR,
  "tokenJar",
  "tokenJar():(address)"
).returns([ethereum.Value.fromAddress(JAR_ADDR)]);

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
