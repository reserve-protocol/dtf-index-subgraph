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
import { DTF } from "../generated/schema";
import {
  FeeRecipientsSetRecipientsStruct,
  ImmutableFeeRecipientsSet,
  ImmutableFeeRecipientsSetRecipientsStruct,
  Upgraded,
} from "../generated/templates/DTF/DTF";
import { _handleDTFDeployed } from "../src/deploy/handlers";
import {
  _handleAuctionLengthSet,
  _handleFeeRecipientsSet,
  _handleFolioFeeSet,
  _handleImmutableFeeRecipientsSet,
  _handleMaxAuctionLengthSet,
  _handleMintFeeSet,
  _handleRoleGranted,
  _handleTradeAllowlistEnabled,
  _handleTradeAllowlistTokenAdded,
  _handleTradeAllowlistTokenRemoved,
  _handleTvlFeeSet,
} from "../src/dtf/handlers";
import { handleImmutableFeeRecipientsSet, handleUpgraded } from "../src/dtf/mappings";
import { _handleTransfer } from "../src/token/mappings";
import { GENESIS_ADDRESS, Role } from "../src/utils/constants";
import { createTestDTF } from "./helpers/mock-entities";
import { mockERC20 } from "./helpers/mock-erc20";

const FOLIO = Address.fromString("0x1000000000000000000000000000000000000001");
const PROXY_ADMIN = Address.fromString("0x2000000000000000000000000000000000000002");
const CREATOR = Address.fromString("0x3000000000000000000000000000000000000003");
const OWNER = Address.fromString("0x4000000000000000000000000000000000000004");
const RECIPIENT = Address.fromString("0x5000000000000000000000000000000000000005");
const IMMUTABLE_RECIPIENT = Address.fromString("0x6000000000000000000000000000000000000006");
const ALLOWED_TOKEN = Address.fromString("0x7000000000000000000000000000000000000007");

