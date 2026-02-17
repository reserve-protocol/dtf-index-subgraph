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
  _handleRebalanceStartedV4,
  _handleRebalanceStartedV5,
  _handleRebalanceEnded,
} from "../src/dtf/handlers";
import {
  RebalanceStartedWeightsStruct,
  RebalanceStartedPricesStruct,
  RebalanceStartedLimitsStruct,
  RebalanceStarted1TokensStruct,
  RebalanceStarted1TokensWeightStruct,
  RebalanceStarted1TokensPriceStruct,
  RebalanceStarted1LimitsStruct,
} from "../generated/templates/DTF/DTF";
import { BIGINT_ZERO } from "../src/utils/constants";
import { createTestDTF, createTestToken, createTestRebalance } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";

const DTF_ADDR = Address.fromString(
  "0xD577936364733a0f03ef92adf572EB4265Ccc4cc"
);
const TOKEN_A = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const TOKEN_B = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);

// Mock ERC20 for tokens used in rebalance
mockERC20(TOKEN_A, "TKA", "Token A", 18);
mockERC20(TOKEN_B, "TKB", "Token B", 18);

function createRebalanceEvent(
  timestamp: i32 = 1000,
  blockNumber: i32 = 100
): ethereum.Event {
  let event = newMockEvent();
  event.block.number = BigInt.fromI32(blockNumber);
  event.block.timestamp = BigInt.fromI32(timestamp);
  return event;
}

function buildWeights(low: i32, spot: i32, high: i32): RebalanceStartedWeightsStruct {
  let w = new RebalanceStartedWeightsStruct();
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(spot)));
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return w;
}

function buildPrices(low: i32, high: i32): RebalanceStartedPricesStruct {
  let p = new RebalanceStartedPricesStruct();
  p.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  p.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return p;
}

function buildLimits(low: i32, spot: i32, high: i32): RebalanceStartedLimitsStruct {
  let l = new RebalanceStartedLimitsStruct();
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(spot)));
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return l;
}

describe("_handleRebalanceStartedV4", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
  });

  test("creates Rebalance with correct fields", () => {
    let tokens: Address[] = [TOKEN_A, TOKEN_B];
    let weights: RebalanceStartedWeightsStruct[] = [
      buildWeights(10, 50, 90),
      buildWeights(20, 60, 80),
    ];
    let prices: RebalanceStartedPricesStruct[] = [
      buildPrices(100, 200),
      buildPrices(300, 400),
    ];
    let limits = buildLimits(1, 5, 10);
    let event = createRebalanceEvent();

    _handleRebalanceStartedV4(
      DTF_ADDR,
      BIGINT_ZERO, // nonce 0
      1, // priceControl
      tokens,
      weights,
      prices,
      limits,
      BigInt.fromI32(500), // restrictedUntil
      BigInt.fromI32(9999), // availableUntil
      event
    );

    let id = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", id, "dtf", DTF_ADDR.toHexString());
    assert.fieldEquals("Rebalance", id, "nonce", "0");
    assert.fieldEquals("Rebalance", id, "restrictedUntil", "500");
    assert.fieldEquals("Rebalance", id, "availableUntil", "9999");
  });

  test("nonce 0 does NOT auto-close anything", () => {
    let event = createRebalanceEvent();
    let tokens: Address[] = [TOKEN_A];
    let weights: RebalanceStartedWeightsStruct[] = [buildWeights(10, 50, 90)];
    let prices: RebalanceStartedPricesStruct[] = [buildPrices(100, 200)];
    let limits = buildLimits(1, 5, 10);

    _handleRebalanceStartedV4(
      DTF_ADDR,
      BIGINT_ZERO,
      1,
      tokens,
      weights,
      prices,
      limits,
      BigInt.fromI32(500),
      BigInt.fromI32(9999),
      event
    );

    // Only 1 rebalance should exist
    assert.entityCount("Rebalance", 1);
  });

  test("nonce > 0 auto-closes previous rebalance", () => {
    // Create an existing rebalance with nonce 0 and far-future availableUntil
    createTestRebalance(DTF_ADDR, BIGINT_ZERO, BigInt.fromI32(999999));

    let event = createRebalanceEvent(5000);
    let tokens: Address[] = [TOKEN_A];
    let weights: RebalanceStartedWeightsStruct[] = [buildWeights(10, 50, 90)];
    let prices: RebalanceStartedPricesStruct[] = [buildPrices(100, 200)];
    let limits = buildLimits(1, 5, 10);

    _handleRebalanceStartedV4(
      DTF_ADDR,
      BigInt.fromI32(1), // nonce 1
      1,
      tokens,
      weights,
      prices,
      limits,
      BigInt.fromI32(500),
      BigInt.fromI32(9999),
      event
    );

    // Old rebalance (nonce 0) should have availableUntil set to event timestamp
    let oldId = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", oldId, "availableUntil", "5000");
  });
});

// V5 struct builders
function buildV5Weight(low: i32, spot: i32, high: i32): RebalanceStarted1TokensWeightStruct {
  let w = new RebalanceStarted1TokensWeightStruct();
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(spot)));
  w.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return w;
}

function buildV5Price(low: i32, high: i32): RebalanceStarted1TokensPriceStruct {
  let p = new RebalanceStarted1TokensPriceStruct();
  p.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  p.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return p;
}

function buildV5Limits(low: i32, spot: i32, high: i32): RebalanceStarted1LimitsStruct {
  let l = new RebalanceStarted1LimitsStruct();
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(low)));
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(spot)));
  l.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(high)));
  return l;
}

