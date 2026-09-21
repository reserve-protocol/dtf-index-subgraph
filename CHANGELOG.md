# Changelog

All notable changes to the DTF Index Subgraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.0] - Unreleased

Folio 6.0.0 support. Clean reindex: `DTF.ownerAddress` now records the deployment's `folioOwner`
(previously the deploy transaction sender) for every version, `DTF.version` is a new field hydrated
from `version()`, and the version registry is a new data source. No graft.

### Added

- `DTF.version`, hydrated from `version()` at deployment and refreshed when the proxy reports a different
  version after an `Upgraded` log (constructor `Upgraded` logs are ignored by comparing versions, not blocks).
- Folio 6.0 fields on `DTF`: `maxAuctionLength` (mirrored into `auctionLength` for existing clients),
  `immutableFeeRecipients`, `folioFeeForSelf`, `tradeAllowlistEnabled`, `tradeTokenAllowlist`, with handlers for `MaxAuctionLengthSet`, `FolioFeeSet`,
  `ImmutableFeeRecipientsSet`, `TradeAllowlistEnabled`, `TradeAllowlistTokenAdded`, `TradeAllowlistTokenRemoved`.
- `FolioVersion` entity and a `FolioVersionRegistry` data source per chain (mainnet and Base
  `0xA665b273997F70b647B66fa7Ed021287544849dB`, BSC `0x79A4E963378AE34fC6c796a24c764322fC6c9390`, each starting at
  the chain's earliest static deployer block so every registration is recorded). A `FolioDeployerFromRegistry`
  template is spawned for releases past the static 1.0.0–5.0.0 sources (`STATIC_DEPLOYER_VERSIONS`, checked
  against `networks.json` at template time), so a 6.0.0 deployer is indexed from its registration onward without
  a manifest change. A deployment made through a new deployer before it is registered is not covered; add a static
  entry at the deployer's creation block for that case.
- Dockerized mainnet-fork profile (`docs/local-mainnet-fork.md`) with an RPC-versus-GraphQL parity gate
  (`pnpm test:fork:parity`) driven by the protocol sandbox fixture.

### Changed

- `DTF.ownerAddress` is the deployment's `folioOwner`.
- `DTF.tradeTokenAllowlist` is non-null (empty before 6.0) and a fresh 6.0 Folio's allowlist state is read at
  deployment, since `initialize` emits no allowlist event.
- `DTF.ownerAddress` changes meaning for existing consumers (deployment owner, not the transaction sender).
- `DTF.legacyAdminGovernances` and `DTF.legacyTradingGovernances`: the subset of `legacyAdmins` /
  `legacyAuctionApprovers` that resolved to an indexed governance when the role was revoked. The raw lists are
  unchanged and still record every former holder, including deployers, upgrade spells and EOAs.

## [1.10.2] - 2026-09-14

- Version bump only; no schema or mapping change.

## [1.10.1] - 2026-08-21

Review follow-ups on 1.10.0 (which was deployed but never tagged `prod`). Clean reindex, no graft.

### Fixed
- **Legacy vaults no longer get a bogus `0x0` entry as their first `legacyGovernance` element.** `_handleOwnershipTransferred` compared the previous owner with `!==`, which is reference identity on AssemblyScript strings, so the constructor's `OwnershipTransferred(0x0 → deployer)` always passed the guard. Visible on every legacy vault in prod today.
- **Withdrawals to another receiver** (`Withdraw.receiver != owner`) now book `totalWithdrawn` / `realizedRewards` on the receiver (who gets the lock) while the owner only releases principal; a later lock cancel lands on the same account. Records carry a `counterparty`.
- **Lock cancellations net out of `totalWithdrawn`**, so `totalDeposited` / `totalWithdrawn` stay a matched pair and `realizedRewards == totalWithdrawn − totalDeposited + principal` holds across cancel round-trips.
- `StakingPosition` rows are no longer created for vote tokens that are not vaults (guarded on `unstakingManager`).
- `getOrCreateAccount` saves on create, fixing dangling `Account` references from proposal actors (`cancellationAccount`, `executionAccount`, `queueAccount`) as well as locks, claims and positions.

### Changed
- Every vault's `Deposit` / `Withdraw` now samples the exchange rate (two eth_calls per event) and retries the `UnstakingManager` subscription if discovery skipped it (with a `log.warning` on the skip), so vaults outside the polled `TrackedVault` list still carry an accurate rate as of their last activity and a missed subscription heals itself.
- `StakingPositionRecord.counterparty` (transfer sender/receiver, withdraw receiver/owner, the unstaking manager for `LOCK_CANCEL`).

## [1.10.0] - 2026-08-20

Requires a clean reindex (no graft): the UnstakingManager subscription and the exchange-rate / position entities are created at staking-token discovery and from historical Deposit/Withdraw events.

### Fixed
- **Vaults discovered outside a tracked deployer event never had their `UnstakingManager` subscribed, so their locks were never indexed.** Concretely the shared BSC vlRSR `0xE744C8157c346B2931807F42552c8CBc0BB6D34f` (deployed by the untracked `ReserveOptimisticGovernorDeployer` at block 102317233) had `unstakingManager: null` and `locks: []` on Goldsky while two `LockCreated` events (blocks 116930184 / 116931302) sat on chain. The subscription now lives in `getOrCreateStakingToken` (`subscribeUnstakingManager`), i.e. on every discovery path — deployer events, `Governor.token()`, timelock role grants. Verified by replaying the two real events in `tests/unstaking-manager-fallback.test.ts`.
- `Lock.account` / `RewardClaim.account` referenced an `Account` that was never saved when the address had not held the vault token before (e.g. a withdraw to a different receiver).

### Added
- **`OptimisticGovernorDeployer` data source** (networks.json; mainnet `0x2acc45e1…` from block 25245938, base `0x604d70d1…` from 46904843, bsc `0x1c10e68b…` from 102317103 — the mainnet/base vlRSR vaults `0xABbDD9AC…` / `0x2F0D6538…` had the same missing-manager bug) handling `ReserveOptimisticGovernorSystemDeployed`. `deployWithNewStakingVault` indexes the vault, its manager, governance and timelock (the AccessControl vault emits no `OwnershipTransferred`, so the timelock entity is created here); `deployWithExistingStakingVault` (`stakingVault = 0x0`) only discovers the vault through `Governor.token()`; the DTF governance keeps being created by the DTF role grant, where its timelock and `optimisticProposers` are known.
- **Vault exchange-rate tracking.** The new StakingVault streams native RSR rewards into `totalAssets()`, so the share → asset rate drifts every block. A hardcoded `TrackedVault` data source per chain (networks.json: the vlRSR vault — mainnet `0xABbDD9AC…`, base `0x2F0D6538…`, bsc `0xE744C815…`) runs a polling block handler (`handleExchangeRatePoll`) that samples `convertToAssets(10^decimals)` + `totalAssets()` roughly every 10 minutes — `every` is derived per network from `networks.json.secondsPerBlock` (mainnet 12s → 50 blocks, base 2s → 300, bsc 0.45s → 1333). New fields `StakingToken.exchangeRate / totalAssets / exchangeRateBlock / exchangeRateTimestamp`, `StakingTokenExchangeRateDailySnapshot` (last sample per day, upsert) and `StakingTokenExchangeRateSnapshot` (immutable, written on the first poll and whenever the rate moves — legacy 1:1 vaults get a single baseline row). Only the tracked vault is polled (two eth_calls per poll); the cadence is one constant in `scripts/parse-template.js`, adding a vault is one `TrackedVault` entry.
- **Per-account staking accounting** for the "locked 100 RSR → 96 vlRSR, now worth 120 RSR" view: `StakingPosition` (shares, average-cost `principal`, `totalDeposited`, `totalWithdrawn`, `realizedRewards`), `StakingPositionRecord` per `Deposit` / `Withdraw` / wallet `Transfer` (with the implied exchange rate), `StakingPositionDailySnapshot`. Withdrawals release principal pro rata and book the excess as realized rewards; wallet transfers move principal pro rata; a cancelled lock re-enters as a `LOCK_CANCEL` record (principal at today's rate; see 1.10.1 for how it nets against `totalWithdrawn`). Validated against the full real history of the BSC locker `0xb0bd…6e18` with an independent BigInt oracle (`tests/staking-position.test.ts`). See `docs/staking-vaults.md` for the query recipe.
- `StakingToken.unstakingManager`, `unstakingDelay`, `rewardRatio`, `rewardHalfLife` (from `UnstakingDelaySet` / `RewardRatioSet` and resolved at discovery).

### Changed
- `abis/staking-vault.json` gains `versionRegistry()`, `rewardTokenRegistry()`, `VersionRegistrySet`, `RewardTokenRegistrySet`; new `abis/optimistic-governor-deployer.json`.
- `scripts/parse-template.js` requires `secondsPerBlock` per network and renders `OptimisticGovernorDeployer` and `TrackedVault` data sources.
- Test helpers: `tests/helpers/mock-staking-vault.ts` mocks every vault / governor / timelock read the discovery path performs.

## [1.9.8] - 2026-06-23

### Fixed
- **Governance-share fees routed to a StakingVault's `tokenJar` are now counted as `governanceRevenue` instead of `externalRevenue`.** The new StakingVault sends the DTF's governance fee share to a `tokenJar` contract (which converts it to the vault's underlying and drips it to lockers) rather than to the stToken directly. `_handleFolioFeePaid` previously credited `governanceRevenue` only when the recipient was the stToken itself, so jar-routed fees fell into `externalRevenue` — undercounting governance revenue (and the vote-lock APR derived from it) for affected DTFs. The fee handler now also credits the recipient matching the vault's `tokenJar`.

### Changed
- `StakingToken` entity gains a `tokenJar` field, resolved once via `StakingVault.tokenJar()` when the staking token is first indexed (legacy / non-jar vaults revert → `null`). The fee handler reads the cached value, so it makes no extra on-chain calls per fee event.
- `abis/staking-vault.json` extended with `tokenJar()`.
- Requires a reindex from the affected deploy blocks for historical revenue to be reclassified — the `tokenJar` resolution runs at staking-token creation.

## [1.9.7] - 2026-06-01

> The version jumped straight from 1.9.3 to 1.9.7 in a single release — 1.9.4 through 1.9.6 were never published.

### Added
- **`OptimisticProposalMetadata` entity** recording each optimistic proposal's veto parameters at creation (`vetoThreshold`, `vetoDelay`, `vetoPeriod`) plus the derived `vetoThresholdVotes`, `optimisticSnapshot`, and `optimisticSnapshotSupply`.

### Fixed
- **Veto threshold for optimistic proposals is now computed correctly.** The threshold in votes is derived from the proposal's snapshot supply (`proposalSnapshot` / past total supply) instead of the previous approximation. `Proposal` gains `vetoThresholdVotes`, `optimisticSnapshot`, and `optimisticSnapshotSupply`.
- **Staking token `underlying` resolved on indexing.** `getOrCreateStakingToken` now reads the vault's `asset()` (or an explicitly passed `underlyingAddress`) and links `StakingToken.underlying`.

### Changed
- `getOrCreateStakingToken` gains an optional `underlyingAddress` parameter; added a `DEFAULT_GOVERNANCE_PROPOSAL_THRESHOLD` constant and optimistic veto-threshold handling across `governance/handlers.ts` and `governance/mappings.ts` (with role-handler test coverage).

## [1.9.3] - 2026-05-15

### Fixed
- **RSR burns indexed correctly on mainnet.** Mainnet now indexes RSR `Transfer` events without the manifest `topic2` filter and filters to the burn address in `handleRSRBurn`, working around Goldsky's historical `topic2` backfill miss. Non-mainnet deployments keep the manifest `topic2` filter.

## [1.9.2] - 2026-05-14

Follows up on 1.9.1 with two more fixes for the same class of DTFs/stTokens that don't go through the standard deploy event path. Smoke-tested on-chain against `0xd45e4170834a803D084b2bB145c9ad08f3BdD651` before implementation.

### Fixed
- **Both `ownerGovernance` and `tradingGovernance` linked when a single timelock holds both roles on a DTF.** Previously `createGovernanceTimelock` recorded only the timelock type from whichever role-grant event arrived first (e.g. `REBALANCE_MANAGER` then `DEFAULT_ADMIN` for the shared timelock → type stayed `TRADING` → only `tradingGovernance` ever linked). `attachGovernanceToTimelock` now consults `dtf.admins` / `dtf.auctionApprovers` membership instead of relying on `timelock.type`, so both fields get set when one timelock controls both.
- **stToken's own governance chain discovered when its deploy event was missed.** When a staking token is encountered via the resilience path (untracked deployer, manual deploy), `getOrCreateGovernance` now reads `getRoleMember(DEFAULT_ADMIN_ROLE, 0)` on the vault to find its timelock, then defers to existing `createGovernanceTimelock` to set up the timelock entity, subscribe its template, locate its Governor via `PROPOSER_ROLE`, and attach governance. Only runs when the staking token entity didn't already exist — no redundant work in the normal deploy flow.

### Changed
- `abis/staking-vault.json` extended with `getRoleMember` and `getRoleMemberCount` (the AccessControlEnumerable methods we now call on the vault).
- Manifest: `StakingVault` ABI added to the `FolioDeployer` data source and `Timelock` template so the binding above works from those contexts.
- Re-indexed from scratch (no grafting from 1.9.x). The role-grant events for affected DTFs fired before the pruned data window, so a graft couldn't replay them — clean reindex was the only way to fix existing entities.

## [1.9.1] - 2026-05-13

### Fixed
- DTFs that go through the `FolioDeployed`-only path (governance attached later via Timelock role grant, no upfront `GovernedFolioDeployed`) were ending up with `stToken` and `stTokenAddress` left as `null`. `attachGovernanceToTimelock` now backfills both from the governance's token reference when they aren't already set. Idempotent — no-op when the deploy-time path already populated them. Concretely fixes the test DTF `0xd45e4170834a803D084b2bB145c9ad08f3BdD651`.

## [1.9.0] - 2026-05-12

A larger release: full optimistic-governance support, several real-data bug fixes, snapshot-completeness work, and infrastructure cleanup.

### Added — Optimistic governance
- First-class support for optimistic governance (proposals pass by default unless vetoed within a window):
  - `Governance` entity gains `isOptimistic`, `optimisticVetoDelay`, `optimisticVetoPeriod`, `optimisticVetoThreshold`, `optimisticProposers`, `optimisticProposalThrottleCapacity`, `optimisticSelectorRegistry`.
  - `Proposal` entity gains `isOptimistic` and `vetoThreshold`.
  - `Delegate` entity tracks optimistic-side state separately from standard: `optimisticDelegatedVotesRaw`, `optimisticDelegatedVotes`, `numberOptimisticVotes`, `hasBeenStandardDelegate`, `hasBeenOptimisticDelegate`, `optimisticTokenHoldersRepresentedAmount`. New `optimisticDelegate` relation on `AccountBalance`.
  - `StakingToken` tracks aggregate optimistic delegation: `currentOptimisticDelegates`, `totalOptimisticDelegates`, `optimisticDelegatedVotesRaw`, `optimisticDelegatedVotes`.
- New event handlers for `OptimisticDelegateChanged` and `OptimisticDelegateVotesChanged` on the staking vault.
- New governance entity fields and timelock fields capturing optimistic proposer roles.

### Added — Monthly snapshot completeness
Several fields existed on daily and hourly snapshots but not monthly. Filling the gaps:
- `monthlyTransferCount`, `monthlyTransferAmount`, `monthlyEventCount`.
- `currentHolderCount`, `cumulativeHolderCount` (monthly holder tracking).
- `cumulativeBurnAmount` (we had cumulative mints, not burns).
- `cumulativeGovernanceRevenue`, `cumulativeExternalRevenue` (we had cumulative protocol, not the other two).

Transfer handlers now also update the monthly snapshot — previously they only touched daily/hourly.

### Added — Infrastructure
- Migrated from npm to pnpm with hardened workspace config:
  - `catalogMode: manual`, `blockExoticSubdeps: true`, `cleanupUnusedCatalogs: true`.
  - `minimumReleaseAge: 1440` — blocks installing packages newer than 24 hours, mitigating supply-chain attacks on freshly-published packages.
- New `onchain-verify` Claude skill captures the playbook for writing viem scripts to cross-check subgraph data against on-chain truth (live in `~/.claude/skills/onchain-verify/` and `.claude/skills/onchain-verify/`).

### Added — Tests
- `tests/token-monthly-snapshot.test.ts` — TDD coverage for the cumulative-inheritance fix, both DTF and non-DTF paths.
- `tests/staking-token.test.ts` — covers `getOrCreateStakingToken` first-creation behavior (supply seed + idempotency).
- `tests/helpers/mock-erc20.ts` — added `mockERC20TotalSupply` helper.

### Fixed — Monthly cumulative revenue resets
In any month where a transfer fired before any fee event, the monthly snapshot was created with `cumulativeRevenue = 0`, and if no later fee event overwrote it, the value stayed at 0 — leaving "holes" in the cumulative chain. Same shape affected `cumulativeProtocolRevenue` and `cumulativeMintAmount`.

Fix: `getOrCreateTokenMonthlySnapshot` now seeds all cumulative fields from the parent running totals (`Token.totalMinted`, `Token.totalBurned`, `DTF.totalRevenue`, `DTF.protocolRevenue`, `DTF.governanceRevenue`, `DTF.externalRevenue`) on first creation. Self-healing — broken historical months recover the next time a snapshot is touched for that month.

### Fixed — Staking token resilience for untracked deployers
Some staking tokens are deployed by factories not in `networks.json` (test deployments, custom factories). Previously these stTokens existed as stub entities — discovered through `Governance.token()` lookups — but with `totalSupply = 0` and no event subscription, so all delegation events were silently dropped.

`getOrCreateStakingToken` now does the full first-time setup atomically on entity creation:
- Initializes entity state.
- Reads `totalSupply()` from chain and seeds the underlying `Token.totalSupply` — recovers supply that pre-existed our first encounter with the contract.
- Subscribes to the `StakingToken` template so all future delegation events index.

Any code path that touches a fresh staking token for the first time (the deployer event flow, or the indirect `getOrCreateGovernance → Governor.token() → getOrCreateStakingToken` path) gets everything wired up automatically. No caller coordination.

### Changed — Schema cleanup
- Reverted nullable fields that had been temporarily made optional during the 1.8.x grafting era. Now back to non-null on `StakingToken` and `Delegate`.
- Removed the `templateInstantiated` flag (was a grafting-era escape hatch).
- All `# TODO: add it as required when we push a non-grafting version` markers cleared.

### Removed — Grafting
- Grafting config removed from `networks.json` per-network blocks and from the deployment scripts. 1.9.0 was re-indexed from scratch on Base because the schema changes (optimistic governance) couldn't be cleanly grafted. Empty `grafting` skeleton kept in `networks.json` as a placeholder for future use.

## [1.8.7] - 2026-02-24

### Added
- `RewardClaim` entity to track `RewardsClaimed` events from StakingVault
  - New `rewardClaims` derived field on `Account`
  - Event handler registered in `StakingToken` template
- `queueAccount`, `executionAccount`, `cancellationAccount` fields on `Proposal` entity
  - Tracks which account queued, executed, or cancelled a proposal (via `event.transaction.from`)

## [1.8.6-test1] - 2025-12-18

### Added
- Full support for DTF protocol version 5.0
  - New `RebalanceStarted` event with `TokenRebalanceParams[]` struct (combines token, weight, price, maxAuctionSize, inRebalance)
  - `BidsEnabledSet` event handler
  - `NameSet` event handler
  - `TrustedFillerRegistrySet` event handler
- New schema fields for v5.0 support:
  - `bidsEnabled`, `trustedFillerRegistry`, `trustedFillerEnabled` on DTF entity
  - `startedAt`, `bidsEnabled`, `maxAuctionSize`, `inRebalance` on Rebalance entity
- Optional grafting support for faster subgraph indexing

### Fixed
- Token snapshot `blockNumber` and `timestamp` fields now properly set

### Changed
- Renamed rebalance handlers to use V4/V5 suffixes for clarity

## [1.8.4] - 2025-11-11

### Changed
- Migrated from Alchemy to Goldsky infrastructure
- Added automated deployment scripts for all supported networks

## [1.8.3] - 2025-11-06

### Added

- Create revenue snapshots

## [1.8.2] - 2025-11-05

### Added

- Track RSR Burns

## [1.8.1] - 2025-10-23

### Added

- Handle mints from the zapper

## [1.8.0] - 2025-10-21

### Added

- Minting tracking for accounts with first mint timestamps
- Enhanced balance tracking with hold period timestamps
- Support for tracking uninterrupted holding periods

## [1.7.4] - 2025-08-25

### Added

- Support for proposal cancellation via timelock `Cancelled` event
- `TimelockOperation` and `TimelockOperationByTx` entities for tracking timelock operations
- `timelockId` field in `Proposal` entity
- Handlers for `CallScheduled` and `Cancelled` timelock events

## [1.7.3] - 2025-08-20

### Fixed

- Current holder count calculation for tokens

## [1.7.2] - 2025-08-01

### Fixed

- Enhanced auction bid parsing from transaction receipts

## [1.7.1] - 2024-12-XX

### Added

- Immutable fields support for DTF entities
- Weight control event handling for portfolio management
- Comprehensive README documentation with setup instructions

### Fixed

- Minor bug fixes and improvements

## [1.7.0] - 2024-11-XX

### Added

- Template-based subgraph configuration using Mustache
- Binance Smart Chain (BSC) network support
- Asynchronous bid support for auction mechanisms
- Network-specific configuration parsing system

### Changed

- Migrated to template-based deployment system for multi-network support
- Enhanced auction and bid relationship mapping
- Improved rebalancing event handling

### Fixed

- Auction to bid relation mapping
- Build configuration issues
- Index errors in event processing

## [1.6.0] - 2024-10-XX

### Added

- Full support for DTF protocol version 4.0
- New auction flow implementation
- Role-based access control handling
- Nonce tracking for transactions

### Changed

- Updated contract addresses for version 4.0 deployment
- Enhanced rebalancing bid handling
- Improved auction mechanisms

### Fixed

- Bid mapping inconsistencies
- Type definitions and constant removals

## [1.5.0] - 2024-09-XX

### Added

- Support for DTF protocol version 2.0
- Comprehensive governance system tracking
  - Proposal creation and voting
  - Delegate tracking and vote delegation
  - Timelock operations
- Vote-locked token (stDAO) implementation
  - Lock creation and management
  - Delegation mechanisms
  - Unlock scheduling
- Reward token tracking
- Fee recipient management

### Changed

- Enhanced trade detail tracking for version 2.0
- Improved initial price calculations
- Updated deployer contract integrations

### Fixed

- Delegate address tracking
- Vote casting mechanisms
- Lock entity management

## [1.0.0] - 2024-01-XX

### Added

- Initial DTF portfolio tracking and indexing
- Basic rebalancing event monitoring
- ERC20 token transfer tracking
- Holder analytics and balance calculations
- Multi-network support (Ethereum Mainnet, Base)
- Basic governance proposal tracking
- Event-based indexing architecture

### Technical

- Graph Protocol subgraph implementation
- AssemblyScript mapping handlers
- Entity schema definitions
- Event filtering and processing
