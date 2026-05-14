import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts";
import {
  DTF,
  Governance,
  GovernanceTimelock,
  StakingToken,
  Token,
  RSRBurnGlobal,
  RSRBurnDailySnapshot,
  RSRBurnMonthlySnapshot,
  TokenDailySnapshot,
  TokenHourlySnapshot,
} from "../../generated/schema";
import {
  Governance as GovernanceTemplate,
  StakingToken as StakingTokenTemplate,
  Timelock as TimelockTemplate,
} from "../../generated/templates";
import { Governor } from "../../generated/templates/Governance/Governor";
import { Timelock } from "../../generated/templates/Governance/Timelock";
import { StakingVault } from "../../generated/templates/StakingToken/StakingVault";
import {
  BIGINT_ZERO,
  GovernanceType,
  Role,
  TokenType,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MONTH,
} from "./constants";
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
} from "./tokens";

export function getOrCreateToken(
  tokenAddress: Address,
  type: string = TokenType.ASSET,
): Token {
  let token = Token.load(tokenAddress.toHexString());

  if (!token) {
    token = new Token(tokenAddress.toHexString());
    token.address = tokenAddress;
    token.name = fetchTokenName(tokenAddress);
    token.symbol = fetchTokenSymbol(tokenAddress);
    token.decimals = fetchTokenDecimals(tokenAddress);
    token.currentHolderCount = BigInt.fromI32(0);
    token.cumulativeHolderCount = BigInt.fromI32(0);
    token.transferCount = BigInt.fromI32(0);
    token.mintCount = BigInt.fromI32(0);
    token.burnCount = BigInt.fromI32(0);
    token.totalSupply = BigInt.fromI32(0);
    token.totalBurned = BigInt.fromI32(0);
    token.totalMinted = BigInt.fromI32(0);
    token.type = type;
    token.save();
  }

  return token as Token;
}

// Canonical "first time we see this stToken" hook. On CREATE: initializes
// entity state, seeds totalSupply from chain (so pre-discovery Transfers aren't
// lost), and subscribes to the StakingToken template so future events index.
// All three side effects fire exactly once per stToken lifetime — there is no
// other place that needs to subscribe. Callers don't need to coordinate.
export function getOrCreateStakingToken(tokenAddress: Address): StakingToken {
  let stakingToken = StakingToken.load(tokenAddress.toHexString());
  if (stakingToken) return stakingToken as StakingToken;

  stakingToken = new StakingToken(tokenAddress.toHexString());
  const voteToken = getOrCreateToken(tokenAddress, TokenType.VOTE);
  voteToken.totalSupply = fetchTokenTotalSupply(tokenAddress);
  voteToken.save();
  stakingToken.token = voteToken.id;
  stakingToken.totalDelegates = BIGINT_ZERO;
  stakingToken.currentDelegates = BIGINT_ZERO;
  stakingToken.delegatedVotesRaw = BIGINT_ZERO;
  stakingToken.delegatedVotes = BigDecimal.fromString("0");
  stakingToken.currentOptimisticDelegates = BIGINT_ZERO;
  stakingToken.totalOptimisticDelegates = BIGINT_ZERO;
  stakingToken.optimisticDelegatedVotesRaw = BIGINT_ZERO;
  stakingToken.optimisticDelegatedVotes = BigDecimal.fromString("0");
  stakingToken.legacyGovernance = [];
  stakingToken.save();

  StakingTokenTemplate.create(tokenAddress);

  return stakingToken as StakingToken;
}

