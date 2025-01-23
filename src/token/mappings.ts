import { ERC20 } from "./../../generated/GovernanceDeployer/ERC20";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  Token,
  TokenDailySnapshot,
  TokenHourlySnapshot,
  TransferEvent,
} from "../../generated/schema";

import {
  BIGINT_ONE,
  BIGINT_ZERO,
  GENESIS_ADDRESS,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
} from "../utils/constants";

import {
  decreaseAccountBalance,
  getOrCreateAccount,
  getOrCreateAccountBalance,
  increaseAccountBalance,
  isNewAccount,
  updateAccountBalanceDailySnapshot,
} from "../account/mappings";
import { getOrCreateToken } from "../utils/getters";

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

function handleBurnEvent(
  token: Token | null,
  amount: BigInt,
  burner: Bytes,
  event: ethereum.Event
): boolean {
  // Track total supply/burned
  if (token != null) {
    let totalSupply = ERC20.bind(event.address).try_totalSupply();
    let currentTotalSupply = totalSupply.reverted
      ? token.totalSupply
      : totalSupply.value;
    //If the totalSupply from contract call equals with the totalSupply stored in token entity, it means the burn event was process before.
    //It happens when the transfer function which transfers to GENESIS_ADDRESS emits both transfer event and burn event.
    if (currentTotalSupply == token.totalSupply) {
      return true;
    }
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
  }
  return false;
}

function handleMintEvent(
  token: Token | null,
  amount: BigInt,
  destination: Bytes,
  event: ethereum.Event
): boolean {
  // Track total token supply/minted
  if (token != null) {
    let totalSupply = ERC20.bind(event.address).try_totalSupply();
    let currentTotalSupply = totalSupply.reverted
      ? token.totalSupply
      : totalSupply.value;
    //If the totalSupply from contract call equals with the totalSupply stored in token entity, it means the mint event was process before.
    //It happens when the transfer function which transfers from GENESIS_ADDRESS emits both transfer event and mint event.
    if (currentTotalSupply == token.totalSupply) {
      return true;
    }
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

function getOrCreateTokenDailySnapshot(
  token: Token,
  block: ethereum.Block
): TokenDailySnapshot {
  let snapshotId =
    token.id + "-" + (block.timestamp.toI64() / SECONDS_PER_DAY).toString();
  let previousSnapshot = TokenDailySnapshot.load(snapshotId);

  if (previousSnapshot != null) {
    return previousSnapshot as TokenDailySnapshot;
  }

  let newSnapshot = new TokenDailySnapshot(snapshotId);
  newSnapshot.token = token.id;
  newSnapshot.dailyTotalSupply = token.totalSupply;
  newSnapshot.currentHolderCount = token.currentHolderCount;
  newSnapshot.cumulativeHolderCount = token.cumulativeHolderCount;
  newSnapshot.dailyEventCount = 0;
  newSnapshot.dailyTransferCount = 0;
  newSnapshot.dailyTransferAmount = BIGINT_ZERO;
  newSnapshot.dailyMintCount = 0;
  newSnapshot.dailyMintAmount = BIGINT_ZERO;
  newSnapshot.dailyBurnCount = 0;
  newSnapshot.dailyBurnAmount = BIGINT_ZERO;

  return newSnapshot;
}

function getOrCreateTokenHourlySnapshot(
  token: Token,
  block: ethereum.Block
): TokenHourlySnapshot {
  let snapshotId =
    token.id + "-" + (block.timestamp.toI64() / SECONDS_PER_HOUR).toString();
  let previousSnapshot = TokenHourlySnapshot.load(snapshotId);

  if (previousSnapshot != null) {
    return previousSnapshot as TokenHourlySnapshot;
  }

  let newSnapshot = new TokenHourlySnapshot(snapshotId);
  newSnapshot.token = token.id;

  newSnapshot.hourlyTotalSupply = token.totalSupply;
  newSnapshot.currentHolderCount = token.currentHolderCount;
  newSnapshot.cumulativeHolderCount = token.cumulativeHolderCount;
  newSnapshot.hourlyEventCount = 0;
  newSnapshot.hourlyTransferCount = 0;
  newSnapshot.hourlyTransferAmount = BIGINT_ZERO;
  newSnapshot.hourlyMintCount = 0;
  newSnapshot.hourlyMintAmount = BIGINT_ZERO;
  newSnapshot.hourlyBurnCount = 0;
  newSnapshot.hourlyBurnAmount = BIGINT_ZERO;

  return newSnapshot;
}
