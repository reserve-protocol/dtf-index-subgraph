import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { Token, TransferEvent } from "../../generated/schema";

import { BIGINT_ONE, BIGINT_ZERO, GENESIS_ADDRESS } from "../utils/constants";

import {
  decreaseAccountBalance,
  getOrCreateAccount,
  getOrCreateAccountBalance,
  increaseAccountBalance,
  isNewAccount,
  updateAccountBalanceDailySnapshot,
} from "../account/mappings";
import {
  getOrCreateToken,
  getOrCreateTokenDailySnapshot,
  getOrCreateTokenHourlySnapshot,
} from "../utils/getters";

export function _handleTransfer(
  from: Address,
  to: Address,
  amount: BigInt,
  event: ethereum.Event
): void {
  let token = getOrCreateToken(event.address);

  if (amount == BIGINT_ZERO) {
    return;
  }

  let isBurn = to.toHex() == GENESIS_ADDRESS;
  let isMint = from.toHex() == GENESIS_ADDRESS;
  let isTransfer = !isBurn && !isMint;
  let isEventProcessed = false;

  if (isBurn) {
    isEventProcessed = handleBurnEvent(token, amount, from, event);
  } else if (isMint) {
    isEventProcessed = handleMintEvent(token, amount, to, event);
  } else {
    // In this case, it will be a normal transfer event.
    handleTransferEvent(token, amount, from, to, event);
  }

  // Updates balances of accounts
  if (isEventProcessed) {
    return;
  }
  if (isTransfer || isBurn) {
    let sourceAccount = getOrCreateAccount(from);

    let accountBalance = decreaseAccountBalance(
      sourceAccount,
      token as Token,
      amount
    );
    accountBalance.blockNumber = event.block.number;
    accountBalance.timestamp = event.block.timestamp;

    sourceAccount.save();
    accountBalance.save();

    // To provide information about evolution of account balances
    updateAccountBalanceDailySnapshot(accountBalance, event);
  }

  if (isTransfer || isMint) {
    let destinationAccount = getOrCreateAccount(to);

    let accountBalance = increaseAccountBalance(
      destinationAccount,
      token as Token,
      amount
    );
    accountBalance.blockNumber = event.block.number;
    accountBalance.timestamp = event.block.timestamp;

    destinationAccount.save();
    accountBalance.save();

    // To provide information about evolution of account balances
    updateAccountBalanceDailySnapshot(accountBalance, event);
  }
}

// TODO: Handle repeated event code
function handleBurnEvent(
  token: Token | null,
  amount: BigInt,
  burner: Bytes,
  event: ethereum.Event
): boolean {
  // Track total supply/burned
  if (token != null) {
    token.totalSupply = token.totalSupply.minus(amount);
    token.burnCount = token.burnCount.plus(BIGINT_ONE);
    token.totalBurned = token.totalBurned.plus(amount);

    let dailySnapshot = getOrCreateTokenDailySnapshot(token, event.block);
    dailySnapshot.dailyTotalSupply = token.totalSupply;
    dailySnapshot.dailyEventCount += 1;
    dailySnapshot.dailyBurnCount += 1;
    dailySnapshot.dailyBurnAmount = dailySnapshot.dailyBurnAmount.plus(amount);
    dailySnapshot.blockNumber = event.block.number;
    dailySnapshot.timestamp = event.block.timestamp;

    let hourlySnapshot = getOrCreateTokenHourlySnapshot(token, event.block);
    hourlySnapshot.hourlyTotalSupply = token.totalSupply;
    hourlySnapshot.hourlyEventCount += 1;
    hourlySnapshot.hourlyBurnCount += 1;
    hourlySnapshot.hourlyBurnAmount =
      hourlySnapshot.hourlyBurnAmount.plus(amount);
    hourlySnapshot.blockNumber = event.block.number;
    hourlySnapshot.timestamp = event.block.timestamp;

    token.save();
    dailySnapshot.save();
    hourlySnapshot.save();

    // Add event
    let transferEvent = new TransferEvent(
      event.address.toHex() +
        "-" +
        event.transaction.hash.toHex() +
        "-" +
        event.logIndex.toString()
    );
    transferEvent.hash = event.transaction.hash.toHex();
    transferEvent.logIndex = event.logIndex.toI32();
    transferEvent.token = event.address.toHex();
    transferEvent.nonce = event.transaction.nonce.toI32();
    transferEvent.amount = amount;
    transferEvent.from = burner.toHex();
    transferEvent.blockNumber = event.block.number;
    transferEvent.timestamp = event.block.timestamp;
    transferEvent.type = "REDEEM";
    transferEvent.save();
  }
  return false;
}

