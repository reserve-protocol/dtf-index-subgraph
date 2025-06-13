import { Bytes, ethereum, BigInt, Address } from "@graphprotocol/graph-ts";

// Create the transaction receipt
export const mockTransactionReceipt = new ethereum.TransactionReceipt(
  Bytes.fromHexString(
    "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
  ), // transactionHash
  BigInt.fromString("180"), // transactionIndex
  Bytes.fromHexString(
    "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
  ), // blockHash
  BigInt.fromString("31230197"), // blockNumber
  BigInt.fromString("49198246"), // cumulativeGasUsed
  BigInt.fromString("1171133"), // gasUsed
  Address.fromString("0x0000000000000000000000000000000000000000"), // contractAddress (null in JSON, using zero address)
  new Array<ethereum.Log>(), // logs (will be populated below)
  BigInt.fromString("1"), // status (success = 1)
  Bytes.empty(), // root (not provided in JSON)
  Bytes.fromHexString(
    "0x000010000000400080000000000010008040402010001000000408000000000004a000000040088040000010000212800000004804282000000000008824040004040020104008080480001800001000008010010008002000000000000000040880010000840040000080200800000040400002000000005000401000080000004000008000500004080288200400020000104060208040000800460100100142400070000804000000000000000000104800000000001201000000040000000800a004800000021000400000014000820008004060000010000000000040010000100002002004002000000018080004460000000000400100000000000000"
  ) // logsBloom
);

// Log 0
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x279ccf56441fc74f1aac39e7fac165dec5a88b3a"),
    [
      Bytes.fromHexString(
        "0x510698a9a2034259e9cad24745e9ddefadd72503c64c959a1cca0c4840dc1779"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000d577936364733a0f03ef92adf572eb4265ccc4cc000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("599"),
    BigInt.fromString("0"),
    "",
    null
  )
);

// Log 1
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x3c8cd0db9a01efa063a7760267b822a129bc7dca"),
    [
      Bytes.fromHexString(
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000d577936364733a0f03ef92adf572eb4265ccc4cc"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000235c25bb6be101900d835"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("600"),
    BigInt.fromString("1"),
    "",
    null
  )
);

// Log 2
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x3c8cd0db9a01efa063a7760267b822a129bc7dca"),
    [
      Bytes.fromHexString(
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c92e8bdf79f0507f65a392b0ab4667716bfe0110"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000235c25bb6be101900d835"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("601"),
    BigInt.fromString("2"),
    "",
    null
  )
);

// Log 3
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x3c8cd0db9a01efa063a7760267b822a129bc7dca"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000d577936364733a0f03ef92adf572eb4265ccc4cc"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000235c25bb6be101900d835"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("602"),
    BigInt.fromString("3"),
    "",
    null
  )
);

// Log 4
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0xc52547ad0856d337a826486c7d07d3b7dcd02a4e"),
    [
      Bytes.fromHexString(
        "0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("603"),
    BigInt.fromString("4"),
    "",
    null
  )
);

// Log 5
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0xd577936364733a0f03ef92adf572eb4265ccc4cc"),
    [
      Bytes.fromHexString(
        "0x7e8e2491200fd9e2cf2541c7229d5bf89f4da14659c18fc31054176c339e310b"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000000000000000000000000000000000000000000004"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("604"),
    BigInt.fromString("5"),
    "",
    null
  )
);

// Log 6
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x9008d19f58aabd9ed0d60971565aa8510560ab41"),
    [
      Bytes.fromHexString(
        "0xed99827efb37016f2275f98c4bcf71c7551c75d59e9b450f79fa32e60be672c2"
      ),
      Bytes.fromHexString(
        "0x00000000000000000000000001dcb88678aedd0c4cc9552b20f4718550250574"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000000000000000000000000760f2a0b00000000000000000000000000000000000000000000000000000000"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("605"),
    BigInt.fromString("6"),
    "",
    null
  )
);

// Log 7
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x9008d19f58aabd9ed0d60971565aa8510560ab41"),
    [
      Bytes.fromHexString(
        "0x40338ce1a7c49204f0099533b1e9a7ee0a3d261f84974ab7af36105b8c4e9db4"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000bbcce072fb1bd2c096667e257322f47693d3dc96"
      ),
    ],
    Bytes.fromHexString("0x"),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("606"),
    BigInt.fromString("7"),
    "",
    null
  )
);

// Log 8
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000bbcce072fb1bd2c096667e257322f47693d3dc96"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab41"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000000000000000001df5cafd"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("607"),
    BigInt.fromString("8"),
    "",
    null
  )
);

// Log 9
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000caf2da315f5a5499299a312b8a86faafe4bad959"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000b94b22332abf5f89877a14cc88f2abc48c34b3df"
      ),
    ],
    Bytes.fromHexString(
      "0x00000000000000000000000000000000000000000000000000000000000758dd"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("628"),
    BigInt.fromString("9"),
    "",
    null
  )
);

