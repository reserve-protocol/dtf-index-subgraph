import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  StakingToken,
  StakingTokenExchangeRateDailySnapshot,
  StakingTokenExchangeRateSnapshot,
  Token,
  UnstakingManager,
} from "../../generated/schema";
import { UnstakingManager as UnstakingManagerTemplate } from "../../generated/templates";
import { StakingVault } from "../../generated/templates/StakingToken/StakingVault";
import { BIGINT_ZERO, DEFAULT_DECIMALS, SECONDS_PER_DAY } from "./constants";

// Every StakingVault version (legacy Ownable and the optimistic AccessControl one)
// exposes unstakingManager(). Vote tokens that are not vaults revert and are skipped.
// Idempotent: safe to call from any discovery path. Does NOT save the staking token.
export function subscribeUnstakingManager(
  stakingToken: StakingToken,
  vault: StakingVault
): void {
  if (stakingToken.unstakingManager !== null) {
    return;
  }

  const result = vault.try_unstakingManager();
  if (result.reverted || result.value.equals(Address.zero())) {
    return;
  }

  const managerId = result.value.toHexString();
  let manager = UnstakingManager.load(managerId);
  if (!manager) {
    manager = new UnstakingManager(managerId);
    manager.token = stakingToken.id;
    manager.save();
    UnstakingManagerTemplate.create(result.value);
  }

  stakingToken.unstakingManager = managerId;
}

// One whole share in raw units, e.g. 1e18 for an 18-decimal vault.
export function oneShare(stakingToken: StakingToken): BigInt {
  const token = Token.load(stakingToken.token);
  const decimals = token ? token.decimals : DEFAULT_DECIMALS;
  return BigInt.fromI32(10).pow(decimals as u8);
}

// Reads convertToAssets(1 share) + totalAssets() and stores them on the staking
// token. With a block, it also appends a history row the first time and whenever
// the rate moved — 1:1 vaults get a single baseline row, appreciating vaults get
// one per poll. Without a block (discovery-time seed) only the live fields are set.
// Does NOT save the staking token.
export function sampleExchangeRate(
  stakingToken: StakingToken,
  vault: StakingVault,
  block: ethereum.Block | null
): void {
  const rate = vault.try_convertToAssets(oneShare(stakingToken));
  const totalAssets = vault.try_totalAssets();
  if (rate.reverted || totalAssets.reverted) {
    return;
  }

  const isFirstSample = stakingToken.exchangeRateBlock === null;
  const rateChanged = rate.value.notEqual(stakingToken.exchangeRate);

  stakingToken.exchangeRate = rate.value;
  stakingToken.totalAssets = totalAssets.value;

  if (block === null) {
    return;
  }

  stakingToken.exchangeRateBlock = block.number;
  stakingToken.exchangeRateTimestamp = block.timestamp;

  const token = Token.load(stakingToken.token);
  const totalSupply = token ? token.totalSupply : BIGINT_ZERO;

  // Daily row is an upsert: it always holds the last sample of the day so a
  // chart can join StakingPositionDailySnapshot on the day id directly.
  const dayId = block.timestamp.toI64() / SECONDS_PER_DAY;
  const dailyId = stakingToken.id + "-" + dayId.toString();
  let daily = StakingTokenExchangeRateDailySnapshot.load(dailyId);
  if (!daily) {
    daily = new StakingTokenExchangeRateDailySnapshot(dailyId);
    daily.token = stakingToken.id;
  }
  daily.exchangeRate = rate.value;
  daily.totalAssets = totalAssets.value;
  daily.totalSupply = totalSupply;
  daily.blockNumber = block.number;
  daily.timestamp = block.timestamp;
  daily.save();

  if (!isFirstSample && !rateChanged) {
    return;
  }

  const snapshot = new StakingTokenExchangeRateSnapshot(
    stakingToken.id + "-" + block.number.toString()
  );
  snapshot.token = stakingToken.id;
  snapshot.exchangeRate = rate.value;
  snapshot.totalAssets = totalAssets.value;
  snapshot.totalSupply = totalSupply;
  snapshot.blockNumber = block.number;
  snapshot.timestamp = block.timestamp;
  snapshot.save();
}
