import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { StakingToken } from "../generated/schema";
import { LockCreated } from "../generated/templates/UnstakingManager/UnstakingManager";
import { _handleDeployedGovernedStakingToken } from "../src/deploy/handlers";
import { handleLockCreated } from "../src/staking-token/mappings";
import { getOrCreateStakingToken } from "../src/utils/getters";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  mockOptimisticGovernor,
  mockStakingVault,
  mockVaultTokenJar,
} from "./helpers/mock-staking-vault";

// Regression for the BSC shared vlRSR (deployed through the untracked
// ReserveOptimisticGovernorDeployer at block 102317233). The subgraph discovered
// the vault through Governor.token() but never subscribed its UnstakingManager, so
// the two real LockCreated events below were never indexed. All values are the
// on-chain ones (tx receipts fetched 2026-08-20).
const VAULT = Address.fromString("0xE744C8157c346B2931807F42552c8CBc0BB6D34f");
const MANAGER = Address.fromString(
  "0xaBa0c273944cacf225412079b599142f71E454b7"
);
const RSR = Address.fromString("0x23f72a3Db61D6CB8aBE5d9AF1Ac4B6c99327bFee");
const TOKEN_JAR = Address.fromString(
  "0x0c2C5064C32800b26d3E0e8A031F366a892Ae793"
);
const USER = Address.fromString("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18");
const UNSTAKING_DELAY = BigInt.fromI32(604800);
const TOTAL_SUPPLY = BigInt.fromString("440118248898585742135575498");
const TOTAL_ASSETS = BigInt.fromString("460466698346365758086336928");
const EXCHANGE_RATE = BigInt.fromString("1046234384358433448");

// LockCreated #0 — tx 0x8784e0…, block 116930184 (2026-08-19T22:43:00Z)
const LOCK0_TX =
  "0x8784e062db27a144747d933631141cb9a577710858bf7d22826ffecc8d7c7a03";
const LOCK0_BLOCK: i64 = 116930184;
const LOCK0_TIMESTAMP: i64 = 1787179380;
const LOCK0_LOG_INDEX = 255;
const LOCK0_AMOUNT = "21533590345237342162257083";
const LOCK0_UNLOCK_TIME = "1787784180";

// LockCreated #1 — tx 0xd2478f…, block 116931302 (2026-08-19T22:51:24Z)
const LOCK1_TX =
  "0xd2478f2fcb33ab741ea099f83141c9d0a55b818ab204a966ac0dc0ce9b7fda39";
const LOCK1_BLOCK: i64 = 116931302;
const LOCK1_TIMESTAMP: i64 = 1787179884;
const LOCK1_LOG_INDEX = 807;
const LOCK1_AMOUNT = "1049167420102310523582207";
const LOCK1_UNLOCK_TIME = "1787784684";

// Legacy vault (Ownable, pre-optimistic) for the GovernanceDeployer event path
const LEGACY_VAULT = Address.fromString(
  "0x4d43e95d8af20aa65695ed2a3b7ec0d2cc88908f"
);
const LEGACY_MANAGER = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const LEGACY_GOVERNOR = Address.fromString(
  "0x05c7cbc4332459b012445c41e452866f1d9faa47"
);
const LEGACY_TIMELOCK = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);

// Vote token that is not a StakingVault at all (every vault read reverts)
const NOT_A_VAULT = Address.fromString(
  "0x3333333333333333333333333333333333333333"
);

mockERC20(RSR, "RSR", "Reserve Rights", 18);
mockStakingVault(
  VAULT,
  "vlRSR",
  "Vote-Locked Reserve Rights",
  18,
  TOTAL_SUPPLY,
  RSR,
  MANAGER,
  UNSTAKING_DELAY,
  EXCHANGE_RATE,
  TOTAL_ASSETS
);
mockVaultTokenJar(VAULT, TOKEN_JAR);

mockStakingVault(
  LEGACY_VAULT,
  "vlRSR",
  "Vote-Locked RSR",
  18,
  BigInt.fromI32(1000),
  RSR,
  LEGACY_MANAGER,
  BigInt.fromI32(1209600),
  BigInt.fromI32(10).pow(18),
  BigInt.fromI32(1000)
);
mockOptimisticGovernor(
  LEGACY_GOVERNOR,
  LEGACY_VAULT,
  "Legacy Governor",
  "1",
  BigInt.fromI32(1),
  BigInt.fromI32(2),
  BigInt.fromI32(3),
  BigInt.fromI32(100),
  BigInt.fromI32(10),
  BigInt.fromI32(0),
  BigInt.fromI32(0),
  BigInt.fromI32(0),
  BigInt.fromI32(0),
  Address.zero()
);

mockStakingVault(
  NOT_A_VAULT,
  "VOTE",
  "Plain Votes",
  18,
  BigInt.fromI32(5),
  null,
  null,
  null,
  null,
  null
);

function createLockCreatedEvent(
  lockId: i32,
  amount: string,
  unlockTime: string,
  blockNumber: i64,
  timestamp: i64,
  txHash: string,
  logIndex: i32
): LockCreated {
  let event = changetype<LockCreated>(newMockEvent());
  event.address = MANAGER;
  event.block.number = BigInt.fromI64(blockNumber);
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.transaction.hash = Bytes.fromHexString(txHash);
  event.logIndex = BigInt.fromI32(logIndex);
  event.parameters = [
    new ethereum.EventParam(
      "lockId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(lockId))
    ),
    new ethereum.EventParam("user", ethereum.Value.fromAddress(USER)),
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
    ),
    new ethereum.EventParam(
      "unlockTime",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(unlockTime))
    ),
  ];
  return event;
}

