import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  createMockedFunction,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { GovernanceTimelock } from "../generated/schema";
import { RoleGranted, RoleRevoked } from "../generated/templates/DTF/DTF";
import { _handleRoleGranted, _handleRoleRevoked } from "../src/dtf/handlers";
import { handleRoleGranted, handleRoleRevoked } from "../src/dtf/mappings";
import { GovernanceType, Role } from "../src/utils/constants";
import { createTestDTF, createTestGovernance } from "./helpers/mock-entities";

const DTF_ADDR = Address.fromString(
  "0xD577936364733a0f03ef92adf572EB4265Ccc4cc"
);
const ACCOUNT_1 = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const ACCOUNT_2 = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);
const MAINNET_DTF = Address.fromString(
  "0x9f4535b8eff872ae8f6cad4486ae3f310903c69a"
);
const SPELL = Address.fromString(
  "0x082e701456cd702fbe5797ab515e6b00580e5a14"
);
const OLD_OWNER_GOVERNOR = Address.fromString(
  "0xcffc7fd16227aa27e9fd2ce718bd51bab4c272c4"
);
const OLD_OWNER_TIMELOCK = Address.fromString(
  "0xdf106aab7113c00bff726e63c7cf54722849df45"
);
const OLD_TRADING_GOVERNOR = Address.fromString(
  "0xaa31a8a5609702c0ee7861665d80ce6f1e8ea6c6"
);
const OLD_TRADING_TIMELOCK = Address.fromString(
  "0x0b73b89e12bfbd2b40f83d8162657548c4b06c3b"
);
const OLD_ST_TOKEN = Address.fromString(
  "0x931f31692073da73bdcf834b9446842dc484bc68"
);
const NEW_GOVERNOR = Address.fromString(
  "0x4e990a4abf778ca1608d0d894a7e5cdbee8863ed"
);
const NEW_TIMELOCK = Address.fromString(
  "0xb7153e43e3c02b93b316accf6cf531cb042c8da5"
);
const NEW_ST_TOKEN = Address.fromString(
  "0x0726d9d0e86da9be70985c8d8b2ab1ff42ece521"
);

// Mock Timelock.getMinDelay() to revert for all accounts used as role grantees
// This makes createGovernanceTimelock() exit early without creating a timelock
function mockTimelockRevert(account: Address): void {
  createMockedFunction(
    account,
    "getMinDelay",
    "getMinDelay():(uint256)"
  ).reverts();
}

mockTimelockRevert(ACCOUNT_1);
mockTimelockRevert(ACCOUNT_2);
mockTimelockRevert(SPELL);

function createRoleGrantedEvent(
  role: Bytes,
  account: Address,
  sender: Address,
  logIndex: i32
): RoleGranted {
  let event = changetype<RoleGranted>(newMockEvent());
  event.address = MAINNET_DTF;
  event.logIndex = BigInt.fromI32(logIndex);
  event.parameters = [
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role)),
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account)),
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender)),
  ];
  return event;
}

function createRoleRevokedEvent(
  role: Bytes,
  account: Address,
  sender: Address,
  logIndex: i32
): RoleRevoked {
  let event = changetype<RoleRevoked>(newMockEvent());
  event.address = MAINNET_DTF;
  event.logIndex = BigInt.fromI32(logIndex);
  event.parameters = [
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role)),
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account)),
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender)),
  ];
  return event;
}

function attachGovernance(
  timelockAddress: Address,
  governanceAddress: Address
): void {
  let timelock = GovernanceTimelock.load(timelockAddress.toHexString())!;
  timelock.governance = governanceAddress.toHexString();
  timelock.save();
}

