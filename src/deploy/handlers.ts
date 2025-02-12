import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  DTF,
  Governance,
  GovernanceTimelock,
  UnstakingManager,
} from "../../generated/schema";
import {
  DTF as DTFTemplate,
  Governance as GovernanceTemplate,
  StakingToken as StakingTokenTemplate,
  Timelock as TimelockTemplate,
  UnstakingManager as UnstakingManagerTemplate,
} from "../../generated/templates";
import { Governor } from "../../generated/templates/Governance/Governor";
import { StakingVault } from "../../generated/templates/StakingToken/StakingVault";
import { BIGINT_ZERO, GENESIS_ADDRESS, TokenType } from "../utils/constants";
import { getOrCreateStakingToken, getOrCreateToken } from "../utils/getters";
import { Timelock } from "./../../generated/templates/Governance/Timelock";

export function _handleDTFDeployed(
  dtfAddress: Address,
  proxyAdmin: Address,
  deployer: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let dtf = new DTF(dtfAddress.toHexString());
  dtf.token = getOrCreateToken(dtfAddress, TokenType.DTF).id;
  dtf.deployer = deployer;
  dtf.proxyAdmin = proxyAdmin;
  dtf.blockNumber = blockNumber;
  dtf.timestamp = timestamp;
  dtf.totalRevenue = BIGINT_ZERO;
  dtf.protocolRevenue = BIGINT_ZERO;
  dtf.governanceRevenue = BIGINT_ZERO;
  dtf.externalRevenue = BIGINT_ZERO;
  dtf.mintingFee = BIGINT_ZERO;
  dtf.tvlFee = BIGINT_ZERO;
  dtf.auctionDelay = BIGINT_ZERO;
  dtf.auctionLength = BIGINT_ZERO;
  dtf.mandate = "";
  dtf.annualizedTvlFee = BIGINT_ZERO;
  dtf.feeRecipients = "";

  dtf.ownerAddress = deployer;
  dtf.auctionApprovers = [];
  dtf.auctionLaunchers = [];
  dtf.brandManagers = [];
  dtf.admins = [];
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

  if (tradingTimelock.toHexString() != GENESIS_ADDRESS) {
    dtf.tradingGovernance = createGovernance(
      tradingGovernor,
      tradingTimelock,
      stToken
    ).id;
  }

  dtf.ownerAddress = ownerTimelock;
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

  StakingTokenTemplate.create(stTokenAddress);

  // Track unstaking manager events
  let contract = StakingVault.bind(stTokenAddress);
  let unstakingManagerAddress = contract.unstakingManager();
  let unstakingManager = new UnstakingManager(
    unstakingManagerAddress.toHexString()
  );
  unstakingManager.token = stakingToken.id;
  unstakingManager.save();

  UnstakingManagerTemplate.create(unstakingManagerAddress);
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
  governance.quorumNumerator = BIGINT_ZERO;
  governance.proposalCount = BIGINT_ZERO;
  governance.proposalsQueued = BIGINT_ZERO;
  governance.proposalsExecuted = BIGINT_ZERO;
  governance.proposalsCanceled = BIGINT_ZERO;
  governance.save();

  // Track governor events
  GovernanceTemplate.create(governanceAddress);

  return governance as Governance;
}
