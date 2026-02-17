import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  DTF,
  Token,
  Rebalance,
  Auction,
  Trade,
  Governance,
  StakingToken,
  GovernanceTimelock,
} from "../../generated/schema";
import { BIGINT_ZERO } from "../../src/utils/constants";

export function createTestDTF(dtfAddress: Address): DTF {
  let dtf = new DTF(dtfAddress.toHexString());
  dtf.token = dtfAddress.toHexString();
  dtf.deployer = dtfAddress;
  dtf.proxyAdmin = dtfAddress;
  dtf.blockNumber = BIGINT_ZERO;
  dtf.timestamp = BIGINT_ZERO;
  dtf.totalRevenue = BIGINT_ZERO;
  dtf.protocolRevenue = BIGINT_ZERO;
  dtf.governanceRevenue = BIGINT_ZERO;
  dtf.externalRevenue = BIGINT_ZERO;
  dtf.mintingFee = BIGINT_ZERO;
  dtf.tvlFee = BIGINT_ZERO;
  dtf.auctionDelay = BIGINT_ZERO;
  dtf.auctionLength = BIGINT_ZERO;
  dtf.mandate = "";
  dtf.annualizedTvlFee = BIGINT_ZERO;
  dtf.feeRecipients = "";
  dtf.weightControl = true;
  dtf.priceControl = 1;
  dtf.ownerAddress = dtfAddress;
  dtf.auctionApprovers = [];
  dtf.legacyAuctionApprovers = [];
  dtf.auctionLaunchers = [];
  dtf.brandManagers = [];
  dtf.admins = [];
  dtf.legacyAdmins = [];
  dtf.save();
  return dtf;
}

export function createTestToken(tokenAddress: Address): Token {
  let token = new Token(tokenAddress.toHexString());
  token.address = tokenAddress;
  token.name = "Test";
  token.symbol = "TEST";
  token.decimals = 18;
  token.currentHolderCount = BIGINT_ZERO;
  token.cumulativeHolderCount = BIGINT_ZERO;
  token.transferCount = BIGINT_ZERO;
  token.mintCount = BIGINT_ZERO;
  token.burnCount = BIGINT_ZERO;
  token.totalSupply = BIGINT_ZERO;
  token.totalBurned = BIGINT_ZERO;
  token.totalMinted = BIGINT_ZERO;
  token.type = "DTF";
  token.save();
  return token;
}

export function createTestRebalance(
  dtfAddress: Address,
  nonce: BigInt,
  availableUntil: BigInt
): Rebalance {
  let id = dtfAddress.toHexString() + "-" + nonce.toHexString();
  let rebalance = new Rebalance(id);
  rebalance.dtf = dtfAddress.toHexString();
  rebalance.nonce = nonce;
  rebalance.priceControl = "1";
  rebalance.tokens = [];
  rebalance.weightLowLimit = [];
  rebalance.weightSpotLimit = [];
  rebalance.weightHighLimit = [];
  rebalance.priceLowLimit = [];
  rebalance.priceHighLimit = [];
  rebalance.rebalanceLowLimit = BIGINT_ZERO;
  rebalance.rebalanceSpotLimit = BIGINT_ZERO;
  rebalance.rebalanceHighLimit = BIGINT_ZERO;
  rebalance.restrictedUntil = BIGINT_ZERO;
  rebalance.availableUntil = availableUntil;
  rebalance.transactionHash = "0x0000";
  rebalance.blockNumber = BIGINT_ZERO;
  rebalance.timestamp = BIGINT_ZERO;
  rebalance.save();
  return rebalance;
}

export function createTestAuction(
  dtfAddress: Address,
  auctionId: BigInt
): Auction {
  let id = dtfAddress.toHexString() + "-" + auctionId.toString();
  let auction = new Auction(id);
  auction.dtf = dtfAddress.toHexString();
  auction.rebalance = dtfAddress.toHexString() + "-0x00";
  auction.tokens = [];
  auction.weightLowLimit = [];
  auction.weightSpotLimit = [];
  auction.weightHighLimit = [];
  auction.priceLowLimit = [];
  auction.priceHighLimit = [];
  auction.rebalanceLowLimit = BIGINT_ZERO;
  auction.rebalanceSpotLimit = BIGINT_ZERO;
  auction.rebalanceHighLimit = BIGINT_ZERO;
  auction.startTime = BIGINT_ZERO;
  auction.endTime = BigInt.fromI32(999999);
  auction.blockNumber = BIGINT_ZERO;
  auction.timestamp = BIGINT_ZERO;
  auction.transactionHash = "0x0000";
  auction.save();
  return auction;
}

