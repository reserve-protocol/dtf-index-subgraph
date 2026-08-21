import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  StakingPosition,
  StakingPositionDailySnapshot,
  StakingPositionRecord,
  StakingToken,
} from "../../generated/schema";
import { StakingVault } from "../../generated/templates/StakingToken/StakingVault";
import { getOrCreateAccount } from "../account/mappings";
import { BIGINT_ZERO, SECONDS_PER_DAY } from "../utils/constants";
import { getOrCreateStakingToken } from "../utils/getters";
import {
  oneShare,
  sampleExchangeRate,
  subscribeUnstakingManager,
} from "../utils/staking-vault";

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
  if (shares.equals(BIGINT_ZERO) && assets.equals(BIGINT_ZERO)) {
    return;
  }

  const stakingToken = refreshVault(vault, event.block);
  const position = getOrCreateStakingPosition(owner, stakingToken, event.block);

  const manager = stakingToken.unstakingManager;
  const isLockCancel =
    manager !== null && sender.toHexString() == (manager as string);

  position.shares = position.shares.plus(shares);
  position.principal = position.principal.plus(assets);
  if (isLockCancel) {
    // The underlying came back from the lock: net it out of the gross flows so
    // totalDeposited / totalWithdrawn stay a matched pair.
    position.totalWithdrawn = assets.ge(position.totalWithdrawn)
      ? BIGINT_ZERO
      : position.totalWithdrawn.minus(assets);
  } else {
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
    isLockCancel ? sender : null,
    event
  );
}

// ERC4626 Withdraw(sender, receiver, owner, assets, shares). Shares are burned
// from `owner`; the underlying goes to an unstaking lock for `receiver`. The
// underlying flows (totalWithdrawn, realizedRewards) follow the receiver, so a
// withdraw to someone else reads as "owner handed over principal, receiver
// cashed out" and a later lock cancel lands on the same account.
export function _handleVaultWithdraw(
  vault: Address,
  owner: Address,
  receiver: Address,
  assets: BigInt,
  shares: BigInt,
  event: ethereum.Event
): void {
  // ERC4626 lets anyone call withdraw(0): nothing moved, nothing to book.
  if (shares.equals(BIGINT_ZERO) && assets.equals(BIGINT_ZERO)) {
    return;
  }

  const stakingToken = refreshVault(vault, event.block);
  const ownerPosition = getOrCreateStakingPosition(
    owner,
    stakingToken,
    event.block
  );

  const principalReleased = principalFor(ownerPosition, shares);
  const realized = assets.minus(principalReleased);
  const rate = impliedRate(stakingToken, assets, shares);
  const toSelf = receiver.equals(owner);

  ownerPosition.shares = subtractShares(ownerPosition.shares, shares);
  ownerPosition.principal = ownerPosition.principal.minus(principalReleased);
  ownerPosition.withdrawCount += 1;
  if (toSelf) {
    ownerPosition.totalWithdrawn = ownerPosition.totalWithdrawn.plus(assets);
    ownerPosition.realizedRewards = ownerPosition.realizedRewards.plus(realized);
  }
  touch(ownerPosition, event.block);

  saveRecord(
    ownerPosition,
    StakingPositionRecordType.WITHDRAW,
    shares,
    assets,
    BIGINT_ZERO.minus(principalReleased),
    toSelf ? realized : BIGINT_ZERO,
    rate,
    toSelf ? null : receiver,
    event
  );

  if (toSelf) {
    return;
  }

  const receiverPosition = getOrCreateStakingPosition(
    receiver,
    stakingToken,
    event.block
  );
  receiverPosition.totalWithdrawn = receiverPosition.totalWithdrawn.plus(assets);
  receiverPosition.realizedRewards =
    receiverPosition.realizedRewards.plus(realized);
  touch(receiverPosition, event.block);

  saveRecord(
    receiverPosition,
    StakingPositionRecordType.WITHDRAW,
    BIGINT_ZERO,
    assets,
    BIGINT_ZERO,
    realized,
    rate,
    owner,
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
  // Plain vote tokens without a vault behind them have no deposits, so a
  // position would be meaningless (see _handleExchangeRatePoll).
  if (stakingToken.unstakingManager === null) {
    return;
  }
  const sender = getOrCreateStakingPosition(from, stakingToken, event.block);
  const receiver = getOrCreateStakingPosition(to, stakingToken, event.block);

  const principalMoved = principalFor(sender, shares);

  sender.shares = subtractShares(sender.shares, shares);
  sender.principal = sender.principal.minus(principalMoved);
  touch(sender, event.block);

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
    to,
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
    from,
    event
  );
}

// Deposit/Withdraw prove the token is a vault and are the cheapest moment to
// keep every vault's live rate fresh: two eth_calls per event, so vaults outside
// the polled TrackedVault list still carry the rate as of their last activity.
// Also retries the UnstakingManager subscription if discovery skipped it.
function refreshVault(vault: Address, block: ethereum.Block): StakingToken {
  const stakingToken = getOrCreateStakingToken(vault);
  const contract = StakingVault.bind(vault);
  subscribeUnstakingManager(stakingToken, contract);
  sampleExchangeRate(stakingToken, contract, block);
  stakingToken.save();
  return stakingToken;
}

// Principal carried by `shares` leaving the position, pro rata. Releasing
// everything when the last share leaves avoids stranded rounding dust. Vaults are
// discovered at creation (deployer events / TrackedVault), so every share was
// seen entering; the clamps only keep the numbers sane if that ever stops holding.
function principalFor(position: StakingPosition, shares: BigInt): BigInt {
  if (shares.ge(position.shares)) {
    return position.principal;
  }
  return position.principal.times(shares).div(position.shares);
}

function subtractShares(current: BigInt, shares: BigInt): BigInt {
  return shares.ge(current) ? BIGINT_ZERO : current.minus(shares);
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
  counterparty: Address | null,
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
  record.counterparty =
    counterparty === null ? null : getOrCreateAccount(counterparty).id;
  record.hash = event.transaction.hash.toHexString();
  record.logIndex = event.logIndex.toI32();
  record.blockNumber = event.block.number;
  record.timestamp = event.block.timestamp;
  record.save();
}
