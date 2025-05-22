import { _handleTransfer } from "../token/mappings";
import {
  DelegateChanged,
  DelegateVotesChanged,
  OwnershipTransferred,
  RewardTokenAdded,
  RewardTokenRemoved,
  Transfer,
} from "./../../generated/templates/StakingToken/StakingVault";
import {
  LockCancelled,
  LockClaimed,
  LockCreated,
} from "./../../generated/templates/UnstakingManager/UnstakingManager";
import {
  _handleDelegateChanged,
  _handleDelegateVotesChanged,
  _handleLockCancelled,
  _handleLockClaimed,
  _handleLockCreated,
  _handleOwnershipTransferred,
  _handleRewardTokenAdded,
  _handleRewardTokenRemoved,
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

export function handleTransfer(event: Transfer): void {
  _handleTransfer(
    event.params.from,
    event.params.to,
    event.params.value,
    event
  );
}
