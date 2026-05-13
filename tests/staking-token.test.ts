import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
} from "matchstick-as/assembly/index";
import { getOrCreateStakingToken } from "../src/utils/getters";
import { mockERC20, mockERC20TotalSupply } from "./helpers/mock-erc20";

const ST_TOKEN = Address.fromString(
  "0xEE00000000000000000000000000000000000001"
);
const ON_CHAIN_SUPPLY: i64 = 5555555555;

mockERC20(ST_TOKEN, "vlTEST", "Vote-Locked Test", 18);
mockERC20TotalSupply(ST_TOKEN, BigInt.fromI64(ON_CHAIN_SUPPLY));

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
});
