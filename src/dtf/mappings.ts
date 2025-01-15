import {
  Bid,
  TradeApproved,
  TradeKilled,
  TradeOpened,
} from "../../generated/templates/DTF/DTF";
import { BIGINT_ZERO } from "../utils/constants";
import {
  _handleBid,
  _handleTradeApproved,
  _handleTradeKilled,
  _handleTradeLaunched,
} from "./handlers";

export function handleTradeApproved(event: TradeApproved): void {
  _handleTradeApproved(event.address, event.params.tradeId, event);
}

// TODO: Missing updated spots
export function handleTradeLaunched(event: TradeOpened): void {
  _handleTradeLaunched(
    event.address,
    event.params.tradeId,
    BIGINT_ZERO,
    BIGINT_ZERO,
    event.params.startPrice,
    event.params.endPrice,
    event.params.start,
    event.params.end,
    event
  );
}

export function handleBid(event: Bid): void {
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
