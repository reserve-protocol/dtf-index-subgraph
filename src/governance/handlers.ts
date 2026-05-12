import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  Delegate,
  DelegateChange,
  DelegateVotingPowerChange,
  Governance,
  Proposal,
  TimelockOperation,
  TimelockOperationByTx,
  Vote,
  VoteDailySnapshot,
} from "../../generated/schema";
import {
  BIGDECIMAL_ZERO,
  BIGINT_ONE,
  BIGINT_ZERO,
  GENESIS_ADDRESS,
  ProposalState,
  VoteChoice,
} from "../utils/constants";
import { getOrCreateAccount } from "../account/mappings";
import { getOrCreateStakingToken } from "../utils/getters";
import { Governor } from "../../generated/templates/Governance/Governor";

export const SECONDS_PER_DAY = 60 * 60 * 24;

export function toDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  return value.divDecimal(
    BigInt.fromI32(10)
      .pow(<u8>decimals)
      .toBigDecimal()
  );
}
export function addressesToStrings(addresses: Address[]): Array<string> {
  const byteAddresses = new Array<string>();
  for (let i = 0; i < addresses.length; i++) {
    byteAddresses.push(addresses[i].toHexString());
  }
  return byteAddresses;
}

export function getVoteChoiceByValue(choiceValue: number): string {
  if (choiceValue === VoteChoice.AGAINST_VALUE) {
    return VoteChoice.AGAINST;
  } else if (choiceValue === VoteChoice.FOR_VALUE) {
    return VoteChoice.FOR;
  } else if (choiceValue === VoteChoice.ABSTAIN_VALUE) {
    return VoteChoice.ABSTAIN;
  } else {
    // Case that shouldn't happen
    log.error("Voting choice of {} does not exist", [choiceValue.toString()]);
    return VoteChoice.ABSTAIN;
  }
}

export function getGovernance(governanceAddress: string): Governance {
  return Governance.load(governanceAddress)!;
}

export function createDelegateChange(
  event: ethereum.Event,
  toDelegate: string,
  fromDelegate: string,
  delegator: string,
  isOptimistic: boolean
): DelegateChange {
  const delegateChangeId = `${event.block.timestamp.toI64()}-${event.logIndex}`;

  const delegateChange = new DelegateChange(delegateChangeId);

  delegateChange.delegate = toDelegate;
  delegateChange.delegator = delegator;
  delegateChange.previousDelegate = fromDelegate;
  delegateChange.isOptimistic = isOptimistic;
  delegateChange.tokenAddress = event.address.toHexString();
  delegateChange.txnHash = event.transaction.hash.toHexString();
  delegateChange.blockNumber = event.block.number;
  delegateChange.blockTimestamp = event.block.timestamp;
  delegateChange.logIndex = event.logIndex;

  return delegateChange;
}

export function createDelegateVotingPowerChange(
  event: ethereum.Event,
  previousBalance: BigInt,
  newBalance: BigInt,
  delegate: string,
  isOptimistic: boolean
): DelegateVotingPowerChange {
  const delegateVotingPwerChangeId = `${event.block.timestamp.toI64()}-${
    event.logIndex
  }`;

  const delegateVPChange = new DelegateVotingPowerChange(
    delegateVotingPwerChangeId
  );

  delegateVPChange.previousBalance = previousBalance;
  delegateVPChange.newBalance = newBalance;
  delegateVPChange.delegate = delegate;
  delegateVPChange.isOptimistic = isOptimistic;
  delegateVPChange.tokenAddress = event.address.toHexString();
  delegateVPChange.txnHash = event.transaction.hash.toHexString();
  delegateVPChange.blockTimestamp = event.block.timestamp;
  delegateVPChange.logIndex = event.logIndex;
  delegateVPChange.blockNumber = event.block.number;

  return delegateVPChange;
}

