import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
  assert,
} from "matchstick-as/assembly/index";
import { AuctionTrustedFillCreated } from "../generated/templates/DTF/DTF";
import { _handleAuctionTrustedFillCreated } from "../src/dtf/handlers";
import { mockTransactionReceipt } from "./mock-receipt";

// Mock ERC20 metadata for FROC
const frocAddress = Address.fromString(
  "0x3c8cd0db9a01efa063a7760267b822a129bc7dca"
);
createMockedFunction(frocAddress, "symbol", "symbol():(string)").returns([
  ethereum.Value.fromString("FROC"),
]);
createMockedFunction(frocAddress, "name", "name():(string)").returns([
  ethereum.Value.fromString("FROC"),
]);
createMockedFunction(frocAddress, "decimals", "decimals():(uint8)").returns([
  ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18)),
]);

// Mock ERC20 metadata for BNKR
const bnkrAddress = Address.fromString(
  "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b"
);
createMockedFunction(bnkrAddress, "symbol", "symbol():(string)").returns([
  ethereum.Value.fromString("BNKR"),
]);
createMockedFunction(bnkrAddress, "name", "name():(string)").returns([
  ethereum.Value.fromString("BNKR"),
]);
createMockedFunction(bnkrAddress, "decimals", "decimals():(uint8)").returns([
  ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(18)),
]);

describe("AuctionTrustedFillCreated handler", () => {
  test("creates correct RebalanceAuctionBid", () => {
    clearStore();

    // 1. Prepare mock event
    let dtf = Address.fromString("0xD577936364733a0f03ef92adf572EB4265Ccc4cc");
    let auctionId = BigInt.fromI32(1);
    let filler = Address.fromString(
      "0xC52547AD0856d337a826486c7D07D3B7DcD02A4E"
    );
    let baseEvent = newMockEvent();
    baseEvent.address = dtf;
    baseEvent.block.number = BigInt.fromI32(123456);
    baseEvent.block.timestamp = BigInt.fromI32(111111);
    baseEvent.transaction.hash = mockTransactionReceipt.transactionHash;
    baseEvent.transaction.from = filler;
    baseEvent.logIndex = BigInt.fromI32(0);
    baseEvent.receipt = mockTransactionReceipt;

    let event = changetype<AuctionTrustedFillCreated>(baseEvent);
    event.parameters = [
      new ethereum.EventParam(
        "auctionId",
        ethereum.Value.fromUnsignedBigInt(auctionId)
      ),
      new ethereum.EventParam("filler", ethereum.Value.fromAddress(filler)),
    ];

    // 2. Call handler
    _handleAuctionTrustedFillCreated(dtf, auctionId, filler, event);

    // // 3. Assert entity (ID is constructed as dtf-auctionId-bidder-blockNumber-logIndex)
    let expectedId =
      dtf.toHexString() +
      "-" +
      auctionId.toString() +
      "-" +
      filler.toHexString() +
      "-123456-0";
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "sellToken",
      "0x3c8cd0db9a01efa063a7760267b822a129bc7dca"
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "sellAmount",
      "2671722339850128759773237"
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "buyToken",
      "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b"
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "buyAmount",
      "189668383973440111381297"
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "dtf",
      dtf.toHexString()
    );
    assert.fieldEquals(
      "RebalanceAuctionBid",
      expectedId,
      "transactionHash",
      mockTransactionReceipt.transactionHash.toHexString()
    );
  });
});
