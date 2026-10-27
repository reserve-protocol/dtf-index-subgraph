import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import {
  LateQuorumVoteExtensionSet,
  ProposalThresholdSet,
} from "../generated/templates/Governance/Governor";
import { _handleRoleGranted } from "../src/dtf/handlers";
import {
  handleLateQuorumVoteExtensionSet,
  handleProposalThresholdSet,
} from "../src/governance/mappings";
import { Role } from "../src/utils/constants";
import {
  getOrCreateGovernance,
  refreshVaultGovernances,
} from "../src/utils/getters";
import { createTestDTF } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  mockOptimisticGovernor,
  mockPastTotalSupply,
  mockStakingVault,
  mockTimelock,
  mockVaultAdmin,
  mockVaultRewardRatio,
  mockVaultTokenJar,
} from "./helpers/mock-staking-vault";

// Real governors. BSC vlRSR DAO 0xbaf703e7… (ratio 0.1%, vote supply ~440M) and Base vlPMF DAO 0xa7469b6f…
// (ratio 1%, initialized with no vote supply; the subgraph showed 0.1% until this fix).
const VLRSR = Address.fromString("0xE744C8157c346B2931807F42552c8CBc0BB6D34f");
const VLRSR_GOVERNOR = Address.fromString("0xbaf703e7891943d46ee462a4ec74945b09c67b86");
const VLRSR_TIMELOCK = Address.fromString("0xb8d699cf52f53a8c9801806e6252a837b3e6b039");
const VLRSR_SUPPLY = BigInt.fromString("440118248898585742135575498");
const VLRSR_THRESHOLD_VOTES = BigInt.fromString("440118248898585742135576");

const VLPMF = Address.fromString("0xef8be4818224248dbd0b7aa52c3135422656047d");
const VLPMF_GOVERNOR = Address.fromString("0xa7469b6f53335c963be792459a80dd376fcb87b5");
const VLPMF_TIMELOCK = Address.fromString("0xcffa24b88dcac54cb70bccad398298067a2dd51e");

const UNDERLYING = Address.fromString("0x23f72a3Db61D6CB8aBE5d9AF1Ac4B6c99327bFee");
const MANAGER = Address.fromString("0xaBa0c273944cacf225412079b599142f71E454b7");
const TOKEN_JAR = Address.fromString("0x0c2C5064C32800b26d3E0e8A031F366a892Ae793");
const SELECTOR_REGISTRY = Address.fromString("0xc50d3c33d7d2f95e14a98f12cafdfec04f919cd6");
const CANCELLER_ROLE = Bytes.fromHexString(
  "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783"
);
const PROPOSER_ROLE = Bytes.fromHexString(
  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"
);
const CLOCK = BigInt.fromI32(1_700_000_000);

const FOLIO = Address.fromString("0x1000000000000000000000000000000000000001");
const OWNER_GOVERNOR = Address.fromString("0x2000000000000000000000000000000000000002");
const OWNER_TIMELOCK = Address.fromString("0x3000000000000000000000000000000000000003");
const TRADING_GOVERNOR = Address.fromString("0x4000000000000000000000000000000000000004");
const TRADING_TIMELOCK = Address.fromString("0x5000000000000000000000000000000000000005");

function mockVault(vault: Address, supply: BigInt): void {
  mockStakingVault(vault, "vlTEST", "Vote-Locked Test", 18, supply, UNDERLYING, MANAGER, BigInt.fromI32(604800), null, null);
  mockVaultTokenJar(vault, TOKEN_JAR);
  mockVaultRewardRatio(vault, BigInt.fromI32(1));
}

function mockGovernor(governor: Address, token: Address, thresholdVotes: BigInt, pastSupply: BigInt): void {
  mockOptimisticGovernor(
    governor,
    token,
    "Reserve Optimistic Governor",
    "1.0.0",
    BigInt.fromI32(172800),
    BigInt.fromI32(259200),
    thresholdVotes,
    BigInt.fromString("1000000000000000000"),
    BigInt.fromString("100000000000000000"),
    BigInt.fromI32(14400),
    BigInt.fromI32(72000),
    BigInt.fromString("10000000000000000"),
    BigInt.fromI32(2),
    SELECTOR_REGISTRY,
    pastSupply,
    BigInt.fromI32(172800),
    CLOCK
  );
}

