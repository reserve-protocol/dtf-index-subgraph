import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { AuctionBid, DTF, Trade } from "../../generated/schema";
import {
  AuctionApprovedAuctionStruct,
  AuctionOpenedAuctionStruct,
} from "../../generated/templates/DTF/DTF";
import { Governor } from "../../generated/templates/Governance/Governor";
import { getGovernance } from "../governance/handlers";
import { removeFromArrayAtIndex } from "../utils/arrays";
import { BIGINT_ZERO, GovernanceType, TradeState } from "../utils/constants";
import { createGovernanceTimelock, getOrCreateToken } from "../utils/getters";
import {
  AuctionApproved1AuctionStruct,
  AuctionApproved1DetailsStruct,
  AuctionOpened1AuctionStruct,
  DTF as DTFContract,
  FeeRecipientsSetRecipientsStruct,
} from "./../../generated/templates/DTF/DTF";
// TRADES
export function _handleTradeApproved(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: AuctionApprovedAuctionStruct,
  availableRuns: BigInt,
  event: ethereum.Event
): void {
  let trade = new Trade(`${dtfAddress.toHexString()}-${tradeId.toString()}`);

  trade.dtf = dtfAddress.toHexString();
  trade.soldAmount = BIGINT_ZERO;
  trade.boughtAmount = BIGINT_ZERO;
  trade.startPrice = tradeData.prices.start;
  trade.endPrice = tradeData.prices.end;
  trade.sellLimitSpot = tradeData.sellLimit.spot;
  trade.sellLimitHigh = tradeData.sellLimit.high;
  trade.sellLimitLow = tradeData.sellLimit.low;
  trade.buyLimitSpot = tradeData.buyLimit.spot;
  trade.buyLimitHigh = tradeData.buyLimit.high;
  trade.buyLimitLow = tradeData.buyLimit.low;
  trade.approvedSellLimitSpot = tradeData.sellLimit.spot;
  trade.approvedBuyLimitSpot = tradeData.buyLimit.spot;
  trade.approvedStartPrice = tradeData.prices.start;
  trade.approvedEndPrice = tradeData.prices.end;
  trade.start = BIGINT_ZERO;
  trade.end = BIGINT_ZERO;
  trade.approvedTimestamp = event.block.timestamp;
  trade.approvedBlockNumber = event.block.number;
  trade.approvedTransactionHash = event.transaction.hash.toHexString();
  trade.launchedTimestamp = BIGINT_ZERO;
  trade.launchedBlockNumber = BIGINT_ZERO;
  trade.launchedTransactionHash = "";
  trade.closedTimestamp = BIGINT_ZERO;
  trade.closedBlockNumber = BIGINT_ZERO;
  trade.closedTransactionHash = "";
  trade.isKilled = false;
  trade.availableRuns = availableRuns;
  trade.state = TradeState.APPROVED;
  trade.availableAt = tradeData.availableAt;
  trade.launchTimeout = tradeData.launchTimeout;
  trade.sell = getOrCreateToken(tradeData.sell).id;
  trade.buy = getOrCreateToken(tradeData.buy).id;

  trade.save();
}

export function _handleTradeApproved1(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: AuctionApproved1AuctionStruct,
  tradeDetails: AuctionApproved1DetailsStruct,
  event: ethereum.Event
): void {
  let trade = new Trade(`${dtfAddress.toHexString()}-${tradeId.toString()}`);

  trade.dtf = dtfAddress.toHexString();
  trade.soldAmount = BIGINT_ZERO;
  trade.boughtAmount = BIGINT_ZERO;
  trade.startPrice = tradeDetails.initialPrices.start;
  trade.endPrice = tradeDetails.initialPrices.end;
  trade.sellLimitSpot = tradeData.sellLimit.spot;
  trade.sellLimitHigh = tradeData.sellLimit.high;
  trade.sellLimitLow = tradeData.sellLimit.low;
  trade.buyLimitSpot = tradeData.buyLimit.spot;
  trade.buyLimitHigh = tradeData.buyLimit.high;
  trade.buyLimitLow = tradeData.buyLimit.low;
  trade.approvedSellLimitSpot = tradeData.sellLimit.spot;
  trade.approvedBuyLimitSpot = tradeData.buyLimit.spot;
  trade.approvedStartPrice = tradeDetails.initialPrices.start;
  trade.approvedEndPrice = tradeDetails.initialPrices.end;
  trade.start = BIGINT_ZERO;
  trade.end = BIGINT_ZERO;
  trade.approvedTimestamp = event.block.timestamp;
  trade.approvedBlockNumber = event.block.number;
  trade.approvedTransactionHash = event.transaction.hash.toHexString();
  trade.launchedTimestamp = BIGINT_ZERO;
  trade.launchedBlockNumber = BIGINT_ZERO;
  trade.launchedTransactionHash = "";
  trade.closedTimestamp = BIGINT_ZERO;
  trade.closedBlockNumber = BIGINT_ZERO;
  trade.closedTransactionHash = "";
  trade.isKilled = false;
  trade.availableRuns = tradeDetails.availableRuns;
  trade.state = TradeState.APPROVED;
  // diff
  trade.availableAt = tradeData.restrictedUntil;
  trade.launchTimeout = tradeData.launchDeadline;
  trade.buy = getOrCreateToken(tradeData.buyToken).id;
  trade.sell = getOrCreateToken(tradeData.sellToken).id;

  trade.save();
}