function buildV5Token(
  token: Address,
  wLow: i32, wSpot: i32, wHigh: i32,
  pLow: i32, pHigh: i32,
  maxAuctionSize: i32,
  inRebalance: boolean
): RebalanceStarted1TokensStruct {
  let t = new RebalanceStarted1TokensStruct();
  t.push(ethereum.Value.fromAddress(token));
  t.push(ethereum.Value.fromTuple(buildV5Weight(wLow, wSpot, wHigh)));
  t.push(ethereum.Value.fromTuple(buildV5Price(pLow, pHigh)));
  t.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(maxAuctionSize)));
  t.push(ethereum.Value.fromBoolean(inRebalance));
  return t;
}

describe("_handleRebalanceStartedV5", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
  });

  test("creates Rebalance with V5-specific fields", () => {
    let tokens: RebalanceStarted1TokensStruct[] = [
      buildV5Token(TOKEN_A, 10, 50, 90, 100, 200, 5000, true),
      buildV5Token(TOKEN_B, 20, 60, 80, 300, 400, 8000, false),
    ];
    let limits = buildV5Limits(1, 5, 10);
    let event = createRebalanceEvent();

    _handleRebalanceStartedV5(
      DTF_ADDR,
      BIGINT_ZERO,
      1,
      tokens,
      limits,
      BigInt.fromI32(900),   // startedAt
      BigInt.fromI32(500),   // restrictedUntil
      BigInt.fromI32(9999),  // availableUntil
      true,                  // bidsEnabled
      event
    );

    let id = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", id, "startedAt", "900");
    assert.fieldEquals("Rebalance", id, "bidsEnabled", "true");
    // maxAuctionSize is an array: [5000, 8000]
    assert.fieldEquals("Rebalance", id, "maxAuctionSize", "[5000, 8000]");
    // inRebalance is a boolean array: [true, false]
    assert.fieldEquals("Rebalance", id, "inRebalance", "[true, false]");
  });

  test("populates weight and price arrays from nested structs", () => {
    let tokens: RebalanceStarted1TokensStruct[] = [
      buildV5Token(TOKEN_A, 10, 50, 90, 100, 200, 5000, true),
    ];
    let limits = buildV5Limits(1, 5, 10);
    let event = createRebalanceEvent();

    _handleRebalanceStartedV5(
      DTF_ADDR,
      BIGINT_ZERO,
      1,
      tokens,
      limits,
      BigInt.fromI32(900),
      BigInt.fromI32(500),
      BigInt.fromI32(9999),
      true,
      event
    );

    let id = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", id, "weightLowLimit", "[10]");
    assert.fieldEquals("Rebalance", id, "weightSpotLimit", "[50]");
    assert.fieldEquals("Rebalance", id, "weightHighLimit", "[90]");
    assert.fieldEquals("Rebalance", id, "priceLowLimit", "[100]");
    assert.fieldEquals("Rebalance", id, "priceHighLimit", "[200]");
    assert.fieldEquals("Rebalance", id, "rebalanceLowLimit", "1");
    assert.fieldEquals("Rebalance", id, "rebalanceSpotLimit", "5");
    assert.fieldEquals("Rebalance", id, "rebalanceHighLimit", "10");
  });

  test("nonce > 0 auto-closes previous rebalance", () => {
    createTestRebalance(DTF_ADDR, BIGINT_ZERO, BigInt.fromI32(999999));

    let tokens: RebalanceStarted1TokensStruct[] = [
      buildV5Token(TOKEN_A, 10, 50, 90, 100, 200, 5000, true),
    ];
    let limits = buildV5Limits(1, 5, 10);
    let event = createRebalanceEvent(5000);

    _handleRebalanceStartedV5(
      DTF_ADDR,
      BigInt.fromI32(1), // nonce 1
      1,
      tokens,
      limits,
      BigInt.fromI32(900),
      BigInt.fromI32(500),
      BigInt.fromI32(9999),
      true,
      event
    );

    let oldId = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", oldId, "availableUntil", "5000");
  });
});

describe("_handleRebalanceEnded", () => {
  beforeEach(() => {
    clearStore();
  });

  test("updates availableUntil when rebalance exists and is still active", () => {
    createTestRebalance(DTF_ADDR, BIGINT_ZERO, BigInt.fromI32(999999));

    let event = createRebalanceEvent(5000);
    _handleRebalanceEnded(DTF_ADDR, BIGINT_ZERO, event);

    let id = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", id, "availableUntil", "5000");
  });

  test("does nothing if rebalance does not exist", () => {
    // No rebalance in store, should not crash
    let event = createRebalanceEvent();
    _handleRebalanceEnded(DTF_ADDR, BIGINT_ZERO, event);
    assert.entityCount("Rebalance", 0);
  });

  test("does nothing if rebalance already expired", () => {
    // Rebalance with availableUntil=100, event at timestamp=200
    createTestRebalance(DTF_ADDR, BIGINT_ZERO, BigInt.fromI32(100));

    let event = createRebalanceEvent(200);
    _handleRebalanceEnded(DTF_ADDR, BIGINT_ZERO, event);

    // availableUntil should be unchanged (100, not 200)
    let id = DTF_ADDR.toHexString() + "-" + BIGINT_ZERO.toHexString();
    assert.fieldEquals("Rebalance", id, "availableUntil", "100");
  });
});
