import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Auction,
  AuctionBid,
  DTF,
  Rebalance,
  RebalanceAuctionBid,
  Trade,
} from "../../generated/schema";
import {
  AuctionApprovedAuctionStruct,
  AuctionOpened2LimitsStruct,
  AuctionOpened2PricesStruct,
  AuctionOpened2WeightsStruct,
  AuctionOpenedAuctionStruct,
  RebalanceStartedLimitsStruct,
  RebalanceStartedPricesStruct,
  RebalanceStartedWeightsStruct,
} from "../../generated/templates/DTF/DTF";
import { getGovernance } from "../governance/handlers";
import { removeFromArrayAtIndex } from "../utils/arrays";
import {
  BIGINT_ONE,
  BIGINT_ZERO,
  GovernanceType,
  TradeState,
} from "../utils/constants";
import {
  createGovernanceTimelock,
  getGovernanceTimelock,
  getOrCreateToken,
} from "../utils/getters";
import { getAuctionBidsFromReceipt } from "../utils/rebalance";
import {
  AuctionApproved1AuctionStruct,
  AuctionApproved1DetailsStruct,
  AuctionOpened1AuctionStruct,
  FeeRecipientsSetRecipientsStruct,
} from "./../../generated/templates/DTF/DTF";
import { Role } from "./../utils/constants";

// Rebalance
export function _handleRebalanceStarted(
  dtfAddress: Address,
  nonce: BigInt,
  priceControl: number,
  tokens: Address[],
  weights: RebalanceStartedWeightsStruct[],
  prices: RebalanceStartedPricesStruct[],
  limits: RebalanceStartedLimitsStruct,
  restrictedUntil: BigInt,
  availableUntil: BigInt,
  event: ethereum.Event
): void {
  let rebalance = new Rebalance(
    `${dtfAddress.toHexString()}-${nonce.toHexString()}`
  );

  let tokenIds: string[] = [];
  let weightLowLimit: BigInt[] = [];
  let weightSpotLimit: BigInt[] = [];
  let weightHighLimit: BigInt[] = [];
  let priceLowLimit: BigInt[] = [];
  let priceHighLimit: BigInt[] = [];

  for (let i = 0; i < tokens.length; i++) {
    tokenIds.push(getOrCreateToken(tokens[i]).id);
    weightLowLimit.push(weights[i].low);
    weightSpotLimit.push(weights[i].spot);
    weightHighLimit.push(weights[i].high);
    priceLowLimit.push(prices[i].low);
    priceHighLimit.push(prices[i].high);
  }

  rebalance.dtf = dtfAddress.toHexString();
  rebalance.tokens = tokenIds;
  rebalance.nonce = nonce;
  rebalance.priceControl = priceControl.toString();
  rebalance.weightLowLimit = weightLowLimit;
  rebalance.weightSpotLimit = weightSpotLimit;
  rebalance.weightHighLimit = weightHighLimit;
  rebalance.priceLowLimit = priceLowLimit;
  rebalance.priceHighLimit = priceHighLimit;
  rebalance.rebalanceLowLimit = limits.low;
  rebalance.rebalanceSpotLimit = limits.spot;
  rebalance.rebalanceHighLimit = limits.high;
  rebalance.restrictedUntil = restrictedUntil;
  rebalance.availableUntil = availableUntil;
  rebalance.transactionHash = event.transaction.hash.toHexString();
  rebalance.blockNumber = event.block.number;
  rebalance.timestamp = event.block.timestamp;
  rebalance.save();

  // Only 1 rebalance can be ongoing at the time, if there is an active rebalance, we need to close it to keep the data valid
  if (nonce > BIGINT_ZERO) {
    _handleRebalanceEnded(dtfAddress, nonce.minus(BIGINT_ONE), event);
  }
}

export function _handleRebalanceEnded(
  dtfAddress: Address,
  nonce: BigInt,
  event: ethereum.Event
): void {
  let rebalance = Rebalance.load(
    `${dtfAddress.toHexString()}-${nonce.toHexString()}`
  );

  if (rebalance && rebalance.availableUntil > event.block.timestamp) {
    rebalance.availableUntil = event.block.timestamp;
    rebalance.save();
  }
}