// Log 10
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0xb94b22332abf5f89877a14cc88f2abc48c34b3df"),
    [
      Bytes.fromHexString(
        "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000caf2da315f5a5499299a312b8a86faafe4bad959"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000caf2da315f5a5499299a312b8a86faafe4bad959"
      ),
    ],
    Bytes.fromHexString(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffe20a350300000000000000000000000000000000000000000000000000000000000758dd000000000000000000000000000000000000000007ec48cd2289fc0c34d31165000000000000000000000000000000000000000000000000000000ba3decd180fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffef0780000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("629"),
    BigInt.fromString("10"),
    "",
    null
  )
);

// Log 11
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000caf2da315f5a5499299a312b8a86faafe4bad959"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab41"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000000000000000001df5cafd"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("630"),
    BigInt.fromString("11"),
    "",
    null
  )
);

// Log 12
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000caf2da315f5a5499299a312b8a86faafe4bad959"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab41"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000000000000000001df5cafd"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("631"),
    BigInt.fromString("12"),
    "",
    null
  )
);

// Log 13
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x9008d19f58aabd9ed0d60971565aa8510560ab41"),
    [
      Bytes.fromHexString(
        "0xed99827efb37016f2275f98c4bcf71c7551c75d59e9b450f79fa32e60be672c2"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000000000000000001ff3684f28c67538d4d072c22734"
      ),
    ],
    Bytes.fromHexString(
      "0x00000000000000000000000000000000000000000000000000000000000000002213bc0b00000000000000000000000000000000000000000000000000000000"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("632"),
    BigInt.fromString("13"),
    "",
    null
  )
);

// Log 14
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x22af33fe49fd1fa80c7149773dde5890d3c76f3b"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab41"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000002829f1962dad5a160b31"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("633"),
    BigInt.fromString("14"),
    "",
    null
  )
);

// Log 15
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000009008d19f58aabd9ed0d60971565aa8510560ab41"
      ),
      Bytes.fromHexString(
        "0x00000000000000000000000089b537d4e0de035303dc1bdae18394f7a6c15c36"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000000000000000001e01c443"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("634"),
    BigInt.fromString("15"),
    "",
    null
  )
);

// Log 16
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x22af33fe49fd1fa80c7149773dde5890d3c76f3b"),
    [
      Bytes.fromHexString(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000c52547ad0856d337a826486c7d07d3b7dcd02a4e"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000d577936364733a0f03ef92adf572eb4265ccc4cc"
      ),
    ],
    Bytes.fromHexString(
      "0x000000000000000000000000000000000000000000002829f1962dad5a160b31"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("635"),
    BigInt.fromString("16"),
    "",
    null
  )
);

// Log 17
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0xd577936364733a0f03ef92adf572eb4265ccc4cc"),
    [
      Bytes.fromHexString(
        "0x4e3a022fa7a66b1e055fe6b819a1afe69dc1d44c43de4af7b32f095e603884ae"
      ),
      Bytes.fromHexString(
        "0x0000000000000000000000003c8cd0db9a01efa063a7760267b822a129bc7dca"
      ),
    ],
    Bytes.fromHexString("0x"),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("636"),
    BigInt.fromString("17"),
    "",
    null
  )
);

// Log 18
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x9008d19f58aabd9ed0d60971565aa8510560ab41"),
    [
      Bytes.fromHexString(
        "0xed99827efb37016f2275f98c4bcf71c7551c75d59e9b450f79fa32e60be672c2"
      ),
      Bytes.fromHexString(
        "0x00000000000000000000000001dcb88678aedd0c4cc9552b20f4718550250574"
      ),
    ],
    Bytes.fromHexString(
      "0x0000000000000000000000000000000000000000000000000000000000000000760f2a0b00000000000000000000000000000000000000000000000000000000"
    ),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("637"),
    BigInt.fromString("18"),
    "",
    null
  )
);

// Log 19
mockTransactionReceipt.logs.push(
  new ethereum.Log(
    Address.fromString("0x9008d19f58aabd9ed0d60971565aa8510560ab41"),
    [
      Bytes.fromHexString(
        "0x40338ce1a7c49204f0099533b1e9a7ee0a3d261f84974ab7af36105b8c4e9db4"
      ),
      Bytes.fromHexString(
        "0x000000000000000000000000bbcce072fb1bd2c096667e257322f47693d3dc96"
      ),
    ],
    Bytes.fromHexString("0x"),
    Bytes.fromHexString(
      "0x4994fc509b6a13fbe8544505e6d325f0aac6089ade7107d02ae1b7dfa3fdc573"
    ),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString(
      "0x59418defdaea6afdfd24447c4e1c64b55608c0b0f7feb408e60db6d721af10eb"
    ),
    BigInt.fromString("180"),
    BigInt.fromString("638"),
    BigInt.fromString("19"),
    "",
    null
  )
);

// // Set the logs array on the transaction receipt
// mockTransactionReceipt.logs = logs;
