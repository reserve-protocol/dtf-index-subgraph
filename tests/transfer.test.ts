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
import { GENESIS_ADDRESS, BIGINT_ZERO } from "../src/utils/constants";
import { createTestToken } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  getOrCreateAccount,
  getOrCreateAccountBalance,
  increaseAccountBalance,
} from "../src/account/mappings";

const TOKEN_ADDR = Address.fromString(
  "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD"
);
const GENESIS = Address.fromString(GENESIS_ADDRESS);
const ALICE = Address.fromString("0x1111111111111111111111111111111111111111");
const BOB = Address.fromString("0x2222222222222222222222222222222222222222");

// Mock ERC20 at module level (required by getOrCreateToken)
mockERC20(TOKEN_ADDR, "TEST", "Test Token", 18);

function createTransferEvent(logIndex: i32 = 0): ethereum.Event {
  let event = newMockEvent();
  event.address = TOKEN_ADDR;
  event.block.number = BigInt.fromI32(100);
  event.block.timestamp = BigInt.fromI32(86400); // day 1
  event.logIndex = BigInt.fromI32(logIndex);
  return event;
}

describe("_handleTransfer", () => {
  beforeEach(() => {
    clearStore();
  });

  test("zero amount does nothing", () => {
    let event = createTransferEvent();
    _handleTransfer(ALICE, BOB, BIGINT_ZERO, event);

    assert.entityCount("TransferEvent", 0);
  });

  // ---- MINT (from == GENESIS) ----

  test("mint increments totalSupply, mintCount, totalMinted", () => {
    let event = createTransferEvent();
    let amount = BigInt.fromI32(1000);

    _handleTransfer(GENESIS, ALICE, amount, event);

    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "totalSupply", "1000");
    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "mintCount", "1");
    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "totalMinted", "1000");
  });

  test("mint to new account increments currentHolderCount and cumulativeHolderCount", () => {
    let event = createTransferEvent();

    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(100), event);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "cumulativeHolderCount",
      "1"
    );
  });

  test("mint to existing account with 0 balance increments both currentHolderCount and cumulativeHolderCount", () => {
    // Pre-create account so it exists globally, but has never held this token
    let account = getOrCreateAccount(ALICE);
    account.save();

    let event = createTransferEvent();
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(100), event);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );
    // cumulativeHolderCount increments because ALICE has never held THIS token
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "cumulativeHolderCount",
      "1"
    );
  });

  test("mint creates Minting entity", () => {
    let event = createTransferEvent();
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(500), event);

    let mintingId = ALICE.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("Minting", mintingId, "amount", "500");
  });

  test("second mint accumulates Minting amount", () => {
    let event1 = createTransferEvent(0);
    let event2 = createTransferEvent(1);

    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(500), event1);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(300), event2);

    let mintingId = ALICE.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("Minting", mintingId, "amount", "800");
  });

  test("mint creates TransferEvent with type MINT", () => {
    let event = createTransferEvent();
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(100), event);

    let transferEventId =
      TOKEN_ADDR.toHex() +
      "-" +
      event.transaction.hash.toHex() +
      "-0";
    assert.fieldEquals("TransferEvent", transferEventId, "type", "MINT");
    assert.fieldEquals("TransferEvent", transferEventId, "amount", "100");
  });

  test("mint creates daily and hourly snapshots", () => {
    let event = createTransferEvent();
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(250), event);

    let dayId = TOKEN_ADDR.toHexString() + "-1"; // 86400 / 86400 = 1
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyMintCount", "1");
    assert.fieldEquals("TokenDailySnapshot", dayId, "dailyMintAmount", "250");

    let hourId = TOKEN_ADDR.toHexString() + "-24"; // 86400 / 3600 = 24
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlyMintCount", "1");
    assert.fieldEquals("TokenHourlySnapshot", hourId, "hourlyMintAmount", "250");
  });

  // ---- BURN (to == GENESIS) ----

  test("burn decrements totalSupply, increments burnCount and totalBurned", () => {
    // First mint so there's supply and balance
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    // Then burn
    let burnEvent = createTransferEvent(1);
    _handleTransfer(ALICE, GENESIS, BigInt.fromI32(200), burnEvent);

    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "totalSupply", "800");
    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "burnCount", "1");
    assert.fieldEquals("Token", TOKEN_ADDR.toHexString(), "totalBurned", "200");
  });

  test("burn where burner balance equals amount decrements currentHolderCount", () => {
    // Mint 100 to ALICE
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(100), mintEvent);
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );

    // Burn all 100
    let burnEvent = createTransferEvent(1);
    _handleTransfer(ALICE, GENESIS, BigInt.fromI32(100), burnEvent);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "0"
    );
  });

  test("burn with remaining balance does NOT decrement currentHolderCount", () => {
    // Mint 1000 to ALICE
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    // Burn only 200
    let burnEvent = createTransferEvent(1);
    _handleTransfer(ALICE, GENESIS, BigInt.fromI32(200), burnEvent);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );
  });

  test("burn creates TransferEvent with type REDEEM", () => {
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(500), mintEvent);

    let burnEvent = createTransferEvent(1);
    _handleTransfer(ALICE, GENESIS, BigInt.fromI32(100), burnEvent);

    let transferEventId =
      TOKEN_ADDR.toHex() +
      "-" +
      burnEvent.transaction.hash.toHex() +
      "-1";
    assert.fieldEquals("TransferEvent", transferEventId, "type", "REDEEM");
  });

  // ---- TRANSFER ----

  test("transfer increments transferCount", () => {
    // Mint to ALICE first
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    // Transfer to BOB
    let transferEvent = createTransferEvent(1);
    _handleTransfer(ALICE, BOB, BigInt.fromI32(100), transferEvent);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "transferCount",
      "1"
    );
  });

  test("sender becoming non-holder decrements currentHolderCount", () => {
    // Mint to ALICE
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(100), mintEvent);
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );

    // Transfer all to BOB
    let transferEvent = createTransferEvent(1);
    _handleTransfer(ALICE, BOB, BigInt.fromI32(100), transferEvent);

    // ALICE lost holder status, BOB gained it, net change = 0
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "currentHolderCount",
      "1"
    );
  });

  test("new receiver increments cumulativeHolderCount", () => {
    // Mint to ALICE
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);
    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "cumulativeHolderCount",
      "1"
    );

    // Transfer to BOB (new account)
    let transferEvent = createTransferEvent(1);
    _handleTransfer(ALICE, BOB, BigInt.fromI32(100), transferEvent);

    assert.fieldEquals(
      "Token",
      TOKEN_ADDR.toHexString(),
      "cumulativeHolderCount",
      "2"
    );
  });

  test("transfer creates TransferEvent with type TRANSFER", () => {
    let mintEvent = createTransferEvent(0);
    _handleTransfer(GENESIS, ALICE, BigInt.fromI32(1000), mintEvent);

    let transferEvent = createTransferEvent(1);
    _handleTransfer(ALICE, BOB, BigInt.fromI32(100), transferEvent);

    let eventId =
      TOKEN_ADDR.toHex() +
      "-" +
      transferEvent.transaction.hash.toHex() +
      "-1";
    assert.fieldEquals("TransferEvent", eventId, "type", "TRANSFER");
    assert.fieldEquals("TransferEvent", eventId, "amount", "100");
  });
});
