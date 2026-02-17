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
  _handleSingletonAuctionBid,
  _handleTradeKilled,
} from "../src/dtf/handlers";
import {
  createTestDTF,
  createTestToken,
  createTestAuction,
  createTestTrade,
} from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";

const DTF_ADDR = Address.fromString(
  "0xD577936364733a0f03ef92adf572EB4265Ccc4cc"
);
const SELL_TOKEN = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const BUY_TOKEN = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);
const BIDDER = Address.fromString(
  "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
);

mockERC20(SELL_TOKEN, "SELL", "Sell Token", 18);
mockERC20(BUY_TOKEN, "BUY", "Buy Token", 18);

function createAuctionEvent(
  blockNumber: i32 = 100,
  logIndex: i32 = 0
): ethereum.Event {
  let event = newMockEvent();
  event.block.number = BigInt.fromI32(blockNumber);
  event.block.timestamp = BigInt.fromI32(5000);
  event.logIndex = BigInt.fromI32(logIndex);
  event.transaction.from = BIDDER;
  return event;
}

describe("_handleSingletonAuctionBid", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates RebalanceAuctionBid with correct ID and fields", () => {
    let auctionId = BigInt.fromI32(3);
    let sellAmount = BigInt.fromString("1000000000000000000");
    let buyAmount = BigInt.fromString("500000000000000000");
    let event = createAuctionEvent();

    let bid = _handleSingletonAuctionBid(
      DTF_ADDR,
      auctionId,
      SELL_TOKEN,
      BUY_TOKEN,
      sellAmount,
      buyAmount,
      event
    );

    let expectedId =
      DTF_ADDR.toHexString() +
      "-3-" +
      BIDDER.toHexString() +
      "-100-0";

    assert.fieldEquals("RebalanceAuctionBid", expectedId, "dtf", DTF_ADDR.toHexString());
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "auction",
      DTF_ADDR.toHexString() + "-3"
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "bidder",
      BIDDER.toHexString()
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "sellToken",
      SELL_TOKEN.toHexString()
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "buyToken",
      BUY_TOKEN.toHexString()
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "sellAmount",
      sellAmount.toString()
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "buyAmount",
      buyAmount.toString()
    );
  });
});

describe("_handleTradeKilled", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
  });

  test("when Auction exists, updates endTime to block timestamp", () => {
    let auctionId = BigInt.fromI32(1);
    createTestAuction(DTF_ADDR, auctionId);

    let event = createAuctionEvent();
    _handleTradeKilled(DTF_ADDR, auctionId, event);

    let auctionEntityId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals("Auction", auctionEntityId, "endTime", "5000");
  });

  test("when Auction does not exist, marks Trade as killed", () => {
    let tradeId = BigInt.fromI32(1);
    createTestTrade(DTF_ADDR, tradeId);

    let event = createAuctionEvent();
    _handleTradeKilled(DTF_ADDR, tradeId, event);

    let tradeEntityId = DTF_ADDR.toHexString() + "-1";
    assert.fieldEquals("Trade", tradeEntityId, "isKilled", "true");
    assert.fieldEquals("Trade", tradeEntityId, "state", "CLOSED");
    assert.fieldEquals("Trade", tradeEntityId, "closedTimestamp", "5000");
  });
});
