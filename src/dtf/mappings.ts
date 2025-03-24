import { BIGINT_ONE, BIGINT_ZERO } from "./../utils/constants";
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
  MintFeeSet,
  TVLFeeSet,
  AuctionDelaySet,
  AuctionLengthSet,
  MandateSet,
  FeeRecipientsSet,
  AuctionOpened1,
  AuctionApproved1,
} from "../../generated/templates/DTF/DTF";
import { _handleTransfer } from "../token/mappings";
import {
  _handleAuctionDelaySet,
  _handleAuctionLengthSet,
  _handleBid,
  _handleFeeRecipientsSet,
  _handleFolioFeePaid,
  _handleMandateSet,
  _handleMintFeeSet,
  _handleProtocolFeePaid,
  _handleRoleGranted,
  _handleRoleRevoked,
  _handleTradeApproved,
  _handleTradeKilled,
  _handleTradeLaunched,
  _handleTvlFeeSet,
} from "./handlers";

// TRADES
export function handleAuctionApproved(event: AuctionApproved): void {
  _handleTradeApproved(
    event.address,
    event.params.auctionId,
    event.params.auction,
    BIGINT_ONE,
    event
  );
}

export function handleAuctionApproved1(event: AuctionApproved1): void {
  _handleTradeApproved(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event.params.details.availableRuns,
    event
  );
}

// TODO: Remove when all folios are 2.0
export function handleAuctionLaunched(event: AuctionOpened): void {
  _handleTradeLaunched(
    event.address,
    event.params.auctionId,
    event.params.auction,
    BIGINT_ZERO,
    event
  );
}

export function handleAuctionLaunched1(event: AuctionOpened1): void {
  _handleTradeLaunched(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event.params.runsRemaining,
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

export function handleMintFeeSet(event: MintFeeSet): void {
  _handleMintFeeSet(event.address, event.params.newFee);
}

export function handleTvlFeeSet(event: TVLFeeSet): void {
  _handleTvlFeeSet(
    event.address,
    event.params.newFee,
    event.params.feeAnnually
  );
}

export function handleAuctionDelaySet(event: AuctionDelaySet): void {
  _handleAuctionDelaySet(event.address, event.params.newAuctionDelay);
}

export function handleAuctionLengthSet(event: AuctionLengthSet): void {
  _handleAuctionLengthSet(event.address, event.params.newAuctionLength);
}

export function handleMandateSet(event: MandateSet): void {
  _handleMandateSet(event.address, event.params.newMandate);
}

export function handleFeeRecipientsSet(event: FeeRecipientsSet): void {
  _handleFeeRecipientsSet(event.address, event.params.recipients);
}