describe("UnstakingManager discovery", () => {
  beforeEach(() => {
    clearStore();
  });

  test("fallback discovery (Governor.token(), no deployer event) subscribes the vault's UnstakingManager", () => {
    getOrCreateStakingToken(VAULT);

    assert.fieldEquals(
      "UnstakingManager",
      MANAGER.toHexString(),
      "token",
      VAULT.toHexString()
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
      "unstakingDelay",
      UNSTAKING_DELAY.toString()
    );
    assert.fieldEquals(
      "StakingToken",
      VAULT.toHexString(),
      "tokenJar",
      TOKEN_JAR.toHexString()
    );
    assert.dataSourceExists("StakingToken", VAULT.toHexString());
    assert.dataSourceExists("UnstakingManager", MANAGER.toHexString());
  });

  test("discovery is idempotent — a second call does not re-read or overwrite the manager", () => {
    getOrCreateStakingToken(VAULT);

    // If the second call re-subscribed, it would pick up this other address
    createMockedFunction(VAULT, "unstakingManager", "unstakingManager():(address)").returns([
      ethereum.Value.fromAddress(Address.fromString("0x4444444444444444444444444444444444444444")),
    ]);
    getOrCreateStakingToken(VAULT);
    createMockedFunction(VAULT, "unstakingManager", "unstakingManager():(address)").returns([
      ethereum.Value.fromAddress(MANAGER),
    ]);

    assert.fieldEquals("StakingToken", VAULT.toHexString(), "unstakingManager", MANAGER.toHexString());
    assert.entityCount("UnstakingManager", 1);
    assert.notInStore("UnstakingManager", "0x4444444444444444444444444444444444444444");
  });

  test("replays the two real BSC LockCreated events into Lock entities after fallback discovery", () => {
    getOrCreateStakingToken(VAULT);

    handleLockCreated(
      createLockCreatedEvent(
        0,
        LOCK0_AMOUNT,
        LOCK0_UNLOCK_TIME,
        LOCK0_BLOCK,
        LOCK0_TIMESTAMP,
        LOCK0_TX,
        LOCK0_LOG_INDEX
      )
    );
    handleLockCreated(
      createLockCreatedEvent(
        1,
        LOCK1_AMOUNT,
        LOCK1_UNLOCK_TIME,
        LOCK1_BLOCK,
        LOCK1_TIMESTAMP,
        LOCK1_TX,
        LOCK1_LOG_INDEX
      )
    );

    assert.entityCount("Lock", 2);

    const lock0 = MANAGER.toHexString() + "-0";
    assert.fieldEquals("Lock", lock0, "lockId", "0");
    assert.fieldEquals("Lock", lock0, "token", VAULT.toHexString());
    assert.fieldEquals("Lock", lock0, "account", USER.toHexString());
    assert.fieldEquals("Lock", lock0, "amount", LOCK0_AMOUNT);
    assert.fieldEquals("Lock", lock0, "unlockTime", LOCK0_UNLOCK_TIME);
    assert.fieldEquals("Lock", lock0, "createdBlock", LOCK0_BLOCK.toString());
    assert.fieldEquals(
      "Lock",
      lock0,
      "createdTimestamp",
      LOCK0_TIMESTAMP.toString()
    );
    assert.fieldEquals("Lock", lock0, "createdTxnHash", LOCK0_TX);

    const lock1 = MANAGER.toHexString() + "-1";
    assert.fieldEquals("Lock", lock1, "lockId", "1");
    assert.fieldEquals("Lock", lock1, "token", VAULT.toHexString());
    assert.fieldEquals("Lock", lock1, "account", USER.toHexString());
    assert.fieldEquals("Lock", lock1, "amount", LOCK1_AMOUNT);
    assert.fieldEquals("Lock", lock1, "unlockTime", LOCK1_UNLOCK_TIME);
    assert.fieldEquals("Lock", lock1, "createdBlock", LOCK1_BLOCK.toString());
    assert.fieldEquals(
      "Lock",
      lock1,
      "createdTimestamp",
      LOCK1_TIMESTAMP.toString()
    );
    assert.fieldEquals("Lock", lock1, "createdTxnHash", LOCK1_TX);

    // The locker is a tracked account (Account.locks is derived from Lock.account)
    assert.fieldEquals("Account", USER.toHexString(), "id", USER.toHexString());
  });

  test("GovernanceDeployer event path still subscribes the manager (moved into getOrCreateStakingToken)", () => {
    _handleDeployedGovernedStakingToken(
      RSR,
      LEGACY_VAULT,
      LEGACY_GOVERNOR,
      LEGACY_TIMELOCK
    );

    assert.fieldEquals(
      "UnstakingManager",
      LEGACY_MANAGER.toHexString(),
      "token",
      LEGACY_VAULT.toHexString()
    );
    assert.fieldEquals(
      "StakingToken",
      LEGACY_VAULT.toHexString(),
      "governance",
      LEGACY_GOVERNOR.toHexString()
    );
    assert.dataSourceExists("UnstakingManager", LEGACY_MANAGER.toHexString());
  });

  test("a vote token that is not a StakingVault is indexed without a manager and without crashing", () => {
    getOrCreateStakingToken(NOT_A_VAULT);

    assert.fieldEquals(
      "StakingToken",
      NOT_A_VAULT.toHexString(),
      "id",
      NOT_A_VAULT.toHexString()
    );
    // matchstick keeps template registrations across tests, so only the store
    // (cleared per test) is a reliable signal here.
    assert.entityCount("UnstakingManager", 0);
    const stakingToken = StakingToken.load(NOT_A_VAULT.toHexString())!;
    assert.assertTrue(stakingToken.unstakingManager === null);
  });
});
