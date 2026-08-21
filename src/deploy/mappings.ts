import {
  FolioDeployed,
  GovernedFolioDeployed,
} from "../../generated/FolioDeployer/FolioDeployer";
import { DeployedGovernedStakingToken } from "../../generated/GovernanceDeployer/GovernanceDeployer";
import { ReserveOptimisticGovernorSystemDeployed } from "../../generated/OptimisticGovernorDeployer/OptimisticGovernorDeployer";
import {
  _handleDeployedGovernedStakingToken,
  _handleDTFDeployed,
  _handleGovernedDTFDeployed,
  _handleOptimisticGovernorSystemDeployed,
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

export function handleOptimisticGovernorSystemDeployed(
  event: ReserveOptimisticGovernorSystemDeployed
): void {
  _handleOptimisticGovernorSystemDeployed(
    event.params.stakingVault,
    event.params.governor,
    event.params.timelock
  );
}
