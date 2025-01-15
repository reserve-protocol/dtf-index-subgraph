import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Timelock } from "./../../generated/templates/Governance/Timelock";
import {
  DTF,
  Governance,
  GovernanceTimelock,
  StakingToken,
} from "../../generated/schema";
import {
  DTF as DTFTemplate,
  Timelock as TimelockTemplate,
  Governance as GovernanceTemplate,
} from "../../generated/templates";
import { Governor } from "../../generated/templates/Governance/Governor";
import { getOrCreateStakingToken, getOrCreateToken } from "../utils/getters";
import { BIGINT_ZERO } from "../utils/constants";

export function _handleDTFDeployed(
  dtfAddress: Address,
  proxyAdmin: Address,
  deployer: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let dtf = new DTF(dtfAddress.toHexString());
  dtf.token = getOrCreateToken(dtfAddress).id;
  dtf.deployer = deployer;
  dtf.proxyAdmin = proxyAdmin;
  dtf.blockNumber = blockNumber;
  dtf.timestamp = timestamp;
  dtf.save();

  // Track transfer and trade events
  DTFTemplate.create(dtfAddress);
}

export function _handleGovernedDTFDeployed(
  dtfAddress: Address,
  stToken: Address,
  ownerGovernor: Address,
  ownerTimelock: Address,
  tradingGovernor: Address,
  tradingTimelock: Address
): void {
  let dtf = DTF.load(dtfAddress.toHexString());
  if (!dtf) {
    return;
  }

  dtf.stToken = stToken.toHexString();
  dtf.stTokenAddress = stToken;
  dtf.ownerGovernance = createGovernance(
    ownerGovernor,
    ownerTimelock,
    stToken
  ).id;
  dtf.tradingGovernance = createGovernance(
    tradingGovernor,
    tradingTimelock,
    stToken
  ).id;
  dtf.save();
}

export function _handleDeployedGovernedStakingToken(
  underlyingAddress: Address,
  stTokenAddress: Address,
  governor: Address,
  timelock: Address
): void {
  let stakingToken = getOrCreateStakingToken(stTokenAddress);

  stakingToken.underlying = getOrCreateToken(underlyingAddress).id;
  stakingToken.governance = createGovernance(
    governor,
    timelock,
    stTokenAddress
  ).id;
  stakingToken.save();

  // TODO: track staking token events
  // Track stToken events
  // TokenTemplate.create(stTokenAddress);
}

export function createTimelock(
  timelockAddress: Address,
  governanceId: string
): GovernanceTimelock {
  const timelockContract = Timelock.bind(timelockAddress);

  const timelock = new GovernanceTimelock(timelockAddress.toHexString());
  timelock.governance = governanceId;
  timelock.guardians = [];
  timelock.executionDelay = timelockContract.getMinDelay();
  timelock.save();

  // Track timelock events
  TimelockTemplate.create(timelockAddress);

  return timelock;
}

export function createGovernance(
  governanceAddress: Address,
  timelockAddress: Address,
  tokenAddress: Address
): Governance {
  let governance = new Governance(governanceAddress.toHexString());

  governance.timelock = createTimelock(timelockAddress, governance.id).id;
  governance.token = getOrCreateStakingToken(tokenAddress).id;

  const contract = Governor.bind(governanceAddress);
  // Params
  governance.name = contract.name();
  governance.version = contract.version();
  governance.votingDelay = contract.votingDelay();
  governance.votingPeriod = contract.votingPeriod();
  governance.proposalThreshold = contract.proposalThreshold();
  governance.quorumDenominator = contract.quorumDenominator();
  governance.proposalCount = BIGINT_ZERO;
  governance.proposalsQueued = BIGINT_ZERO;
  governance.proposalsExecuted = BIGINT_ZERO;
  governance.proposalsCanceled = BIGINT_ZERO;
  governance.save();

  // Track governor events
  GovernanceTemplate.create(governanceAddress);

  return governance as Governance;
}
