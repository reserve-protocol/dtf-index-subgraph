import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  Token,
  TokenDailySnapshot,
  TokenHourlySnapshot,
  TokenMonthlySnapshot,
  TransferEvent,
  Minting,
} from "../../generated/schema";

import {
  BIGINT_ONE,
  BIGINT_ZERO,
  GENESIS_ADDRESS,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MONTH,
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

const ERC20_TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
      amount,
      event.block.timestamp
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

    let monthlySnapshot = getOrCreateTokenMonthlySnapshot(token, event.block);
    monthlySnapshot.monthlyTotalSupply = token.totalSupply;
    monthlySnapshot.monthlyBurnAmount = monthlySnapshot.monthlyBurnAmount.plus(amount);
    monthlySnapshot.monthlyBurnCount += 1;
    monthlySnapshot.blockNumber = event.block.number;
    monthlySnapshot.timestamp = event.block.timestamp;

    token.save();
    dailySnapshot.save();
    hourlySnapshot.save();
    monthlySnapshot.save();

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
  destination: Address,
  event: ethereum.Event
): boolean {
  // Track total token supply/minted
  let trueMinter = destination;
  if (token != null) {
    let receipt = event.receipt;
    if (receipt != null) {
      for (let index = 0; index < receipt.logs.length; index++) {
        let log = receipt.logs[index];

        if (log.topics.length < 3) continue;

        let topic0 = log.topics[0].toHexString();
        if (topic0 == ERC20_TRANSFER_EVENT_SIGNATURE) {
          let decodedFrom = ethereum.decode("address", log.topics[1]);
          let decodedTo = ethereum.decode("address", log.topics[2]);
          let decodedAmount = ethereum.decode("uint256", log.data);

          if (decodedFrom == null || decodedTo == null || decodedAmount == null) {
            continue;
          }

          let from = decodedFrom.toAddress();
          let to = decodedTo.toAddress();
          let amountDecoded = decodedAmount.toBigInt();

          if (amountDecoded == amount && from == destination) {
            trueMinter = to;
            break;
          }
        }
      }
    }

    // Handle Minting entity
    let mintingId = trueMinter.toHex() + "-" + token.id;
    let minting = Minting.load(mintingId);
    if (minting == null) {
      minting = new Minting(mintingId);
      let minterAccount = getOrCreateAccount(trueMinter);
      minting.account = minterAccount.id;
      minting.token = token.id;
      minting.amount = BIGINT_ZERO;
      minting.firstMintTimestamp = event.block.timestamp;
    }
    minting.amount = minting.amount.plus(amount);
    minting.save();

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

    let monthlySnapshot = getOrCreateTokenMonthlySnapshot(token, event.block);
    monthlySnapshot.monthlyTotalSupply = token.totalSupply;
    monthlySnapshot.monthlyMintAmount = monthlySnapshot.monthlyMintAmount.plus(amount);
    monthlySnapshot.monthlyMintCount += 1;
    monthlySnapshot.cumulativeMintAmount = token.totalMinted;
    monthlySnapshot.blockNumber = event.block.number;
    monthlySnapshot.timestamp = event.block.timestamp;

    token.save();
    dailySnapshot.save();
    hourlySnapshot.save();
    monthlySnapshot.save();

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
    transferEvent.to = trueMinter.toHex();
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

export function getOrCreateTokenDailySnapshot(
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
  newSnapshot.dailyRevenue = BIGINT_ZERO;
  newSnapshot.dailyProtocolRevenue = BIGINT_ZERO;
  newSnapshot.dailyGovernanceRevenue = BIGINT_ZERO;
  newSnapshot.dailyExternalRevenue = BIGINT_ZERO;

  return newSnapshot;
}

export function getOrCreateTokenHourlySnapshot(
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
  newSnapshot.hourlyRevenue = BIGINT_ZERO;
  newSnapshot.hourlyProtocolRevenue = BIGINT_ZERO;
  newSnapshot.hourlyGovernanceRevenue = BIGINT_ZERO;
  newSnapshot.hourlyExternalRevenue = BIGINT_ZERO;

  return newSnapshot;
}

export function getOrCreateTokenMonthlySnapshot(
  token: Token,
  block: ethereum.Block
): TokenMonthlySnapshot {
  let monthId = block.timestamp.toI64() / SECONDS_PER_MONTH;
  let snapshotId = token.id + "-" + monthId.toString();

  let previousSnapshot = TokenMonthlySnapshot.load(snapshotId);
  if (previousSnapshot != null) {
    return previousSnapshot as TokenMonthlySnapshot;
  }

  let newSnapshot = new TokenMonthlySnapshot(snapshotId);
  newSnapshot.token = token.id;
  newSnapshot.monthlyTotalSupply = token.totalSupply;
  newSnapshot.monthlyMintAmount = BIGINT_ZERO;
  newSnapshot.monthlyMintCount = 0;
  newSnapshot.monthlyBurnAmount = BIGINT_ZERO;
  newSnapshot.monthlyBurnCount = 0;
  newSnapshot.monthlyRevenue = BIGINT_ZERO;
  newSnapshot.monthlyProtocolRevenue = BIGINT_ZERO;
  newSnapshot.monthlyGovernanceRevenue = BIGINT_ZERO;
  newSnapshot.monthlyExternalRevenue = BIGINT_ZERO;
  newSnapshot.cumulativeRevenue = BIGINT_ZERO;
  newSnapshot.cumulativeProtocolRevenue = BIGINT_ZERO;
  newSnapshot.cumulativeMintAmount = BIGINT_ZERO;
  newSnapshot.blockNumber = block.number;
  newSnapshot.timestamp = block.timestamp;

  return newSnapshot;
}
