# Staking vaults: discovery, exchange rate, per-account rewards

## Discovery — one hook, every path

`getOrCreateStakingToken` (`src/utils/getters.ts`) is the only place a vault is set up. On first sight it:

1. seeds `Token.totalSupply`, `underlying`, `tokenJar`, `unstakingDelay`, `rewardRatio` from chain,
2. seeds `exchangeRate` / `totalAssets`,
3. subscribes the `StakingToken` template **and** the vault's `UnstakingManager` template (`subscribeUnstakingManager`, `src/utils/staking-vault.ts`).

Every way a vault can show up goes through it — `DeployedGovernedStakingToken`, `ReserveOptimisticGovernorSystemDeployed`, `Governor.token()` when a governor is met first, timelock role grants. That is the fix for the BSC vlRSR whose locks were never indexed: the vault came in through `Governor.token()` and only the deployer handler used to subscribe the manager.

Tokens that are not vaults (every vault read reverts) still get a `StakingToken` with `unstakingManager: null`, `exchangeRate = 10^decimals`, `totalAssets = 0`.

### Deployers tracked

| Event | Source | Notes |
|---|---|---|
| `GovernedFolioDeployed` | `FolioDeployer` (all versions) | DTF + its governances |
| `DeployedGovernedStakingToken` | `GovernanceDeployer` (all versions) | legacy Ownable vaults |
| `ReserveOptimisticGovernorSystemDeployed` | `OptimisticGovernorDeployer` (reserve-governor repo) | `stakingVault = 0x0` ⇒ `deployWithExistingStakingVault`: only a governance reusing a shared vault. Non-zero ⇒ new AccessControl vault; the timelock entity is created here because the vault emits no `OwnershipTransferred`. |

Optimistic deployers (one per chain, different addresses): mainnet `0x2acc45e1…` (block 25245938), base `0x604d70d1…` (46904843), bsc `0x1c10e68b…` (102317103). Adding one = append to `networks.json` `OptimisticGovernorDeployer` with address + creation block.

## Exchange rate

The reserve-governor `StakingVault` is ERC4626 with `totalAssets() = totalDeposited + time-streamed native rewards`, so `convertToAssets` moves every block even without events. Legacy vaults use the ERC4626 default (`balanceOf`) and only move on donations.

Sampling = one static `TrackedVault` data source per chain (hardcoded in `networks.json`, one vlRSR vault each: mainnet `0xABbDD9AC…` from block 25245945, base `0x2F0D6538…` from 46904963, bsc `0xE744C815…` from 102317233) carrying only a polling block handler:

```yaml
blockHandlers:
  - handler: handleExchangeRatePoll
    filter:
      kind: polling
      every: {{exchangeRatePollingBlocks}}   # round(600 / secondsPerBlock)
```

graph-node fires it when `(block - startBlock) % every == 0`. Two `eth_call`s per poll for one vault per chain — nothing else is polled. The handler goes through `getOrCreateStakingToken`, so the tracked vault is discovered at its start block regardless of deployer events. Adding a vault to track = one more `TrackedVault` entry (address + deploy block). `networks.json.secondsPerBlock` (measured 2026-08-20: mainnet 12.04 s, base 2.00 s, bsc 0.45 s) turns the 10-minute cadence into blocks; change `EXCHANGE_RATE_POLL_SECONDS` in `scripts/parse-template.js` to retune.

Written per sample (`sampleExchangeRate`):

- `StakingToken.exchangeRate` — underlying raw units per **one whole share** (`convertToAssets(10^decimals)`); `totalAssets`; `exchangeRateBlock/Timestamp`.
- `StakingTokenExchangeRateDailySnapshot` `{vault}-{day}` — upsert, last sample of the day. Chart source.
- `StakingTokenExchangeRateSnapshot` `{vault}-{block}` — immutable, first poll + every time the rate changed. 1:1 vaults get exactly one row, so the ~50 BSC test vaults cost nothing.

`value(shares) = shares * exchangeRate / 10^decimals`.

## Per-account accounting (`src/staking-token/positions.ts`)

Goal: "locked 100 RSR, got 96 vlRSR; 3 months later still 96 vlRSR but worth 120 RSR (+20%)", including locks/unlocks in between.

`StakingPosition` `{account}-{vault}` keeps an **average cost basis**:

| Event | shares | principal | other |
|---|---|---|---|
| `Deposit(assets, shares)` | `+shares` | `+assets` | `totalDeposited += assets`, record `DEPOSIT` |
| `Deposit` with `sender == unstakingManager` (`cancelLock`) | `+shares` | `+assets` | record `LOCK_CANCEL`; lifetime totals untouched — the rewards were already booked as realized on the withdraw, so `(realized + unrealized) / totalDeposited` still reads 20 / 100 after a cancel |
| `Withdraw(assets, shares)` | `−shares` | `−released`, `released = principal × shares / shares_before` | `totalWithdrawn += assets`, `realizedRewards += assets − released` |
| wallet `Transfer(from, to, shares)` | moves | `moved = principal_from × shares / shares_from` follows the shares | records `TRANSFER_OUT` / `TRANSFER_IN` |

Mints/burns are skipped by the transfer path (ERC4626 always pairs them with `Deposit`/`Withdraw`).


Derived in the UI / API:

- current value `= position.shares * token.exchangeRate / 10^decimals`
- unrealized `= value − principal`
- "got back so far" `= unrealized + realizedRewards`
- `%` `= (unrealized + realizedRewards) / totalDeposited` (or `/ principal` for the open part only)

Every event also writes `StakingPositionRecord` (with the exchange rate implied by the event: `assets × 10^decimals / shares`) and upserts `StakingPositionDailySnapshot` `{position}-{day}`.

### Query recipe

```graphql
query Position($account: String!, $vault: String!, $fromDay: BigInt!) {
  stakingPosition(id: "$account-$vault") {
    shares principal totalDeposited totalWithdrawn realizedRewards
    token { exchangeRate exchangeRateTimestamp token { decimals } }
    records(orderBy: timestamp, orderDirection: desc, first: 50) {
      type shares assets principalDelta realizedRewards exchangeRate hash timestamp
    }
    dailySnapshots(where: { timestamp_gte: $fromDay }, orderBy: timestamp) {
      timestamp shares principal realizedRewards
    }
  }
  stakingTokenExchangeRateDailySnapshots(
    where: { token: $vault, timestamp_gte: $fromDay }, orderBy: timestamp, first: 1000
  ) { timestamp exchangeRate }
}
```

Chart: walk the daily rate rows; for each day carry forward the latest position snapshot at or before that day and plot `shares × rate / 10^decimals − principal + realizedRewards`. Days before the first position snapshot are zero.

## Test fixtures

All vault tests use real BSC data for `0xE744C8157c346B2931807F42552c8CBc0BB6D34f` (tx receipts / logs pulled 2026-08-20): the deployer event, the two `LockCreated`, the locker's full 14-event history (`tests/staking-position.test.ts`, expected values from an independent plain-BigInt oracle; final share balance matches `balanceOf` on chain).
