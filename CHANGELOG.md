# Changelog

All notable changes to the DTF Index Subgraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.2] - 2024-12-XX

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