export function getProposal(id: string): Proposal {
  let proposal = Proposal.load(id);
  if (!proposal) {
    proposal = new Proposal(id);
    proposal.tokenHoldersAtStart = BIGINT_ZERO;
    proposal.delegatesAtStart = BIGINT_ZERO;
  }

  return proposal as Proposal;
}

export function getOrCreateDelegate(token: string, address: string): Delegate {
  let delegate = Delegate.load(`${token}-${address}`);
  if (!delegate) {
    delegate = new Delegate(`${token}-${address}`);
    delegate.address = address;
    delegate.token = token;
    delegate.delegatedVotesRaw = BIGINT_ZERO;
    delegate.delegatedVotes = BIGDECIMAL_ZERO;
    delegate.optimisticDelegatedVotesRaw = BIGINT_ZERO;
    delegate.optimisticDelegatedVotes = BIGDECIMAL_ZERO;
    delegate.hasBeenStandardDelegate = false;
    delegate.hasBeenOptimisticDelegate = false;
    delegate.tokenHoldersRepresentedAmount = 0;
    delegate.optimisticTokenHoldersRepresentedAmount = 0;
    delegate.numberVotes = 0;
    delegate.numberOptimisticVotes = 0;
    delegate.save();
  }

  return delegate as Delegate;
}

export function getOrCreateStandardDelegate(
  token: string,
  address: string
): Delegate {
  const delegate = getOrCreateDelegate(token, address);

  if (!delegate.hasBeenStandardDelegate && address != GENESIS_ADDRESS) {
    const stakingToken = getOrCreateStakingToken(Address.fromString(token));
    stakingToken.totalDelegates = stakingToken.totalDelegates.plus(BIGINT_ONE);
    stakingToken.save();

    delegate.hasBeenStandardDelegate = true;
    delegate.save();
  }

  return delegate;
}

export function getOrCreateOptimisticDelegate(
  token: string,
  address: string
): Delegate {
  const delegate = getOrCreateDelegate(token, address);

  if (!delegate.hasBeenOptimisticDelegate && address != GENESIS_ADDRESS) {
    const stakingToken = getOrCreateStakingToken(Address.fromString(token));
    // totalOptimisticDelegates is nullable in schema for grafting compat but backfilled in getOrCreateStakingToken.
    stakingToken.totalOptimisticDelegates =
      stakingToken.totalOptimisticDelegates!.plus(BIGINT_ONE);
    stakingToken.save();

    delegate.hasBeenOptimisticDelegate = true;
    delegate.save();
  }

  return delegate;
}

export function getOrCreateVoteDailySnapshot(
  proposal: Proposal,
  block: ethereum.Block
): VoteDailySnapshot {
  const snapshotId =
    proposal.id + "-" + (block.timestamp.toI64() / SECONDS_PER_DAY).toString();
  const previousSnapshot = VoteDailySnapshot.load(snapshotId);

  if (previousSnapshot != null) {
    return previousSnapshot as VoteDailySnapshot;
  }
  const snapshot = new VoteDailySnapshot(snapshotId);
  return snapshot;
}

