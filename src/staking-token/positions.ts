import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  StakingPosition,
  StakingPositionDailySnapshot,
  StakingPositionRecord,
  StakingToken,
} from "../../generated/schema";
import { getOrCreateAccount } from "../account/mappings";
import { BIGINT_ZERO, SECONDS_PER_DAY } from "../utils/constants";
import { getOrCreateStakingToken } from "../utils/getters";
import { oneShare } from "../utils/staking-vault";

export namespace StakingPositionRecordType {
  export const DEPOSIT = "DEPOSIT";
  export const LOCK_CANCEL = "LOCK_CANCEL";
  export const WITHDRAW = "WITHDRAW";
  export const TRANSFER_IN = "TRANSFER_IN";
  export const TRANSFER_OUT = "TRANSFER_OUT";
}

export function getOrCreateStakingPosition(
  accountAddress: Address,
  stakingToken: StakingToken,
  block: ethereum.Block
): StakingPosition {
  const account = getOrCreateAccount(accountAddress);
  account.save();

  const id = account.id + "-" + stakingToken.id;
  let position = StakingPosition.load(id);
  if (position) {
    return position as StakingPosition;
  }

  position = new StakingPosition(id);
  position.account = account.id;
  position.token = stakingToken.id;
  position.shares = BIGINT_ZERO;
  position.principal = BIGINT_ZERO;
  position.totalDeposited = BIGINT_ZERO;
  position.totalWithdrawn = BIGINT_ZERO;
  position.realizedRewards = BIGINT_ZERO;
  position.accountingComplete = true;
  position.untrackedShares = BIGINT_ZERO;
  position.depositCount = 0;
  position.withdrawCount = 0;
  position.blockNumber = block.number;
  position.timestamp = block.timestamp;
  return position as StakingPosition;
}

// ERC4626 Deposit(sender, owner, assets, shares). `owner` receives the shares.
// When the sender is the vault's UnstakingManager this is cancelLock() putting a
// pending unlock back: the underlying re-enters as principal at today's rate
// (the rewards it carried were already booked as realized on the withdraw) but
// it is not new capital, so lifetime totals are left alone.
export function _handleVaultDeposit(
  vault: Address,
  sender: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
  event: ethereum.Event
): void {
  const stakingToken = getOrCreateStakingToken(vault);
  const position = getOrCreateStakingPosition(owner, stakingToken, event.block);

  const manager = stakingToken.unstakingManager;
  const isLockCancel = manager !== null && sender.toHexString() == manager!;

  position.shares = position.shares.plus(shares);
  position.principal = position.principal.plus(assets);
  if (!isLockCancel) {
    position.totalDeposited = position.totalDeposited.plus(assets);
    position.depositCount += 1;
  }
  touch(position, event.block);

  saveRecord(
    position,
    isLockCancel
      ? StakingPositionRecordType.LOCK_CANCEL
      : StakingPositionRecordType.DEPOSIT,
    shares,
    assets,
    assets,
    BIGINT_ZERO,
    impliedRate(stakingToken, assets, shares),
    event
  );
}

// ERC4626 Withdraw(sender, receiver, owner, assets, shares). Shares are burned
// from `owner`; the assets go to an unstaking lock for `receiver`.
export function _handleVaultWithdraw(
  vault: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
  event: ethereum.Event
): void {
  const stakingToken = getOrCreateStakingToken(vault);
  const position = getOrCreateStakingPosition(owner, stakingToken, event.block);

  const trackedShares = trackedPortion(position, shares);
  const principalReleased = principalFor(position, trackedShares);
  // Only the underlying paid out for shares we saw enter can be compared to a cost basis
  const trackedAssets = shares.equals(BIGINT_ZERO)
    ? BIGINT_ZERO
    : assets.times(trackedShares).div(shares);
  const realized = trackedAssets.minus(principalReleased);

  markUntracked(position, shares.minus(trackedShares));
  position.shares = position.shares.minus(trackedShares);
  position.principal = position.principal.minus(principalReleased);
  position.totalWithdrawn = position.totalWithdrawn.plus(assets);
  position.realizedRewards = position.realizedRewards.plus(realized);
  position.withdrawCount += 1;
  touch(position, event.block);

  saveRecord(
    position,
    StakingPositionRecordType.WITHDRAW,
    shares,
    assets,
    BIGINT_ZERO.minus(principalReleased),
    realized,
    impliedRate(stakingToken, assets, shares),
    event
  );
}

