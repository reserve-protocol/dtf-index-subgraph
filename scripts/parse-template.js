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

// Prepare data for the specific network
const templateData = {
  network: network,
  rsrAddress: networksData[network].RSR.address,
  rsrBurnStartBlock: networksData[network].RSR.startBlock,
  FolioDeployer: getWithPostfix(networksData[network].FolioDeployer),
  GovernanceDeployer: getWithPostfix(networksData[network].GovernanceDeployer),
};

const output = mustache.render(template, templateData);

fs.writeFileSync("subgraph.yaml", output);

function getWithPostfix(array) {
  return array.map((item, index) => ({
    ...item,
    postfix: index ? index.toString() : "",
  }));
}
