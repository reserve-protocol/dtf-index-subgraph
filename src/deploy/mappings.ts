import {
  FolioDeployed,
  GovernedFolioDeployed,
} from "../../generated/templates/FolioDeployer/FolioDeployer";
import { DeployedGovernedStakingToken } from "../../generated/GovernanceDeployer/GovernanceDeployer";
import {
  _handleDeployedGovernedStakingToken,
  _handleDTFDeployed,
  _handleGovernedDTFDeployed,
} from "./handlers";

export function handleDTFDeployed(event: FolioDeployed): void {
  _handleDTFDeployed(
    event.params.folio,
    event.params.folioAdmin,
    event.transaction.from,
    event.block.number,
    event.block.timestamp
  );
}

export function handleGovernedDTFDeployed(event: GovernedFolioDeployed): void {
  _handleGovernedDTFDeployed(
    event.params.folio,
    event.params.stToken,
    event.params.ownerGovernor,
    event.params.ownerTimelock,
    event.params.tradingGovernor,
    event.params.tradingTimelock
  );
}

export function handleDeployedGovernedStakingToken(
  event: DeployedGovernedStakingToken
): void {
  _handleDeployedGovernedStakingToken(
    event.params.underlying,
    event.params.stToken,
    event.params.governor,
    event.params.timelock
  );
}
