import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  clearStore,
  describe,
  test,
  assert,
  beforeEach,
  newMockEvent,
} from "matchstick-as/assembly/index";
import { _handleTransfer } from "../src/token/mappings";
import { AccountBalance } from "../generated/schema";
import { mockERC20 } from "./helpers/mock-erc20";
import { MAG7_TRANSFERS, MAG7_EXPECTED_HOLDERS } from "./helpers/mag7-transfers";

// Regression for currentHolderCount going negative (-12) on MAG7 / Base.
// Replays the real on-chain Transfer log of the token. Fixture regenerated with:
//   getLogs({ address: MAG7, event: Transfer, fromBlock: 49541707 }) via viem,
//   sorted by (block, logIndex); expected holders = addresses with balance > 0.

const MAG7 = Address.fromString("0xcef8db49e456f872e288e1c042f916e9ced7c781");
mockERC20(MAG7, "MAG7", "Reserve Magnificent 7 DTF (Base)", 18);

describe("MAG7 real transfer log replay", () => {
  beforeEach(() => {
    clearStore();
  });

  test("currentHolderCount matches on-chain holders with balance > 0", () => {
    for (let i = 0; i < MAG7_TRANSFERS.length; i++) {
      let row = MAG7_TRANSFERS[i];
      let event = newMockEvent();
      event.address = MAG7;
      event.block.number = BigInt.fromString(row[3]);
      event.block.timestamp = BigInt.fromString(row[3]).times(BigInt.fromI32(2));
      event.logIndex = BigInt.fromString(row[4]);
      _handleTransfer(
        Address.fromString(row[0]),
        Address.fromString(row[1]),
        BigInt.fromString(row[2]),
        event
      );
    }

    assert.fieldEquals(
      "Token",
      MAG7.toHexString(),
      "currentHolderCount",
      MAG7_EXPECTED_HOLDERS.toString()
    );

    // Cross-check the counter against the balances the subgraph itself tracked.
    let holdersWithBalance = 0;
    let seen = new Map<string, boolean>();
    for (let i = 0; i < MAG7_TRANSFERS.length; i++) {
      let to = MAG7_TRANSFERS[i][1];
      if (seen.has(to)) continue;
      seen.set(to, true);
      let balance = AccountBalance.load(to + "-" + MAG7.toHexString());
      if (balance != null && balance.amount.gt(BigInt.zero())) {
        holdersWithBalance++;
      }
    }
    assert.i32Equals(holdersWithBalance, MAG7_EXPECTED_HOLDERS);
  });
});