// TODO: Missing updated spots
export function _handleTradeLaunched(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: AuctionOpenedAuctionStruct,
  runsRemaining: BigInt,
  event: ethereum.Event
): void {
  let trade = getTrade(dtfAddress, tradeId);
  trade.startPrice = tradeData.prices.start;
  trade.endPrice = tradeData.prices.end;
  trade.sellLimitSpot = tradeData.sellLimit.spot;
  trade.buyLimitSpot = tradeData.buyLimit.spot;
  trade.launchedTimestamp = event.block.timestamp;
  trade.launchedBlockNumber = event.block.number;
  trade.launchedTransactionHash = event.transaction.hash.toHexString();
  trade.availableRuns = runsRemaining;
  trade.state = TradeState.LAUNCHED;
  trade.start = tradeData.start;
  trade.end = tradeData.end;

  trade.save();
}

export function _handleTradeLaunched1(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: AuctionOpened1AuctionStruct,
  runsRemaining: BigInt,
  event: ethereum.Event
): void {
  let trade = getTrade(dtfAddress, tradeId);
  trade.startPrice = tradeData.prices.start;
  trade.endPrice = tradeData.prices.end;
  trade.sellLimitSpot = tradeData.sellLimit.spot;
  trade.buyLimitSpot = tradeData.buyLimit.spot;
  trade.launchedTimestamp = event.block.timestamp;
  trade.launchedBlockNumber = event.block.number;
  trade.launchedTransactionHash = event.transaction.hash.toHexString();
  trade.availableRuns = runsRemaining;
  trade.state = TradeState.LAUNCHED;
  trade.start = tradeData.startTime;
  trade.end = tradeData.endTime;

  trade.save();
}

export function _handleBid(
  dtfAddress: Address,
  tradeId: BigInt,
  sellAmount: BigInt,
  buyAmount: BigInt,
  event: ethereum.Event
): void {
  let trade = getTrade(dtfAddress, tradeId);
  trade.soldAmount = trade.soldAmount.plus(sellAmount);
  trade.boughtAmount = trade.boughtAmount.plus(buyAmount);
  trade.save();

  let bid = new AuctionBid(
    `${dtfAddress.toHexString()}-${tradeId.toString()}-${event.transaction.from.toHexString()}-${event.logIndex.toString()}`
  );
  bid.dtf = dtfAddress.toHexString();
  bid.auction = trade.id;
  bid.bidder = event.transaction.from;
  bid.sellAmount = sellAmount;
  bid.buyAmount = buyAmount;
  bid.blockNumber = event.block.number;
  bid.timestamp = event.block.timestamp;
  bid.transactionHash = event.transaction.hash.toHexString();
  bid.save();
}

export function _handleTradeKilled(
  dtfAddress: Address,
  tradeId: BigInt,
  event: ethereum.Event
): void {
  let trade = getTrade(dtfAddress, tradeId);
  trade.closedTimestamp = event.block.timestamp;
  trade.closedBlockNumber = event.block.number;
  trade.closedTransactionHash = event.transaction.hash.toHexString();
  trade.isKilled = true;
  trade.state = TradeState.CLOSED;

  trade.save();
}

// FEES
export function _handleProtocolFeePaid(
  dtfAddress: Address,
  amount: BigInt
): void {
  let dtf = getDTF(dtfAddress);
  dtf.totalRevenue = dtf.totalRevenue.plus(amount);
  dtf.protocolRevenue = dtf.protocolRevenue.plus(amount);
  dtf.save();
}

export function _handleFolioFeePaid(
  dtfAddress: Address,
  recipient: Address,
  amount: BigInt
): void {
  let dtf = getDTF(dtfAddress);
  dtf.totalRevenue = dtf.totalRevenue.plus(amount);

  // Check if recipient is governance token to properly track revenue type
  const isGovernanceToken = dtf.ownerGovernance
    ? getGovernance(dtf.ownerGovernance as string).token ==
      recipient.toHexString()
    : false;

  if (isGovernanceToken) {
    dtf.governanceRevenue = dtf.governanceRevenue.plus(amount);
  } else {
    dtf.externalRevenue = dtf.externalRevenue.plus(amount);
  }

  dtf.save();
}

