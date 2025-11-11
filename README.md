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

## Deployment

This subgraph is deployed using Goldsky infrastructure. Multiple deployment options are available:

### Prerequisites

Before deploying, you need to install and configure the Goldsky CLI:

#### Install Goldsky CLI

**For macOS/Linux:**
```bash
curl https://goldsky.com | sh
```

**For Windows:**
```bash
npm install -g @goldskycom/cli
```

#### Configure Authentication

After installation, login with your CLI token:
```bash
goldsky login
```

You'll be prompted to enter your CLI token key. This is required for deployment access.

### Deploy to Specific Network

```bash
# Deploy to Ethereum Mainnet
npm run deploy:mainnet

# Deploy to Base
npm run deploy:base

# Deploy to BSC
npm run deploy:bsc

# Deploy with custom version
npm run deploy:mainnet -- --version 1.8.4
```

### Interactive Deployment

```bash
# Interactive mode - prompts for network and version
npm run deploy
```

### Deploy to All Networks

```bash
# Deploy to all networks with current version
npm run deploy:all

# Deploy to all networks with custom version
npm run deploy:all -- --version 1.8.4
```

The deployment process automatically:
1. Generates network-specific configuration using the template system
2. Deploys to Goldsky with the format: `dtf-index-<network>/<version>`

## Key Entities

- **DTF**: Represents an index DTF with configuration, fees, and governance settings
- **Rebalance/Auction**: Tracks index rebalancing events and auction bids
- **Token**: ERC20 tokens with transfer history and holder analytics
- **Governance**: Proposals, votes, delegates, and timelock operations
- **VoteLockedToken**: stDAO tokens with delegation and vote-locking mechanisms

## Version Support

The subgraph supports multiple protocol versions:
- Version 1.0.0: Initial protocol deployment
- Version 2.0.0: Enhanced features and updated contracts
- Version 4.0.0: Latest version with advanced functionality

Each version has its own deployer contracts (FolioDeployer and GovernanceDeployer) at different addresses across networks.