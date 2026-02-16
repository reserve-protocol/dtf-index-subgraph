import {
  AuctionApproved,
  AuctionApproved1,
  AuctionBid,
  AuctionBid1,
  AuctionClosed,
  AuctionDelaySet,
  AuctionLengthSet,
  AuctionOpened,
  AuctionOpened1,
  AuctionOpened2,
  AuctionTrustedFillCreated,
  BidsEnabledSet,
  FeeRecipientsSet,
  FolioFeePaid,
  MandateSet,
  MintFeeSet,
  NameSet,
  ProtocolFeePaid,
  RebalanceControlSet,
  RebalanceEnded,
  RebalanceStarted,
  RebalanceStarted1,
  RoleGranted,
  RoleRevoked,
  Transfer,
  TrustedFillerRegistrySet,
  TVLFeeSet,
} from "../../generated/templates/DTF/DTF";
import { _handleTransfer } from "../token/mappings";
import { BIGINT_ONE, BIGINT_ZERO } from "./../utils/constants";
import {
  _handleAuctionDelaySet,
  _handleAuctionLengthSet,
  _handleAuctionTrustedFillCreated,
  _handleBid,
  _handleBidsEnabledSet,
  _handleFeeRecipientsSet,
  _handleFolioFeePaid,
  _handleMandateSet,
  _handleMintFeeSet,
  _handleNameSet,
  _handleProtocolFeePaid,
  _handleRebalanceControlSet,
  _handleRebalanceEnded,
  _handleRebalanceStartedV4,
  _handleRebalanceStartedV5,
  _handleRoleGranted,
  _handleRoleRevoked,
  _handleRSRBurn,
  _handleSingletonAuctionBid,
  _handleSingletonAuctionLaunched,
  _handleTradeApproved,
  _handleTradeApproved1,
  _handleTradeKilled,
  _handleTradeLaunched,
  _handleTradeLaunched1,
  _handleTrustedFillerRegistrySet,
  _handleTvlFeeSet,
} from "./handlers";

export function handleRSRBurn(event: Transfer): void {
  _handleRSRBurn(event.params.value, event.params.from, event);
}

// v4.0 handler - separate tokens[], weights[], prices[] arrays
export function handleRebalanceStartedV4(event: RebalanceStarted): void {
  _handleRebalanceStartedV4(
    event.address,
    event.params.nonce,
    event.params.priceControl,
    event.params.tokens,
    event.params.weights,
    event.params.prices,
    event.params.limits,
    event.params.restrictedUntil,
    event.params.availableUntil,
    event
  );
}

export function handleRebalanceEnded(event: RebalanceEnded): void {
  _handleRebalanceEnded(event.address, event.params.nonce, event);
}

export function handleRebalanceControlSet(event: RebalanceControlSet): void {
  _handleRebalanceControlSet(event.address, event.params.newControl);
}

// v5.0 handler - uses TokenRebalanceParams[] struct (combines token, weight, price, maxAuctionSize, inRebalance)
export function handleRebalanceStartedV5(event: RebalanceStarted1): void {
  _handleRebalanceStartedV5(
    event.address,
    event.params.nonce,
    event.params.priceControl,
    event.params.tokens,
    event.params.limits,
    event.params.startedAt,
    event.params.restrictedUntil,
    event.params.availableUntil,
    event.params.bidsEnabled,
    event
  );
}

// v5.0 handler
export function handleBidsEnabledSet(event: BidsEnabledSet): void {
  _handleBidsEnabledSet(event.address, event.params.bidsEnabled);
}

// v5.0 handler
export function handleNameSet(event: NameSet): void {
  _handleNameSet(event.address, event.params.newName);
}

// v5.0 handler
export function handleTrustedFillerRegistrySet(
  event: TrustedFillerRegistrySet
): void {
  _handleTrustedFillerRegistrySet(
    event.address,
    event.params.trustedFillerRegistry,
    event.params.isEnabled
  );
}

export function handleSingletonAuctionLaunched(event: AuctionOpened2): void {
  _handleSingletonAuctionLaunched(
    event.address,
    event.params.auctionId,
    event.params.rebalanceNonce,
    event.params.tokens,
    event.params.weights,
    event.params.prices,
    event.params.limits,
    event.params.startTime,
    event.params.endTime,
    event
  );
}

// This event WONT trigger if the auction is trusted filled (async bid from cowswap)
export function handleSingletonAuctionBid(event: AuctionBid1): void {
  _handleSingletonAuctionBid(
    event.address,
    event.params.auctionId,
    event.params.sellToken,
    event.params.buyToken,
    event.params.sellAmount,
    event.params.buyAmount,
    event
  );
}

export function handleAuctionTrustedFillCreated(
  event: AuctionTrustedFillCreated
): void {
  _handleAuctionTrustedFillCreated(
    event.address,
    event.params.auctionId,
    event.params.filler,
    event
  );
}

export function handleTradeKilled(event: AuctionClosed): void {
  _handleTradeKilled(event.address, event.params.auctionId, event);
}

// FEES
export function handleProtocolFeePaid(event: ProtocolFeePaid): void {
  _handleProtocolFeePaid(event.address, event.params.amount, event);
}

export function handleFolioFeePaid(event: FolioFeePaid): void {
  _handleFolioFeePaid(
    event.address,
    event.params.recipient,
    event.params.amount,
    event
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

// @deprecated - v1.0 handler
export function handleAuctionApproved(event: AuctionApproved): void {
  _handleTradeApproved(
    event.address,
    event.params.auctionId,
    event.params.auction,
    BIGINT_ONE,
    event
  );
}

// @deprecated - v2.0 handler
export function handleAuctionApproved1(event: AuctionApproved1): void {
  _handleTradeApproved1(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event.params.details,
    event
  );
}

// @deprecated - v1.0 handler
export function handleAuctionLaunched(event: AuctionOpened): void {
  _handleTradeLaunched(
    event.address,
    event.params.auctionId,
    event.params.auction,
    BIGINT_ZERO,
    event
  );
}

// @deprecated - v2.0 handler
export function handleAuctionLaunched1(event: AuctionOpened1): void {
  _handleTradeLaunched1(
    event.address,
    event.params.auctionId,
    event.params.auction,
    event.params.runsRemaining,
    event
  );
}

// @deprecated - v1.0 / v2.0 handler
export function handleBid(event: AuctionBid): void {
  _handleBid(
    event.address,
    event.params.auctionId,
    event.params.sellAmount,
    event.params.buyAmount,
    event
  );
}