// ROLES
export function _handleRoleGranted(
  dtfAddress: Address,
  role: Bytes,
  account: Address
): void {
  let dtf = getDTF(dtfAddress);
  let dtfContract = DTFContract.bind(dtfAddress);

  // TODO: Store the roles hex so no need to call the contract
  if (role.equals(dtfContract.AUCTION_APPROVER())) {
    let current = dtf.auctionApprovers;
    current.push(account.toHexString());
    dtf.auctionApprovers = current;
    // Track basket governance
    createGovernanceTimelock(
      account,
      dtfAddress.toHexString(),
      GovernanceType.TRADING
    );
  } else if (role.equals(dtfContract.AUCTION_LAUNCHER())) {
    let current = dtf.auctionLaunchers;
    current.push(account.toHexString());
    dtf.auctionLaunchers = current;
  } else if (role.equals(dtfContract.BRAND_MANAGER())) {
    let current = dtf.brandManagers;
    current.push(account.toHexString());
    dtf.brandManagers = current;
  } else if (role.equals(dtfContract.DEFAULT_ADMIN_ROLE())) {
    let current = dtf.admins;
    current.push(account.toHexString());
    dtf.admins = current;
    // Track owner governance
    createGovernanceTimelock(
      account,
      dtfAddress.toHexString(),
      GovernanceType.OWNER
    );
  }

  dtf.save();
}

export function _handleRoleRevoked(
  dtfAddress: Address,
  role: Bytes,
  account: Address
): void {
  let dtf = getDTF(dtfAddress);
  let dtfContract = DTFContract.bind(dtfAddress);

  // TODO: Store the roles hex so no need to call the contract
  // TODO: Terrible code, but oh well it works
  if (role.equals(dtfContract.AUCTION_APPROVER())) {
    let current = dtf.auctionApprovers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.auctionApprovers = removeFromArrayAtIndex(current, index);
    }
  } else if (role.equals(dtfContract.AUCTION_LAUNCHER())) {
    let current = dtf.auctionLaunchers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.auctionLaunchers = removeFromArrayAtIndex(current, index);
    }
  } else if (role.equals(dtfContract.BRAND_MANAGER())) {
    let current = dtf.brandManagers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.brandManagers = removeFromArrayAtIndex(current, index);
    }
  } else if (role.equals(dtfContract.DEFAULT_ADMIN_ROLE())) {
    let current = dtf.admins;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.admins = removeFromArrayAtIndex(current, index);
    }
  }

  // Store legacy governors
  if (account.toHexString() == dtf.ownerGovernance) {
    dtf.ownerGovernance = null;
    let current = dtf.legacyAdmins;
    current.push(account.toHexString());
    dtf.legacyAdmins = current;
  } else if (account.toHexString() == dtf.tradingGovernance) {
    dtf.tradingGovernance = null;
    let current = dtf.legacyAuctionApprovers;
    current.push(account.toHexString());
    dtf.legacyAuctionApprovers = current;
  }

  dtf.save();
}

export function _handleMintFeeSet(dtfAddress: Address, fee: BigInt): void {
  let dtf = getDTF(dtfAddress);
  dtf.mintingFee = fee;
  dtf.save();
}

export function _handleTvlFeeSet(
  dtfAddress: Address,
  fee: BigInt,
  feeAnnually: BigInt
): void {
  let dtf = getDTF(dtfAddress);
  dtf.tvlFee = fee;
  dtf.annualizedTvlFee = feeAnnually;
  dtf.save();
}

export function _handleAuctionDelaySet(
  dtfAddress: Address,
  delay: BigInt
): void {
  let dtf = getDTF(dtfAddress);
  dtf.auctionDelay = delay;
  dtf.save();
}

export function _handleAuctionLengthSet(
  dtfAddress: Address,
  length: BigInt
): void {
  let dtf = getDTF(dtfAddress);
  dtf.auctionLength = length;
  dtf.save();
}

export function _handleMandateSet(dtfAddress: Address, mandate: string): void {
  let dtf = getDTF(dtfAddress);
  dtf.mandate = mandate;
  dtf.save();
}

export function _handleFeeRecipientsSet(
  dtfAddress: Address,
  recipients: FeeRecipientsSetRecipientsStruct[]
): void {
  let dtf = getDTF(dtfAddress);
  let recipientStrings: string[] = [];
  for (let i = 0; i < recipients.length; i++) {
    let recipient = recipients[i];
    recipientStrings.push(
      `${recipient.recipient.toHexString()}:${recipient.portion.toString()}`
    );
  }
  dtf.feeRecipients = recipientStrings.join(",");
  dtf.save();
}

// getters
export function getTrade(dtfAddress: Address, tradeId: BigInt): Trade {
  return Trade.load(`${dtfAddress.toHexString()}-${tradeId.toString()}`)!;
}

export function getDTF(dtfAddress: Address): DTF {
  return DTF.load(dtfAddress.toHexString())!;
}
