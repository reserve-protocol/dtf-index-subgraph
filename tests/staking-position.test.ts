import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  assert,
  beforeEach,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import {
  Deposit,
  Transfer,
  Withdraw,
} from "../generated/templates/StakingToken/StakingVault";
import {
  handleDeposit,
  handleTransfer,
  handleWithdraw,
} from "../src/staking-token/mappings";
import { getOrCreateStakingToken } from "../src/utils/getters";
import { mockERC20 } from "./helpers/mock-erc20";
import {
  mockStakingVault,
  mockVaultExchangeRate,
} from "./helpers/mock-staking-vault";

// Full real history of the BSC vlRSR locker 0xb0bd…6e18 on vault 0xE744… —
// 11 deposits (1:1 at first, then at an appreciating rate), one 1 vlRSR transfer
// out, and the two withdrawals that created locks #0 and #1. Event data pulled
// from the chain on 2026-08-20; the expected numbers below come from an
// independent plain-BigInt reimplementation of the average-cost accounting, and
// the final share balance (0) matches vault.balanceOf(user) on chain.
const VAULT = Address.fromString("0xE744C8157c346B2931807F42552c8CBc0BB6D34f");
const MANAGER = Address.fromString(
  "0xaBa0c273944cacf225412079b599142f71E454b7"
);
const RSR = Address.fromString("0x23f72a3Db61D6CB8aBE5d9AF1Ac4B6c99327bFee");
const USER = "0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18";
const RECIPIENT = "0xf2ca2778665b1d712c1addee7f701ffbb1450b13";
const ONE = BigInt.fromI32(10).pow(18);

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

function baseEvent(
  block: i64,
  timestamp: i64,
  tx: string,
  logIndex: i32
): ethereum.Event {
  let event = newMockEvent();
  event.address = VAULT;
  event.block.number = BigInt.fromI64(block);
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.transaction.hash = Bytes.fromHexString(tx);
  event.logIndex = BigInt.fromI32(logIndex);
  return event;
}

function deposit(
  owner: string,
  assets: string,
  shares: string,
  block: i64,
  timestamp: i64,
  tx: string,
  logIndex: i32
): void {
  depositFrom(owner, owner, assets, shares, block, timestamp, tx, logIndex);
}

function depositFrom(
  sender: string,
  owner: string,
  assets: string,
  shares: string,
  block: i64,
  timestamp: i64,
  tx: string,
  logIndex: i32
): void {
  let event = changetype<Deposit>(baseEvent(block, timestamp, tx, logIndex));
  event.parameters = [
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(sender))
    ),
    new ethereum.EventParam(
      "owner",
      ethereum.Value.fromAddress(Address.fromString(owner))
    ),
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(assets))
    ),
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(shares))
    ),
  ];
  handleDeposit(event);
}

function withdraw(
  owner: string,
  assets: string,
  shares: string,
  block: i64,
  timestamp: i64,
  tx: string,
  logIndex: i32
): void {
  let event = changetype<Withdraw>(baseEvent(block, timestamp, tx, logIndex));
  event.parameters = [
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(owner))
    ),
    new ethereum.EventParam(
      "receiver",
      ethereum.Value.fromAddress(Address.fromString(owner))
    ),
    new ethereum.EventParam(
      "owner",
      ethereum.Value.fromAddress(Address.fromString(owner))
    ),
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(assets))
    ),
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(shares))
    ),
  ];
  handleWithdraw(event);
}

function transfer(
  from: string,
  to: string,
  shares: string,
  block: i64,
  timestamp: i64,
  tx: string,
  logIndex: i32
): void {
  let event = changetype<Transfer>(baseEvent(block, timestamp, tx, logIndex));
  event.parameters = [
    new ethereum.EventParam(
      "from",
      ethereum.Value.fromAddress(Address.fromString(from))
    ),
    new ethereum.EventParam(
      "to",
      ethereum.Value.fromAddress(Address.fromString(to))
    ),
    new ethereum.EventParam(
      "value",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(shares))
    ),
  ];
  handleTransfer(event);
}

