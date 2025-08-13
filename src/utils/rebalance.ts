import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

class Transfer {
  log: ethereum.Log;
  from: Address;
  to: Address;
  value: BigInt;
  token: Address;
  index: i32;
  constructor(
    log: ethereum.Log,
    from: Address,
    to: Address,
    value: BigInt,
    token: Address,
    index: i32
  ) {
    this.log = log;
    this.from = from;
    this.to = to;
    this.value = value;
    this.token = token;
    this.index = index;
  }
}

class ParsedAuctionBid {
  sellToken: Address;
  sellAmount: BigInt;
  buyToken: Address;
  buyAmount: BigInt;
  dtf: Address;
  blockNumber: BigInt;
  transactionHash: Bytes;
  constructor(
    sellToken: Address,
    sellAmount: BigInt,
    buyToken: Address,
    buyAmount: BigInt,
    dtf: Address,
    blockNumber: BigInt,
    transactionHash: Bytes
  ) {
    this.sellToken = sellToken;
    this.sellAmount = sellAmount;
    this.buyToken = buyToken;
    this.buyAmount = buyAmount;
    this.dtf = dtf;
    this.blockNumber = blockNumber;
    this.transactionHash = transactionHash;
  }
}

const TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function getTransfersFromLogs(
  address: Address,
  logs: Array<ethereum.Log>
): Array<Transfer> {
  let transfers = new Array<Transfer>();

  for (let i = 0; i < logs.length; i++) {
    let log = logs[i];
    if (log.topics.length < 3) continue;
    if (!log.topics[0].equals(Bytes.fromHexString(TRANSFER_EVENT_SIGNATURE)))
      continue;
    let fromDecoded = ethereum.decode("address", log.topics[1]);
    let toDecoded = ethereum.decode("address", log.topics[2]);
    let valueDecoded = ethereum.decode("uint256", log.data);
    if (fromDecoded == null || toDecoded == null || valueDecoded == null)
      continue;
    let from = fromDecoded.toAddress();
    let to = toDecoded.toAddress();
    let value = valueDecoded.toBigInt();
    let token = log.address;

    if (from == address || to == address) {
      transfers.push(
        new Transfer(log, from, to, value, token, log.logIndex.toI32())
      );
    }
  }

  return transfers;
}

export function getAuctionBidsFromReceipt(
  dtfAddress: Address,
  receipt: ethereum.TransactionReceipt
): Array<ParsedAuctionBid> {
  let transfers = getTransfersFromLogs(dtfAddress, receipt.logs);
  if (transfers.length == 0) return new Array<ParsedAuctionBid>();

  transfers.sort((a: Transfer, b: Transfer): i32 => {
    return a.index - b.index;
  });

  let bids = new Array<ParsedAuctionBid>();
  let i = 0;

  while (i < transfers.length) {
    const first = transfers[i];

    if (first.from != dtfAddress) {
      i++;
      continue;
    }

    // Aggregate consecutive sells of the same token
    let sellToken = first.token;
    let sellAmount = first.value;

    let j = i + 1;
    while (j < transfers.length) {
      const maybeMoreSell = transfers[j];
      if (
        maybeMoreSell.from == dtfAddress &&
        maybeMoreSell.token == sellToken
      ) {
        sellAmount = sellAmount.plus(maybeMoreSell.value);
        j++;
      } else {
        break;
      }
    }

    // FIXED: Track both potential incoming tokens
    let buyToken = Address.zero();
    let buyAmount = BigInt.fromI32(0);
    let sellTokenRefund = BigInt.fromI32(0); // <-- Track refund separately
    let foundBuy = false;

    while (j < transfers.length) {
      const t = transfers[j];

      if (t.to == dtfAddress) {
        if (t.token == sellToken) {
          // This is a refund of the sell token
          sellTokenRefund = sellTokenRefund.plus(t.value);
        } else if (!foundBuy) {
          // First different token - this is our buy token
          buyToken = t.token;
          buyAmount = t.value;
          foundBuy = true;
        } else if (t.token == buyToken) {
          // More of the buy token
          buyAmount = buyAmount.plus(t.value);
        } else {
          // A third different token - shouldn't happen based on your assumption
          // but if it does, we're done with this trade
          break;
        }
        j++;
        continue;
      }

      // If we encounter another sell, the current trade is done
      if (t.from == dtfAddress) {
        break;
      }

      j++;
    }

    // Only push the bid if we found a buy token different from sell token
    if (foundBuy && buyToken != sellToken) {
      // Net the sell amount (subtract any refund)
      let netSellAmount = sellAmount.minus(sellTokenRefund);

      bids.push(
        new ParsedAuctionBid(
          sellToken,
          netSellAmount, // <-- Use NET amount (out minus refund)
          buyToken,
          buyAmount,
          dtfAddress,
          receipt.blockNumber,
          receipt.transactionHash
        )
      );
    }

    i = j;
  }

  return bids;
}