export function createGovernanceTimelock(
  timelockAddress: Address,
  entity: string,
  entityType: string,
): void {
  if (GovernanceTimelock.load(timelockAddress.toHexString())) {
    return;
  }

  const timelockContract = Timelock.bind(timelockAddress);
  let delay = timelockContract.try_getMinDelay();

  // Not a timelock
  if (delay.reverted) {
    return;
  }

  const cancellerRole = timelockContract.try_CANCELLER_ROLE();

  let timelock = new GovernanceTimelock(timelockAddress.toHexString());
  timelock.guardians = cancellerRole.reverted
    ? []
    : getRoleMembers(timelockContract, cancellerRole.value);
  timelock.optimisticProposers = getRoleMembers(
    timelockContract,
    Bytes.fromHexString(Role.OPTIMISTIC_PROPOSER),
  );
  timelock.entity = entity;
  timelock.type = entityType;
  timelock.executionDelay = delay.value;
  timelock.save();

  const proposerRole = timelockContract.try_PROPOSER_ROLE();
  if (!proposerRole.reverted) {
    const governorResult = timelockContract.try_getRoleMember(
      proposerRole.value,
      BIGINT_ZERO,
    );

    if (!governorResult.reverted) {
      const governorAddress = governorResult.value;
      const governorContract = Governor.bind(governorAddress);
      if (!governorContract.try_token().reverted) {
        attachGovernanceToTimelock(timelock, governorAddress);
      }
    }
  }

  // Track timelock events
  TimelockTemplate.create(timelockAddress);
}

export function getGovernanceTimelock(
  timelockAddress: Address,
): GovernanceTimelock | null {
  return GovernanceTimelock.load(timelockAddress.toHexString());
}

export function attachGovernanceToTimelock(
  timelock: GovernanceTimelock,
  governorAddress: Address,
): Governance {
  const governance = getOrCreateGovernance(
    governorAddress,
    Address.fromString(timelock.id),
  );
  timelock.governance = governance.id;
  timelock.save();

  if (timelock.type == GovernanceType.VOTE_LOCKING) {
    const stakingToken = getOrCreateStakingToken(
      Address.fromString(timelock.entity),
    );
    stakingToken.governance = governance.id;
    stakingToken.save();
  } else {
    const dtf = DTF.load(timelock.entity);
    if (dtf) {
      // A single timelock can hold multiple DTF roles (e.g. DEFAULT_ADMIN +
      // REBALANCE_MANAGER). Use the DTF's own role membership rather than
      // timelock.type — which only records whichever role was granted first.
      const timelockId = timelock.id;
      if (dtf.admins.indexOf(timelockId) != -1 && !dtf.ownerGovernance) {
        dtf.ownerGovernance = governance.id;
      }
      if (
        dtf.auctionApprovers.indexOf(timelockId) != -1 &&
        !dtf.tradingGovernance
      ) {
        dtf.tradingGovernance = governance.id;
      }
      // Backfill DTF → stToken link if it wasn't set by GovernedFolioDeployed.
      if (!dtf.stToken) {
        dtf.stToken = governance.token;
        dtf.stTokenAddress = Address.fromString(governance.token);
      }
      dtf.save();
    }
  }

  return governance;
}

export function getOrCreateGovernance(
  governanceAddress: Address,
  timelockAddress: Address,
): Governance {
  let governance = Governance.load(governanceAddress.toHexString());
  if (governance) {
    return governance as Governance;
  }

  governance = new Governance(governanceAddress.toHexString());
  const contract = Governor.bind(governanceAddress);

  let token = contract.token();
  // Capture missing-ness BEFORE getOrCreateStakingToken creates the entity —
  // the resilience block below needs to know whether we just discovered this
  // stToken for the first time.
  const stTokenWasMissing = StakingToken.load(token.toHexString()) === null;
  governance.token = getOrCreateStakingToken(token).id;

  if (stTokenWasMissing) {
    // Resilience: discover the stToken's own timelock via DEFAULT_ADMIN role
    // member 0 (the typical AccessControl pattern for vote-locks), then defer
    // to createGovernanceTimelock to set up the timelock entity, subscribe its
    // template, find its Governor via PROPOSER_ROLE, and attach governance.
    const vault = StakingVault.bind(token);
    const adminCount = vault.try_getRoleMemberCount(
      Bytes.fromHexString(Role.DEFAULT_ADMIN),
    );
    if (!adminCount.reverted && adminCount.value.gt(BIGINT_ZERO)) {
      const admin = vault.try_getRoleMember(
        Bytes.fromHexString(Role.DEFAULT_ADMIN),
        BIGINT_ZERO,
      );
      if (!admin.reverted) {
        createGovernanceTimelock(
          admin.value,
          token.toHexString(),
          GovernanceType.VOTE_LOCKING,
        );
      }
    }
  }

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
  governance.timelock = timelockAddress.toHexString();
  governance.isOptimistic = false;
  governance.optimisticProposers = [];

  const optimisticParams = contract.try_optimisticParams();
  if (!optimisticParams.reverted) {
    governance.isOptimistic = true;
    governance.optimisticVetoDelay = optimisticParams.value.getVetoDelay();
    governance.optimisticVetoPeriod = optimisticParams.value.getVetoPeriod();
    governance.optimisticVetoThreshold =
      optimisticParams.value.getVetoThreshold();

    const proposalThrottle = contract.try_proposalThrottleCapacity();
    if (!proposalThrottle.reverted) {
      governance.optimisticProposalThrottleCapacity = proposalThrottle.value;
    }

    const selectorRegistry = contract.try_selectorRegistry();
    if (!selectorRegistry.reverted) {
      governance.optimisticSelectorRegistry = selectorRegistry.value;
    }

    const timelock = GovernanceTimelock.load(timelockAddress.toHexString());
    if (timelock) {
      const timelockContract = Timelock.bind(timelockAddress);
      const optimisticProposers = getRoleMembers(
        timelockContract,
        Bytes.fromHexString(Role.OPTIMISTIC_PROPOSER),
      );
      const cancellerRole = timelockContract.try_CANCELLER_ROLE();

      governance.optimisticProposers = optimisticProposers;
      timelock.optimisticProposers = optimisticProposers;
      timelock.guardians = cancellerRole.reverted
        ? []
        : getRoleMembers(timelockContract, cancellerRole.value);
      timelock.save();
    }
  }
  governance.save();

  // Track governor events
  GovernanceTemplate.create(governanceAddress);

  return governance as Governance;
}

