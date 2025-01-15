import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreateToken } from "../utils/getters";
import { BIGINT_ZERO, TradeState } from "../utils/constants";
import { TradeApprovedTradeStruct } from "../../generated/templates/DTF/DTF";
import { Trade } from "../../generated/schema";

export function getTrade(dtfAddress: Address, tradeId: BigInt): Trade {
  return Trade.load(`${dtfAddress.toHexString()}-${tradeId.toString()}`)!;
}

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
  trade.selledAmount = BIGINT_ZERO;
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
  trade.approvedEndPrice = tradeData.prices.start;
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
  tradeData: TradeApprovedTradeStruct,
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
  trade.selledAmount = sellAmount;
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
