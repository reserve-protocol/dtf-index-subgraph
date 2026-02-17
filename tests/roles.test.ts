import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  createMockedFunction,
  describe,
  test,
  assert,
  beforeEach,
} from "matchstick-as/assembly/index";
import { _handleRoleGranted, _handleRoleRevoked } from "../src/dtf/handlers";
import { Role } from "../src/utils/constants";
import { createTestDTF } from "./helpers/mock-entities";

const DTF_ADDR = Address.fromString(
  "0xD577936364733a0f03ef92adf572EB4265Ccc4cc"
);
const ACCOUNT_1 = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);
const ACCOUNT_2 = Address.fromString(
  "0x2222222222222222222222222222222222222222"
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
