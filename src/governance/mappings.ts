import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  GovernanceTimelock,
  Proposal,
  StakingToken,
  Token,
} from "../../generated/schema";
import {
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
import { BIGINT_ONE, GovernanceType, ProposalState } from "../utils/constants";
import {
  Governor,
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  ProposalThresholdSet,
  QuorumNumeratorUpdated,
  VoteCast,
  VotingDelaySet,
  VotingPeriodSet,
} from "./../../generated/templates/Governance/Governor";
import { getOrCreateStakingToken } from "../utils/getters";
import { getDTF } from "../dtf/handlers";

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
    event.params.proposalId.toString(),
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
    proposal.delegatesAtStart = stakingToken.currentDelegates;
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
  // TODO: Only listens for guardian role
  let guardianRole = timelockContract.CANCELLER_ROLE();
  let proposerRole = timelockContract.PROPOSER_ROLE();

  if (event.params.role.equals(guardianRole)) {
    let current = timelock.get("guardians")!.toStringArray();
    current.push(event.params.account.toHexString());
    timelock.guardians = current;
    timelock.save();
  } else if (event.params.role.equals(proposerRole)) {
    // Track Governor
    let governance = getOrCreateGovernance(event.params.account, event.address);
    timelock.governance = governance.id;
    timelock.save();

    if (timelock.type == GovernanceType.VOTE_LOCKING) {
      let stakingToken = getOrCreateStakingToken(
        Address.fromString(timelock.entity)
      );
      stakingToken.governance = governance.id;
      stakingToken.save();
    } else {
      let dtf = getDTF(Address.fromString(timelock.entity));
      if (timelock.type == GovernanceType.OWNER) {
        dtf.ownerGovernance = governance.id;
      } else {
        dtf.tradingGovernance = governance.id;
      }
      dtf.save();
    }
  }
}

export function handleTimelockRoleRevoked(event: RoleRevoked): void {
  let timelock = GovernanceTimelock.load(event.address.toHexString())!;

  let timelockContract = Timelock.bind(event.address);
  let guardianRole = timelockContract.CANCELLER_ROLE();

  if (event.params.role.equals(guardianRole)) {
    let current = timelock.guardians;
    let index = current.indexOf(event.params.account.toHexString());

    if (index != -1) {
      timelock.guardians = removeFromArrayAtIndex(current, index);
      timelock.save();
    }
  }
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
