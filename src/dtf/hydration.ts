import { Address, BigInt } from "@graphprotocol/graph-ts";
import { DTF } from "../../generated/schema";
import { DTF as DTFContract } from "../../generated/templates/DTF/DTF";

const MAX_FEE_RECIPIENTS = 64;

export function hydrateDTFState(dtf: DTF, dtfAddress: Address): void {
  const contract = DTFContract.bind(dtfAddress);

  readDTFVersion(dtf, contract);

  const mintFee = contract.try_mintFee();
  if (!mintFee.reverted) dtf.mintingFee = mintFee.value;

  const auctionDelay = contract.try_auctionDelay();
  if (!auctionDelay.reverted) dtf.auctionDelay = auctionDelay.value;

  const auctionLength = contract.try_auctionLength();
  if (!auctionLength.reverted) dtf.auctionLength = auctionLength.value;

  const mandate = contract.try_mandate();
  if (!mandate.reverted) dtf.mandate = mandate.value;

  const bidsEnabled = contract.try_bidsEnabled();
  if (!bidsEnabled.reverted) dtf.bidsEnabled = bidsEnabled.value;

  const trustedFillerRegistry = contract.try_trustedFillerRegistry();
  if (!trustedFillerRegistry.reverted) {
    dtf.trustedFillerRegistry = trustedFillerRegistry.value;
  }

  const trustedFillerEnabled = contract.try_trustedFillerEnabled();
  if (!trustedFillerEnabled.reverted) {
    dtf.trustedFillerEnabled = trustedFillerEnabled.value;
  }

  const rebalanceControl = contract.try_rebalanceControl();
  if (!rebalanceControl.reverted) {
    dtf.weightControl = rebalanceControl.value.getWeightControl();
    dtf.priceControl = rebalanceControl.value.getPriceControl();
  }

  dtf.feeRecipients = readFeeRecipients(contract, false);

  // WHY no role reads: getters here return the block's FINAL state, so they already include
  // grants later in the upgrade tx, and those RoleGranted handlers would append them again.
  // Roles are event-sourced from the creation block (AccessControl emits once per real change,
  // upgrades never touch role storage), so the role arrays are left to the Role* handlers.

  // Folio 6.0 getters revert on older implementations; the try_ reads decide, not a version prefix.
  hydrateV6DTFState(dtf, contract);
}

/**
 * Deploy-time hydration. Every other setting has an initialization event the
 * dynamic template replays from the creation block; version() has none, and a
 * fresh 6.0 Folio never emits an allowlist event until governance touches it.
 */
export function hydrateDTFDeployState(dtf: DTF, dtfAddress: Address): void {
  const contract = DTFContract.bind(dtfAddress);
  readDTFVersion(dtf, contract);
  readTradeAllowlist(dtf, contract);
}

export function rehydrateDTF(dtfAddress: Address): void {
  const dtf = DTF.load(dtfAddress.toHexString());
  if (!dtf) return;

  hydrateDTFState(dtf, dtfAddress);
  dtf.save();
}

function hydrateV6DTFState(dtf: DTF, contract: DTFContract): void {
  const maxAuctionLength = contract.try_maxAuctionLength();
  if (!maxAuctionLength.reverted) {
    dtf.maxAuctionLength = maxAuctionLength.value;
    // Preserve the v1-v5 field for consumers that have not migrated yet.
    dtf.auctionLength = maxAuctionLength.value;
  }

  const folioFee = contract.try_folioFeeForSelf();
  if (!folioFee.reverted) dtf.folioFeeForSelf = folioFee.value;

  readTradeAllowlist(dtf, contract);

  dtf.immutableFeeRecipients = readFeeRecipients(contract, true);
}

function readTradeAllowlist(dtf: DTF, contract: DTFContract): void {
  const allowlistEnabled = contract.try_tradeAllowlistEnabled();
  if (!allowlistEnabled.reverted) {
    dtf.tradeAllowlistEnabled = allowlistEnabled.value;
  }

  const allowlist = contract.try_getTokenAllowlist();
  if (!allowlist.reverted) {
    dtf.tradeTokenAllowlist = addressesToStrings(allowlist.value);
  }
}

function readDTFVersion(dtf: DTF, contract: DTFContract): void {
  const version = contract.try_version();
  if (!version.reverted) dtf.version = version.value;
}

function readFeeRecipients(contract: DTFContract, immutable: bool): string {
  const recipients: string[] = [];

  for (let i = 0; i < MAX_FEE_RECIPIENTS; i++) {
    const index = BigInt.fromI32(i);
    if (immutable) {
      const result = contract.try_immutableFeeRecipients(index);
      if (result.reverted) break;
      recipients.push(
        `${result.value.getRecipient().toHexString()}:${result.value.getPortion().toString()}`,
      );
    } else {
      const result = contract.try_feeRecipients(index);
      if (result.reverted) break;
      recipients.push(
        `${result.value.getRecipient().toHexString()}:${result.value.getPortion().toString()}`,
      );
    }
  }

  return recipients.join(",");
}

function addressesToStrings(addresses: Address[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < addresses.length; i++) {
    result.push(addresses[i].toHexString());
  }
  return result;
}
