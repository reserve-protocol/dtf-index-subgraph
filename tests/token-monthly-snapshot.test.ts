import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { getOrCreateTokenMonthlySnapshot } from "../src/token/mappings";
import { Token } from "../generated/schema";
import { createTestDTF, createTestToken } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";

const DTF_ADDR = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const ASSET_ADDR = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);

mockERC20(DTF_ADDR, "DTF", "DTF Token", 18);
mockERC20(ASSET_ADDR, "ASSET", "Asset Token", 18);

const SECONDS_PER_MONTH: i32 = 60 * 60 * 24 * 30;

function makeBlock(timestamp: i32): ethereum.Block {
  let event = newMockEvent();
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.block.number = BigInt.fromI32(100);
  return event.block;
}

describe("getOrCreateTokenMonthlySnapshot cumulative inheritance", () => {
  beforeEach(() => {
    clearStore();
  });

  test("DTF token: all cumulatives seeded from parent entities (Token + DTF)", () => {
    // Token + DTF entity with non-zero lifetime totals
    let token = createTestToken(DTF_ADDR);
    token.totalMinted = BigInt.fromI32(1000);
    token.totalBurned = BigInt.fromI32(400);
    token.currentHolderCount = BigInt.fromI32(7);
    token.cumulativeHolderCount = BigInt.fromI32(10);
    token.save();
    let dtf = createTestDTF(DTF_ADDR);
    dtf.totalRevenue = BigInt.fromI32(500);
    dtf.protocolRevenue = BigInt.fromI32(200);
    dtf.governanceRevenue = BigInt.fromI32(180);
    dtf.externalRevenue = BigInt.fromI32(120);
    dtf.save();

    // Simulate the "Transfer-first" path that creates a fresh monthly snapshot
    // in a month with no fee events. All cumulatives must inherit running totals.
    let snapshot = getOrCreateTokenMonthlySnapshot(token, makeBlock(SECONDS_PER_MONTH));
    snapshot.save();

    let monthId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "cumulativeRevenue", "500");
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeProtocolRevenue",
      "200"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeGovernanceRevenue",
      "180"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeExternalRevenue",
      "120"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeMintAmount",
      "1000"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeBurnAmount",
      "400"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "currentHolderCount",
      "7"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeHolderCount",
      "10"
    );
  });

  test("non-DTF token: mint cumulative inherits from Token, revenue stays 0", () => {
    let token = createTestToken(ASSET_ADDR);
    token.type = "ASSET";
    token.totalMinted = BigInt.fromI32(7777);
    token.totalBurned = BigInt.fromI32(123);
    token.save();
    // No DTF entity for an asset token

    let snapshot = getOrCreateTokenMonthlySnapshot(token, makeBlock(SECONDS_PER_MONTH * 2));
    snapshot.save();

    let monthId = ASSET_ADDR.toHexString() + "-2";
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeMintAmount",
      "7777"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeBurnAmount",
      "123"
    );
    assert.fieldEquals("TokenMonthlySnapshot", monthId, "cumulativeRevenue", "0");
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeProtocolRevenue",
      "0"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeGovernanceRevenue",
      "0"
    );
    assert.fieldEquals(
      "TokenMonthlySnapshot",
      monthId,
      "cumulativeExternalRevenue",
      "0"
    );
  });

  test("returns existing snapshot without re-init when called twice in same month", () => {
    let token = createTestToken(DTF_ADDR);
    token.totalMinted = BigInt.fromI32(100);
    token.save();
    let dtf = createTestDTF(DTF_ADDR);
    dtf.totalRevenue = BigInt.fromI32(50);
    dtf.save();

    let block = makeBlock(SECONDS_PER_MONTH);

    let first = getOrCreateTokenMonthlySnapshot(token, block);
    // Simulate a fee event that adds to monthlyRevenue
    first.monthlyRevenue = first.monthlyRevenue.plus(BigInt.fromI32(123));
    first.save();

    // Second call in same month should return same entity, untouched delta
    let second = getOrCreateTokenMonthlySnapshot(token, block);
    assert.bigIntEquals(second.monthlyRevenue, BigInt.fromI32(123));
  });
});
