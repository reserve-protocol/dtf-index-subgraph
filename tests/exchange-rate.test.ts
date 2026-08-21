import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { StakingToken } from "../generated/schema";
import {
  _handleExchangeRatePoll,
  _handleRewardRatioSet,
  _handleUnstakingDelaySet,
} from "../src/staking-token/handlers";
import { getOrCreateStakingToken } from "../src/utils/getters";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  mockStakingVault,
  mockVaultExchangeRate,
} from "./helpers/mock-staking-vault";

// Appreciating vault: BSC vlRSR 0xE744… sampled at block 117076699 (2026-08-20).
// totalAssets / totalSupply = 1.0462 because native RSR rewards stream into totalAssets.
const VAULT = Address.fromString("0xE744C8157c346B2931807F42552c8CBc0BB6D34f");
const MANAGER = Address.fromString(
  "0xaBa0c273944cacf225412079b599142f71E454b7"
);
const RSR = Address.fromString("0x23f72a3Db61D6CB8aBE5d9AF1Ac4B6c99327bFee");
const TOTAL_SUPPLY = BigInt.fromString("440118248898585742135575498");
const TOTAL_ASSETS = BigInt.fromString("460466698346365758086336928");
const RATE = BigInt.fromString("1046234384358433448");
const RATE_LATER = BigInt.fromString("1046300000000000000");
const TOTAL_ASSETS_LATER = BigInt.fromString("460495572000000000000000000");
const ONE = BigInt.fromI32(10).pow(18);
const POLL_BLOCKS = BigInt.fromI32(1333); // bsc: 600s / 0.45s
const SAMPLE_BLOCK = BigInt.fromI32(117076699);
const SAMPLE_TIMESTAMP = BigInt.fromI32(1787245400);
const LEGACY_BLOCK = BigInt.fromI32(50000000);
const TEN_MINUTES = BigInt.fromI32(600);

// Legacy 1:1 vault
const LEGACY_VAULT = Address.fromString(
  "0x4d43e95d8af20aa65695ed2a3b7ec0d2cc88908f"
);
const LEGACY_SUPPLY = BigInt.fromString("123000000000000000000");

// Vote token that is not an ERC4626 vault
const NOT_A_VAULT = Address.fromString(
  "0x3333333333333333333333333333333333333333"
);

mockERC20(RSR, "RSR", "Reserve Rights", 18);
mockStakingVault(
  VAULT,
  "vlRSR",
  "Vote-Locked Reserve Rights",
  18,
  TOTAL_SUPPLY,
  RSR,
  MANAGER,
  BigInt.fromI32(604800),
  RATE,
  TOTAL_ASSETS
);
mockStakingVault(
  LEGACY_VAULT,
  "vlRSR",
  "Vote-Locked RSR",
  18,
  LEGACY_SUPPLY,
  RSR,
  Address.fromString("0x1111111111111111111111111111111111111111"),
  BigInt.fromI32(1209600),
  ONE,
  LEGACY_SUPPLY
);
mockStakingVault(
  NOT_A_VAULT,
  "VOTE",
  "Plain Votes",
  18,
  BigInt.fromI32(5),
  null,
  null,
  null,
  null,
  null
);

function mockBlock(number: BigInt, timestamp: BigInt): ethereum.Block {
  let block = newMockEvent().block;
  block.number = number;
  block.timestamp = timestamp;
  return block;
}

