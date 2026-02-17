import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  describe,
  test,
  assert,
} from "matchstick-as/assembly/index";
import { getAuctionBidsFromReceipt } from "../src/utils/rebalance";
import {
  buildTransferLog,
  buildNonTransferLog,
  buildReceipt,
} from "./helpers/mock-receipts";

const DTF = Address.fromString("0xD577936364733a0f03ef92adf572EB4265Ccc4cc");
const TOKEN_A = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const TOKEN_B = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);
const TOKEN_C = Address.fromString(
  "0x3333333333333333333333333333333333333333"
);
const TOKEN_D = Address.fromString(
  "0x4444444444444444444444444444444444444444"
);
const FILLER = Address.fromString(
  "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
);
const RANDOM = Address.fromString(
  "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
);

describe("getAuctionBidsFromReceipt", () => {
  test("returns empty array for receipt with no logs", () => {
    let receipt = buildReceipt(new Array<ethereum.Log>());
    let bids = getAuctionBidsFromReceipt(DTF, receipt);
    assert.i32Equals(0, bids.length);
  });

  test("returns empty array when no Transfer logs exist", () => {
    let logs = new Array<ethereum.Log>();
    logs.push(buildNonTransferLog(BigInt.fromI32(0)));
    logs.push(buildNonTransferLog(BigInt.fromI32(1)));
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);
    assert.i32Equals(0, bids.length);
  });

  test("returns empty array when transfers dont involve DTF", () => {
    let logs = new Array<ethereum.Log>();
    logs.push(
      buildTransferLog(TOKEN_A, RANDOM, FILLER, BigInt.fromI32(100), BigInt.fromI32(0))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);
    assert.i32Equals(0, bids.length);
  });

  test("single sell and buy produces one bid", () => {
    let logs = new Array<ethereum.Log>();
    // DTF sells TOKEN_A to FILLER
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(1000), BigInt.fromI32(0))
    );
    // FILLER sends TOKEN_B to DTF
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(500), BigInt.fromI32(1))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(1, bids.length);
    assert.addressEquals(TOKEN_A, bids[0].sellToken);
    assert.bigIntEquals(BigInt.fromI32(1000), bids[0].sellAmount);
    assert.addressEquals(TOKEN_B, bids[0].buyToken);
    assert.bigIntEquals(BigInt.fromI32(500), bids[0].buyAmount);
  });

  test("consecutive sells of same token are aggregated", () => {
    let logs = new Array<ethereum.Log>();
    // Two consecutive sells of TOKEN_A
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(100), BigInt.fromI32(0))
    );
    logs.push(
      buildTransferLog(TOKEN_A, DTF, RANDOM, BigInt.fromI32(200), BigInt.fromI32(1))
    );
    // Buy TOKEN_B
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(50), BigInt.fromI32(2))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(1, bids.length);
    assert.bigIntEquals(BigInt.fromI32(300), bids[0].sellAmount);
    assert.bigIntEquals(BigInt.fromI32(50), bids[0].buyAmount);
  });

  test("sell token refund nets against sell amount", () => {
    let logs = new Array<ethereum.Log>();
    // DTF sells 1000 TOKEN_A
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(1000), BigInt.fromI32(0))
    );
    // 200 TOKEN_A refunded back to DTF
    logs.push(
      buildTransferLog(TOKEN_A, FILLER, DTF, BigInt.fromI32(200), BigInt.fromI32(1))
    );
    // Buy 500 TOKEN_B
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(500), BigInt.fromI32(2))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(1, bids.length);
    // Net sell = 1000 - 200 = 800
    assert.bigIntEquals(BigInt.fromI32(800), bids[0].sellAmount);
    assert.bigIntEquals(BigInt.fromI32(500), bids[0].buyAmount);
  });

  test("only sells with no buy produces no bid", () => {
    let logs = new Array<ethereum.Log>();
    // DTF sells TOKEN_A but nothing comes back
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(1000), BigInt.fromI32(0))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(0, bids.length);
  });

  test("multiple sell-buy pairs produce multiple bids", () => {
    let logs = new Array<ethereum.Log>();
    // First trade: sell TOKEN_A, buy TOKEN_B
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(100), BigInt.fromI32(0))
    );
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(50), BigInt.fromI32(1))
    );
    // Second trade: sell TOKEN_C, buy TOKEN_D
    logs.push(
      buildTransferLog(TOKEN_C, DTF, FILLER, BigInt.fromI32(200), BigInt.fromI32(2))
    );
    logs.push(
      buildTransferLog(TOKEN_D, FILLER, DTF, BigInt.fromI32(80), BigInt.fromI32(3))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(2, bids.length);
    assert.addressEquals(TOKEN_A, bids[0].sellToken);
    assert.bigIntEquals(BigInt.fromI32(100), bids[0].sellAmount);
    assert.addressEquals(TOKEN_B, bids[0].buyToken);
    assert.bigIntEquals(BigInt.fromI32(50), bids[0].buyAmount);
    assert.addressEquals(TOKEN_C, bids[1].sellToken);
    assert.bigIntEquals(BigInt.fromI32(200), bids[1].sellAmount);
    assert.addressEquals(TOKEN_D, bids[1].buyToken);
    assert.bigIntEquals(BigInt.fromI32(80), bids[1].buyAmount);
  });

  test("buy token arriving in multiple parts is aggregated", () => {
    let logs = new Array<ethereum.Log>();
    // Sell
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(100), BigInt.fromI32(0))
    );
    // Buy in two parts
    logs.push(
      buildTransferLog(TOKEN_B, RANDOM, DTF, BigInt.fromI32(30), BigInt.fromI32(1))
    );
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(20), BigInt.fromI32(2))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(1, bids.length);
    assert.bigIntEquals(BigInt.fromI32(50), bids[0].buyAmount);
  });

  test("unrelated transfers between bid pairs are skipped", () => {
    let logs = new Array<ethereum.Log>();
    // Sell
    logs.push(
      buildTransferLog(TOKEN_A, DTF, FILLER, BigInt.fromI32(1000), BigInt.fromI32(0))
    );
    // Unrelated transfer (neither from nor to DTF but same token - won't be picked up)
    logs.push(
      buildTransferLog(TOKEN_A, RANDOM, FILLER, BigInt.fromI32(999), BigInt.fromI32(1))
    );
    // Buy
    logs.push(
      buildTransferLog(TOKEN_B, FILLER, DTF, BigInt.fromI32(500), BigInt.fromI32(2))
    );
    let receipt = buildReceipt(logs);
    let bids = getAuctionBidsFromReceipt(DTF, receipt);

    assert.i32Equals(1, bids.length);
    assert.bigIntEquals(BigInt.fromI32(1000), bids[0].sellAmount);
    assert.bigIntEquals(BigInt.fromI32(500), bids[0].buyAmount);
  });
});
