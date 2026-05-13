import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  GovernanceTimelock,
  Proposal,
  StakingToken,
  TimelockOperation,
  TimelockOperationByTx,
  Token,
} from "../../generated/schema";
import {
  CallScheduled,
  Cancelled,
  MinDelayChange,
  RoleGranted,
  RoleRevoked,
  Timelock,
} from "../../generated/templates/Governance/Timelock";
import {
  _handleProposalCanceled,
  _handleProposalCreated,
  _handleProposalExecuted,
  _handleProposalQueued,
  _handleVoteCast,
  getGovernance,
  getProposal,
} from "../governance/handlers";
import { removeFromArrayAtIndex } from "../utils/arrays";
import { BIGINT_ONE, ProposalState, Role } from "../utils/constants";
import {
  Governor,
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  ProposalThresholdSet,
  OptimisticParamsUpdated,
  ProposalThrottleUpdated,
  QuorumNumeratorUpdated,
  VoteCast,
  VotingDelaySet,
  VotingPeriodSet,
} from "./../../generated/templates/Governance/Governor";
import { attachGovernanceToTimelock } from "../utils/getters";

// ProposalCanceled(proposalId)
export function handleProposalCanceled(event: ProposalCanceled): void {
  _handleProposalCanceled(event.params.proposalId.toString(), event);
}

// ProposalCreated(proposalId, proposer, targets, values, signatures, calldatas, startBlock, endBlock, description)
export function handleProposalCreated(event: ProposalCreated): void {
  const quorumVotes = getQuorumFromContract(
    event.address,
    event.block.timestamp.minus(BIGINT_ONE)
  );

  // FIXME: Prefer to use a single object arg for params
  // e.g.  { proposalId: event.params.proposalId, proposer: event.params.proposer, ...}
  // but graph wasm compilation breaks for unknown reasons
  _handleProposalCreated(
    event.params.proposalId,
    event.params.proposer.toHexString(),
    event.params.targets,
    event.params.values,
    event.params.signatures,
    event.params.calldatas,
    event.params.voteStart,
    event.params.voteEnd,
    event.params.description,
    quorumVotes,
    event
  );
}

// ProposalExecuted(proposalId)
export function handleProposalExecuted(event: ProposalExecuted): void {
  _handleProposalExecuted(event.params.proposalId.toString(), event);
}

// ProposalQueued(proposalId, eta)
export function handleProposalQueued(event: ProposalQueued): void {
  _handleProposalQueued(
    event.params.proposalId,
    event.params.etaSeconds,
    event
  );
}

export function handleTimelockMinDelayChange(event: MinDelayChange): void {
  const timelock = GovernanceTimelock.load(event.address.toHexString())!;
  timelock.executionDelay = event.params.newDuration;
  timelock.save();
}

export function handleTimelockCallScheduled(event: CallScheduled): void {
  // Store the timelock operation with its transaction hash
  // This will be used to link the timelock ID to the proposal
  const timelockId = event.params.id.toHexString();
  const txHash = event.transaction.hash.toHexString();

  const operation = new TimelockOperation(timelockId);
  operation.transactionHash = txHash;
  operation.blockNumber = event.block.number;
  operation.timestamp = event.block.timestamp;
  operation.save();

  // Create a mapping from transaction hash to timelock ID
  // This allows ProposalQueued handler to retrieve the timelock ID
  const operationByTx = new TimelockOperationByTx(txHash);
  operationByTx.timelockId = timelockId;
  operationByTx.save();
}

export function handleTimelockCancelled(event: Cancelled): void {
  const timelockId = event.params.id.toHexString();

  // Load the timelock operation to get the associated proposal
  const operation = TimelockOperation.load(timelockId);
  if (!operation) {
    log.error("TimelockOperation not found for timelockId: {}", [timelockId]);
    return;
  }

  if (!operation.proposal) {
    log.error(
      "TimelockOperation has no associated proposal for timelockId: {}",
      [timelockId]
    );
    return;
  }

  // Load and update the proposal
  const proposal = Proposal.load(operation.proposal as string);
  if (!proposal) {
    log.error("Proposal not found for id: {}", [operation.proposal as string]);
    return;
  }

  proposal.state = ProposalState.CANCELED;
  proposal.cancellationTxnHash = event.transaction.hash.toHexString();
  proposal.cancellationBlock = event.block.number;
  proposal.cancellationTime = event.block.timestamp;
  proposal.save();

  // Update governance proposal state counts
  const governance = getGovernance(proposal.governance);
  governance.proposalsCanceled = governance.proposalsCanceled.plus(BIGINT_ONE);
  governance.save();
}

export function handleProposalThresholdSet(event: ProposalThresholdSet): void {
  const governance = getGovernance(event.address.toHexString());
  governance.proposalThreshold = event.params.newProposalThreshold;
  governance.save();
}

// QuorumNumeratorUpdated(oldQuorumNumerator, newQuorumNumerator)
export function handleQuorumNumeratorUpdated(
  event: QuorumNumeratorUpdated
): void {
  const governance = getGovernance(event.address.toHexString());
  governance.quorumNumerator = event.params.newQuorumNumerator;
  governance.save();
}

