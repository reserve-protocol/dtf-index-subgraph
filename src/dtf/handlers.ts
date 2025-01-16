import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreateToken } from "../utils/getters";
import { BIGINT_ZERO, TradeState } from "../utils/constants";
import {
  TradeApprovedTradeStruct,
  TradeOpenedTradeStruct,
} from "../../generated/templates/DTF/DTF";
import { DTF, Trade } from "../../generated/schema";
import { getGovernance } from "../governance/handlers";

// TRADES
export function _handleTradeApproved(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: TradeApprovedTradeStruct,
  event: ethereum.Event
): void {
  let trade = new Trade(`${dtfAddress.toHexString()}-${tradeId.toString()}`);

  trade.dtf = dtfAddress.toHexString();
  trade.sell = getOrCreateToken(tradeData.sell).id;
  trade.buy = getOrCreateToken(tradeData.buy).id;
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
  trade.availableAt = tradeData.availableAt;
  trade.launchTimeout = tradeData.launchTimeout;
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
  trade.state = TradeState.APPROVED;

  trade.save();
}

// TODO: Missing updated spots
export function _handleTradeLaunched(
  dtfAddress: Address,
  tradeId: BigInt,
  tradeData: TradeOpenedTradeStruct,
  event: ethereum.Event
): void {
  let trade = getTrade(dtfAddress, tradeId);
  trade.startPrice = tradeData.prices.start;
  trade.endPrice = tradeData.prices.end;
  trade.start = tradeData.start;
  trade.end = tradeData.end;
  trade.sellLimitSpot = tradeData.sellLimit.spot;
  trade.buyLimitSpot = tradeData.buyLimit.spot;
  trade.launchedTimestamp = event.block.timestamp;
  trade.launchedBlockNumber = event.block.number;
  trade.launchedTransactionHash = event.transaction.hash.toHexString();
  trade.state = TradeState.LAUNCHED;

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
  trade.soldAmount = sellAmount;
  trade.boughtAmount = buyAmount;
  trade.closedTimestamp = event.block.timestamp;
  trade.closedBlockNumber = event.block.number;
  trade.closedTransactionHash = event.transaction.hash.toHexString();
  trade.state = TradeState.CLOSED;

  trade.save();
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

// getters

export function getTrade(dtfAddress: Address, tradeId: BigInt): Trade {
  return Trade.load(`${dtfAddress.toHexString()}-${tradeId.toString()}`)!;
}

export function getDTF(dtfAddress: Address): DTF {
  return DTF.load(dtfAddress.toHexString())!;
}
