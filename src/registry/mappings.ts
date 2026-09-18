import { log } from "@graphprotocol/graph-ts";
import { FolioVersion } from "../../generated/schema";
import { FolioDeployer as FolioDeployerContract } from "../../generated/FolioVersionRegistry/FolioDeployer";
import {
  VersionDeprecated,
  VersionRegistered,
} from "../../generated/FolioVersionRegistry/FolioVersionRegistry";
import { FolioDeployerFromRegistry } from "../../generated/templates";
import { STATIC_DEPLOYER_VERSIONS } from "../utils/constants";

export function handleVersionRegistered(event: VersionRegistered): void {
  const deployer = event.params.folioDeployer;
  const versionCall = FolioDeployerContract.bind(deployer).try_version();
  if (versionCall.reverted) {
    log.warning("VersionRegistered for {} without a readable version(); not indexed", [deployer.toHexString()]);
    return;
  }
  const version = versionCall.value;

  let record = FolioVersion.load(event.params.versionHash.toHexString());
  if (!record) {
    record = new FolioVersion(event.params.versionHash.toHexString());
    record.blockNumber = event.block.number;
    record.timestamp = event.block.timestamp;
    record.deprecated = false;
  }
  record.version = version;
  record.deployer = deployer;
  record.save();

  // Releases up to 5.0.0 are static data sources in networks.json; a second
  // source on the same deployer would index every deployment twice.
  if (STATIC_DEPLOYER_VERSIONS.indexOf(version) !== -1) return;
  FolioDeployerFromRegistry.create(deployer);
}

export function handleVersionDeprecated(event: VersionDeprecated): void {
  const record = FolioVersion.load(event.params.versionHash.toHexString());
  if (!record) return;
  record.deprecated = true;
  record.save();
}