function replayRealHistory(): void {
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "500499000000030000000000", "496893869686149267007322", 112726978, 1785287143, "0x05b11f1de211d508d3b6158b5a3771bad01ab30aa8d1ec524769421d8d8f5db6", 267);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "5494500000000000000000", "5454377412315041002120", 112730767, 1785288848, "0x4272bdd1a2520cf1de022188e19e9ef66377b23aa52ed24a1d26ccd92834d4c1", 447);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "354645000000000000000000", "349134207082752907787655", 113086098, 1785448818, "0xd4c0f8f473aae46c6bc1cdae8dd225ecbbdb1ab6f8d1d33d6cc5b5397fca044e", 199);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "19215800934840000000000", "18892675949336462046856", 113148801, 1785477039, "0x969993e67a69e5fb9ef37b8f9346e8d20d192e4d7e744ea7fb3296273524bae7", 307);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "559440000000000000000000", "550023269896795931945269", 113149645, 1785477418, "0x88f4fe0634cfc70a5de60e5d5352b56e08a60e333e745ed51cbed0a513fa3600", 463);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "4995000000000000000000000", "4900481643686379633809802", 113261286, 1785527665, "0xea6ea66ff54f1d8a6e0e87ce758d2f57562e9a1319a4dca7e6fbd228ca3aca8b", 14);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "3896100000000000000000000", "3820010255747115017414774", 113296299, 1785543440, "0x03690185305c0868df0d5a0a521c0c6e72609f1a10289906d779d76ea58d891f", 139);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "1498500000000000000000000", "1466736103675208831694749", 113397488, 1785588987, "0x5a9903694b960140c141df18ce4ff493d5253f5ffcb112b965f0f29a34581845", 213);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "8991000000000000000000000", "8780504853361816287891167", 113545971, 1785655814, "0x50b42bd571c4f46f5ac1360964c630c9da9a948da553fb21c7e4c32e993cfc4c", 726);
  transfer("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "0xf2ca2778665b1d712c1addee7f701ffbb1450b13", "1000000000000000000", 113637056, 1785696811, "0xd52bfb8e6ec4635cf93b0384b88295b937ac8846877860e7ea0b599fdb01367a", 387);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "283029921149810000000000", "272584815404528942256354", 115081425, 1786347173, "0x02b7abc4e178be1a3b0eba4a43c85e68f81b1b1ba386a7fbd758b2099d6388a2", 99);
  deposit("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "983224368378210000000000", "942958672695918989222418", 115987137, 1786754897, "0xa9f1c2bd8f38378785b3cadfc2d3075e6fdd0fcc8e4c6a7a49df7ebf62c2f961", 314);
  withdraw("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "21533590345237342162257083", "20600000000000000000000000", 116930184, 1787179380, "0x8784e062db27a144747d933631141cb9a577710858bf7d22826ffecc8d7c7a03", 256);
  withdraw("0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18", "1049167420102310523582207", "1003673744598317312078486", 116931302, 1787179884, "0xd2478f2fcb33ab741ea099f83141c9d0a55b818ab204a966ac0dc0ce9b7fda39", 808);
}

function positionId(account: string): string {
  return account + "-" + VAULT.toHexString();
}

describe("StakingPosition — real BSC vlRSR history", () => {
  beforeEach(() => {
    clearStore();
    getOrCreateStakingToken(VAULT);
  });

  test("replaying the locker's full history reproduces the independently computed position", () => {
    replayRealHistory();

    const id = positionId(USER);
    // Everything was withdrawn: matches vault.balanceOf(user) == 0 on chain
    assert.fieldEquals("StakingPosition", id, "shares", "0");
    assert.fieldEquals("StakingPosition", id, "principal", "0");
    assert.fieldEquals("StakingPosition", id, "totalDeposited", "22086148590462890000000000");
    assert.fieldEquals("StakingPosition", id, "totalWithdrawn", "22582757765339652685839290");
    assert.fieldEquals("StakingPosition", id, "realizedRewards", "496610196053938710708861");
    assert.fieldEquals("StakingPosition", id, "depositCount", "11");
    assert.fieldEquals("StakingPosition", id, "withdrawCount", "2");
    assert.fieldEquals("StakingPosition", id, "account", USER);
    assert.fieldEquals("StakingPosition", id, "token", VAULT.toHexString());

    assert.fieldEquals("StakingPosition", id, "accountingComplete", "true");
    assert.fieldEquals("StakingPosition", id, "untrackedShares", "0");

    // The 1 vlRSR transfer carried its pro-rata principal to the recipient
    const recipient = positionId(RECIPIENT);
    assert.fieldEquals("StakingPosition", recipient, "shares", "1000000000000000000");
    assert.fieldEquals("StakingPosition", recipient, "principal", "1021177176024869571");
    assert.fieldEquals("StakingPosition", recipient, "totalDeposited", "0");

    // 11 deposits + 2 withdrawals + 1 transfer (out + in) = 15 records
    assert.entityCount("StakingPositionRecord", 15);
    const lastWithdraw = "0xb0bd0435cd29ac6762d7a633267b6d9bdfe36e18-0xe744c8157c346b2931807f42552c8cbc0bb6d34f-0xd2478f2fcb33ab741ea099f83141c9d0a55b818ab204a966ac0dc0ce9b7fda39-808";
    assert.fieldEquals("StakingPositionRecord", lastWithdraw, "type", "WITHDRAW");
    assert.fieldEquals(
      "StakingPositionRecord",
      lastWithdraw,
      "principalDelta",
      "-1026088742899971917866517"
    );
    assert.fieldEquals(
      "StakingPositionRecord",
      lastWithdraw,
      "realizedRewards",
      "23078677202338605715690"
    );
    assert.fieldEquals(
      "StakingPositionRecord",
      lastWithdraw,
      "exchangeRate",
      "1045327155112740689"
    );

    // Daily snapshots: the last withdrawal day carries the final state, the recipient has its transfer day
    const lastDay = (1787179884 / 86400).toString();
    assert.fieldEquals("StakingPositionDailySnapshot", id + "-" + lastDay, "shares", "0");
    assert.fieldEquals("StakingPositionDailySnapshot", id + "-" + lastDay, "realizedRewards", "496610196053938710708861");
    const transferDay = (1785696811 / 86400).toString();
    assert.fieldEquals("StakingPositionDailySnapshot", recipient + "-" + transferDay, "shares", "1000000000000000000");
  });

  test("first deposit was 1:1, later deposits record the appreciated rate", () => {
    replayRealHistory();
    assert.fieldEquals(
      "StakingPositionRecord",
      positionId(USER) + "-0x05b11f1de211d508d3b6158b5a3771bad01ab30aa8d1ec524769421d8d8f5db6-267",
      "exchangeRate",
      "1007255332645093457"
    );
    assert.fieldEquals(
      "StakingPositionRecord",
      positionId(USER) + "-0xa9f1c2bd8f38378785b3cadfc2d3075e6fdd0fcc8e4c6a7a49df7ebf62c2f961-314",
      "exchangeRate",
      "1042701442648776303"
    );
  });
});

describe("StakingPosition — accounting rules", () => {
  beforeEach(() => {
    clearStore();
    getOrCreateStakingToken(VAULT);
  });

  const ALICE = "0xa11ce00000000000000000000000000000000001";
  const BOB = "0xb0b0000000000000000000000000000000000002";
  const TX = "0x1111111111111111111111111111111111111111111111111111111111111111";

  test("lock 100 RSR for 96 vlRSR; at rate 1.25 unrealized is 20 RSR; withdrawing half realizes 10 and leaves 10 unrealized", () => {
    const hundred = BigInt.fromI32(100).times(ONE);
    const shares96 = BigInt.fromI32(96).times(ONE);
    deposit(ALICE, hundred.toString(), shares96.toString(), 100, 1787000000, TX, 1);

    const id = positionId(ALICE);
    assert.fieldEquals("StakingPosition", id, "shares", shares96.toString());
    assert.fieldEquals("StakingPosition", id, "principal", hundred.toString());

    // Vault appreciated: 1 share = 1.25 RSR → 96 shares = 120 RSR → +20 RSR (20%)
    const rate = BigInt.fromString("1250000000000000000");

    // Unlock 48 shares → 60 RSR out, releases 50 RSR principal, realizes 10
    const shares48 = BigInt.fromI32(48).times(ONE);
    const sixty = BigInt.fromI32(60).times(ONE);
    withdraw(ALICE, sixty.toString(), shares48.toString(), 200, 1787100000, TX, 2);

    assert.fieldEquals("StakingPosition", id, "shares", shares48.toString());
    assert.fieldEquals(
      "StakingPosition",
      id,
      "principal",
      BigInt.fromI32(50).times(ONE).toString()
    );
    assert.fieldEquals(
      "StakingPosition",
      id,
      "realizedRewards",
      BigInt.fromI32(10).times(ONE).toString()
    );
    assert.fieldEquals("StakingPosition", id, "totalWithdrawn", sixty.toString());
    assert.fieldEquals("StakingPosition", id, "depositCount", "1");
    assert.fieldEquals("StakingPosition", id, "withdrawCount", "1");

    // Remaining 48 shares at 1.25 = 60 RSR vs 50 principal → 10 unrealized; 10 + 10 = the original 20
    assert.fieldEquals("StakingPosition", id, "accountingComplete", "true");

    const record = id + "-" + TX + "-2";
    assert.fieldEquals("StakingPositionRecord", record, "type", "WITHDRAW");
    assert.fieldEquals(
      "StakingPositionRecord",
      record,
      "principalDelta",
      "-" + BigInt.fromI32(50).times(ONE).toString()
    );
    assert.fieldEquals(
      "StakingPositionRecord",
      record,
      "realizedRewards",
      BigInt.fromI32(10).times(ONE).toString()
    );
    assert.fieldEquals("StakingPositionRecord", record, "exchangeRate", rate.toString());
  });

  test("a wallet transfer moves principal pro rata and leaves rewards with the shares", () => {
    deposit(ALICE, BigInt.fromI32(100).times(ONE).toString(), BigInt.fromI32(96).times(ONE).toString(), 100, 1787000000, TX, 1);
    transfer(ALICE, BOB, BigInt.fromI32(24).times(ONE).toString(), 150, 1787050000, TX, 2);

    assert.fieldEquals("StakingPosition", positionId(ALICE), "shares", BigInt.fromI32(72).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(ALICE), "principal", BigInt.fromI32(75).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(BOB), "shares", BigInt.fromI32(24).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(BOB), "principal", BigInt.fromI32(25).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(BOB), "totalDeposited", "0");
    assert.fieldEquals("StakingPositionRecord", positionId(ALICE) + "-" + TX + "-2", "type", "TRANSFER_OUT");
    assert.fieldEquals("StakingPositionRecord", positionId(BOB) + "-" + TX + "-2", "type", "TRANSFER_IN");
    assert.fieldEquals("StakingPositionRecord", positionId(BOB) + "-" + TX + "-2", "assets", BigInt.fromI32(25).times(ONE).toString());
  });

  test("a cancelled lock re-enters as a fresh deposit at the current rate", () => {
    deposit(ALICE, BigInt.fromI32(100).times(ONE).toString(), BigInt.fromI32(100).times(ONE).toString(), 100, 1787000000, TX, 1);
    // withdraw everything at 1.2 → 120 RSR out, 20 realized
    withdraw(ALICE, BigInt.fromI32(120).times(ONE).toString(), BigInt.fromI32(100).times(ONE).toString(), 200, 1787100000, TX, 2);
    assert.fieldEquals("StakingPosition", positionId(ALICE), "shares", "0");
    assert.fieldEquals("StakingPosition", positionId(ALICE), "principal", "0");
    assert.fieldEquals("StakingPosition", positionId(ALICE), "realizedRewards", BigInt.fromI32(20).times(ONE).toString());

    // cancelLock: the manager deposits the 120 RSR back for the user (Deposit with sender = manager)
    depositFrom(MANAGER.toHexString(), ALICE, BigInt.fromI32(120).times(ONE).toString(), BigInt.fromI32(100).times(ONE).toString(), 300, 1787200000, TX, 3);
    assert.fieldEquals("StakingPosition", positionId(ALICE), "shares", BigInt.fromI32(100).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(ALICE), "principal", BigInt.fromI32(120).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(ALICE), "realizedRewards", BigInt.fromI32(20).times(ONE).toString());
    // Not new capital: lifetime deposit stays 100 so the return is still 20 / 100
    assert.fieldEquals("StakingPosition", positionId(ALICE), "totalDeposited", BigInt.fromI32(100).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(ALICE), "depositCount", "1");
    assert.fieldEquals("StakingPositionRecord", positionId(ALICE) + "-" + TX + "-3", "type", "LOCK_CANCEL");
  });

  test("shares minted before discovery earn no rewards and flag the position incomplete", () => {
    // Only 10 shares / 10 RSR seen by the subgraph, but the account burns 40 shares for 50 RSR
    deposit(ALICE, BigInt.fromI32(10).times(ONE).toString(), BigInt.fromI32(10).times(ONE).toString(), 100, 1787000000, TX, 1);
    withdraw(ALICE, BigInt.fromI32(50).times(ONE).toString(), BigInt.fromI32(40).times(ONE).toString(), 200, 1787100000, TX, 2);

    const id = positionId(ALICE);
    assert.fieldEquals("StakingPosition", id, "shares", "0");
    assert.fieldEquals("StakingPosition", id, "principal", "0");
    assert.fieldEquals("StakingPosition", id, "totalWithdrawn", BigInt.fromI32(50).times(ONE).toString());
    // 10 tracked shares got 50 * 10 / 40 = 12.5 RSR against 10 RSR principal → 2.5 realized; the other 30 shares are unknown
    assert.fieldEquals("StakingPosition", id, "realizedRewards", "2500000000000000000");
    assert.fieldEquals("StakingPosition", id, "accountingComplete", "false");
    assert.fieldEquals("StakingPosition", id, "untrackedShares", BigInt.fromI32(30).times(ONE).toString());
    assert.fieldEquals("StakingPositionDailySnapshot", id + "-" + (1787100000 / 86400).toString(), "accountingComplete", "false");
  });

  test("a transfer of untracked shares flags both sides incomplete", () => {
    transfer(ALICE, BOB, BigInt.fromI32(5).times(ONE).toString(), 100, 1787000000, TX, 1);

    assert.fieldEquals("StakingPosition", positionId(ALICE), "shares", "0");
    assert.fieldEquals("StakingPosition", positionId(ALICE), "accountingComplete", "false");
    assert.fieldEquals("StakingPosition", positionId(ALICE), "untrackedShares", BigInt.fromI32(5).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(BOB), "shares", BigInt.fromI32(5).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(BOB), "principal", "0");
    assert.fieldEquals("StakingPosition", positionId(BOB), "accountingComplete", "false");
  });

  test("zero-value transfers are ignored", () => {
    transfer(ALICE, BOB, "0", 100, 1787000000, TX, 1);
    assert.entityCount("StakingPosition", 0);
    assert.entityCount("StakingPositionRecord", 0);
  });

  test("a self-transfer leaves the position untouched", () => {
    deposit(ALICE, BigInt.fromI32(100).times(ONE).toString(), BigInt.fromI32(96).times(ONE).toString(), 100, 1787000000, TX, 1);
    transfer(ALICE, ALICE, BigInt.fromI32(10).times(ONE).toString(), 150, 1787050000, TX, 2);

    assert.fieldEquals("StakingPosition", positionId(ALICE), "shares", BigInt.fromI32(96).times(ONE).toString());
    assert.fieldEquals("StakingPosition", positionId(ALICE), "principal", BigInt.fromI32(100).times(ONE).toString());
    assert.entityCount("StakingPositionRecord", 1);
  });
});