export function _handleSingletonAuctionLaunched(
  dtfAddress: Address,
  auctionId: BigInt,
  rebalanceNonce: BigInt,
  tokens: Address[],
  weights: AuctionOpened2WeightsStruct[],
  prices: AuctionOpened2PricesStruct[],
  limits: AuctionOpened2LimitsStruct,
  startTime: BigInt,
  endTime: BigInt,
  event: ethereum.Event
): void {
  let auction = new Auction(
    `${dtfAddress.toHexString()}-${auctionId.toString()}`
  );

  let tokenIds: string[] = [];
  let weightLowLimit: BigInt[] = [];
  let weightSpotLimit: BigInt[] = [];
  let weightHighLimit: BigInt[] = [];
  let priceLowLimit: BigInt[] = [];
  let priceHighLimit: BigInt[] = [];

  for (let i = 0; i < tokens.length; i++) {
    tokenIds.push(getOrCreateToken(tokens[i]).id);
    weightLowLimit.push(weights[i].low);
    weightSpotLimit.push(weights[i].spot);
    weightHighLimit.push(weights[i].high);
    priceLowLimit.push(prices[i].low);
    priceHighLimit.push(prices[i].high);
  }

  auction.dtf = dtfAddress.toHexString();
  auction.rebalance = `${dtfAddress.toHexString()}-${rebalanceNonce.toHexString()}`;
  auction.tokens = tokenIds;
  auction.weightLowLimit = weightLowLimit;
  auction.weightSpotLimit = weightSpotLimit;
  auction.weightHighLimit = weightHighLimit;
  auction.priceLowLimit = priceLowLimit;
  auction.priceHighLimit = priceHighLimit;
  auction.rebalanceLowLimit = limits.low;
  auction.rebalanceSpotLimit = limits.spot;
  auction.rebalanceHighLimit = limits.high;
  auction.startTime = startTime;
  auction.endTime = endTime;
  auction.blockNumber = event.block.number;
  auction.timestamp = event.block.timestamp;
  auction.transactionHash = event.transaction.hash.toHexString();

  auction.save();
}

export function _handleSingletonAuctionBid(
  dtfAddress: Address,
  auctionId: BigInt,
  sellToken: Address,
  buyToken: Address,
  sellAmount: BigInt,
  buyAmount: BigInt,
  event: ethereum.Event
): RebalanceAuctionBid {
  let bid = new RebalanceAuctionBid(
    `${dtfAddress.toHexString()}-${auctionId.toString()}-${event.transaction.from.toHexString()}-${event.block.number.toString()}-${event.logIndex.toString()}`
  );
  bid.dtf = dtfAddress.toHexString();
  bid.auction = `${dtfAddress.toHexString()}-${auctionId.toString()}`;
  bid.bidder = event.transaction.from;
  bid.sellToken = getOrCreateToken(sellToken).id;
  bid.buyToken = getOrCreateToken(buyToken).id;
  bid.sellAmount = sellAmount;
  bid.buyAmount = buyAmount;
  bid.blockNumber = event.block.number;
  bid.timestamp = event.block.timestamp;
  bid.transactionHash = event.transaction.hash.toHexString();
  bid.save();

  return bid;
}