function getRoleMembers(timelock: Timelock, role: Bytes): Array<string> {
  const members = new Array<string>();
  const count = timelock.try_getRoleMemberCount(role);

  if (count.reverted) {
    return members;
  }

  for (let i = BIGINT_ZERO; i.lt(count.value); i = i.plus(BigInt.fromI32(1))) {
    const member = timelock.try_getRoleMember(role, i);
    if (!member.reverted) {
      members.push(member.value.toHexString());
    }
  }

  return members;
}

// RSR Burn helper functions
export function getOrCreateRSRBurnGlobal(): RSRBurnGlobal {
  let global = RSRBurnGlobal.load("1");
  if (global == null) {
    global = new RSRBurnGlobal("1");
    global.totalBurned = BIGINT_ZERO;
    global.totalBurnCount = BIGINT_ZERO;
    global.lastUpdateBlock = BIGINT_ZERO;
    global.lastUpdateTimestamp = BIGINT_ZERO;
  }
  return global as RSRBurnGlobal;
}

export function getOrCreateRSRBurnDailySnapshot(
  block: ethereum.Block,
): RSRBurnDailySnapshot {
  let dayID = block.timestamp.toI64() / SECONDS_PER_DAY;
  let snapshotID = dayID.toString();

  let snapshot = RSRBurnDailySnapshot.load(snapshotID);
  if (snapshot == null) {
    snapshot = new RSRBurnDailySnapshot(snapshotID);
    snapshot.dailyBurnAmount = BIGINT_ZERO;
    snapshot.dailyBurnCount = 0;
    snapshot.cumulativeBurned = BIGINT_ZERO;
    snapshot.blockNumber = block.number;
    snapshot.timestamp = block.timestamp;
  }
  return snapshot as RSRBurnDailySnapshot;
}

export function getOrCreateRSRBurnMonthlySnapshot(
  block: ethereum.Block,
): RSRBurnMonthlySnapshot {
  let monthID = block.timestamp.toI64() / SECONDS_PER_MONTH;
  let snapshotID = monthID.toString();

  let snapshot = RSRBurnMonthlySnapshot.load(snapshotID);
  if (snapshot == null) {
    snapshot = new RSRBurnMonthlySnapshot(snapshotID);
    snapshot.monthlyBurnAmount = BIGINT_ZERO;
    snapshot.monthlyBurnCount = 0;
    snapshot.cumulativeBurned = BIGINT_ZERO;
    snapshot.blockNumber = block.number;
    snapshot.timestamp = block.timestamp;
  }
  return snapshot as RSRBurnMonthlySnapshot;
}