describe("Folio deployment replay and v6 state", () => {
  beforeEach(() => {
    clearStore();
  });

  test("replays creation-block mint, roles, and settings exactly once", () => {
    mockCommonState("5.0.0", true);

    _handleDTFDeployed(
      FOLIO,
      PROXY_ADMIN,
      CREATOR,
      OWNER,
      BigInt.fromI32(100),
      BigInt.fromI32(1000),
    );

    // FolioDeployed creates the entity/template first. Graph Node then replays
    // the Folio's earlier logs from the creation block through that template.
    const proxyCreationEvent = changetype<Upgraded>(newMockEvent());
    proxyCreationEvent.address = FOLIO;
    proxyCreationEvent.block.number = BigInt.fromI32(100);
    handleUpgraded(proxyCreationEvent);

    const mintEvent = newMockEvent();
    mintEvent.address = FOLIO;
    mintEvent.block.number = BigInt.fromI32(100);
    mintEvent.block.timestamp = BigInt.fromI32(1000);
    _handleTransfer(
      Address.fromString(GENESIS_ADDRESS),
      CREATOR,
      BigInt.fromI32(1000000),
      mintEvent,
    );

    createMockedFunction(OWNER, "getMinDelay", "getMinDelay():(uint256)").reverts();
    _handleRoleGranted(
      FOLIO,
      Bytes.fromHexString(Role.DEFAULT_ADMIN),
      OWNER,
    );
    _handleMintFeeSet(FOLIO, BigInt.fromI32(100));
    _handleTvlFeeSet(FOLIO, BigInt.fromI32(200), BigInt.fromI32(300));
    _handleAuctionLengthSet(FOLIO, BigInt.fromI32(900));
    const recipient = new FeeRecipientsSetRecipientsStruct();
    recipient.push(ethereum.Value.fromAddress(RECIPIENT));
    recipient.push(
      ethereum.Value.fromUnsignedBigInt(
        BigInt.fromString("1000000000000000000"),
      ),
    );
    _handleFeeRecipientsSet(FOLIO, [recipient]);

    assert.fieldEquals("DTF", FOLIO.toHexString(), "version", "5.0.0");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "ownerAddress", OWNER.toHexString());
    assert.fieldEquals("DTF", FOLIO.toHexString(), "mintingFee", "100");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tvlFee", "200");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "auctionLength", "900");
    assert.fieldEquals(
      "DTF",
      FOLIO.toHexString(),
      "feeRecipients",
      `${RECIPIENT.toHexString()}:1000000000000000000`,
    );
    assert.fieldEquals("Token", FOLIO.toHexString(), "totalSupply", "1000000");
    assert.fieldEquals("Token", FOLIO.toHexString(), "totalMinted", "1000000");
    assert.fieldEquals("Token", FOLIO.toHexString(), "mintCount", "1");
    assert.fieldEquals("Token", FOLIO.toHexString(), "currentHolderCount", "1");
    assert.fieldEquals(
      "AccountBalance",
      `${CREATOR.toHexString()}-${FOLIO.toHexString()}`,
      "amount",
      "1000000",
    );
    assert.fieldEquals(
      "DTF",
      FOLIO.toHexString(),
      "admins",
      `[${OWNER.toHexString()}]`,
    );
  });

  test("hydrates a fresh 6.0 folio's allowlist state at deployment", () => {
    mockCommonState("6.0.0", false);
    mockBool("tradeAllowlistEnabled", "tradeAllowlistEnabled():(bool)", false);
    createMockedFunction(FOLIO, "getTokenAllowlist", "getTokenAllowlist():(address[])").returns([
      ethereum.Value.fromAddressArray([]),
    ]);
    mockERC20(FOLIO, "Folio", "FOLIO", 18);

    _handleDTFDeployed(FOLIO, PROXY_ADMIN, CREATOR, OWNER, BigInt.fromI32(100), BigInt.fromI32(1000));

    assert.fieldEquals("DTF", FOLIO.toHexString(), "version", "6.0.0");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeAllowlistEnabled", "false");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeTokenAllowlist", "[]");
  });

  test("decodes a real ImmutableFeeRecipientsSet log through the mapping", () => {
    createTestDTF(FOLIO).save();
    const tuple = new ethereum.Tuple();
    tuple.push(ethereum.Value.fromAddress(IMMUTABLE_RECIPIENT));
    tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(77)));
    const event = changetype<ImmutableFeeRecipientsSet>(newMockEvent());
    event.address = FOLIO;
    event.parameters = [new ethereum.EventParam("recipients", ethereum.Value.fromTupleArray([tuple]))];
    handleImmutableFeeRecipientsSet(event);

    assert.fieldEquals(
      "DTF",
      FOLIO.toHexString(),
      "immutableFeeRecipients",
      `${IMMUTABLE_RECIPIENT.toHexString()}:77`,
    );
  });

  test("updates v6 settings and keeps allowlist mutations idempotent", () => {
    const dtf = createTestDTF(FOLIO);
    dtf.version = "6.0.0";
    dtf.tradeTokenAllowlist = [];
    dtf.save();

    _handleMaxAuctionLengthSet(FOLIO, BigInt.fromI32(1500));
    _handleFolioFeeSet(FOLIO, BigInt.fromI32(123));
    _handleTradeAllowlistEnabled(FOLIO, true);
    _handleTradeAllowlistTokenAdded(FOLIO, ALLOWED_TOKEN);
    _handleTradeAllowlistTokenAdded(FOLIO, ALLOWED_TOKEN);

    const tuple = new ImmutableFeeRecipientsSetRecipientsStruct();
    tuple.push(ethereum.Value.fromAddress(IMMUTABLE_RECIPIENT));
    tuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(77)));
    _handleImmutableFeeRecipientsSet(FOLIO, [tuple]);

    assert.fieldEquals("DTF", FOLIO.toHexString(), "maxAuctionLength", "1500");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "auctionLength", "1500");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "folioFeeForSelf", "123");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeAllowlistEnabled", "true");
    assert.fieldEquals(
      "DTF",
      FOLIO.toHexString(),
      "tradeTokenAllowlist",
      `[${ALLOWED_TOKEN.toHexString()}]`,
    );
    assert.fieldEquals(
      "DTF",
      FOLIO.toHexString(),
      "immutableFeeRecipients",
      `${IMMUTABLE_RECIPIENT.toHexString()}:77`,
    );

    _handleTradeAllowlistTokenRemoved(FOLIO, ALLOWED_TOKEN);
    _handleTradeAllowlistTokenRemoved(FOLIO, ALLOWED_TOKEN);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeTokenAllowlist", "[]");
  });

  test("rehydrates the same DTF entity after a v5 to v6 proxy upgrade", () => {
    const dtf = createTestDTF(FOLIO);
    dtf.version = "5.0.0";
    dtf.save();
    mockCommonState("6.0.0", false);
    mockV6State();

    const event = changetype<Upgraded>(newMockEvent());
    event.address = FOLIO;
    event.block.number = BigInt.fromI32(101);
    handleUpgraded(event);

    assert.entityCount("DTF", 1);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "version", "6.0.0");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "maxAuctionLength", "1200");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "tradeAllowlistEnabled", "true");
  });

  test("skips the constructor Upgraded log but rehydrates a same-block upgrade that changes the version", () => {
    const dtf = createTestDTF(FOLIO);
    dtf.version = "5.0.0";
    dtf.blockNumber = BigInt.fromI32(100);
    dtf.save();

    mockCommonState("5.0.0", true);
    const constructorLog = changetype<Upgraded>(newMockEvent());
    constructorLog.address = FOLIO;
    constructorLog.block.number = BigInt.fromI32(100);
    handleUpgraded(constructorLog);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "version", "5.0.0");
    const untouched = DTF.load(FOLIO.toHexString());
    assert.assertTrue(untouched !== null && untouched.maxAuctionLength === null);

    mockCommonState("6.0.0", false);
    mockV6State();
    const sameBlockUpgrade = changetype<Upgraded>(newMockEvent());
    sameBlockUpgrade.address = FOLIO;
    sameBlockUpgrade.block.number = BigInt.fromI32(100);
    handleUpgraded(sameBlockUpgrade);
    assert.fieldEquals("DTF", FOLIO.toHexString(), "version", "6.0.0");
    assert.fieldEquals("DTF", FOLIO.toHexString(), "maxAuctionLength", "1200");
  });

});

