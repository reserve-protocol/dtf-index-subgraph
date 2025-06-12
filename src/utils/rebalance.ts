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
      transfers.push(new Transfer(log, from, to, value, token, i));
    }
  }

  return transfers;
}

export function getAuctionBidsFromReceipt(
  dtfAddress: Address,
  receipt: ethereum.TransactionReceipt
): Array<ParsedAuctionBid> {
  let transfers = getTransfersFromLogs(dtfAddress, receipt.logs);

  let bids = new Array<ParsedAuctionBid>();
  let i = 0;
  while (i < transfers.length) {
    let sell = transfers[i];
    if (sell.from == dtfAddress) {
      let buyAmount = BigInt.fromI32(0);
      let buyToken = Address.zero();
      let foundBuy = false;
      let j = i + 1;
      while (j < transfers.length) {
        let buy = transfers[j];
        if (buy.to == dtfAddress) {
          if (!foundBuy) {
            buyToken = buy.token;
            buyAmount = buy.value;
            foundBuy = true;
          } else if (buy.token == buyToken) {
            buyAmount = buyAmount.plus(buy.value);
          } else {
            break;
          }
        } else if (buy.from == dtfAddress) {
          break;
        }
        j++;
      }
      if (foundBuy) {
        bids.push(
          new ParsedAuctionBid(
            sell.token,
            sell.value,
            buyToken,
            buyAmount,
            dtfAddress,
            BigInt.fromI32(123456),
            sell.log.transactionHash
          )
        );
      }
      i = j;
    } else {
      i++;
    }
  }
  return bids;
}