describe("exchange rate tracking", () => {
  beforeEach(() => {
    clearStore();
    // mocks are global — reset the appreciating vault's rate for every test
    mockVaultExchangeRate(VAULT, 18, RATE, TOTAL_ASSETS);
  });

  test("discovery seeds the live rate without writing history", () => {
    getOrCreateStakingToken(VAULT);

    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRate",
      RATE.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "totalAssets",
      TOTAL_ASSETS.toString()
    );
    assert.assertTrue(
      StakingToken.load(VAULT.toHexString())!.exchangeRateBlock === null
    );
    assert.entityCount("StakingTokenExchangeRateSnapshot", 0);
  });

  test("first poll writes a baseline snapshot; unchanged polls only bump the sample block", () => {
    getOrCreateStakingToken(VAULT);

    _handleExchangeRatePoll(VAULT, mockBlock(SAMPLE_BLOCK, SAMPLE_TIMESTAMP));

    const snapshotId = VAULT.toHexString() + "-117076699";
    assert.entityCount("StakingTokenExchangeRateSnapshot", 1);
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "token",
      VAULT.toHexString()
    );
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "exchangeRate",
      RATE.toString()
    );
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "totalAssets",
      TOTAL_ASSETS.toString()
    );
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "totalSupply",
      TOTAL_SUPPLY.toString()
    );
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "timestamp",
      "1787245400"
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRateBlock",
      "117076699"
    );

    // Same rate 10 minutes later → no new row, live fields move
    const nextBlock = SAMPLE_BLOCK.plus(POLL_BLOCKS);
    _handleExchangeRatePoll(
      VAULT,
      mockBlock(nextBlock, SAMPLE_TIMESTAMP.plus(TEN_MINUTES))
    );
    assert.entityCount("StakingTokenExchangeRateSnapshot", 1);
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRateBlock",
      nextBlock.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRateTimestamp",
      SAMPLE_TIMESTAMP.plus(TEN_MINUTES).toString()
    );
  });

  test("a moved rate appends a snapshot and updates the live fields", () => {
    getOrCreateStakingToken(VAULT);
    _handleExchangeRatePoll(VAULT, mockBlock(SAMPLE_BLOCK, SAMPLE_TIMESTAMP));

    mockVaultExchangeRate(VAULT, 18, RATE_LATER, TOTAL_ASSETS_LATER);
    const block = SAMPLE_BLOCK.plus(POLL_BLOCKS).plus(POLL_BLOCKS);
    _handleExchangeRatePoll(
      VAULT,
      mockBlock(block, SAMPLE_TIMESTAMP.plus(TEN_MINUTES).plus(TEN_MINUTES))
    );

    assert.entityCount("StakingTokenExchangeRateSnapshot", 2);
    const snapshotId = VAULT.toHexString() + "-" + block.toString();
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "exchangeRate",
      RATE_LATER.toString()
    );
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      snapshotId,
      "totalAssets",
      TOTAL_ASSETS_LATER.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRate",
      RATE_LATER.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "totalAssets",
      TOTAL_ASSETS_LATER.toString()
    );

  });

  test("legacy 1:1 vault gets exactly one baseline row however often it is polled", () => {
    getOrCreateStakingToken(LEGACY_VAULT);

    let block = LEGACY_BLOCK;
    let timestamp = SAMPLE_TIMESTAMP;
    for (let i = 0; i < 5; i++) {
      _handleExchangeRatePoll(LEGACY_VAULT, mockBlock(block, timestamp));
      block = block.plus(POLL_BLOCKS);
      timestamp = timestamp.plus(TEN_MINUTES);
    }

    assert.entityCount("StakingTokenExchangeRateSnapshot", 1);
    assert.fieldEquals(
      "StakingTokenExchangeRateSnapshot",
      LEGACY_VAULT.toHexString() + "-50000000",
      "exchangeRate",
      ONE.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      LEGACY_VAULT.toHexString(),
      "exchangeRate",
      ONE.toString()
    );
  });

  // Note: matchstick cannot observe that the poll skipped its eth_calls; the
  // unstakingManager === null guard in _handleExchangeRatePoll is a cost
  // optimisation, the assertions below hold with or without it.
  test("a vote token that is not a vault defaults to 1:1 and polls are a no-op", () => {
    getOrCreateStakingToken(NOT_A_VAULT);
    _handleExchangeRatePoll(NOT_A_VAULT, mockBlock(LEGACY_BLOCK, SAMPLE_TIMESTAMP));

    assert.fieldEquals(
      "StakingToken",
      NOT_A_VAULT.toHexString(),
      "exchangeRate",
      ONE.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      NOT_A_VAULT.toHexString(),
      "totalAssets",
      "0"
    );
    assert.assertTrue(
      StakingToken.load(NOT_A_VAULT.toHexString())!.exchangeRateBlock === null
    );
    assert.entityCount("StakingTokenExchangeRateSnapshot", 0);
  });

  test("the first poll discovers the tracked vault (manager included) when no deployer event did", () => {
    _handleExchangeRatePoll(VAULT, mockBlock(SAMPLE_BLOCK, SAMPLE_TIMESTAMP));

    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "unstakingManager",
      MANAGER.toHexString()
    );
    assert.dataSourceExists("StakingToken", VAULT.toHexString());
    assert.dataSourceExists("UnstakingManager", MANAGER.toHexString());
    assert.entityCount("StakingTokenExchangeRateSnapshot", 1);
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "exchangeRateBlock",
      SAMPLE_BLOCK.toString()
    );
  });

  test("UnstakingDelaySet / RewardRatioSet update the vault config", () => {
    getOrCreateStakingToken(VAULT);

    _handleUnstakingDelaySet(VAULT, BigInt.fromI32(1209600));
    _handleRewardRatioSet(
      VAULT,
      BigInt.fromString("1146076687433"),
      BigInt.fromI32(604800)
    );

    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "unstakingDelay",
      "1209600"
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "rewardRatio",
      "1146076687433"
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "rewardHalfLife",
      "604800"
    );
  });
});
