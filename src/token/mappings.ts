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
    // Check if burner becomes a non-holder after burn
    let burnerAccount = getOrCreateAccount(burner);
    let burnerBalance = getOrCreateAccountBalance(burnerAccount, token);
    let burnerBecomesNonHolder = BIGINT_ZERO;
    if (burnerBalance.amount == amount) {
      // Burner will have 0 balance after burn
      burnerBecomesNonHolder = BIGINT_ONE;
    }

    token.totalSupply = token.totalSupply.minus(amount);
    token.burnCount = token.burnCount.plus(BIGINT_ONE);
    token.totalBurned = token.totalBurned.plus(amount);

    // Update holder count if burner becomes non-holder
    token.currentHolderCount = token.currentHolderCount.minus(
      burnerBecomesNonHolder
    );

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
    // Check if receiver is becoming a new holder
    let isReceiverNewAccount = isNewAccount(destination);
    let receiverAccount = getOrCreateAccount(destination);
    let receiverBalance = getOrCreateAccountBalance(receiverAccount, token);

    let receiverBecomesHolder = BIGINT_ZERO;
    if (receiverBalance.amount == BIGINT_ZERO) {
      // Receiver currently has 0 balance, will become a holder
      receiverBecomesHolder = BIGINT_ONE;
    }

    // Update cumulative holder count only if this is truly a new account
    if (isReceiverNewAccount) {
      token.cumulativeHolderCount =
        token.cumulativeHolderCount.plus(BIGINT_ONE);
    }

    token.totalSupply = token.totalSupply.plus(amount);
    token.mintCount = token.mintCount.plus(BIGINT_ONE);
    token.totalMinted = token.totalMinted.plus(amount);

    // Update holder count if receiver becomes a holder
    token.currentHolderCount = token.currentHolderCount.plus(
      receiverBecomesHolder
    );

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
    // Check if sender will have zero balance after transfer
    let senderBecomesNonHolder = BIGINT_ZERO;
    let senderBalance = getOrCreateAccountBalance(
      getOrCreateAccount(source),
      token
    );
    if (senderBalance.amount == amount) {
      // Sender's balance will be 0 after this transfer
      senderBecomesNonHolder = BIGINT_ONE;
    }

    // Check if receiver is becoming a new holder
    let receiverBecomesHolder = BIGINT_ZERO;
    let isReceiverNewAccount = isNewAccount(destination);
    let receiverAccount = getOrCreateAccount(destination);
    let receiverBalance = getOrCreateAccountBalance(receiverAccount, token);

    // Receiver becomes a holder if they currently have 0 balance (regardless of whether they're a new account)
    if (receiverBalance.amount == BIGINT_ZERO) {
      receiverBecomesHolder = BIGINT_ONE;
    }

    // Update cumulative holder count only if this is truly a new account that never held this token
    let toAddressIsNewHolderNum = BIGINT_ZERO;
    if (isReceiverNewAccount) {
      toAddressIsNewHolderNum = BIGINT_ONE;
    }

    // Update current holder count: subtract if sender becomes non-holder, add if receiver becomes holder
    token.currentHolderCount = token.currentHolderCount
      .minus(senderBecomesNonHolder)
      .plus(receiverBecomesHolder);
    token.cumulativeHolderCount = token.cumulativeHolderCount.plus(
      toAddressIsNewHolderNum
    );
    token.transferCount = token.transferCount.plus(BIGINT_ONE);

    let dailySnapshot = getOrCreateTokenDailySnapshot(token, event.block);
    dailySnapshot.currentHolderCount = token.currentHolderCount;
    dailySnapshot.cumulativeHolderCount =
      dailySnapshot.cumulativeHolderCount.plus(toAddressIsNewHolderNum);
    dailySnapshot.dailyEventCount += 1;
    dailySnapshot.dailyTransferCount += 1;
    dailySnapshot.dailyTransferAmount =
      dailySnapshot.dailyTransferAmount.plus(amount);
    dailySnapshot.blockNumber = event.block.number;
    dailySnapshot.timestamp = event.block.timestamp;

    let hourlySnapshot = getOrCreateTokenHourlySnapshot(token, event.block);
    hourlySnapshot.currentHolderCount = token.currentHolderCount;
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