export function createTestTrade(
  dtfAddress: Address,
  tradeId: BigInt
): Trade {
  let id = dtfAddress.toHexString() + "-" + tradeId.toString();
  let trade = new Trade(id);
  trade.dtf = dtfAddress.toHexString();
  trade.sell = dtfAddress.toHexString();
  trade.buy = dtfAddress.toHexString();
  trade.soldAmount = BIGINT_ZERO;
  trade.boughtAmount = BIGINT_ZERO;
  trade.startPrice = BIGINT_ZERO;
  trade.endPrice = BIGINT_ZERO;
  trade.sellLimitSpot = BIGINT_ZERO;
  trade.sellLimitHigh = BIGINT_ZERO;
  trade.sellLimitLow = BIGINT_ZERO;
  trade.buyLimitSpot = BIGINT_ZERO;
  trade.buyLimitHigh = BIGINT_ZERO;
  trade.buyLimitLow = BIGINT_ZERO;
  trade.approvedSellLimitSpot = BIGINT_ZERO;
  trade.approvedBuyLimitSpot = BIGINT_ZERO;
  trade.approvedStartPrice = BIGINT_ZERO;
  trade.approvedEndPrice = BIGINT_ZERO;
  trade.availableAt = BIGINT_ZERO;
  trade.launchTimeout = BIGINT_ZERO;
  trade.start = BIGINT_ZERO;
  trade.end = BIGINT_ZERO;
  trade.approvedTimestamp = BIGINT_ZERO;
  trade.approvedBlockNumber = BIGINT_ZERO;
  trade.approvedTransactionHash = "";
  trade.launchedTimestamp = BIGINT_ZERO;
  trade.launchedBlockNumber = BIGINT_ZERO;
  trade.launchedTransactionHash = "";
  trade.closedTimestamp = BIGINT_ZERO;
  trade.closedBlockNumber = BIGINT_ZERO;
  trade.closedTransactionHash = "";
  trade.isKilled = false;
  trade.availableRuns = BIGINT_ZERO;
  trade.state = "LAUNCHED";
  trade.save();
  return trade;
}

export function createTestGovernance(
  governanceAddress: Address,
  timelockAddress: Address,
  stakingTokenAddress: Address
): Governance {
  // Create required StakingToken
  let stakingToken = new StakingToken(stakingTokenAddress.toHexString());
  stakingToken.token = stakingTokenAddress.toHexString();
  stakingToken.totalDelegates = BIGINT_ZERO;
  stakingToken.currentDelegates = BIGINT_ZERO;
  stakingToken.delegatedVotesRaw = BIGINT_ZERO;
  stakingToken.delegatedVotes = BIGINT_ZERO.toBigDecimal();
  stakingToken.legacyGovernance = [];
  stakingToken.save();

  // Create required GovernanceTimelock
  let timelock = new GovernanceTimelock(timelockAddress.toHexString());
  timelock.guardians = [];
  timelock.entity = "";
  timelock.type = "OWNER";
  timelock.executionDelay = BIGINT_ZERO;
  timelock.save();

  let governance = new Governance(governanceAddress.toHexString());
  governance.name = "Test Governor";
  governance.version = "1";
  governance.timelock = timelockAddress.toHexString();
  governance.token = stakingTokenAddress.toHexString();
  governance.votingDelay = BIGINT_ZERO;
  governance.votingPeriod = BIGINT_ZERO;
  governance.proposalThreshold = BIGINT_ZERO;
  governance.quorumDenominator = BIGINT_ZERO;
  governance.quorumNumerator = BIGINT_ZERO;
  governance.proposalCount = BIGINT_ZERO;
  governance.proposalsQueued = BIGINT_ZERO;
  governance.proposalsExecuted = BIGINT_ZERO;
  governance.proposalsCanceled = BIGINT_ZERO;
  governance.save();

  return governance;
}