// When this happens, all the bids are on the same tx, need to go through the logs in order to compute all the bids
export function _handleAuctionTrustedFillCreated(
  dtfAddress: Address,
  auctionId: BigInt,
  filler: Address,
  event: ethereum.Event
): void {
  let bids = getAuctionBidsFromReceipt(dtfAddress, event.receipt!);

  for (let i = 0; i < bids.length; i++) {
    let bid = bids[i];

    let bidEntity = _handleSingletonAuctionBid(
      dtfAddress,
      auctionId,
      bid.sellToken,
      bid.buyToken,
      bid.sellAmount,
      bid.buyAmount,
      event
    );
    bidEntity.filler = filler;
    bidEntity.save();
  }
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

  if (
    role.equals(Bytes.fromHexString(Role.REBALANCE_MANAGER)) ||
    role.equals(Bytes.fromHexString(Role.AUCTION_APPROVER))
  ) {
    let current = dtf.auctionApprovers;
    current.push(account.toHexString());
    dtf.auctionApprovers = current;
    // Track basket governance
    createGovernanceTimelock(
      account,
      dtfAddress.toHexString(),
      GovernanceType.TRADING
    );
  } else if (role.equals(Bytes.fromHexString(Role.AUCTION_LAUNCHER))) {
    let current = dtf.auctionLaunchers;
    current.push(account.toHexString());
    dtf.auctionLaunchers = current;
  } else if (role.equals(Bytes.fromHexString(Role.BRAND_MANAGER))) {
    let current = dtf.brandManagers;
    current.push(account.toHexString());
    dtf.brandManagers = current;
  } else if (role.equals(Bytes.fromHexString(Role.DEFAULT_ADMIN))) {
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

  // TODO: Terrible code, but oh well it works
  if (
    role.equals(Bytes.fromHexString(Role.REBALANCE_MANAGER)) ||
    role.equals(Bytes.fromHexString(Role.AUCTION_APPROVER))
  ) {
    let current = dtf.auctionApprovers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.auctionApprovers = removeFromArrayAtIndex(current, index);
    }

    let timelock = getGovernanceTimelock(account);
    let gov =
      timelock !== null && timelock.governance !== null
        ? timelock.governance
        : account.toHexString();

    let legacy = dtf.legacyAuctionApprovers;
    legacy.push(gov!);
    dtf.legacyAuctionApprovers = legacy;
  } else if (role.equals(Bytes.fromHexString(Role.AUCTION_LAUNCHER))) {
    let current = dtf.auctionLaunchers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.auctionLaunchers = removeFromArrayAtIndex(current, index);
    }
  } else if (role.equals(Bytes.fromHexString(Role.BRAND_MANAGER))) {
    let current = dtf.brandManagers;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.brandManagers = removeFromArrayAtIndex(current, index);
    }
  } else if (role.equals(Bytes.fromHexString(Role.DEFAULT_ADMIN))) {
    let current = dtf.admins;
    let index = current.indexOf(account.toHexString());

    if (index != -1) {
      dtf.admins = removeFromArrayAtIndex(current, index);
    }

    let timelock = getGovernanceTimelock(account);
    let gov =
      timelock !== null && timelock.governance !== null
        ? timelock.governance
        : account.toHexString();

    let legacy = dtf.legacyAdmins;
    legacy.push(gov!);
    dtf.legacyAdmins = legacy;
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

export function getAuction(dtfAddress: Address, auctionId: BigInt): Auction {
  return Auction.load(`${dtfAddress.toHexString()}-${auctionId.toString()}`)!;
}

export function getDTF(dtfAddress: Address): DTF {
  return DTF.load(dtfAddress.toHexString())!;
}

// @deprecated
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

// @deprecated
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

// @deprecated
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

// @deprecated
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

// @deprecated
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

// @deprecated
export function _handleTradeKilled(
  dtfAddress: Address,
  auctionId: BigInt,
  event: ethereum.Event
): void {
  let auction = Auction.load(
    `${dtfAddress.toHexString()}-${auctionId.toString()}`
  );

  if (auction) {
    // Lets just update the end time to make the auction end.
    auction.endTime = event.block.timestamp;
    auction.save();
  } else {
    // @deprecated 1.0/2.0 trades killed
    let trade = getTrade(dtfAddress, auctionId);
    trade.closedTimestamp = event.block.timestamp;
    trade.closedBlockNumber = event.block.number;
    trade.closedTransactionHash = event.transaction.hash.toHexString();
    trade.isKilled = true;
    trade.state = TradeState.CLOSED;

    trade.save();
  }
}
