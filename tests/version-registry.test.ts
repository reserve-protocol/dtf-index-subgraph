import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import {
  VersionDeprecated,
  VersionRegistered,
} from "../generated/FolioVersionRegistry/FolioVersionRegistry";
import {
  handleVersionDeprecated,
  handleVersionRegistered,
} from "../src/registry/mappings";

const V5_DEPLOYER = Address.fromString("0x4D201a6e5BF975E2CEE9e5cbDfc803C0Ff122073");
const V6_DEPLOYER = Address.fromString("0x388dB009b7984E673938AC20480194D4481bEF11");
const V5_HASH = Bytes.fromHexString(
  "0x2ade05f7ad4e6dde8d7d2e1ac2a1fd6ae32b3c3e0f9ffb2a4a9b1d1e0f0c558c",
);
const V6_HASH = Bytes.fromHexString(
  "0x6000000000000000000000000000000000000000000000000000000000000006",
);

function registered(hash: Bytes, deployer: Address, block: i32): VersionRegistered {
  const event = changetype<VersionRegistered>(newMockEvent());
  event.block.number = ethereum.Value.fromI32(block).toBigInt();
  event.block.timestamp = ethereum.Value.fromI32(block * 12).toBigInt();
  event.parameters = [
    new ethereum.EventParam("versionHash", ethereum.Value.fromFixedBytes(hash)),
    new ethereum.EventParam("folioDeployer", ethereum.Value.fromAddress(deployer)),
  ];
  return event;
}

describe("Folio version registry", () => {
  beforeEach(() => {
    clearStore();
  });

  test("records registered releases and spawns a deployer source only for deployers without a static one", () => {
    createMockedFunction(V5_DEPLOYER, "version", "version():(string)").returns([
      ethereum.Value.fromString("5.0.0"),
    ]);
    createMockedFunction(V6_DEPLOYER, "version", "version():(string)").returns([
      ethereum.Value.fromString("6.0.0"),
    ]);

    // Data source counts persist across tests in a file, so the negative cases run before the first spawn.
    // V6_DEPLOYER stands for a sandbox-built 6.0.0 deployer: not static, so the registry spawns it.
    const UNKNOWN = Address.fromString("0x9000000000000000000000000000000000000009");
    const V401 = Address.fromString("0x5Bed18AcA50E6057E6658Fe8498004092EedCDcF");
    createMockedFunction(UNKNOWN, "version", "version():(string)").reverts();
    createMockedFunction(V401, "version", "version():(string)").returns([ethereum.Value.fromString("4.0.1")]);
    handleVersionRegistered(registered(V6_HASH, UNKNOWN, 300));
    assert.entityCount("FolioVersion", 0);
    assert.dataSourceCount("FolioDeployerFromRegistry", 0);
    handleVersionRegistered(registered(V5_HASH, V401, 301));
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "version", "4.0.1");
    assert.dataSourceCount("FolioDeployerFromRegistry", 0);
    // The real 6.0.0 deployer is a static source in networks.json: recorded, not spawned again.
    const REAL_V6 = Address.fromString("0x2B1Cd9aEF0CD3B9fF5DCa1C66348eCfC46F37392");
    createMockedFunction(REAL_V6, "version", "version():(string)").returns([ethereum.Value.fromString("6.0.0")]);
    handleVersionRegistered(registered(V6_HASH, REAL_V6, 302));
    assert.fieldEquals("FolioVersion", V6_HASH.toHexString(), "deployer", REAL_V6.toHexString());
    assert.dataSourceCount("FolioDeployerFromRegistry", 0);
    clearStore();

    handleVersionRegistered(registered(V5_HASH, V5_DEPLOYER, 100));
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "version", "5.0.0");
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "deployer", V5_DEPLOYER.toHexString());
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "blockNumber", "100");
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "timestamp", "1200");
    assert.fieldEquals("FolioVersion", V5_HASH.toHexString(), "deprecated", "false");
    assert.dataSourceCount("FolioDeployerFromRegistry", 0);

    handleVersionRegistered(registered(V6_HASH, V6_DEPLOYER, 200));
    assert.fieldEquals("FolioVersion", V6_HASH.toHexString(), "version", "6.0.0");
    assert.dataSourceCount("FolioDeployerFromRegistry", 1);
    assert.dataSourceExists("FolioDeployerFromRegistry", V6_DEPLOYER.toHexString());
  });


  test("marks a release deprecated and ignores unknown hashes", () => {
    createMockedFunction(V6_DEPLOYER, "version", "version():(string)").returns([
      ethereum.Value.fromString("6.0.0"),
    ]);
    handleVersionRegistered(registered(V6_HASH, V6_DEPLOYER, 200));

    const deprecated = changetype<VersionDeprecated>(newMockEvent());
    deprecated.parameters = [
      new ethereum.EventParam("versionHash", ethereum.Value.fromFixedBytes(V6_HASH)),
    ];
    handleVersionDeprecated(deprecated);
    assert.fieldEquals("FolioVersion", V6_HASH.toHexString(), "deprecated", "true");

    const unknown = changetype<VersionDeprecated>(newMockEvent());
    unknown.parameters = [
      new ethereum.EventParam("versionHash", ethereum.Value.fromFixedBytes(V5_HASH)),
    ];
    handleVersionDeprecated(unknown);
    assert.entityCount("FolioVersion", 1);
  });
});
