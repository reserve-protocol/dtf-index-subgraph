import { BIGINT_ONE } from "../utils/constants";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { AccountBalance } from "../../generated/schema";
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
import { BIGINT_ZERO } from "../utils/constants";
import { getOrCreateStakingToken, getOrCreateToken } from "../utils/getters";

function getOrCreateStakeTokenHolder(
  delegator: string,
  tokenAddress: Address
): AccountBalance {
  const account = getOrCreateAccount(Address.fromString(delegator));
  const token = getOrCreateToken(tokenAddress);
  return getOrCreateAccountBalance(account, token);
}

export function _handleDelegateChanged(
  delegator: string,
  fromDelegate: string,
  toDelegate: string,
  event: ethereum.Event
): void {
  const tokenHolder = getOrCreateStakeTokenHolder(delegator, event.address);
  const previousDelegate = getOrCreateDelegate(
    event.address.toHexString(),
    fromDelegate
  );
  const newDelegate = getOrCreateDelegate(
    event.address.toHexString(),
    toDelegate
  );

  tokenHolder.delegate = newDelegate.id;
  tokenHolder.save();

  previousDelegate.tokenHoldersRepresentedAmount =
    previousDelegate.tokenHoldersRepresentedAmount - 1;
  previousDelegate.save();

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
