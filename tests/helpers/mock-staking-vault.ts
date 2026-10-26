import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";
import { Role } from "../../src/utils/constants";
import { mockERC20, mockERC20TotalSupply } from "./mock-erc20";

const DEFAULT_ADMIN_ROLE = Bytes.fromHexString(Role.DEFAULT_ADMIN);

// Mocks every read getOrCreateStakingToken performs on a StakingVault. Pass null
// to make a call revert (legacy vault without the function / non-vault token).
export function mockStakingVault(
  vault: Address,
  symbol: string,
  name: string,
  decimals: i32,
  totalSupply: BigInt,
  asset: Address | null,
  unstakingManager: Address | null,
  unstakingDelay: BigInt | null,
  exchangeRate: BigInt | null,
  totalAssets: BigInt | null
): void {
  mockERC20(vault, symbol, name, decimals);
  mockERC20TotalSupply(vault, totalSupply);

  if (asset !== null) {
    createMockedFunction(vault, "asset", "asset():(address)").returns([
      ethereum.Value.fromAddress(asset),
    ]);
  } else {
    createMockedFunction(vault, "asset", "asset():(address)").reverts();
  }

  if (unstakingManager !== null) {
    createMockedFunction(
      vault,
      "unstakingManager",
      "unstakingManager():(address)"
    ).returns([ethereum.Value.fromAddress(unstakingManager)]);
  } else {
    createMockedFunction(
      vault,
      "unstakingManager",
      "unstakingManager():(address)"
    ).reverts();
  }

  if (unstakingDelay !== null) {
    createMockedFunction(
      vault,
      "unstakingDelay",
      "unstakingDelay():(uint256)"
    ).returns([ethereum.Value.fromUnsignedBigInt(unstakingDelay)]);
  } else {
    createMockedFunction(
      vault,
      "unstakingDelay",
      "unstakingDelay():(uint256)"
    ).reverts();
  }

  // Not read by the fallback path for legacy vaults; tests that care re-mock.
  createMockedFunction(vault, "tokenJar", "tokenJar():(address)").reverts();
  createMockedFunction(vault, "rewardRatio", "rewardRatio():(uint256)").reverts();

  mockVaultExchangeRate(vault, decimals, exchangeRate, totalAssets);
}

export function mockVaultTokenJar(vault: Address, tokenJar: Address): void {
  createMockedFunction(vault, "tokenJar", "tokenJar():(address)").returns([
    ethereum.Value.fromAddress(tokenJar),
  ]);
}

export function mockVaultRewardRatio(vault: Address, rewardRatio: BigInt): void {
  createMockedFunction(vault, "rewardRatio", "rewardRatio():(uint256)").returns(
    [ethereum.Value.fromUnsignedBigInt(rewardRatio)]
  );
}

// convertToAssets(10^decimals) + totalAssets(). Re-mock between polls to move the rate.
export function mockVaultExchangeRate(
  vault: Address,
  decimals: i32,
  exchangeRate: BigInt | null,
  totalAssets: BigInt | null
): void {
  const oneShare = BigInt.fromI32(10).pow(decimals as u8);
  if (exchangeRate !== null) {
    createMockedFunction(
      vault,
      "convertToAssets",
      "convertToAssets(uint256):(uint256)"
    )
      .withArgs([ethereum.Value.fromUnsignedBigInt(oneShare)])
      .returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);
  } else {
    createMockedFunction(
      vault,
      "convertToAssets",
      "convertToAssets(uint256):(uint256)"
    )
      .withArgs([ethereum.Value.fromUnsignedBigInt(oneShare)])
      .reverts();
  }

  if (totalAssets !== null) {
    createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)").returns(
      [ethereum.Value.fromUnsignedBigInt(totalAssets)]
    );
  } else {
    createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)").reverts();
  }
}

// AccessControlEnumerable on the vault: DEFAULT_ADMIN_ROLE member 0 (the timelock).
export function mockVaultAdmin(vault: Address, admin: Address): void {
  mockRoleMembers(vault, DEFAULT_ADMIN_ROLE, [admin]);
}

export function mockRoleMembers(
  contract: Address,
  role: Bytes,
  members: Address[]
): void {
  createMockedFunction(
    contract,
    "getRoleMemberCount",
    "getRoleMemberCount(bytes32):(uint256)"
  )
    .withArgs([ethereum.Value.fromFixedBytes(role)])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(members.length))]);

  for (let i = 0; i < members.length; i++) {
    createMockedFunction(
      contract,
      "getRoleMember",
      "getRoleMember(bytes32,uint256):(address)"
    )
      .withArgs([
        ethereum.Value.fromFixedBytes(role),
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(i)),
      ])
      .returns([ethereum.Value.fromAddress(members[i])]);
  }
}

