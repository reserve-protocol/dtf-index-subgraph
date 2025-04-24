import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  AccountBalance,
  Lock,
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
  getOrCreateDelegate,
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

export function _handleDelegateChanged(
  delegator: string,
  fromDelegate: string,
  toDelegate: string,
  event: ethereum.Event
): void {
  const tokenHolder = getOrCreateStakeTokenHolder(delegator, event.address);

  if (fromDelegate != GENESIS_ADDRESS) {
    const previousDelegate = getOrCreateDelegate(
      event.address.toHexString(),
      fromDelegate
    );

    previousDelegate.tokenHoldersRepresentedAmount =
      previousDelegate.tokenHoldersRepresentedAmount - 1;
    previousDelegate.save();
  }

  const newDelegate = getOrCreateDelegate(
    event.address.toHexString(),
    toDelegate
  );

  tokenHolder.delegate = newDelegate.id;
  tokenHolder.save();

  newDelegate.tokenHoldersRepresentedAmount =
    newDelegate.tokenHoldersRepresentedAmount + 1;
  newDelegate.save();

  const delegateChanged = createDelegateChange(
    event,
    toDelegate,
    fromDelegate,
    delegator
  );

  delegateChanged.save();
}

export function _handleDelegateVotesChanged(
  delegateAddress: string,
  previousBalance: BigInt,
  newBalance: BigInt,
  event: ethereum.Event
): void {
  const votesDifference = newBalance.minus(previousBalance);

  const delegate = getOrCreateDelegate(
    event.address.toHexString(),
    delegateAddress
  );
  delegate.delegatedVotesRaw = newBalance;
  delegate.delegatedVotes = toDecimal(newBalance);
  delegate.save();

  // Create DelegateVotingPowerChange
  const delegateVPChange = createDelegateVotingPowerChange(
    event,
    previousBalance,
    newBalance,
    delegateAddress
  );
  delegateVPChange.save();

  // Update governance delegate count
  const stakingToken = getOrCreateStakingToken(event.address);
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
  stakingToken.legacyGovernance.push(oldOwner.toHexString());
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
