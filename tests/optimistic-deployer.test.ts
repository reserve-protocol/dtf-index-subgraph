import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { ReserveOptimisticGovernorSystemDeployed } from "../generated/OptimisticGovernorDeployer/OptimisticGovernorDeployer";
import { handleOptimisticGovernorSystemDeployed } from "../src/deploy/mappings";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  mockOptimisticGovernor,
  mockStakingVault,
  mockTimelock,
  mockVaultAdmin,
  mockVaultRewardRatio,
  mockVaultTokenJar,
} from "./helpers/mock-staking-vault";

// Real BSC ReserveOptimisticGovernorDeployer (0x1c10e68b…) events.
// #1 deployWithNewStakingVault  — block 102317233, tx 0x969401ca…
// #2 deployWithExistingStakingVault — block 103053084, tx 0x051d452b… (vault = 0x0)
const DEPLOYER = Address.fromString(
  "0x1c10e68b0fbfd0da41969120bf499e8d39d66495"
);
const VAULT = Address.fromString("0xE744C8157c346B2931807F42552c8CBc0BB6D34f");
const GOVERNOR = Address.fromString(
  "0xbaf703e7891943d46ee462a4ec74945b09c67b86"
);
const TIMELOCK = Address.fromString(
  "0xb8d699cf52f53a8c9801806e6252a837b3e6b039"
);
const SELECTOR_REGISTRY = Address.fromString(
  "0xc50d3c33d7d2f95e14a98f12cafdfec04f919cd6"
);
const MANAGER = Address.fromString(
  "0xaBa0c273944cacf225412079b599142f71E454b7"
);
const RSR = Address.fromString("0x23f72a3Db61D6CB8aBE5d9AF1Ac4B6c99327bFee");
const TOKEN_JAR = Address.fromString(
  "0x0c2C5064C32800b26d3E0e8A031F366a892Ae793"
);
const EXTRA_GUARDIAN = Address.fromString(
  "0xB432b0cf55df8D8F367D965A23198ccDaacc4b1f"
);
const CANCELLER_ROLE = Bytes.fromHexString(
  "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783"
);
const PROPOSER_ROLE = Bytes.fromHexString(
  "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"
);

const DTF_GOVERNOR = Address.fromString(
  "0xf6f73c085b22d791705b8173712f37a2feee58e1"
);
const DTF_TIMELOCK = Address.fromString(
  "0x823677ea4c1abb3e4f26eee767c550f48425e042"
);

mockERC20(RSR, "RSR", "Reserve Rights", 18);
mockStakingVault(
  VAULT,
  "vlRSR",
  "Vote-Locked Reserve Rights",
  18,
  BigInt.fromString("440118248898585742135575498"),
  RSR,
  MANAGER,
  BigInt.fromI32(604800),
  BigInt.fromString("1046234384358433448"),
  BigInt.fromString("460466698346365758086336928")
);
mockVaultTokenJar(VAULT, TOKEN_JAR);
mockVaultRewardRatio(VAULT, BigInt.fromString("1146076687433"));
mockVaultAdmin(VAULT, TIMELOCK);

mockTimelock(
  TIMELOCK,
  BigInt.fromI32(172800),
  CANCELLER_ROLE,
  [GOVERNOR, EXTRA_GUARDIAN],
  PROPOSER_ROLE,
  [GOVERNOR],
  []
);

// Governor / timelock parameters below are the on-chain values of the BSC vlRSR
// governor 0xbaf703e7… and timelock 0xb8d699cf… (cast, 2026-08-20); the DTF
// governor 0xf6f73c08… is mocked with the same values for simplicity.
function mockGovernor(governor: Address): void {
  mockOptimisticGovernor(
    governor,
    VAULT,
    "Reserve Optimistic Governor",
    "1.0.0",
    BigInt.fromI32(172800),
    BigInt.fromI32(259200),
    BigInt.fromString("440118248898585742135576"),
    BigInt.fromString("1000000000000000000"),
    BigInt.fromString("100000000000000000"),
    BigInt.fromI32(14400),
    BigInt.fromI32(72000),
    BigInt.fromString("10000000000000000"),
    BigInt.fromI32(2),
    SELECTOR_REGISTRY
  );
}
mockGovernor(GOVERNOR);
mockGovernor(DTF_GOVERNOR);