// TimelockControllerOptimistic reads used by createGovernanceTimelock / getOrCreateGovernance.
export function mockTimelock(
  timelock: Address,
  minDelay: BigInt,
  cancellerRole: Bytes,
  cancellers: Address[],
  proposerRole: Bytes,
  proposers: Address[],
  optimisticProposers: Address[]
): void {
  createMockedFunction(timelock, "getMinDelay", "getMinDelay():(uint256)").returns(
    [ethereum.Value.fromUnsignedBigInt(minDelay)]
  );
  createMockedFunction(
    timelock,
    "CANCELLER_ROLE",
    "CANCELLER_ROLE():(bytes32)"
  ).returns([ethereum.Value.fromFixedBytes(cancellerRole)]);
  createMockedFunction(
    timelock,
    "PROPOSER_ROLE",
    "PROPOSER_ROLE():(bytes32)"
  ).returns([ethereum.Value.fromFixedBytes(proposerRole)]);
  mockRoleMembers(timelock, cancellerRole, cancellers);
  mockRoleMembers(timelock, proposerRole, proposers);
  mockRoleMembers(
    timelock,
    Bytes.fromHexString(Role.OPTIMISTIC_PROPOSER),
    optimisticProposers
  );
}

// ReserveOptimisticGovernor reads used by getOrCreateGovernance.
export function mockOptimisticGovernor(
  governor: Address,
  token: Address,
  name: string,
  version: string,
  votingDelay: BigInt,
  votingPeriod: BigInt,
  proposalThreshold: BigInt,
  quorumDenominator: BigInt,
  quorumNumerator: BigInt,
  vetoDelay: BigInt,
  vetoPeriod: BigInt,
  vetoThreshold: BigInt,
  proposalThrottleCapacity: BigInt,
  selectorRegistry: Address,
  pastSupply: BigInt = BigInt.zero(),
  voteExtension: BigInt = BigInt.fromI32(172800),
  clock: BigInt = BigInt.fromI32(1_700_000_000)
): void {
  createMockedFunction(governor, "token", "token():(address)").returns([
    ethereum.Value.fromAddress(token),
  ]);
  createMockedFunction(governor, "name", "name():(string)").returns([
    ethereum.Value.fromString(name),
  ]);
  createMockedFunction(governor, "version", "version():(string)").returns([
    ethereum.Value.fromString(version),
  ]);
  createMockedFunction(governor, "votingDelay", "votingDelay():(uint256)").returns(
    [ethereum.Value.fromUnsignedBigInt(votingDelay)]
  );
  createMockedFunction(
    governor,
    "votingPeriod",
    "votingPeriod():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(votingPeriod)]);
  createMockedFunction(
    governor,
    "proposalThreshold",
    "proposalThreshold():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(proposalThreshold)]);
  createMockedFunction(
    governor,
    "quorumDenominator",
    "quorumDenominator():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(quorumDenominator)]);
  createMockedFunction(
    governor,
    "quorumNumerator",
    "quorumNumerator():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(quorumNumerator)]);
  createMockedFunction(
    governor,
    "optimisticParams",
    "optimisticParams():(uint48,uint32,uint256)"
  ).returns([
    ethereum.Value.fromUnsignedBigInt(vetoDelay),
    ethereum.Value.fromUnsignedBigInt(vetoPeriod),
    ethereum.Value.fromUnsignedBigInt(vetoThreshold),
  ]);
  createMockedFunction(
    governor,
    "proposalThrottleCapacity",
    "proposalThrottleCapacity():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(proposalThrottleCapacity)]);
  createMockedFunction(
    governor,
    "selectorRegistry",
    "selectorRegistry():(address)"
  ).returns([ethereum.Value.fromAddress(selectorRegistry)]);
  createMockedFunction(governor, "clock", "clock():(uint48)").returns([
    ethereum.Value.fromUnsignedBigInt(clock),
  ]);
  createMockedFunction(
    governor,
    "lateQuorumVoteExtension",
    "lateQuorumVoteExtension():(uint48)"
  ).returns([ethereum.Value.fromUnsignedBigInt(voteExtension)]);
  mockPastTotalSupply(token, clock.minus(BigInt.fromI32(1)), pastSupply);
}

// ERC20Votes getPastTotalSupply(timepoint) on a vote-lock vault.
export function mockPastTotalSupply(
  token: Address,
  timepoint: BigInt,
  supply: BigInt
): void {
  createMockedFunction(
    token,
    "getPastTotalSupply",
    "getPastTotalSupply(uint256):(uint256)"
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(timepoint)])
    .returns([ethereum.Value.fromUnsignedBigInt(supply)]);
}
