# Changelog

All notable changes to the DTF Index Subgraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.1] - 2026-05-13

### Fixed
- DTFs that go through the `FolioDeployed`-only path (governance attached later via Timelock role grant, no upfront `GovernedFolioDeployed`) were ending up with `stToken` and `stTokenAddress` left as `null`. `attachGovernanceToTimelock` now backfills both from the governance's token reference when they aren't already set. Idempotent — no-op when the deploy-time path already populated them. Concretely fixes the test DTF `0xd45e4170834a803D084b2bB145c9ad08f3BdD651`.

### Changed
- Re-indexed from scratch (no grafting from 1.9.0). The affected `RoleGranted` events for existing DTFs fired before 1.9.0's pruned data window, so a graft couldn't replay them — the only way to fix existing entities was a clean reindex.

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