function createSystemDeployedEvent(
  stakingVault: Address,
  governor: Address,
  timelock: Address,
  blockNumber: i64
): ReserveOptimisticGovernorSystemDeployed {
  let event = changetype<ReserveOptimisticGovernorSystemDeployed>(
    newMockEvent()
  );
  event.address = DEPLOYER;
  event.block.number = BigInt.fromI64(blockNumber);
  event.parameters = [
    new ethereum.EventParam(
      "stakingVault",
      ethereum.Value.fromAddress(stakingVault)
    ),
    new ethereum.EventParam("governor", ethereum.Value.fromAddress(governor)),
    new ethereum.EventParam("timelock", ethereum.Value.fromAddress(timelock)),
    new ethereum.EventParam(
      "optimisticSelectorRegistry",
      ethereum.Value.fromAddress(SELECTOR_REGISTRY)
    ),
  ];
  return event;
}

describe("handleOptimisticGovernorSystemDeployed", () => {
  beforeEach(() => {
    clearStore();
  });

  test("deployWithNewStakingVault: vault, unstaking manager, governance and timelock are all indexed", () => {
    handleOptimisticGovernorSystemDeployed(
      createSystemDeployedEvent(VAULT, GOVERNOR, TIMELOCK, 102317233)
    );

    // Vault
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "governance",
      GOVERNOR.toHexString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "underlying",
      RSR.toHexString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "unstakingManager",
      MANAGER.toHexString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "rewardRatio",
      "1146076687433"
    );
    assert.fieldEquals(
      "UnstakingManager",
      MANAGER.toHexString(),
      "token",
      VAULT.toHexString()
    );

    // Governance
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "token",
      VAULT.toHexString()
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "timelock",
      TIMELOCK.toHexString()
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "isOptimistic",
      "true"
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "optimisticVetoDelay",
      "14400"
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "optimisticVetoPeriod",
      "72000"
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "optimisticVetoThreshold",
      "10000000000000000"
    );
    assert.fieldEquals(
      "Governance",
      GOVERNOR.toHexString(),
      "optimisticProposalThrottleCapacity",
      "2"
    );

    // Timelock (AccessControl vault has no OwnershipTransferred — created here)
    assert.fieldEquals(
      "GovernanceTimelock",
      TIMELOCK.toHexString(),
      "governance",
      GOVERNOR.toHexString()
    );
    assert.fieldEquals(
      "GovernanceTimelock",
      TIMELOCK.toHexString(),
      "entity",
      VAULT.toHexString()
    );
    assert.fieldEquals(
      "GovernanceTimelock",
      TIMELOCK.toHexString(),
      "type",
      "VOTE_LOCKING"
    );
    assert.fieldEquals(
      "GovernanceTimelock",
      TIMELOCK.toHexString(),
      "executionDelay",
      "172800"
    );
    assert.fieldEquals(
      "GovernanceTimelock",
      TIMELOCK.toHexString(),
      "guardians",
      "[" +
        GOVERNOR.toHexString() +
        ", " +
        EXTRA_GUARDIAN.toHexString() +
        "]"
    );

    // Templates
    assert.dataSourceExists("StakingToken", VAULT.toHexString());
    assert.dataSourceExists("UnstakingManager", MANAGER.toHexString());
    assert.dataSourceExists("Governance", GOVERNOR.toHexString());
    assert.dataSourceExists("Timelock", TIMELOCK.toHexString());
  });

  test("deployWithExistingStakingVault (vault = 0x0): the shared vault is untouched and the DTF governance is left to the role-grant path", () => {
    handleOptimisticGovernorSystemDeployed(
      createSystemDeployedEvent(VAULT, GOVERNOR, TIMELOCK, 102317233)
    );
    handleOptimisticGovernorSystemDeployed(
      createSystemDeployedEvent(
        Address.zero(),
        DTF_GOVERNOR,
        DTF_TIMELOCK,
        103053084
      )
    );

    // Creating the Governance here would freeze optimisticProposers to [] (its
    // timelock entity does not exist yet); the DTF role grant creates both later.
    assert.notInStore("Governance", DTF_GOVERNOR.toHexString());
    assert.notInStore("GovernanceTimelock", DTF_TIMELOCK.toHexString());

    // The vault's own governance is untouched by a DTF reusing it
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "governance",
      GOVERNOR.toHexString()
    );
    assert.entityCount("StakingToken", 1);
    assert.entityCount("Governance", 1);
  });

  test("deployWithExistingStakingVault on a never-seen vault still discovers it (manager included) through Governor.token()", () => {
    handleOptimisticGovernorSystemDeployed(
      createSystemDeployedEvent(
        Address.zero(),
        DTF_GOVERNOR,
        DTF_TIMELOCK,
        103053084
      )
    );

    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "unstakingManager",
      MANAGER.toHexString()
    );
    assert.dataSourceExists("StakingToken", VAULT.toHexString());
    assert.dataSourceExists("UnstakingManager", MANAGER.toHexString());
    assert.notInStore("Governance", DTF_GOVERNOR.toHexString());
  });
});
