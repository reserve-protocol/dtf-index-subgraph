import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { getOrCreateTrade } from "../utils/getters";
import { TradeState } from "../utils/constants";

export function _handleTradeApproved(
  dtfAddress: Address,
  tradeId: BigInt,
  event: ethereum.Event
): void {
  getOrCreateTrade(dtfAddress, tradeId, event);
}

// TODO: Missing updated spots
export function _handleTradeLaunched(
  dtfAddress: Address,
  tradeId: BigInt,
  spotBuyLimit: BigInt,
  spotSellLimit: BigInt,
  startPrice: BigInt,
  endPrice: BigInt,
  start: BigInt,
  end: BigInt,
  event: ethereum.Event
): void {
  let trade = getOrCreateTrade(dtfAddress, tradeId, event);
  trade.startPrice = startPrice;
  trade.endPrice = endPrice;
  trade.start = start;
  trade.end = end;
  trade.sellLimitSpot = spotSellLimit;
  trade.buyLimitSpot = spotBuyLimit;
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
  let trade = getOrCreateTrade(dtfAddress, tradeId, event);
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
  let trade = getOrCreateTrade(dtfAddress, tradeId, event);
  trade.closedTimestamp = event.block.timestamp;
  trade.closedBlockNumber = event.block.number;
  trade.closedTransactionHash = event.transaction.hash.toHexString();
  trade.isKilled = true;
  trade.state = TradeState.CLOSED;

  trade.save();
}
