import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, clearStore, createMockedFunction, describe, newMockEvent, test } from "matchstick-as/assembly/index";
import { DTF } from "../generated/schema";
import { Upgraded } from "../generated/templates/DTF/DTF";
import { _handleDTFDeployed } from "../src/deploy/handlers";
import { _handleAuctionLengthSet, _handleRoleGranted, _handleRoleRevoked } from "../src/dtf/handlers";
import { handleUpgraded } from "../src/dtf/mappings";
import { Role } from "../src/utils/constants";
import { mockERC20 } from "./helpers/mock-erc20";

// LCAP on Base (0x4dA9…), replayed from chain: deployed by the 4.0.0 FolioDeployer at block 33506544 and
// upgraded to 5.0.0 by proposal 88719…8040, executed in tx 0x6cf51c8e… at block 45297277.
const LCAP = Address.fromString("0x4dA9A0f397dB1397902070f93a4D6ddBC0E0E6e8");
const PROXY_ADMIN = Address.fromString("0xf6Db82f6b5F343d74A1D88af9e58fA1d2D89562e");
const DEPLOYER_TX_FROM = Address.fromString("0x5e6EF4cFd64e29981fB3a8703a584DDE407032d2");
const OWNER_TIMELOCK = Address.fromString("0x98E702320f055c1073F9CEE2B93f46c9715Bc32d");
const TRADING_TIMELOCK = Address.fromString("0xB785A1daC3724ea73A1368d6E0085B6A930e2CCD");
const SPELL_5_0_0 = Address.fromString("0x04B3eD311C68dfB0649D9faf695115F23DcbB540");
const IMPL_4_0_0 = Address.fromString("0x03D27E00e98d107a9d2523144C2AdEC7cf214DFb");
const IMPL_5_0_0 = Address.fromString("0x6368E66a38BAB5a03c4f1be64b9d890305959A10");
const LAUNCHER_A = Address.fromString("0x718841C68eab4038EF389C154f8e91f9923b2fdA");
const LAUNCHER_B = Address.fromString("0x7DaAf7Bc2eE8bf4C0ac7f37E6b6cfaEB3ed9a868");
const ST_TOKEN = Address.fromString("0x45A96cD0E4D89a41eebF3cC4204B00B1cf1582FA");
const PLATFORM = Address.fromString("0xcBCa96091f43C024730a020E57515A18b5dC633B");
const TRUSTED_FILLER_REGISTRY = Address.fromString("0x72DB5f49D0599C314E2f2FEDf6Fe33E1bA6C7A18");
const CREATION_BLOCK = 33506544;
const UPGRADE_BLOCK = 45297277;
const MANDATE =
  "The CF Large Cap Index (Diversified Weight) is a liquid, investible benchmark portfolio index designed to track the performance of large-cap digital assets. The index seeks to capture 95% of the total market capitalization of the investible digital asset universe as its constituents.";

describe("LCAP replay: 4.0.0 deployment and the 5.0.0 spell upgrade", () => {
  test("tracks the version across the real deployment and upgrade logs", () => {
    clearStore();
    mockERC20(LCAP, "LCAP", "CF Large Cap Index DTF", 18);
    createMockedFunction(OWNER_TIMELOCK, "getMinDelay", "getMinDelay():(uint256)").reverts();
    // The role handler probes a new admin for a timelock; the spell is a plain contract.
    createMockedFunction(SPELL_5_0_0, "getMinDelay", "getMinDelay():(uint256)").reverts();
    mockLiveState("4.0.0");

    _handleDTFDeployed(
      LCAP,
      PROXY_ADMIN,
      DEPLOYER_TX_FROM,
      OWNER_TIMELOCK,
      BigInt.fromI32(CREATION_BLOCK),
      BigInt.fromString("1753802435"),
    );
    // Replayed initialization events set the 4.0.0 settings; the constructor Upgraded log must not rehydrate.
    _handleAuctionLengthSet(LCAP, BigInt.fromI32(900));
    _handleRoleGranted(LCAP, Bytes.fromHexString(Role.DEFAULT_ADMIN), OWNER_TIMELOCK);
    handleUpgraded(upgraded(IMPL_4_0_0, CREATION_BLOCK, 1753802435, 380));

    assert.fieldEquals("DTF", LCAP.toHexString(), "version", "4.0.0");
    assert.fieldEquals("DTF", LCAP.toHexString(), "auctionLength", "900");
    assert.fieldEquals("DTF", LCAP.toHexString(), "admins", `[${OWNER_TIMELOCK.toHexString()}]`);

    // The spell's execution tx, log by log: grantRole(admin, spell), Upgraded, revokeRole(admin, spell).
    mockLiveState("5.0.0");
    _handleRoleGranted(LCAP, Bytes.fromHexString(Role.DEFAULT_ADMIN), SPELL_5_0_0);
    handleUpgraded(upgraded(IMPL_5_0_0, UPGRADE_BLOCK, 1777383901, 3));
    // getRoleMembers at the Upgraded log still lists the spell; the RoleRevoked log that follows removes it.
    assert.fieldEquals(
      "DTF",
      LCAP.toHexString(),
      "admins",
      `[${OWNER_TIMELOCK.toHexString()}, ${SPELL_5_0_0.toHexString()}]`,
    );
    _handleRoleRevoked(LCAP, Bytes.fromHexString(Role.DEFAULT_ADMIN), SPELL_5_0_0);

    assert.entityCount("DTF", 1);
    assert.fieldEquals("DTF", LCAP.toHexString(), "version", "5.0.0");
    assert.fieldEquals("DTF", LCAP.toHexString(), "admins", `[${OWNER_TIMELOCK.toHexString()}]`);
    assert.fieldEquals("DTF", LCAP.toHexString(), "auctionApprovers", `[${TRADING_TIMELOCK.toHexString()}]`);
    assert.fieldEquals(
      "DTF",
      LCAP.toHexString(),
      "auctionLaunchers",
      `[${LAUNCHER_A.toHexString()}, ${LAUNCHER_B.toHexString()}]`,
    );
    assert.fieldEquals("DTF", LCAP.toHexString(), "mintingFee", "3000000000000000");
    assert.fieldEquals("DTF", LCAP.toHexString(), "auctionLength", "900");
    assert.fieldEquals("DTF", LCAP.toHexString(), "mandate", MANDATE);
    assert.fieldEquals("DTF", LCAP.toHexString(), "bidsEnabled", "true");
    assert.fieldEquals("DTF", LCAP.toHexString(), "trustedFillerEnabled", "true");
    assert.fieldEquals("DTF", LCAP.toHexString(), "weightControl", "true");
    assert.fieldEquals("DTF", LCAP.toHexString(), "priceControl", "1");
    assert.fieldEquals(
      "DTF",
      LCAP.toHexString(),
      "feeRecipients",
      `${ST_TOKEN.toHexString()}:74626865671641900,${LAUNCHER_A.toHexString()}:746268656716417800,${PLATFORM.toHexString()}:179104477611940300`,
    );
    // Nothing 6.0-shaped leaks into a 5.0.0 folio.
    const dtf = DTF.load(LCAP.toHexString())!;
    assert.assertTrue(dtf.maxAuctionLength === null);
    assert.assertTrue(dtf.tradeAllowlistEnabled === null);
    assert.fieldEquals("DTF", LCAP.toHexString(), "tradeTokenAllowlist", "[]");
  });
});

