# DTF Index Subgraph

A Graph Protocol subgraph for indexing DTF portfolios, governance systems, and vote-locked tokens across multiple blockchain networks.

## Overview

The DTF Index Subgraph tracks and indexes:
- DTF portfolio deployments and configurations
- Portfolio rebalancing events and auction mechanisms
- Governance proposals, voting, and timelock operations
- Vote-locked token (stDAO) delegation and unlocking
- ERC20 token transfers and holder analytics

## Supported Networks

- **Ethereum Mainnet** (`mainnet`)
- **Base** (`base`)
- **Binance Smart Chain** (`bsc`)

## Template Parsing System

This subgraph uses a Mustache-based template system to generate network-specific configurations:

1. **Template File**: `subgraph.yaml.mustache` contains the base configuration with placeholders
2. **Network Configuration**: `networks.json` stores deployment addresses and block numbers for each network
3. **Parser Script**: `scripts/parse-template.js` generates the final `subgraph.yaml`

### How It Works

The template parsing process:
1. Takes a network argument (e.g., "mainnet", "base", "bsc")
2. Loads network-specific addresses and block numbers from `networks.json`
3. Handles multiple protocol versions (1.0.0, 2.0.0, 4.0.0) with different deployer contracts
4. Generates `subgraph.yaml` with all network-specific values filled in

### Building for Different Networks

```bash
# Generate configuration for Ethereum Mainnet
npm run parse:mainnet

# Generate configuration for Base
npm run parse:base

# Generate configuration for BSC
npm run parse:bsc

# Then build the subgraph
npm run codegen
npm run build
```

## Key Entities

- **DTF**: Represents a DTF portfolio with configuration, fees, and governance settings
- **Rebalance/Auction**: Tracks portfolio rebalancing events and auction bids
- **Token**: ERC20 tokens with transfer history and holder analytics
- **Governance**: Proposals, votes, delegates, and timelock operations
- **VoteLockedToken**: stDAO tokens with delegation and vote-locking mechanisms

## Version Support

The subgraph supports multiple protocol versions:
- Version 1.0.0: Initial protocol deployment
- Version 2.0.0: Enhanced features and updated contracts
- Version 4.0.0: Latest version with advanced functionality

Each version has its own deployer contracts (FolioDeployer and GovernanceDeployer) at different addresses across networks.