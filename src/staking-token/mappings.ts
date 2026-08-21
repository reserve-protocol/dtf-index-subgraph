import { dataSource, ethereum } from "@graphprotocol/graph-ts";
import { _handleTransfer } from "../token/mappings";
import { GENESIS_ADDRESS } from "../utils/constants";
import {
  _handlePositionTransfer,
  _handleVaultDeposit,
  _handleVaultWithdraw,
} from "./positions";
import {
  DelegateChanged,
  DelegateVotesChanged,
  Deposit,
  OptimisticDelegateChanged,
  OptimisticDelegateVotesChanged,
  OwnershipTransferred,
  RewardsClaimed,
  RewardRatioSet,
  RewardTokenAdded,
  RewardTokenRemoved,
  Transfer,
  UnstakingDelaySet,
  Withdraw,
} from "./../../generated/templates/StakingToken/StakingVault";
import {
  LockCancelled,
  LockClaimed,
  LockCreated,
} from "./../../generated/templates/UnstakingManager/UnstakingManager";
import {
  _handleDelegateChanged,
  _handleDelegateVotesChanged,
  _handleExchangeRatePoll,
  _handleLockCancelled,
  _handleLockClaimed,
  _handleLockCreated,
  _handleOwnershipTransferred,
  _handleRewardRatioSet,
  _handleRewardsClaimed,
  _handleRewardTokenAdded,
  _handleRewardTokenRemoved,
  _handleUnstakingDelaySet,
} from "./handlers";

export function handleRewardTokenAdded(event: RewardTokenAdded): void {
  _handleRewardTokenAdded(event.address, event.params.rewardToken);
}

export function handleRewardTokenRemoved(event: RewardTokenRemoved): void {
  _handleRewardTokenRemoved(event.address, event.params.rewardToken);
}

// DelegateChanged(indexed address,indexed address,indexed address)
export function handleDelegateChanged(event: DelegateChanged): void {
  _handleDelegateChanged(
    event.params.delegator.toHexString(),
    event.params.fromDelegate.toHexString(),
    event.params.toDelegate.toHexString(),
    false,
    event
  );
}

// DelegateVotesChanged(indexed address,uint256,uint256)
// Called in succession to the above DelegateChanged event
export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  _handleDelegateVotesChanged(
    event.params.delegate.toHexString(),
    event.params.previousVotes,
    event.params.newVotes,
    false,
    event
  );
}

// OptimisticDelegateChanged(indexed address,indexed address,indexed address)
export function handleOptimisticDelegateChanged(
  event: OptimisticDelegateChanged
): void {
  _handleDelegateChanged(
    event.params.delegator.toHexString(),
    event.params.fromDelegate.toHexString(),
    event.params.toDelegate.toHexString(),
    true,
    event
  );
}

// OptimisticDelegateVotesChanged(indexed address,uint256,uint256)
export function handleOptimisticDelegateVotesChanged(
  event: OptimisticDelegateVotesChanged
): void {
  _handleDelegateVotesChanged(
    event.params.delegate.toHexString(),
    event.params.previousVotes,
    event.params.newVotes,
    true,
    event
  );
}

export function handleLockCreated(event: LockCreated): void {
  _handleLockCreated(
    event.address,
    event.params.lockId,
    event.params.amount,
    event.params.user,
    event.params.unlockTime,
    event
  );
}

export function handleLockCancelled(event: LockCancelled): void {
  _handleLockCancelled(event.address, event.params.lockId, event);
}

export function handleLockClaimed(event: LockClaimed): void {
  _handleLockClaimed(event.address, event.params.lockId, event);
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  _handleOwnershipTransferred(
    event.params.previousOwner,
    event.params.newOwner,
    event
  );
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  _handleRewardsClaimed(
    event.address,
    event.params.user,
    event.params.rewardToken,
    event.params.amount,
    event
  );
}

export function handleTransfer(event: Transfer): void {
  _handleTransfer(
    event.params.from,
    event.params.to,
    event.params.value,
    event
  );

  // Mints / burns are accounted by Deposit / Withdraw; only wallet moves here.
  const isMint = event.params.from.toHexString() == GENESIS_ADDRESS;
  const isBurn = event.params.to.toHexString() == GENESIS_ADDRESS;
  if (!isMint && !isBurn) {
    _handlePositionTransfer(
      event.address,
      event.params.from,
      event.params.to,
      event.params.value,
      event
    );
  }
}

export function handleDeposit(event: Deposit): void {
  _handleVaultDeposit(
    event.address,
    event.params.sender,
    event.params.owner,
    event.params.assets,
    event.params.shares,
    event
  );
}

export function handleWithdraw(event: Withdraw): void {
  _handleVaultWithdraw(
    event.address,
    event.params.owner,
    event.params.receiver,
    event.params.assets,
    event.params.shares,
    event
  );
}

export function handleUnstakingDelaySet(event: UnstakingDelaySet): void {
  _handleUnstakingDelaySet(event.address, event.params.delay);
}

export function handleRewardRatioSet(event: RewardRatioSet): void {
  _handleRewardRatioSet(
    event.address,
    event.params.rewardRatio,
    event.params.halfLife
  );
}

export function handleExchangeRatePoll(block: ethereum.Block): void {
  _handleExchangeRatePoll(dataSource.address(), block);
}