// TODO: Handle repeated event code
function handleMintEvent(
  token: Token | null,
  amount: BigInt,
  destination: Bytes,
  event: ethereum.Event
): boolean {
  // Track total token supply/minted
  if (token != null) {
    token.totalSupply = token.totalSupply.plus(amount);
    token.mintCount = token.mintCount.plus(BIGINT_ONE);
    token.totalMinted = token.totalMinted.plus(amount);

    let dailySnapshot = getOrCreateTokenDailySnapshot(token, event.block);
    dailySnapshot.dailyTotalSupply = token.totalSupply;
    dailySnapshot.dailyEventCount += 1;
    dailySnapshot.dailyMintCount += 1;
    dailySnapshot.dailyMintAmount = dailySnapshot.dailyMintAmount.plus(amount);
    dailySnapshot.blockNumber = event.block.number;
    dailySnapshot.timestamp = event.block.timestamp;

    let hourlySnapshot = getOrCreateTokenHourlySnapshot(token, event.block);
    hourlySnapshot.hourlyTotalSupply = token.totalSupply;
    hourlySnapshot.hourlyEventCount += 1;
    hourlySnapshot.hourlyMintCount += 1;
    hourlySnapshot.hourlyMintAmount =
      hourlySnapshot.hourlyMintAmount.plus(amount);
    hourlySnapshot.blockNumber = event.block.number;
    hourlySnapshot.timestamp = event.block.timestamp;

    token.save();
    dailySnapshot.save();
    hourlySnapshot.save();

    // Add event
    let transferEvent = new TransferEvent(
      event.address.toHex() +
        "-" +
        event.transaction.hash.toHex() +
        "-" +
        event.logIndex.toString()
    );
    transferEvent.hash = event.transaction.hash.toHex();
    transferEvent.logIndex = event.logIndex.toI32();
    transferEvent.token = event.address.toHex();
    transferEvent.nonce = event.transaction.nonce.toI32();
    transferEvent.amount = amount;
    transferEvent.to = destination.toHex();
    transferEvent.blockNumber = event.block.number;
    transferEvent.timestamp = event.block.timestamp;
    transferEvent.type = "MINT";
    transferEvent.save();
  }
  return false;
}

function handleTransferEvent(
  token: Token | null,
  amount: BigInt,
  source: Bytes,
  destination: Bytes,
  event: ethereum.Event
): TransferEvent {
  let transferEvent = new TransferEvent(
    event.address.toHex() +
      "-" +
      event.transaction.hash.toHex() +
      "-" +
      event.logIndex.toString()
  );
  transferEvent.hash = event.transaction.hash.toHex();
  transferEvent.logIndex = event.logIndex.toI32();
  transferEvent.token = event.address.toHex();
  transferEvent.nonce = event.transaction.nonce.toI32();
  transferEvent.amount = amount;
  transferEvent.to = destination.toHex();
  transferEvent.from = source.toHex();
  transferEvent.blockNumber = event.block.number;
  transferEvent.timestamp = event.block.timestamp;
  transferEvent.type = "TRANSFER";
  transferEvent.save();

  // Track total token transferred
  if (token != null) {
    let FromBalanceToZeroNum = BIGINT_ZERO;
    let balance = getOrCreateAccountBalance(getOrCreateAccount(source), token);
    if (balance.amount == amount) {
      // It means the sender's token balance will be 0 after transferal.
      FromBalanceToZeroNum = BIGINT_ONE;
    }

    let toAddressIsNewHolderNum = BIGINT_ZERO;
    let toBalanceIsZeroNum = BIGINT_ZERO;
    if (isNewAccount(destination)) {
      // It means the receiver is a new holder
      toAddressIsNewHolderNum = BIGINT_ONE;
    }
    balance = getOrCreateAccountBalance(getOrCreateAccount(destination), token);
    if (balance.amount == BIGINT_ZERO) {
      // It means the receiver's token balance is 0 before transferal.
      toBalanceIsZeroNum = BIGINT_ONE;
    }

    token.currentHolderCount = token.currentHolderCount
      .minus(FromBalanceToZeroNum)
      .plus(toBalanceIsZeroNum);
    token.cumulativeHolderCount = token.cumulativeHolderCount.plus(
      toAddressIsNewHolderNum
    );
    token.transferCount = token.transferCount.plus(BIGINT_ONE);

    let dailySnapshot = getOrCreateTokenDailySnapshot(token, event.block);
    dailySnapshot.currentHolderCount = dailySnapshot.currentHolderCount
      .minus(FromBalanceToZeroNum)
      .plus(toBalanceIsZeroNum);
    dailySnapshot.cumulativeHolderCount =
      dailySnapshot.cumulativeHolderCount.plus(toAddressIsNewHolderNum);
    dailySnapshot.dailyEventCount += 1;
    dailySnapshot.dailyTransferCount += 1;
    dailySnapshot.dailyTransferAmount =
      dailySnapshot.dailyTransferAmount.plus(amount);
    dailySnapshot.blockNumber = event.block.number;
    dailySnapshot.timestamp = event.block.timestamp;

    let hourlySnapshot = getOrCreateTokenHourlySnapshot(token, event.block);
    hourlySnapshot.currentHolderCount = hourlySnapshot.currentHolderCount
      .minus(FromBalanceToZeroNum)
      .plus(toBalanceIsZeroNum);
    hourlySnapshot.cumulativeHolderCount =
      hourlySnapshot.cumulativeHolderCount.plus(toAddressIsNewHolderNum);
    hourlySnapshot.hourlyEventCount += 1;
    hourlySnapshot.hourlyTransferCount += 1;
    hourlySnapshot.hourlyTransferAmount =
      hourlySnapshot.hourlyTransferAmount.plus(amount);
    hourlySnapshot.blockNumber = event.block.number;
    hourlySnapshot.timestamp = event.block.timestamp;

    token.save();
    dailySnapshot.save();
    hourlySnapshot.save();
  }

  return transferEvent;
}
