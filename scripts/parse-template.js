const fs = require("fs");
const mustache = require("mustache");

// Parse command line arguments
const args = process.argv.slice(2);
const networkIndex = args.indexOf("--network");
if (networkIndex === -1 || networkIndex === args.length - 1) {
  console.error("Error: --network argument is required");
  process.exit(1);
}
const network = args[networkIndex + 1];

const template = fs.readFileSync("subgraph.yaml.mustache", "utf8");
const data = fs.readFileSync("networks.json", "utf8");
const networksData = JSON.parse(data);

// Check if the specified network exists
if (!networksData[network]) {
  console.error(`Error: Network '${network}' not found in networks.json`);
  process.exit(1);
}

// Grafting: networks.json holds <name>/<version> + block for Goldsky's --graft-from CLI flag.
// The manifest only declares `features: - grafting` (Goldsky's validator requires it);
// the actual graft target/block are passed via CLI in deploy.js.
const graftingConfig = networksData[network].grafting;
const hasGrafting =
  graftingConfig && graftingConfig.base && graftingConfig.base !== "";

// Vault exchange rates are sampled by a polling block handler. The cadence is
// expressed in seconds here and converted to blocks per chain (block times differ
// by ~25x between mainnet and BSC).
const EXCHANGE_RATE_POLL_SECONDS = 600;
const secondsPerBlock = networksData[network].secondsPerBlock;
if (!secondsPerBlock) {
  console.error(`Error: Network '${network}' is missing secondsPerBlock in networks.json`);
  process.exit(1);
}
const exchangeRatePollingBlocks = Math.max(
  1,
  Math.round(EXCHANGE_RATE_POLL_SECONDS / secondsPerBlock)
);

const templateData = {
  network: network,
  exchangeRatePollingBlocks: exchangeRatePollingBlocks,
  rsrAddress: networksData[network].RSR.address,
  rsrBurnStartBlock: networksData[network].RSR.startBlock,
  FolioDeployer: getWithPostfix(networksData[network].FolioDeployer),
  GovernanceDeployer: getWithPostfix(networksData[network].GovernanceDeployer),
  OptimisticGovernorDeployer: getWithPostfix(
    networksData[network].OptimisticGovernorDeployer || []
  ),
  // Vaults whose share -> asset rate is polled (one vlRSR vault per chain)
  TrackedVault: getWithPostfix(networksData[network].TrackedVault || []),
  BridgedDTF: getWithPostfix(networksData[network].BridgedDTF || []),
  grafting: hasGrafting,
};

const output = mustache.render(template, templateData);

fs.writeFileSync("subgraph.yaml", output);

function getWithPostfix(array) {
  return array.map((item, index) => ({
    ...item,
    postfix: index ? index.toString() : "",
  }));
}
