import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { DTF, UnstakingManager, Version } from "../../generated/schema";
import {
  DTF as DTFTemplate,
  FolioDeployer as FolioDeployerTemplate,
  StakingToken as StakingTokenTemplate,
  UnstakingManager as UnstakingManagerTemplate,
} from "../../generated/templates";
import { StakingVault } from "../../generated/templates/StakingToken/StakingVault";
import { BIGINT_ZERO, GENESIS_ADDRESS, TokenType } from "../utils/constants";
import {
  getOrCreateGovernance,
  getOrCreateStakingToken,
  getOrCreateToken,
} from "../utils/getters";

export function _handleVersionRegistered(
  versionHash: Bytes,
  deployer: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let version = new Version(versionHash.toHexString());
  version.hash = versionHash;
  version.address = deployer;
  version.blockNumber = blockNumber;
  version.timestamp = timestamp;
  version.save();

  // Track folio deployer events
  FolioDeployerTemplate.create(deployer);
}

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
  dtf.legacyAuctionApprovers = [];
  dtf.auctionLaunchers = [];
  dtf.brandManagers = [];
  dtf.admins = [];
  dtf.legacyAdmins = [];
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
  dtf.ownerGovernance = getOrCreateGovernance(ownerGovernor, ownerTimelock).id;

  if (tradingTimelock.toHexString() != GENESIS_ADDRESS) {
    dtf.tradingGovernance = getOrCreateGovernance(
      tradingGovernor,
      tradingTimelock
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
  stakingToken.governance = getOrCreateGovernance(governor, timelock).id;
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
