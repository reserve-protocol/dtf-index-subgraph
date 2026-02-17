import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
} from "matchstick-as/assembly/index";
import {
  getOrCreateAccount,
  getOrCreateAccountBalance,
  increaseAccountBalance,
  decreaseAccountBalance,
} from "../src/account/mappings";
import { createTestToken } from "./helpers/mock-entities";

const TOKEN_ADDR = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const ACCOUNT_ADDR = Address.fromString(
  "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
);

describe("increaseAccountBalance", () => {
  beforeEach(() => {
    clearStore();
    createTestToken(TOKEN_ADDR);
  });

  test("sets firstHoldTimestamp on first increase from 0", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);
    let timestamp = BigInt.fromI32(5000);

    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      timestamp
    );
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "firstHoldTimestamp", "5000");
  });

  test("does NOT overwrite firstHoldTimestamp on subsequent increase after going to 0", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    // First hold
    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      BigInt.fromI32(1000)
    );
    balance.save();

    // Decrease to 0
    balance = decreaseAccountBalance(account, token, BigInt.fromI32(100));
    balance.save();

    // Increase again
    balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(50),
      BigInt.fromI32(9999)
    );
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    // firstHoldTimestamp should still be the original
    assert.fieldEquals(
      "AccountBalance",
      balanceId,
      "firstHoldTimestamp",
      "1000"
    );
  });

  test("sets currentHoldStartTimestamp when going from 0 to positive", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      BigInt.fromI32(3000)
    );
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals(
      "AccountBalance",
      balanceId,
      "currentHoldStartTimestamp",
      "3000"
    );
  });

  test("does NOT update currentHoldStartTimestamp when balance already positive", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    // First increase
    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      BigInt.fromI32(3000)
    );
    balance.save();

    // Second increase (balance already positive)
    balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(50),
      BigInt.fromI32(4000)
    );
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    // Should still be original timestamp
    assert.fieldEquals(
      "AccountBalance",
      balanceId,
      "currentHoldStartTimestamp",
      "3000"
    );
  });
});

describe("decreaseAccountBalance", () => {
  beforeEach(() => {
    clearStore();
    createTestToken(TOKEN_ADDR);
  });

  test("clamps to 0 if decrease exceeds balance", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    // Increase to 50
    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(50),
      BigInt.fromI32(1000)
    );
    balance.save();

    // Decrease by 100 (more than balance)
    balance = decreaseAccountBalance(account, token, BigInt.fromI32(100));
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "amount", "0");
  });

  test("clears currentHoldStartTimestamp when balance reaches 0", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      BigInt.fromI32(1000)
    );
    balance.save();

    balance = decreaseAccountBalance(account, token, BigInt.fromI32(100));
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "amount", "0");
    assert.fieldEquals(
      "AccountBalance",
      balanceId,
      "currentHoldStartTimestamp",
      "null"
    );
  });

  test("preserves currentHoldStartTimestamp when balance stays positive", () => {
    let account = getOrCreateAccount(ACCOUNT_ADDR);
    account.save();
    let token = createTestToken(TOKEN_ADDR);

    let balance = increaseAccountBalance(
      account,
      token,
      BigInt.fromI32(100),
      BigInt.fromI32(1000)
    );
    balance.save();

    balance = decreaseAccountBalance(account, token, BigInt.fromI32(50));
    balance.save();

    let balanceId = ACCOUNT_ADDR.toHex() + "-" + TOKEN_ADDR.toHexString();
    assert.fieldEquals("AccountBalance", balanceId, "amount", "50");
    assert.fieldEquals(
      "AccountBalance",
      balanceId,
      "currentHoldStartTimestamp",
      "1000"
    );
  });
});