function mockCommonState(version: string, hasLegacyAuctionFields: bool): void {
  if (hasLegacyAuctionFields) {
    createMockedFunction(FOLIO, "tradeAllowlistEnabled", "tradeAllowlistEnabled():(bool)").reverts();
    createMockedFunction(FOLIO, "getTokenAllowlist", "getTokenAllowlist():(address[])").reverts();
  }
  mockERC20(FOLIO, "DTF", "Test DTF", 18);
  mockString("version", "version():(string)", version);
  mockUint("mintFee", "mintFee():(uint256)", 100);
  mockUint("tvlFee", "tvlFee():(uint256)", 200);
  mockString("mandate", "mandate():(string)", "test mandate");
  mockBool("bidsEnabled", "bidsEnabled():(bool)", true);
  mockAddress(
    "trustedFillerRegistry",
    "trustedFillerRegistry():(address)",
    Address.fromString("0x8000000000000000000000000000000000000008"),
  );
  mockBool("trustedFillerEnabled", "trustedFillerEnabled():(bool)", true);
  createMockedFunction(FOLIO, "rebalanceControl", "rebalanceControl():(bool,uint8)").returns([
    ethereum.Value.fromBoolean(true),
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)),
  ]);

  if (hasLegacyAuctionFields) {
    mockUint("auctionDelay", "auctionDelay():(uint256)", 60);
    mockUint("auctionLength", "auctionLength():(uint256)", 900);
  } else {
    createMockedFunction(FOLIO, "auctionDelay", "auctionDelay():(uint256)").reverts();
    createMockedFunction(FOLIO, "auctionLength", "auctionLength():(uint256)").reverts();
  }

  createMockedFunction(FOLIO, "feeRecipients", "feeRecipients(uint256):(address,uint96)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([
      ethereum.Value.fromAddress(RECIPIENT),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1000000000000000000")),
    ]);
  createMockedFunction(FOLIO, "feeRecipients", "feeRecipients(uint256):(address,uint96)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
    .reverts();

  mockRole(Role.REBALANCE_MANAGER, [OWNER]);
  mockRole(Role.AUCTION_APPROVER, []);
  mockRole(Role.AUCTION_LAUNCHER, [CREATOR]);
  mockRole(Role.BRAND_MANAGER, []);
  mockRole(Role.DEFAULT_ADMIN, [OWNER]);
}

function mockV6State(): void {
  mockUint("maxAuctionLength", "maxAuctionLength():(uint256)", 1200);
  createMockedFunction(FOLIO, "folioFeeForSelf", "folioFeeForSelf():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString("250000000000000000")),
  ]);
  mockBool("tradeAllowlistEnabled", "tradeAllowlistEnabled():(bool)", true);
  createMockedFunction(FOLIO, "getTokenAllowlist", "getTokenAllowlist():(address[])").returns([
    ethereum.Value.fromAddressArray([ALLOWED_TOKEN]),
  ]);
  createMockedFunction(
    FOLIO,
    "immutableFeeRecipients",
    "immutableFeeRecipients(uint256):(address,uint96)",
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))])
    .returns([
      ethereum.Value.fromAddress(IMMUTABLE_RECIPIENT),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString("500000000000000000")),
    ]);
  createMockedFunction(
    FOLIO,
    "immutableFeeRecipients",
    "immutableFeeRecipients(uint256):(address,uint96)",
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
    .reverts();
}

function mockRole(role: string, members: Address[]): void {
  createMockedFunction(FOLIO, "getRoleMembers", "getRoleMembers(bytes32):(address[])")
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(role))])
    .returns([ethereum.Value.fromAddressArray(members)]);
}

function mockUint(name: string, signature: string, value: i32): void {
  createMockedFunction(FOLIO, name, signature).returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value)),
  ]);
}

function mockString(name: string, signature: string, value: string): void {
  createMockedFunction(FOLIO, name, signature).returns([
    ethereum.Value.fromString(value),
  ]);
}

function mockBool(name: string, signature: string, value: bool): void {
  createMockedFunction(FOLIO, name, signature).returns([
    ethereum.Value.fromBoolean(value),
  ]);
}

function mockAddress(name: string, signature: string, value: Address): void {
  createMockedFunction(FOLIO, name, signature).returns([
    ethereum.Value.fromAddress(value),
  ]);
}
