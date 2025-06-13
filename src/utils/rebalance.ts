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
  // Extract all transfers that involve the DTF address
  let transfers = getTransfersFromLogs(dtfAddress, receipt.logs);

  // Defensive-check – if nothing relevant was found just return early
  if (transfers.length == 0) return new Array<ParsedAuctionBid>();

  // Ensure the transfers are processed in the same order they appeared in the
  // transaction receipt. We rely on the `index` property, which mirrors the
  // original position inside `receipt.logs`.
  transfers.sort((a: Transfer, b: Transfer): i32 => {
    return a.index - b.index;
  });

  let bids = new Array<ParsedAuctionBid>();
  let i = 0;

  while (i < transfers.length) {
    const first = transfers[i];

    // A trade always starts with the DTF *sending* a token (the "sell"). If the
    // current transfer is not a sell just move forward.
    if (first.from != dtfAddress) {
      i++;
      continue;
    }

    // Aggregate *consecutive* sells of the same token
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

    // After we finished accumulating the sells we expect one or more buys where
    // the DTF *receives* a (different) token.
    let buyToken = Address.zero();
    let buyAmount = BigInt.fromI32(0);
    let foundBuy = false;

    while (j < transfers.length) {
      const t = transfers[j];

      if (t.to == dtfAddress) {
        // We found a transfer where the DTF receives tokens (potential buy part)
        if (!foundBuy) {
          buyToken = t.token;
          buyAmount = t.value;
          foundBuy = true;
        } else if (t.token == buyToken) {
          // Same token – accumulate amount
          buyAmount = buyAmount.plus(t.value);
        } else {
          // A different token received means the previous buy leg ended.
          break;
        }
        j++;
        continue;
      }

      // If we encounter another sell before finishing the buy leg, the current
      // trade is done.
      if (t.from == dtfAddress) {
        break;
      }

      j++;
    }

    // Only push the bid if we actually found the buy side AND the tokens differ.
    if (foundBuy && buyToken != sellToken) {
      bids.push(
        new ParsedAuctionBid(
          sellToken,
          sellAmount,
          buyToken,
          buyAmount,
          dtfAddress,
          receipt.blockNumber,
          receipt.transactionHash
        )
      );
    }

    // Continue parsing from where we stopped (j)
    i = j;
  }

  return bids;
}