// Wallet-to-wallet share transfer: principal follows the shares pro rata.
export function _handlePositionTransfer(
  vault: Address,
  from: Address,
  to: Address,
  shares: BigInt,
  event: ethereum.Event
): void {
  // A self-transfer moves nothing, and loading the same position twice would
  // double-apply the second save.
  if (shares.equals(BIGINT_ZERO) || from.equals(to)) {
    return;
  }

  const stakingToken = getOrCreateStakingToken(vault);
  const sender = getOrCreateStakingPosition(from, stakingToken, event.block);
  const receiver = getOrCreateStakingPosition(to, stakingToken, event.block);

  const trackedShares = trackedPortion(sender, shares);
  const principalMoved = principalFor(sender, trackedShares);
  const untrackedShares = shares.minus(trackedShares);

  markUntracked(sender, untrackedShares);
  sender.shares = sender.shares.minus(trackedShares);
  sender.principal = sender.principal.minus(principalMoved);
  touch(sender, event.block);

  // The receiver now holds shares whose basis is unknown too
  markUntracked(receiver, untrackedShares);
  receiver.shares = receiver.shares.plus(shares);
  receiver.principal = receiver.principal.plus(principalMoved);
  touch(receiver, event.block);

  saveRecord(
    sender,
    StakingPositionRecordType.TRANSFER_OUT,
    shares,
    principalMoved,
    BIGINT_ZERO.minus(principalMoved),
    BIGINT_ZERO,
    stakingToken.exchangeRate,
    event
  );
  saveRecord(
    receiver,
    StakingPositionRecordType.TRANSFER_IN,
    shares,
    principalMoved,
    principalMoved,
    BIGINT_ZERO,
    stakingToken.exchangeRate,
    event
  );
}

// Shares leaving a position beyond what we saw enter it exist only if the vault
// was discovered after the account had already deposited. Their cost basis is
// unknowable, so they release no principal and earn no realized rewards.
function trackedPortion(position: StakingPosition, shares: BigInt): BigInt {
  return shares.gt(position.shares) ? position.shares : shares;
}

function markUntracked(position: StakingPosition, shares: BigInt): void {
  if (shares.equals(BIGINT_ZERO)) {
    return;
  }
  position.accountingComplete = false;
  position.untrackedShares = position.untrackedShares.plus(shares);
}

// Principal carried by `trackedShares` out of the position, pro rata. Releasing
// everything when the last tracked share leaves avoids stranded rounding dust.
function principalFor(position: StakingPosition, trackedShares: BigInt): BigInt {
  if (trackedShares.ge(position.shares)) {
    return position.principal;
  }
  return position.principal.times(trackedShares).div(position.shares);
}

// Underlying per whole share implied by the event itself.
function impliedRate(
  stakingToken: StakingToken,
  assets: BigInt,
  shares: BigInt
): BigInt {
  if (shares.equals(BIGINT_ZERO)) {
    return stakingToken.exchangeRate;
  }
  return assets.times(oneShare(stakingToken)).div(shares);
}

function touch(position: StakingPosition, block: ethereum.Block): void {
  position.blockNumber = block.number;
  position.timestamp = block.timestamp;
  position.save();

  const dayId = block.timestamp.toI64() / SECONDS_PER_DAY;
  const snapshotId = position.id + "-" + dayId.toString();
  let snapshot = StakingPositionDailySnapshot.load(snapshotId);
  if (!snapshot) {
    snapshot = new StakingPositionDailySnapshot(snapshotId);
    snapshot.position = position.id;
    snapshot.account = position.account;
    snapshot.token = position.token;
  }
  snapshot.shares = position.shares;
  snapshot.principal = position.principal;
  snapshot.totalDeposited = position.totalDeposited;
  snapshot.totalWithdrawn = position.totalWithdrawn;
  snapshot.realizedRewards = position.realizedRewards;
  snapshot.accountingComplete = position.accountingComplete;
  snapshot.blockNumber = block.number;
  snapshot.timestamp = block.timestamp;
  snapshot.save();
}

function saveRecord(
  position: StakingPosition,
  type: string,
  shares: BigInt,
  assets: BigInt,
  principalDelta: BigInt,
  realizedRewards: BigInt,
  exchangeRate: BigInt,
  event: ethereum.Event
): void {
  const record = new StakingPositionRecord(
    position.id +
      "-" +
      event.transaction.hash.toHexString() +
      "-" +
      event.logIndex.toString()
  );
  record.position = position.id;
  record.account = position.account;
  record.token = position.token;
  record.type = type;
  record.shares = shares;
  record.assets = assets;
  record.principalDelta = principalDelta;
  record.realizedRewards = realizedRewards;
  record.exchangeRate = exchangeRate;
  record.hash = event.transaction.hash.toHexString();
  record.logIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.save();
}
