import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

const TRANSFER_SIG = Bytes.fromHexString(
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
);

const ZERO_HASH = Bytes.fromHexString(
  "0x0000000000000000000000000000000000000000000000000000000000000000"
);

export function buildTransferLog(
  tokenAddress: Address,
  from: Address,
  to: Address,
  value: BigInt,
  logIndex: BigInt
): ethereum.Log {
  let fromTopic = ethereum.encode(ethereum.Value.fromAddress(from))!;
  let toTopic = ethereum.encode(ethereum.Value.fromAddress(to))!;
  let data = ethereum.encode(ethereum.Value.fromUnsignedBigInt(value))!;

  return new ethereum.Log(
    tokenAddress,
    [TRANSFER_SIG, fromTopic, toTopic],
    data,
    ZERO_HASH, // blockHash
    Bytes.empty(), // blockNumber (unused in tests)
    ZERO_HASH, // transactionHash
    BigInt.fromI32(0), // transactionIndex
    logIndex,
    BigInt.fromI32(0), // transactionLogIndex
    "",
    null
  );
}

export function buildNonTransferLog(logIndex: BigInt): ethereum.Log {
  let randomSig = Bytes.fromHexString(
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  );

  return new ethereum.Log(
    Address.fromString("0x0000000000000000000000000000000000000001"),
    [randomSig],
    Bytes.empty(),
    ZERO_HASH,
    Bytes.empty(),
    ZERO_HASH,
    BigInt.fromI32(0),
    logIndex,
    BigInt.fromI32(0),
    "",
    null
  );
}

export function buildReceipt(
  logs: Array<ethereum.Log>,
  txHash: Bytes = ZERO_HASH,
  blockNumber: BigInt = BigInt.fromI32(100)
): ethereum.TransactionReceipt {
  return new ethereum.TransactionReceipt(
    txHash,
    BigInt.fromI32(0), // transactionIndex
    ZERO_HASH, // blockHash
    blockNumber,
    BigInt.fromI32(0), // cumulativeGasUsed
    BigInt.fromI32(0), // gasUsed
    Address.fromString("0x0000000000000000000000000000000000000000"),
    logs,
    BigInt.fromI32(1), // status
    Bytes.empty(), // root
    Bytes.empty() // logsBloom
  );
}
