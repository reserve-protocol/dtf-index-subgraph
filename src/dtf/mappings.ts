import {
  FolioFeePaid,
  ProtocolFeePaid,
  TradeApproved,
  TradeBid,
  TradeKilled,
  TradeOpened,
  Transfer,
} from "../../generated/templates/DTF/DTF";
import { _handleTransfer } from "../token/mappings";
import {
  _handleBid,
  _handleFolioFeePaid,
  _handleProtocolFeePaid,
  _handleTradeApproved,
  _handleTradeKilled,
  _handleTradeLaunched,
} from "./handlers";

// TRADES
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

// FEES
export function handleProtocolFeePaid(event: ProtocolFeePaid): void {
  _handleProtocolFeePaid(event.address, event.params.amount);
}

export function handleFolioFeePaid(event: FolioFeePaid): void {
  _handleFolioFeePaid(
    event.address,
    event.params.recipient,
    event.params.amount
  );
}

// TRANSFERS
export function handleTransfer(event: Transfer): void {
  _handleTransfer(
    event.params.from,
    event.params.to,
    event.params.value,
    event
  );
}
