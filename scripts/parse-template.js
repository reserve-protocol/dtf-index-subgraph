const fs = require("fs");
const mustache = require("mustache");

const args = process.argv.slice(2);
const network = getArgument("--network");
if (!network) {
  console.error("Error: --network argument is required");
  process.exit(1);
}
const configPath = getArgument("--config") || "networks.json";
const outputPath = getArgument("--output") || "subgraph.yaml";

const template = fs.readFileSync("subgraph.yaml.mustache", "utf8");
const data = fs.readFileSync(configPath, "utf8");
const networksData = JSON.parse(data);

// Check if the specified network exists
if (!networksData[network]) {
  console.error(`Error: Network '${network}' not found in ${configPath}`);
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
  // One registry per chain; omitted from configs that list every deployer statically (fork profile)
  FolioVersionRegistry: networksData[network].FolioVersionRegistry,
  grafting: hasGrafting,
};

// The registry mapping skips deployers whose version is in STATIC_DEPLOYER_VERSIONS; a static
// entry whose version is missing there would be indexed twice (static source + registry template).
const staticVersions = fs
  .readFileSync("src/utils/constants.ts", "utf8")
  .match(/STATIC_DEPLOYER_VERSIONS[^=]*=\s*\[([^\]]*)\]/)[1]
  .match(/"[^"]+"/g)
  .map((entry) => entry.replace(/"/g, ""));
for (const deployer of networksData[network].FolioDeployer) {
  const version = String(deployer._version || "").replace(/-fork$/, "");
  if (!staticVersions.includes(version)) {
    console.error(
      `Error: FolioDeployer ${deployer.address} (${deployer._version}) is not in STATIC_DEPLOYER_VERSIONS; add it or index it through the registry instead`
    );
    process.exit(1);
  }
}

const output = mustache.render(template, templateData);

fs.writeFileSync(outputPath, output);

function getArgument(name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function getWithPostfix(array) {
  return array.map((item, index) => ({
    ...item,
    postfix: index ? index.toString() : "",
  }));
}
