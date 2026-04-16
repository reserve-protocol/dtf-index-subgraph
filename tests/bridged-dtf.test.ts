import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { _handleTransfer } from "../src/token/mappings";
import { getOrCreateToken } from "../src/utils/getters";
import { GENESIS_ADDRESS, TokenType } from "../src/utils/constants";
import { mockERC20 } from "./helpers/mock-erc20";

const BRIDGED_ADDR = Address.fromString(
  "0xa0A8481fc246Cd12f75227aBB96220fF5360fad3"
);
const GENESIS = Address.fromString(GENESIS_ADDRESS);
const ALICE = Address.fromString("0x1111111111111111111111111111111111111111");
const BOB = Address.fromString("0x2222222222222222222222222222222222222222");

mockERC20(BRIDGED_ADDR, "CMC20", "CoinMarketCap 20 Index DTF", 18);

function createTransferEvent(logIndex: i32 = 0): ethereum.Event {
  let event = newMockEvent();
  event.address = BRIDGED_ADDR;
  event.block.number = BigInt.fromI32(38479300);
  event.block.timestamp = BigInt.fromI32(86400);
  event.logIndex = BigInt.fromI32(logIndex);
  return event;
}

// These tests mirror what handleBridgedDTFTransfer does: ensure Token.type
// is BRIDGED_DTF on first sight, then delegate to _handleTransfer so that
// Account.transferTo/transferFrom/balancesSnapshot are populated normally.
describe("bridged DTF transfer handling", () => {
  beforeEach(() => {
    clearStore();
  });

  test("first sight creates Token with type BRIDGED_DTF", () => {
    getOrCreateToken(BRIDGED_ADDR, TokenType.BRIDGED_DTF);

    assert.fieldEquals(
      "Token",
      BRIDGED_ADDR.toHexString(),
      "type",
      "BRIDGED_DTF"
    );
    assert.fieldEquals(
      "Token",
      BRIDGED_ADDR.toHexString(),
      "symbol",
      "CMC20"
    );
    assert.fieldEquals("Token", BRIDGED_ADDR.toHexString(), "decimals", "18");
  });

  test("second call does not overwrite existing type", () => {
    getOrCreateToken(BRIDGED_ADDR, TokenType.BRIDGED_DTF);
    getOrCreateToken(BRIDGED_ADDR, TokenType.ASSET);

    assert.fieldEquals(
      "Token",
      BRIDGED_ADDR.toHexString(),
      "type",
      "BRIDGED_DTF"
    );
  });

  test("mint populates AccountBalance and TransferEvent", () => {
    getOrCreateToken(BRIDGED_ADDR, TokenType.BRIDGED_DTF);

    let event = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), event);

    let balanceId = ALICE.toHex() + "-" + BRIDGED_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "amount", "1000");

    let transferEventId =
      BRIDGED_ADDR.toHex() +
      "-" +
      event.transaction.hash.toHex() +
      "-0";
    assert.fieldEquals("TransferEvent", transferEventId, "type", "MINT");
    assert.fieldEquals("TransferEvent", transferEventId, "to", ALICE.toHex());
  });

  test("transfer populates AccountBalance for sender and receiver plus daily snapshot", () => {
    getOrCreateToken(BRIDGED_ADDR, TokenType.BRIDGED_DTF);

    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    let transferEvent = createTransferEvent(1);
    _handleTransfer(ALICE, BOB, BigInt.fromI32(300), transferEvent);

    let aliceBalance = ALICE.toHex() + "-" + BRIDGED_ADDR.toHexString();
    let bobBalance = BOB.toHex() + "-" + BRIDGED_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", aliceBalance, "amount", "700");
    assert.fieldEquals("AccountBalance", bobBalance, "amount", "300");

    // AccountBalanceDailySnapshot ids are "<account>-<token>-<day>"
    let dayIndex = "1"; // timestamp 86400 / SECONDS_PER_DAY = 1
    let aliceSnapshotId =
      ALICE.toHex() + "-" + BRIDGED_ADDR.toHexString() + "-" + dayIndex;
    let bobSnapshotId =
      BOB.toHex() + "-" + BRIDGED_ADDR.toHexString() + "-" + dayIndex;
    assert.fieldEquals(
      "AccountBalanceDailySnapshot",
      aliceSnapshotId,
      "amount",
      "700"
    );
    assert.fieldEquals(
      "AccountBalanceDailySnapshot",
      bobSnapshotId,
      "amount",
      "300"
    );

    let eventId =
      BRIDGED_ADDR.toHex() +
      "-" +
      transferEvent.transaction.hash.toHex() +
      "-1";
    assert.fieldEquals("TransferEvent", eventId, "type", "TRANSFER");
    assert.fieldEquals("TransferEvent", eventId, "from", ALICE.toHex());
    assert.fieldEquals("TransferEvent", eventId, "to", BOB.toHex());
  });

  test("burn decrements balance and emits REDEEM event", () => {
    getOrCreateToken(BRIDGED_ADDR, TokenType.BRIDGED_DTF);

    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    let burnEvent = createTransferEvent(1);
    _handleTransfer(ALICE, GENESIS, BigInt.fromI32(400), burnEvent);

    let balanceId = ALICE.toHex() + "-" + BRIDGED_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "amount", "600");

    let eventId =
      BRIDGED_ADDR.toHex() +
      "-" +
      burnEvent.transaction.hash.toHex() +
      "-1";
    assert.fieldEquals("TransferEvent", eventId, "type", "REDEEM");
  });
});
