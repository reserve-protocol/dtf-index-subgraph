import { Address, BigInt } from "@graphprotocol/graph-ts";
import { DTF } from "../../generated/schema";
import { DTF as DTFTemplate } from "../../generated/templates";
import { Governor } from "../../generated/templates/Governance/Governor";
import {
  BIGINT_ZERO,
  GENESIS_ADDRESS,
  GovernanceType,
  TokenType,
} from "../utils/constants";
import {
  createGovernanceTimelock,
  getOrCreateGovernance,
  getOrCreateStakingToken,
  getOrCreateToken,
} from "../utils/getters";
import { hydrateDTFDeployState } from "../dtf/hydration";

export function _handleDTFDeployed(
  dtfAddress: Address,
  proxyAdmin: Address,
  deployer: Address,
  ownerAddress: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let dtf = new DTF(dtfAddress.toHexString());
  const token = getOrCreateToken(dtfAddress, TokenType.DTF);
  dtf.token = token.id;
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

  // Default to NATIVE DTF with PARTIAL price control, this will set up correctly with the rebalance control set event
  dtf.weightControl = true;
  dtf.priceControl = 1;

  dtf.ownerAddress = ownerAddress;
  dtf.auctionApprovers = [];
  dtf.legacyAuctionApprovers = [];
  dtf.auctionLaunchers = [];
  dtf.brandManagers = [];
  dtf.admins = [];
  dtf.legacyAdmins = [];
  dtf.tradeTokenAllowlist = [];

  hydrateDTFDeployState(dtf, dtfAddress);
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
  // StakingToken + UnstakingManager template subscriptions happen inside
  // getOrCreateStakingToken so every discovery path gets both.
  let stakingToken = getOrCreateStakingToken(stTokenAddress, underlyingAddress);

  stakingToken.governance = getOrCreateGovernance(governor, timelock).id;
  stakingToken.save();
}

// ReserveOptimisticGovernorDeployer (reserve-governor repo). Two flavours share one event:
// - deployWithNewStakingVault: stakingVault is the freshly deployed vault, governor/timelock
//   govern it. The vault uses AccessControl (no OwnershipTransferred), so the timelock entity
//   must be created here instead of relying on the legacy ownership hook.
// - deployWithExistingStakingVault: stakingVault is address(0); governor/timelock are a DTF
//   governance reusing a shared vault (e.g. BSC vlRSR). Only the vault is discovered here
//   (Governor.token()). The Governance entity itself is created when the DTF grants the
//   timelock a role — same as the FolioDeployer path — because getOrCreateGovernance reads
//   optimisticProposers from the timelock entity, which does not exist yet at this point.
export function _handleOptimisticGovernorSystemDeployed(
  stakingVault: Address,
  governor: Address,
  timelock: Address
): void {
  if (stakingVault.toHexString() == GENESIS_ADDRESS) {
    const token = Governor.bind(governor).try_token();
    if (!token.reverted) {
      getOrCreateStakingToken(token.value);
    }
    return;
  }

  getOrCreateStakingToken(stakingVault);

  // Creates the timelock entity + template, finds the governor through PROPOSER_ROLE
  // and links stakingToken.governance via refreshGovernanceLinks.
  createGovernanceTimelock(
    timelock,
    stakingVault.toHexString(),
    GovernanceType.VOTE_LOCKING
  );

  // Reload: createGovernanceTimelock may have saved the staking token.
  let stakingToken = getOrCreateStakingToken(stakingVault);
  stakingToken.governance = getOrCreateGovernance(governor, timelock).id;
  stakingToken.save();
}