function upgraded(implementation: Address, block: i32, timestamp: i32, logIndex: i32): Upgraded {
  const event = changetype<Upgraded>(newMockEvent());
  event.address = LCAP;
  event.block.number = BigInt.fromI32(block);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.logIndex = BigInt.fromI32(logIndex);
  event.parameters = [new ethereum.EventParam("implementation", ethereum.Value.fromAddress(implementation))];
  return event;
}

function mockLiveState(version: string): void {
  createMockedFunction(LCAP, "version", "version():(string)").returns([ethereum.Value.fromString(version)]);
  createMockedFunction(LCAP, "mintFee", "mintFee():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString("3000000000000000")),
  ]);
  createMockedFunction(LCAP, "auctionDelay", "auctionDelay():(uint256)").reverts();
  createMockedFunction(LCAP, "auctionLength", "auctionLength():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(900)),
  ]);
  createMockedFunction(LCAP, "mandate", "mandate():(string)").returns([ethereum.Value.fromString(MANDATE)]);
  createMockedFunction(LCAP, "bidsEnabled", "bidsEnabled():(bool)").returns([ethereum.Value.fromBoolean(true)]);
  createMockedFunction(LCAP, "trustedFillerRegistry", "trustedFillerRegistry():(address)").returns([
    ethereum.Value.fromAddress(TRUSTED_FILLER_REGISTRY),
  ]);
  createMockedFunction(LCAP, "trustedFillerEnabled", "trustedFillerEnabled():(bool)").returns([
    ethereum.Value.fromBoolean(true),
  ]);
  createMockedFunction(LCAP, "rebalanceControl", "rebalanceControl():(bool,uint8)").returns([
    ethereum.Value.fromBoolean(true),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
  ]);
  mockRecipient(0, ST_TOKEN, "74626865671641900");
  mockRecipient(1, LAUNCHER_A, "746268656716417800");
  mockRecipient(2, PLATFORM, "179104477611940300");
  createMockedFunction(LCAP, "feeRecipients", "feeRecipients(uint256):(address,uint96)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3))])
    .reverts();
  createMockedFunction(LCAP, "immutableFeeRecipients", "immutableFeeRecipients(uint256):(address,uint96)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .reverts();
  createMockedFunction(LCAP, "maxAuctionLength", "maxAuctionLength():(uint256)").reverts();
  createMockedFunction(LCAP, "folioFeeForSelf", "folioFeeForSelf():(uint256)").reverts();
  createMockedFunction(LCAP, "tradeAllowlistEnabled", "tradeAllowlistEnabled():(bool)").reverts();
  createMockedFunction(LCAP, "getTokenAllowlist", "getTokenAllowlist():(address[])").reverts();
  // Role members as the chain reports them at the Upgraded log of the spell tx (the spell holds admin).
  const admins: Address[] = version == "4.0.0" ? [OWNER_TIMELOCK] : [OWNER_TIMELOCK, SPELL_5_0_0];
  mockRole(Role.DEFAULT_ADMIN, admins);
  mockRole(Role.REBALANCE_MANAGER, [TRADING_TIMELOCK]);
  mockRole(Role.AUCTION_APPROVER, []);
  mockRole(Role.AUCTION_LAUNCHER, [LAUNCHER_A, LAUNCHER_B]);
  mockRole(Role.BRAND_MANAGER, [LAUNCHER_A, LAUNCHER_B]);
}

function mockRecipient(index: i32, recipient: Address, portion: string): void {
  createMockedFunction(LCAP, "feeRecipients", "feeRecipients(uint256):(address,uint96)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(index))])
    .returns([ethereum.Value.fromAddress(recipient), ethereum.Value.fromUnsignedBigInt(BigInt.fromString(portion))]);
}

function mockRole(role: string, members: Address[]): void {
  createMockedFunction(LCAP, "getRoleMembers", "getRoleMembers(bytes32):(address[])")
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(role))])
    .returns([ethereum.Value.fromAddressArray(members)]);
}
