import { log } from "@graphprotocol/graph-ts";
import { FolioVersion } from "../../generated/schema";
import { FolioDeployer as FolioDeployerContract } from "../../generated/FolioVersionRegistry/FolioDeployer";
import {
  VersionDeprecated,
  VersionRegistered,
} from "../../generated/FolioVersionRegistry/FolioVersionRegistry";
import { FolioDeployerFromRegistry } from "../../generated/templates";
import { STATIC_FOLIO_DEPLOYERS } from "../utils/constants";

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

  // Deployers listed in networks.json already have a static source.
  if (STATIC_FOLIO_DEPLOYERS.indexOf(deployer.toHexString()) !== -1) return;
  FolioDeployerFromRegistry.create(deployer);
}

export function handleVersionDeprecated(event: VersionDeprecated): void {
  const record = FolioVersion.load(event.params.versionHash.toHexString());
  if (!record) return;
  record.deprecated = true;
  record.save();
}