export function handleOptimisticParamsUpdated(
  event: OptimisticParamsUpdated
): void {
  const governance = getGovernance(event.address.toHexString());
  governance.isOptimistic = true;
  governance.optimisticVetoDelay = event.params.optimisticParams.vetoDelay;
  governance.optimisticVetoPeriod = event.params.optimisticParams.vetoPeriod;
  governance.optimisticVetoThreshold =
    event.params.optimisticParams.vetoThreshold;
  governance.save();
}

export function handleProposalThrottleUpdated(
  event: ProposalThrottleUpdated
): void {
  const governance = getGovernance(event.address.toHexString());
  governance.isOptimistic = true;
  governance.optimisticProposalThrottleCapacity = event.params.throttleCapacity;
  governance.save();
}

function getLatestProposalValues(proposalId: string): Proposal {
  const proposal = getProposal(proposalId);
  const governance = getGovernance(proposal.governance);
  const stakingToken = StakingToken.load(governance.token)!;
  const token = Token.load(stakingToken.token)!;

  // On first vote, set state and quorum values
  if (proposal.state == ProposalState.PENDING) {
    proposal.state = ProposalState.ACTIVE;
    proposal.quorumVotes = getQuorumFromContract(
      Address.fromString(proposal.governance),
      proposal.voteStart
    );

    proposal.tokenHoldersAtStart = token.currentHolderCount;

    if (proposal.isOptimistic) {
      proposal.delegatesAtStart = stakingToken.currentOptimisticDelegates;
    } else {
      proposal.delegatesAtStart = stakingToken.currentDelegates;
    }
  }
  return proposal;
}

// VoteCast(account, proposalId, support, weight, reason);
export function handleVoteCast(event: VoteCast): void {
  const proposal = getLatestProposalValues(event.params.proposalId.toString());

  _handleVoteCast(
    proposal,
    event.params.voter.toHexString(),
    event.params.weight,
    event.params.reason,
    event.params.support,
    event
  );
}

export function handleVotingDelaySet(event: VotingDelaySet): void {
  const governance = getGovernance(event.address.toHexString());
  governance.votingDelay = event.params.newVotingDelay;
  governance.save();
}

export function handleVotingPeriodSet(event: VotingPeriodSet): void {
  const governance = getGovernance(event.address.toHexString());
  governance.votingPeriod = event.params.newVotingPeriod;
  governance.save();
}

export function handleTimelockRoleGranted(event: RoleGranted): void {
  let timelock = GovernanceTimelock.load(event.address.toHexString())!;
  let timelockContract = Timelock.bind(event.address);
  let guardianRole = timelockContract.CANCELLER_ROLE();
  let proposerRole = timelockContract.PROPOSER_ROLE();
  let optimisticProposerRole = Bytes.fromHexString(Role.OPTIMISTIC_PROPOSER);
  let account = event.params.account.toHexString();

  if (event.params.role.equals(guardianRole)) {
    timelock.guardians = addUniqueString(timelock.guardians, account);
    timelock.save();
  } else if (event.params.role.equals(optimisticProposerRole)) {
    timelock.optimisticProposers = addUniqueString(
      getNullableStringArray(timelock.optimisticProposers),
      account
    );
    timelock.save();

    if (timelock.governance !== null) {
      const governance = getGovernance(timelock.governance!);
      governance.optimisticProposers = getNullableStringArray(
        timelock.optimisticProposers
      );
      governance.save();
    }
  } else if (event.params.role.equals(proposerRole)) {
    // Track Governor
    attachGovernanceToTimelock(timelock, event.params.account);
  }
}

export function handleTimelockRoleRevoked(event: RoleRevoked): void {
  let timelock = GovernanceTimelock.load(event.address.toHexString())!;

  let timelockContract = Timelock.bind(event.address);
  let guardianRole = timelockContract.CANCELLER_ROLE();
  let optimisticProposerRole = Bytes.fromHexString(Role.OPTIMISTIC_PROPOSER);
  let account = event.params.account.toHexString();

  if (event.params.role.equals(guardianRole)) {
    let current = timelock.guardians;
    let index = current.indexOf(account);

    if (index != -1) {
      timelock.guardians = removeFromArrayAtIndex(current, index);
    }

    timelock.save();
  } else if (event.params.role.equals(optimisticProposerRole)) {
    let optimisticProposers = getNullableStringArray(
      timelock.optimisticProposers
    );
    let index = optimisticProposers.indexOf(account);

    if (index != -1) {
      timelock.optimisticProposers = removeFromArrayAtIndex(
        optimisticProposers,
        index
      );
      timelock.save();

      if (timelock.governance !== null) {
        const governance = getGovernance(timelock.governance!);
        governance.optimisticProposers = getNullableStringArray(
          timelock.optimisticProposers
        );
        governance.save();
      }
    }
  }
}

function getNullableStringArray(value: Array<string> | null): Array<string> {
  return value !== null ? value : new Array<string>();
}

function addUniqueString(value: Array<string>, item: string): Array<string> {
  if (value.indexOf(item) == -1) {
    value.push(item);
  }
  return value;
}

function getQuorumFromContract(
  contractAddress: Address,
  blockTimestamp: BigInt
): BigInt {
  const governance = getGovernance(contractAddress.toHexString());
  const contract = Governor.bind(contractAddress);
  const quorumVotes = contract.quorum(blockTimestamp);

  governance.quorumVotes = quorumVotes;
  governance.save();

  return quorumVotes;
}
