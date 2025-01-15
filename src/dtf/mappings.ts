import {
  TradeApproved,
  TradeBid,
  TradeKilled,
  TradeOpened,
  Transfer,
} from "../../generated/templates/DTF/DTF";
import { _handleTransfer } from "../token/mappings";
import {
  _handleBid,
  _handleTradeApproved,
  _handleTradeKilled,
  _handleTradeLaunched,
} from "./handlers";

export function handleTradeApproved(event: TradeApproved): void {
  _handleTradeApproved(
    event.address,
    event.params.tradeId,
    event.params.trade,
    event
  );
}

export function handleTradeLaunched(event: TradeOpened): void {
  _handleTradeLaunched(
    event.address,
    event.params.tradeId,
    event.params.trade,
    event
  );
}

export function handleBid(event: TradeBid): void {
  _handleBid(
    event.address,
    event.params.tradeId,
    event.params.sellAmount,
    event.params.buyAmount,
    event
  );
}

export function handleTradeKilled(event: TradeKilled): void {
  _handleTradeKilled(event.address, event.params.tradeId, event);
}

export function handleTransfer(event: Transfer): void {
  _handleTransfer(event);
}
