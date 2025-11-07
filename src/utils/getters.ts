import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
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
  Timelock as TimelockTemplate,
} from "../../generated/templates";
import { Governor } from "../../generated/templates/Governance/Governor";
import { Timelock } from "../../generated/templates/Governance/Timelock";
import {
  BIGINT_ZERO,
  TokenType,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MONTH
} from "./constants";
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from "./tokens";

export function getOrCreateToken(
  tokenAddress: Address,
  type: string = TokenType.ASSET
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

export function getOrCreateStakingToken(tokenAddress: Address): StakingToken {
  let stakingToken = StakingToken.load(tokenAddress.toHexString());

  if (!stakingToken) {
    stakingToken = new StakingToken(tokenAddress.toHexString());
    stakingToken.token = getOrCreateToken(tokenAddress, TokenType.VOTE).id;
    stakingToken.totalDelegates = BIGINT_ZERO;
    stakingToken.currentDelegates = BIGINT_ZERO;
    stakingToken.delegatedVotesRaw = BIGINT_ZERO;
    stakingToken.delegatedVotes = BigDecimal.fromString("0");
    stakingToken.legacyGovernance = [];
    stakingToken.save();
  }

  return stakingToken as StakingToken;
}

export function createGovernanceTimelock(
  timelockAddress: Address,
  entity: string,
  entityType: string
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

  let timelock = new GovernanceTimelock(timelockAddress.toHexString());
  timelock.guardians = [];
  timelock.entity = entity;
  timelock.type = entityType;
  timelock.executionDelay = delay.value;
  timelock.save();

  // Track timelock events
  TimelockTemplate.create(timelockAddress);
}

export function getGovernanceTimelock(
  timelockAddress: Address
): GovernanceTimelock | null {
  return GovernanceTimelock.load(timelockAddress.toHexString());
}

export function getOrCreateGovernance(
  governanceAddress: Address,
  timelockAddress: Address
): Governance {
  let governance = Governance.load(governanceAddress.toHexString());
  if (governance) {
    return governance;
  }

  governance = new Governance(governanceAddress.toHexString());
  const contract = Governor.bind(governanceAddress);

  let token = contract.token();
  governance.token = getOrCreateStakingToken(token).id;

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
  governance.save();

  // Track governor events
  GovernanceTemplate.create(governanceAddress);

  return governance as Governance;
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
  block: ethereum.Block
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
  block: ethereum.Block
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