function mockGovernorTimelock(timelock: Address, governor: Address): void {
  mockTimelock(timelock, BigInt.fromI32(172800), CANCELLER_ROLE, [governor], PROPOSER_ROLE, [governor], []);
}

mockERC20(UNDERLYING, "RSR", "Reserve Rights", 18);
mockERC20(TOKEN_JAR, "JAR", "Token Jar", 18);
mockVault(VLRSR, VLRSR_SUPPLY);
mockVaultAdmin(VLRSR, VLRSR_TIMELOCK);
mockVault(VLPMF, BigInt.zero());
mockVaultAdmin(VLPMF, VLPMF_TIMELOCK);
mockGovernorTimelock(VLRSR_TIMELOCK, VLRSR_GOVERNOR);
mockGovernorTimelock(VLPMF_TIMELOCK, VLPMF_GOVERNOR);
mockGovernorTimelock(OWNER_TIMELOCK, OWNER_GOVERNOR);
mockGovernorTimelock(TRADING_TIMELOCK, TRADING_GOVERNOR);

function thresholdSetEvent(governor: Address, oldValue: BigInt, newValue: BigInt): ProposalThresholdSet {
  const event = changetype<ProposalThresholdSet>(newMockEvent());
  event.address = governor;
  event.parameters = [
    new ethereum.EventParam("oldProposalThreshold", ethereum.Value.fromUnsignedBigInt(oldValue)),
    new ethereum.EventParam("newProposalThreshold", ethereum.Value.fromUnsignedBigInt(newValue)),
  ];
  return event;
}

function voteExtensionSetEvent(governor: Address, oldValue: BigInt, newValue: BigInt): LateQuorumVoteExtensionSet {
  const event = changetype<LateQuorumVoteExtensionSet>(newMockEvent());
  event.address = governor;
  event.parameters = [
    new ethereum.EventParam("oldVoteExtension", ethereum.Value.fromUnsignedBigInt(oldValue)),
    new ethereum.EventParam("newVoteExtension", ethereum.Value.fromUnsignedBigInt(newValue)),
  ];
  return event;
}

describe("Governance proposalThreshold is the governor's D18 ratio", () => {
  beforeEach(() => {
    clearStore();
  });

  test("a governor with vote supply stores its exact ratio, not its vote count", () => {
    mockGovernor(VLRSR_GOVERNOR, VLRSR, VLRSR_THRESHOLD_VOTES, VLRSR_SUPPLY);
    getOrCreateGovernance(VLRSR_GOVERNOR, VLRSR_TIMELOCK);

    assert.fieldEquals("Governance", VLRSR_GOVERNOR.toHexString(), "proposalThreshold", "1000000000000000");
    assert.fieldEquals("Governance", VLRSR_GOVERNOR.toHexString(), "proposalThresholdExact", "true");
  });

  test("a governor with no vote supply keeps the fallback until a deposit gives it supply", () => {
    mockGovernor(VLPMF_GOVERNOR, VLPMF, BigInt.fromI32(1), BigInt.zero());
    getOrCreateGovernance(VLPMF_GOVERNOR, VLPMF_TIMELOCK);

    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThreshold", "1000000000000000");
    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThresholdExact", "false");

    // 3 vlPMF locked: proposalThreshold() = ceil(1% × 3e18) = 3e16 votes.
    const supply = BigInt.fromString("3000000000000000000");
    mockGovernor(VLPMF_GOVERNOR, VLPMF, BigInt.fromString("30000000000000000"), supply);
    refreshVaultGovernances(VLPMF);

    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThreshold", "10000000000000000");
    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThresholdExact", "true");
  });

  test("a vote supply under one token is too coarse to read the ratio from", () => {
    mockGovernor(VLPMF_GOVERNOR, VLPMF, BigInt.fromI32(1), BigInt.fromI32(10_000));
    getOrCreateGovernance(VLPMF_GOVERNOR, VLPMF_TIMELOCK);

    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThresholdExact", "false");
  });

  test("an exact ratio is not read again", () => {
    mockGovernor(VLRSR_GOVERNOR, VLRSR, VLRSR_THRESHOLD_VOTES, VLRSR_SUPPLY);
    getOrCreateGovernance(VLRSR_GOVERNOR, VLRSR_TIMELOCK);
    // A vote count that would give 2% if it were read again.
    mockPastTotalSupply(VLRSR, CLOCK.minus(BigInt.fromI32(1)), BigInt.fromString("22005912444929287106778775"));

    refreshVaultGovernances(VLRSR);

    assert.fieldEquals("Governance", VLRSR_GOVERNOR.toHexString(), "proposalThreshold", "1000000000000000");
  });

  test("ProposalThresholdSet stores the emitted ratio as exact", () => {
    mockGovernor(VLPMF_GOVERNOR, VLPMF, BigInt.fromI32(1), BigInt.zero());
    getOrCreateGovernance(VLPMF_GOVERNOR, VLPMF_TIMELOCK);

    handleProposalThresholdSet(
      thresholdSetEvent(VLPMF_GOVERNOR, BigInt.fromString("10000000000000000"), BigInt.fromString("20000000000000000"))
    );

    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThreshold", "20000000000000000");
    assert.fieldEquals("Governance", VLPMF_GOVERNOR.toHexString(), "proposalThresholdExact", "true");
  });
});

