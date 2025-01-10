import { DeployedGovernedStakingToken } from "../../generated/GovernanceDeployer/GovernanceDeployer";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { getOrCreateToken } from "../utils/getters";
import { DAORegistry, Folio, Token } from "../../generated/schema";
import { Token as TokenTemplate } from "../../generated/templates";

export function _handleFolioDeployed(
  folioAddress: Address,
  proxyAdmin: Address,
  deployer: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  let folio = new Folio(folioAddress.toHexString());
  folio.token = getOrCreateToken(folioAddress).id;
  folio.deployer = deployer;
  folio.proxyAdmin = proxyAdmin;
  folio.blockNumber = blockNumber;
  folio.timestamp = timestamp;
  folio.save();

  // Track folio erc20 events
  TokenTemplate.create(folioAddress);
}

export function _handleGovernedFolioDeployed(
  folioAddress: Address,
  stToken: Address,
  ownerGovernor: Address,
  ownerTimelock: Address,
  tradingGovernor: Address,
  tradingTimelock: Address
): void {
  let folio = Folio.load(folioAddress.toHexString());
  if (!folio) {
    return;
  }

  folio.stToken = stToken.toHexString();
  folio.ownerGovernor = ownerGovernor;
  folio.ownerTimelock = ownerTimelock;
  folio.tradingGovernor = tradingGovernor;
  folio.tradingTimelock = tradingTimelock;
  folio.save();
}

export function _handleDeployedGovernedStakingToken(
  underlying: Address,
  stToken: Address,
  governor: Address,
  timelock: Address
): void {
  let daoRegistry = DAORegistry.load(stToken.toHexString());

  if (!daoRegistry) {
    const underlyingToken = getOrCreateToken(underlying);
    const stakingToken = getOrCreateToken(stToken);

    daoRegistry = new DAORegistry(stToken.toHexString());
    daoRegistry.underlying = underlyingToken.id;
    daoRegistry.stToken = stakingToken.id;
    daoRegistry.governor = governor;
    daoRegistry.timelock = timelock;
    daoRegistry.save();

    // Track stToken events
    TokenTemplate.create(stToken);
  }
}