export function _handleProposalCreated(
  proposalId: BigInt,
  proposerAddr: string,
  targets: Address[],
  values: BigInt[],
  signatures: string[],
  calldatas: Bytes[],
  voteStart: BigInt,
  voteEnd: BigInt,
  description: string,
  quorum: BigInt,
  event: ethereum.Event
): void {
  const proposalIdString = proposalId.toString();
  const proposal = getProposal(proposalIdString);
  const governance = getGovernance(event.address.toHexString());
  const contract = Governor.bind(event.address);
  const isOptimistic = contract.try_isOptimistic(proposalId);
  const proposalIsOptimistic = !isOptimistic.reverted && isOptimistic.value;

  proposal.proposer = getOrCreateDelegate(governance.token, proposerAddr).id;
  proposal.txnHash = event.transaction.hash.toHexString();
  proposal.againstDelegateVotes = BIGINT_ZERO;
  proposal.forDelegateVotes = BIGINT_ZERO;
  proposal.abstainDelegateVotes = BIGINT_ZERO;
  proposal.totalDelegateVotes = BIGINT_ZERO;
  proposal.againstWeightedVotes = BIGINT_ZERO;
  proposal.forWeightedVotes = BIGINT_ZERO;
  proposal.abstainWeightedVotes = BIGINT_ZERO;
  proposal.totalWeightedVotes = BIGINT_ZERO;
  proposal.targets = addressesToStrings(targets);
  proposal.values = values;
  proposal.signatures = signatures;
  proposal.calldatas = calldatas;
  proposal.creationBlock = event.block.number;
  proposal.creationTime = event.block.timestamp;
  proposal.voteStart = voteStart;
  proposal.voteEnd = voteEnd;
  proposal.description = description;
  proposal.state =
    event.block.timestamp >= proposal.voteStart
      ? ProposalState.ACTIVE
      : ProposalState.PENDING;
  proposal.governance = event.address.toHexString();
  proposal.quorumVotes = quorum;
  proposal.isOptimistic = proposalIsOptimistic;

  if (proposal.isOptimistic) {
    const vetoThreshold = contract.try_vetoThreshold(proposalId);
    if (!vetoThreshold.reverted) {
      proposal.vetoThreshold = vetoThreshold.value;
    }
  }
  proposal.save();

  // Increment gov proposal count
  governance.proposalCount = governance.proposalCount.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalCanceled(
  proposalId: string,
  event: ethereum.Event
): void {
  const proposal = getProposal(proposalId);
  proposal.state = ProposalState.CANCELED;
  proposal.cancellationTxnHash = event.transaction.hash.toHexString();
  proposal.cancellationAccount = getOrCreateAccount(event.transaction.from).id;
  proposal.cancellationBlock = event.block.number;
  proposal.cancellationTime = event.block.timestamp;
  proposal.save();

  // Update governance proposal state counts
  const governance = getGovernance(event.address.toHexString());
  governance.proposalsCanceled = governance.proposalsCanceled.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalExecuted(
  proposalId: string,
  event: ethereum.Event
): void {
  // Update proposal status + execution metadata
  const proposal = getProposal(proposalId);
  proposal.state = ProposalState.EXECUTED;
  proposal.executionTxnHash = event.transaction.hash.toHexString();
  proposal.executionAccount = getOrCreateAccount(event.transaction.from).id;
  proposal.executionBlock = event.block.number;
  proposal.executionTime = event.block.timestamp;
  proposal.save();

  // Update governance proposal state counts
  const governance = getGovernance(event.address.toHexString());
  governance.proposalsQueued = governance.proposalsQueued.minus(BIGINT_ONE);
  governance.proposalsExecuted = governance.proposalsExecuted.plus(BIGINT_ONE);
  governance.save();
}

export function _handleProposalExtended(
  proposalId: string,
  extendedDeadline: BigInt
): void {
  // Update proposal endBlock
  const proposal = getProposal(proposalId);
  proposal.voteEnd = extendedDeadline;
  proposal.save();
}

export function _handleProposalQueued(
  proposalId: BigInt,
  eta: BigInt,
  event: ethereum.Event
): void {
  // Update proposal status + execution metadata
  const proposal = getProposal(proposalId.toString());
  proposal.state = ProposalState.QUEUED;
  proposal.queueTxnHash = event.transaction.hash.toHexString();
  proposal.queueAccount = getOrCreateAccount(event.transaction.from).id;
  proposal.queueBlock = event.block.number;
  proposal.queueTime = event.block.timestamp;
  proposal.executionETA = eta;

  // Get the timelock operation created in the same transaction
  const txHash = event.transaction.hash.toHexString();
  const operationByTx = TimelockOperationByTx.load(txHash);

  if (!operationByTx) {
    log.error("TimelockOperationByTx not found for transaction: {}", [txHash]);
    proposal.save();
    return;
  }

  // Link the proposal with the timelock operation
  proposal.timelockId = operationByTx.timelockId;

  // Update the TimelockOperation to reference this proposal
  const operation = TimelockOperation.load(operationByTx.timelockId);
  if (!operation) {
    log.error("TimelockOperation not found for id: {}", [
      operationByTx.timelockId,
    ]);
    proposal.save();
    return;
  }

  operation.proposal = proposal.id;
  operation.save();
  proposal.save();

  const governance = getGovernance(event.address.toHexString());
  governance.proposalsQueued = governance.proposalsQueued.plus(BIGINT_ONE);
  governance.save();
}

export function _handleVoteCast(
  proposal: Proposal,
  voterAddress: string,
  weight: BigInt,
  reason: string,
  support: i32,
  event: ethereum.Event
): void {
  const voteId = voterAddress.concat("-").concat(proposal.id);
  const tokenId = getGovernance(event.address.toHexString()).token;
  const voter = getOrCreateDelegate(tokenId, voterAddress);
  const isOptimisticProposal = proposal.isOptimistic;
  const vote = new Vote(voteId);
  vote.proposal = proposal.id;
  vote.voter = voter.id;
  vote.weight = weight;
  vote.reason = reason;
  vote.block = event.block.number;
  vote.blockTime = event.block.timestamp;
  vote.txnHash = event.transaction.hash.toHexString();
  vote.logIndex = event.logIndex;
  // Retrieve enum string key by value (0 = Against, 1 = For, 2 = Abstain)
  vote.choice = getVoteChoiceByValue(support);
  vote.blockTimeId = `${event.block.timestamp.toI64()}-${event.logIndex}`;
  vote.save();

  // Increment respective vote choice counts
  // NOTE: We are counting the weight instead of individual votes
  if (support === VoteChoice.AGAINST_VALUE) {
    proposal.againstDelegateVotes =
      proposal.againstDelegateVotes.plus(BIGINT_ONE);
    proposal.againstWeightedVotes = proposal.againstWeightedVotes.plus(weight);
  } else if (support === VoteChoice.FOR_VALUE) {
    proposal.forDelegateVotes = proposal.forDelegateVotes.plus(BIGINT_ONE);
    proposal.forWeightedVotes = proposal.forWeightedVotes.plus(weight);
  } else if (support === VoteChoice.ABSTAIN_VALUE) {
    proposal.abstainDelegateVotes =
      proposal.abstainDelegateVotes.plus(BIGINT_ONE);
    proposal.abstainWeightedVotes = proposal.abstainWeightedVotes.plus(weight);
  }
  // Increment total
  proposal.totalDelegateVotes = proposal.totalDelegateVotes.plus(BIGINT_ONE);
  proposal.totalWeightedVotes = proposal.totalWeightedVotes.plus(weight);
  proposal.save();

  // Add 1 to participant's proposal voting count
  if (isOptimisticProposal) {
    voter.numberOptimisticVotes = voter.numberOptimisticVotes + 1;
  } else {
    voter.numberVotes = voter.numberVotes + 1;
  }
  voter.save();

  // Take snapshot
  const dailySnapshot = getOrCreateVoteDailySnapshot(proposal, event.block);
  dailySnapshot.proposal = proposal.id;
  dailySnapshot.forWeightedVotes = proposal.forWeightedVotes;
  dailySnapshot.againstWeightedVotes = proposal.againstWeightedVotes;
  dailySnapshot.abstainWeightedVotes = proposal.abstainWeightedVotes;
  dailySnapshot.totalWeightedVotes = proposal.totalWeightedVotes;
  dailySnapshot.blockNumber = event.block.number;
  dailySnapshot.timestamp = event.block.timestamp;
  dailySnapshot.save();
}
