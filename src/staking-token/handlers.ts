import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AccountBalance,
  Lock,
  RewardClaim,
  StakingTokenRewards,
  UnstakingManager,
} from "../../generated/schema";
import {
  getOrCreateAccount,
  getOrCreateAccountBalance,
} from "../account/mappings";
import {
  createDelegateChange,
  createDelegateVotingPowerChange,
  getOrCreateOptimisticDelegate,
  getOrCreateStandardDelegate,
  toDecimal,
} from "../governance/handlers";
import {
  BIGINT_ONE,
  BIGINT_ZERO,
  GENESIS_ADDRESS,
  GovernanceType,
  TokenType,
} from "../utils/constants";
import {
  createGovernanceTimelock,
  getGovernanceTimelock,
  getOrCreateStakingToken,
  getOrCreateToken,
} from "../utils/getters";

function getOrCreateStakeTokenHolder(
  delegator: string,
  tokenAddress: Address
): AccountBalance {
  const account = getOrCreateAccount(Address.fromString(delegator));
  const token = getOrCreateToken(tokenAddress, TokenType.VOTE);
  return getOrCreateAccountBalance(account, token);
}

function getOrCreateStakingTokenReward(
  stakingTokenAddress: Address,
  rewardTokenAddress: Address
): StakingTokenRewards {
  const stakingToken = getOrCreateStakingToken(stakingTokenAddress);
  let rewardToken = StakingTokenRewards.load(
    stakingTokenAddress.toHexString() + "-" + rewardTokenAddress.toHexString()
  );

  if (!rewardToken) {
    rewardToken = new StakingTokenRewards(
      stakingTokenAddress.toHexString() + "-" + rewardTokenAddress.toHexString()
    );
    rewardToken.stToken = stakingToken.id;
    // In theory only DTF should be whitelisted as reward token and they should already exists as entity
    // But if the token doesnt exist, we create it and assume is an asset
    rewardToken.rewardToken = getOrCreateToken(
      rewardTokenAddress,
      TokenType.ASSET
    ).id;
    rewardToken.active = true;
    rewardToken.save();
  }

  return rewardToken;
}

export function _handleRewardTokenAdded(
  stakingTokenAddress: Address,
  rewardTokenAddress: Address
): void {
  const rewardToken = getOrCreateStakingTokenReward(
    stakingTokenAddress,
    rewardTokenAddress
  );

  if (!rewardToken.active) {
    rewardToken.active = true;
    rewardToken.save();
  }
}

export function _handleRewardTokenRemoved(
  stakingTokenAddress: Address,
  rewardTokenAddress: Address
): void {
  const rewardToken = getOrCreateStakingTokenReward(
    stakingTokenAddress,
    rewardTokenAddress
  );

  if (rewardToken.active) {
    rewardToken.active = false;
    rewardToken.save();
  }
}

export function _handleRewardsClaimed(
  stakingTokenAddress: Address,
  userAddress: Address,
  rewardTokenAddress: Address,
  amount: BigInt,
  event: ethereum.Event
): void {
  let id =
    stakingTokenAddress.toHexString() +
    "-" +
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();

  let claim = new RewardClaim(id);
  claim.token = getOrCreateStakingToken(stakingTokenAddress).id;
  claim.account = getOrCreateAccount(userAddress).id;
  claim.rewardToken = getOrCreateToken(rewardTokenAddress, TokenType.ASSET).id;
  claim.amount = amount;
  claim.blockNumber = event.block.number;
  claim.timestamp = event.block.timestamp;
  claim.txnHash = event.transaction.hash.toHexString();
  claim.save();
}

export function _handleDelegateChanged(
  delegator: string,
  fromDelegate: string,
  toDelegate: string,
  isOptimistic: boolean,
  event: ethereum.Event
): void {
  const tokenHolder = getOrCreateStakeTokenHolder(delegator, event.address);

  if (fromDelegate != GENESIS_ADDRESS) {
    const previousDelegate = isOptimistic
      ? getOrCreateOptimisticDelegate(event.address.toHexString(), fromDelegate)
      : getOrCreateStandardDelegate(event.address.toHexString(), fromDelegate);

    if (isOptimistic) {
      previousDelegate.optimisticTokenHoldersRepresentedAmount =
        previousDelegate.optimisticTokenHoldersRepresentedAmount - 1;
    } else {
      previousDelegate.tokenHoldersRepresentedAmount =
        previousDelegate.tokenHoldersRepresentedAmount - 1;
    }
    previousDelegate.save();
  }

  const newDelegate = isOptimistic
    ? getOrCreateOptimisticDelegate(event.address.toHexString(), toDelegate)
    : getOrCreateStandardDelegate(event.address.toHexString(), toDelegate);

  if (isOptimistic) {
    tokenHolder.optimisticDelegate = newDelegate.id;
  } else {
    tokenHolder.delegate = newDelegate.id;
  }
  tokenHolder.save();

  if (isOptimistic) {
    newDelegate.optimisticTokenHoldersRepresentedAmount =
      newDelegate.optimisticTokenHoldersRepresentedAmount + 1;
  } else {
    newDelegate.tokenHoldersRepresentedAmount =
      newDelegate.tokenHoldersRepresentedAmount + 1;
  }
  newDelegate.save();

  const delegateChanged = createDelegateChange(
    event,
    toDelegate,
    fromDelegate,
    delegator,
    isOptimistic
  );

  delegateChanged.save();
}