describe("_handleRoleGranted", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
  });

  test("REBALANCE_MANAGER adds to auctionApprovers", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.REBALANCE_MANAGER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionApprovers",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
  });

  test("AUCTION_APPROVER adds to auctionApprovers (same bucket)", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_APPROVER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionApprovers",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
  });

  test("AUCTION_LAUNCHER adds to auctionLaunchers", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionLaunchers",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
  });

  test("BRAND_MANAGER adds to brandManagers", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.BRAND_MANAGER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "brandManagers",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
  });

  test("DEFAULT_ADMIN adds to admins", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.DEFAULT_ADMIN),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "admins",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
  });

  test("multiple grants accumulate", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_1
    );
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_2
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionLaunchers",
      "[" +
        ACCOUNT_1.toHexString() +
        ", " +
        ACCOUNT_2.toHexString() +
      "]"
    );
  });

  test("mainnet upgrade role events replace current governance links", () => {
    let dtf = createTestDTF(MAINNET_DTF);
    createTestGovernance(
      OLD_OWNER_GOVERNOR,
      OLD_OWNER_TIMELOCK,
      OLD_ST_TOKEN
    );
    createTestGovernance(
      OLD_TRADING_GOVERNOR,
      OLD_TRADING_TIMELOCK,
      OLD_ST_TOKEN
    );
    createTestGovernance(NEW_GOVERNOR, NEW_TIMELOCK, NEW_ST_TOKEN);
    attachGovernance(OLD_OWNER_TIMELOCK, OLD_OWNER_GOVERNOR);
    attachGovernance(OLD_TRADING_TIMELOCK, OLD_TRADING_GOVERNOR);
    attachGovernance(NEW_TIMELOCK, NEW_GOVERNOR);

    let newTimelock = GovernanceTimelock.load(NEW_TIMELOCK.toHexString())!;
    newTimelock.entity = MAINNET_DTF.toHexString();
    newTimelock.type = GovernanceType.TRADING;
    newTimelock.save();

    dtf.ownerGovernance = OLD_OWNER_GOVERNOR.toHexString();
    dtf.tradingGovernance = OLD_TRADING_GOVERNOR.toHexString();
    dtf.stToken = OLD_ST_TOKEN.toHexString();
    dtf.stTokenAddress = OLD_ST_TOKEN;
    dtf.admins = [OLD_OWNER_TIMELOCK.toHexString()];
    dtf.auctionApprovers = [OLD_TRADING_TIMELOCK.toHexString()];
    dtf.save();

    // Replays the DTF RoleGranted(bytes32,address,address) and
    // RoleRevoked(bytes32,address,address) logs from tx
    // 0x24756e6522ea75a3bc5664af026c9c9b592d3637bfee721e7495ba098eb44019.
    handleRoleGranted(
      createRoleGrantedEvent(
        Bytes.fromHexString(Role.DEFAULT_ADMIN),
        SPELL,
        OLD_OWNER_TIMELOCK,
        330
      )
    );
    handleRoleRevoked(
      createRoleRevokedEvent(
        Bytes.fromHexString(Role.REBALANCE_MANAGER),
        OLD_TRADING_TIMELOCK,
        SPELL,
        364
      )
    );
    handleRoleGranted(
      createRoleGrantedEvent(
        Bytes.fromHexString(Role.REBALANCE_MANAGER),
        NEW_TIMELOCK,
        SPELL,
        365
      )
    );
    handleRoleRevoked(
      createRoleRevokedEvent(
        Bytes.fromHexString(Role.DEFAULT_ADMIN),
        OLD_OWNER_TIMELOCK,
        SPELL,
        367
      )
    );
    handleRoleGranted(
      createRoleGrantedEvent(
        Bytes.fromHexString(Role.DEFAULT_ADMIN),
        NEW_TIMELOCK,
        SPELL,
        368
      )
    );
    handleRoleRevoked(
      createRoleRevokedEvent(
        Bytes.fromHexString(Role.DEFAULT_ADMIN),
        SPELL,
        SPELL,
        369
      )
    );

    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "ownerGovernance",
      NEW_GOVERNOR.toHexString()
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "tradingGovernance",
      NEW_GOVERNOR.toHexString()
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "stToken",
      NEW_ST_TOKEN.toHexString()
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "stTokenAddress",
      NEW_ST_TOKEN.toHexString()
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "admins",
      "[" + NEW_TIMELOCK.toHexString() + "]"
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "auctionApprovers",
      "[" + NEW_TIMELOCK.toHexString() + "]"
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "legacyAdmins",
      "[" +
        OLD_OWNER_GOVERNOR.toHexString() +
        ", " +
        SPELL.toHexString() +
        "]"
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "legacyAuctionApprovers",
      "[" + OLD_TRADING_GOVERNOR.toHexString() + "]"
    );
    // Raw history keeps the spell; the governance views keep only the former governors.
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "legacyAdminGovernances",
      "[" + OLD_OWNER_GOVERNOR.toHexString() + "]"
    );
    assert.fieldEquals(
      "DTF",
      MAINNET_DTF.toHexString(),
      "legacyTradingGovernances",
      "[" + OLD_TRADING_GOVERNOR.toHexString() + "]"
    );
  });
});

describe("_handleRoleRevoked", () => {
  beforeEach(() => {
    clearStore();
    createTestDTF(DTF_ADDR);
  });

  test("removes from auctionLaunchers", () => {
    // Grant first
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_1
    );
    // Then revoke
    _handleRoleRevoked(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionLaunchers",
      "[]"
    );
  });

  test("removes from brandManagers", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.BRAND_MANAGER),
      ACCOUNT_1
    );
    _handleRoleRevoked(
      DTF_ADDR,
      Bytes.fromHexString(Role.BRAND_MANAGER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "brandManagers",
      "[]"
    );
  });

  test("removes from admins and adds to legacyAdmins", () => {
    _handleRoleGranted(
      DTF_ADDR,
      Bytes.fromHexString(Role.DEFAULT_ADMIN),
      ACCOUNT_1
    );
    _handleRoleRevoked(
      DTF_ADDR,
      Bytes.fromHexString(Role.DEFAULT_ADMIN),
      ACCOUNT_1
    );

    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "admins", "[]");
    // legacyAdmins should have an entry (the account address since no timelock exists)
    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "legacyAdmins",
      "[" + ACCOUNT_1.toHexString() + "]"
    );
    // A plain account is history, not a former governance.
    assert.fieldEquals("DTF", DTF_ADDR.toHexString(), "legacyAdminGovernances", "[]");
  });

  test("revoke for non-existent member is safe", () => {
    // ACCOUNT_1 is not in any array, revoke should not crash
    _handleRoleRevoked(
      DTF_ADDR,
      Bytes.fromHexString(Role.AUCTION_LAUNCHER),
      ACCOUNT_1
    );

    assert.fieldEquals(
      "DTF",
      DTF_ADDR.toHexString(),
      "auctionLaunchers",
      "[]"
    );
  });
});