describe("Governance lateQuorumVoteExtension", () => {
  beforeEach(() => {
    clearStore();
  });

  test("is read at creation and follows LateQuorumVoteExtensionSet", () => {
    mockGovernor(VLRSR_GOVERNOR, VLRSR, VLRSR_THRESHOLD_VOTES, VLRSR_SUPPLY);
    getOrCreateGovernance(VLRSR_GOVERNOR, VLRSR_TIMELOCK);
    assert.fieldEquals("Governance", VLRSR_GOVERNOR.toHexString(), "lateQuorumVoteExtension", "172800");

    handleLateQuorumVoteExtensionSet(voteExtensionSetEvent(VLRSR_GOVERNOR, BigInt.fromI32(172800), BigInt.fromI32(86400)));

    assert.fieldEquals("Governance", VLRSR_GOVERNOR.toHexString(), "lateQuorumVoteExtension", "86400");
  });
});

describe("GovernanceTimelock type", () => {
  beforeEach(() => {
    clearStore();
    mockGovernor(OWNER_GOVERNOR, VLRSR, VLRSR_THRESHOLD_VOTES, VLRSR_SUPPLY);
    mockGovernor(TRADING_GOVERNOR, VLRSR, VLRSR_THRESHOLD_VOTES, VLRSR_SUPPLY);
    createTestDTF(FOLIO);
  });

  test("a single timelock that gets REBALANCE_MANAGER and then DEFAULT_ADMIN is OWNER", () => {
    _handleRoleGranted(FOLIO, Bytes.fromHexString(Role.REBALANCE_MANAGER), OWNER_TIMELOCK);
    assert.fieldEquals("GovernanceTimelock", OWNER_TIMELOCK.toHexString(), "type", "TRADING");

    _handleRoleGranted(FOLIO, Bytes.fromHexString(Role.DEFAULT_ADMIN), OWNER_TIMELOCK);

    assert.fieldEquals("GovernanceTimelock", OWNER_TIMELOCK.toHexString(), "type", "OWNER");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "ownerGovernance", OWNER_GOVERNOR.toHexString());
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradingGovernance", OWNER_GOVERNOR.toHexString());
  });

  test("a separate trading timelock stays TRADING", () => {
    _handleRoleGranted(FOLIO, Bytes.fromHexString(Role.DEFAULT_ADMIN), OWNER_TIMELOCK);
    _handleRoleGranted(FOLIO, Bytes.fromHexString(Role.REBALANCE_MANAGER), TRADING_TIMELOCK);

    assert.fieldEquals("GovernanceTimelock", OWNER_TIMELOCK.toHexString(), "type", "OWNER");
    assert.fieldEquals("GovernanceTimelock", TRADING_TIMELOCK.toHexString(), "type", "TRADING");
  });
});
