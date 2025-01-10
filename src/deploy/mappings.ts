import { DeployedGovernedStakingToken } from "../../generated/GovernanceDeployer/GovernanceDeployer";
import {
  FolioDeployed,
  GovernedFolioDeployed,
} from "../../generated/FolioDeployer/FolioDeployer";
import { _handleDeployedGovernedStakingToken, _handleFolioDeployed, _handleGovernedFolioDeployed } from "./handlers";

export function handleFolioDeployed(event: FolioDeployed): void {
  _handleFolioDeployed(
    event.params.folio,
    event.params.folioAdmin,
    event.transaction.from,
    event.block.number,
    event.block.timestamp
  );
}

export function handleGovernedFolioDeployed(
  event: GovernedFolioDeployed
): void {
  _handleGovernedFolioDeployed(
    event.params.folio,
    event.params.stToken,
    event.params.ownerGovernor,
    event.params.ownerTimelock,
    event.params.tradingGovernor,
    event.params.tradingGovernor
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
