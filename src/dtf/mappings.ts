import {
  FolioFeePaid,
  ProtocolFeePaid,
  AuctionApproved,
  AuctionBid,
  AuctionClosed,
  AuctionOpened,
  Transfer,
  RoleGranted,
  RoleRevoked,
} from "../../generated/templates/DTF/DTF";
import { _handleTransfer } from "../token/mappings";
import {
  _handleBid,
  _handleFolioFeePaid,
  _handleProtocolFeePaid,
  _handleRoleGranted,
  _handleRoleRevoked,
  _handleTradeApproved,
  _handleTradeKilled,
  _handleTradeLaunched,
} from "./handlers";

// TRADES
export function handleAuctionApproved(event: AuctionApproved): void {
  _handleTradeApproved(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event
  );
}

export function handleAuctionLaunched(event: AuctionOpened): void {
  _handleTradeLaunched(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event
  );
}

export function handleBid(event: AuctionBid): void {
  _handleBid(
    event.address,
    event.params.auctionId,
    event.params.sellAmount,
    event.params.buyAmount,
    event
  );
}

export function handleTradeKilled(event: AuctionClosed): void {
  _handleTradeKilled(event.address, event.params.auctionId, event);
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

// ROLES
export function handleRoleGranted(event: RoleGranted): void {
  _handleRoleGranted(event.address, event.params.role, event.params.account);
}

export function handleRoleRevoked(event: RoleRevoked): void {
  _handleRoleRevoked(event.address, event.params.role, event.params.account);
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