export function _handleDelegateVotesChanged(
  delegateAddress: string,
  previousBalance: BigInt,
  newBalance: BigInt,
  isOptimistic: boolean,
  event: ethereum.Event
): void {
  const votesDifference = newBalance.minus(previousBalance);

  const delegate = isOptimistic
    ? getOrCreateOptimisticDelegate(event.address.toHexString(), delegateAddress)
    : getOrCreateStandardDelegate(event.address.toHexString(), delegateAddress);

  if (isOptimistic) {
    delegate.optimisticDelegatedVotesRaw = newBalance;
    delegate.optimisticDelegatedVotes = toDecimal(newBalance);
  } else {
    delegate.delegatedVotesRaw = newBalance;
    delegate.delegatedVotes = toDecimal(newBalance);
  }
  delegate.save();

  // Create DelegateVotingPowerChange
  const delegateVPChange = createDelegateVotingPowerChange(
    event,
    previousBalance,
    newBalance,
    delegateAddress,
    isOptimistic
  );
  delegateVPChange.save();

  const stakingToken = getOrCreateStakingToken(event.address);

  if (isOptimistic) {
    // Optimistic fields are nullable in schema for grafting compat but backfilled to BIGINT_ZERO in getOrCreateStakingToken.
    if (previousBalance == BIGINT_ZERO && newBalance > BIGINT_ZERO) {
      stakingToken.currentOptimisticDelegates =
        stakingToken.currentOptimisticDelegates!.plus(BIGINT_ONE);
    }
    if (newBalance == BIGINT_ZERO) {
      stakingToken.currentOptimisticDelegates =
        stakingToken.currentOptimisticDelegates!.minus(BIGINT_ONE);
    }
    stakingToken.optimisticDelegatedVotesRaw =
      stakingToken.optimisticDelegatedVotesRaw!.plus(votesDifference);
    stakingToken.optimisticDelegatedVotes = toDecimal(
      stakingToken.optimisticDelegatedVotesRaw!
    );
  } else {
    if (previousBalance == BIGINT_ZERO && newBalance > BIGINT_ZERO) {
      stakingToken.currentDelegates =
        stakingToken.currentDelegates.plus(BIGINT_ONE);
    }
    if (newBalance == BIGINT_ZERO) {
      stakingToken.currentDelegates =
        stakingToken.currentDelegates.minus(BIGINT_ONE);
    }
    stakingToken.delegatedVotesRaw =
      stakingToken.delegatedVotesRaw.plus(votesDifference);
    stakingToken.delegatedVotes = toDecimal(stakingToken.delegatedVotesRaw);
  }
  stakingToken.save();
}

export function _handleLockCreated(
  manager: Address,
  lockId: BigInt,
  amount: BigInt,
  user: Address,
  unlockTime: BigInt,
  event: ethereum.Event
): void {
  let token = getTokenFromManager(manager);
  let lock = new Lock(manager.toHexString() + "-" + lockId.toString());
  lock.lockId = lockId;
  lock.token = token;
  lock.account = getOrCreateAccount(user).id;
  lock.amount = amount;
  lock.unlockTime = unlockTime;
  lock.createdBlock = event.block.number;
  lock.createdTimestamp = event.block.timestamp;
  lock.createdTxnHash = event.transaction.hash.toHexString();
  lock.save();
}

export function _handleLockCancelled(
  manager: Address,
  lockId: BigInt,
  event: ethereum.Event
): void {
  let lock = Lock.load(manager.toHexString() + "-" + lockId.toString());
  if (!lock) {
    return;
  }
  lock.cancelledBlock = event.block.number;
  lock.cancelledTimestamp = event.block.timestamp;
  lock.cancelledTxnHash = event.transaction.hash.toHexString();
  lock.save();
}

export function _handleLockClaimed(
  manager: Address,
  lockId: BigInt,
  event: ethereum.Event
): void {
  let lock = Lock.load(manager.toHexString() + "-" + lockId.toString());
  if (!lock) {
    return;
  }
  lock.claimedBlock = event.block.number;
  lock.claimedTimestamp = event.block.timestamp;
  lock.claimedTxnHash = event.transaction.hash.toHexString();
  lock.save();
}

export function _handleOwnershipTransferred(
  oldOwner: Address,
  newOwner: Address,
  event: ethereum.Event
): void {
  let stakingToken = getOrCreateStakingToken(event.address);

  if (oldOwner.toHexString() !== GENESIS_ADDRESS) {
    let timelock = getGovernanceTimelock(oldOwner);
    let gov =
      timelock !== null && timelock.governance !== null
        ? timelock.governance
        : oldOwner.toHexString();
    let legacy = stakingToken.legacyGovernance;
    legacy.push(gov!);
    stakingToken.legacyGovernance = legacy;
  }

  stakingToken.save();

  createGovernanceTimelock(
    newOwner,
    stakingToken.id,
    GovernanceType.VOTE_LOCKING
  );
}

export function getTokenFromManager(manager: Address): string {
  return UnstakingManager.load(manager.toHexString())!.token;
}
