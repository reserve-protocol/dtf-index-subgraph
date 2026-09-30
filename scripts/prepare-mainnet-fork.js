const fs = require("fs");
const path = require("path");

const MAINNET = {
  v5FolioDeployer: "0x4D201a6e5BF975E2CEE9e5cbDfc803C0Ff122073",
  v6FolioDeployer: "0x2B1Cd9aEF0CD3B9fF5DCa1C66348eCfC46F37392",
  versionRegistry: "0xA665b273997F70b647B66fa7Ed021287544849dB",
  v5GovernanceDeployer: "0x72f87239981159ed23673012EE3806Ca6114AB2A",
  optimisticGovernorDeployer: "0x2acc45e12776579f40ae3419764eef7022763735",
  // Wired into the 6.0.0 deployer
  optimisticGovernorDeployerV11: "0x4292433c772958ae93bebf32602ffDe0f9C5Fcd6",
  rsr: "0x320623b8e4ff03373931769a31fc52a4e78b5d70",
};

const args = process.argv.slice(2);
const forkBlock = getArgument("--fork-block") || process.env.FORK_BLOCK;
// The real 6.0.0 deployer is a static source like on mainnet (harmless on a fork older than it);
// a sandbox-built v6 deployer is discovered through the fork's version registry.
const versionRegistry = optionalAddress(
  "--version-registry",
  "VERSION_REGISTRY_ADDRESS",
  MAINNET.versionRegistry
);
const outputPath =
  getArgument("--output") || process.env.FORK_NETWORK_CONFIG || ".fork/networks.json";

if (!forkBlock || !/^\d+$/.test(forkBlock)) {
  fail("--fork-block (or FORK_BLOCK) must be a non-negative integer");
}
const v5FolioDeployer = optionalAddress(
  "--v5-folio-deployer",
  "V5_FOLIO_DEPLOYER_ADDRESS",
  MAINNET.v5FolioDeployer
);
const v5GovernanceDeployer = optionalAddress(
  "--v5-governance-deployer",
  "V5_GOVERNANCE_DEPLOYER_ADDRESS",
  MAINNET.v5GovernanceDeployer
);
const v6FolioDeployer = optionalAddress(
  "--v6-folio-deployer",
  "V6_FOLIO_DEPLOYER_ADDRESS",
  MAINNET.v6FolioDeployer
);
const optimisticGovernorDeployerV11 = optionalAddress(
  "--optimistic-governor-deployer-v11",
  "OPTIMISTIC_GOVERNOR_DEPLOYER_V11_ADDRESS",
  MAINNET.optimisticGovernorDeployerV11
);
const optimisticGovernorDeployer = optionalAddress(
  "--optimistic-governor-deployer",
  "OPTIMISTIC_GOVERNOR_DEPLOYER_ADDRESS",
  MAINNET.optimisticGovernorDeployer
);

const startBlock = Number(forkBlock);
if (!Number.isSafeInteger(startBlock)) {
  fail("fork block exceeds JavaScript's safe integer range");
}

const config = {
  mainnet: {
    grafting: { base: "", block: 0 },
    secondsPerBlock: 12,
    FolioDeployer: [
      {
        address: v5FolioDeployer,
        startBlock,
        _version: "5.0.0-fork",
      },
      {
        address: v6FolioDeployer,
        startBlock,
        _version: "6.0.0-fork",
      },
    ],
    GovernanceDeployer: [
      {
        address: v5GovernanceDeployer,
        startBlock,
        _version: "5.0.0-fork",
      },
    ],
    OptimisticGovernorDeployer: [
      {
        address: optimisticGovernorDeployer,
        startBlock,
        _version: "reserve-governor-fork",
      },
      {
        address: optimisticGovernorDeployerV11,
        startBlock,
        _version: "reserve-governor-1.1.0-fork",
      },
    ],
    TrackedVault: [],
    FolioVersionRegistry: { address: versionRegistry, startBlock },
    RSR: {
      address: MAINNET.rsr,
      startBlock,
    },
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);

function getArgument(name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function optionalAddress(argument, environment, fallback) {
  const value = getArgument(argument) || process.env[environment] || fallback;
  if (!isAddress(value)) {
    fail(`${argument} (or ${environment}) must be an Ethereum address`);
  }
  return value;
}

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
