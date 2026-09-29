const fs = require("fs");

const fixturePath =
  process.argv[2] ||
  process.env.INDEX_DTF_FORK_MANIFEST ||
  process.env.FORK_PARITY_FIXTURE;
const endpoint =
  process.env.FORK_SUBGRAPH_URL ||
  "http://localhost:18000/subgraphs/name/dtf-index-subgraph-fork";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const REBALANCE_STARTED_TOPIC =
  "0x0cbeb8974ae6272ee021fa78c8317a620933553dd58949490a4c70ae8cebc4e4";
const AUCTION_OPENED_TOPIC =
  "0x24c9d9f1ca3e1d57b1fe4445280ced7eb621e75b079f2b23ec634a1072c92e24";
const PROPOSAL_CREATED_TOPIC =
  "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0";
const PROPOSAL_EXECUTED_TOPIC =
  "0x712ae1383f79ac853f8d882153778e0260ef8f03b504e2866e0593e04d2b291f";
const OPTIMISTIC_PROPOSAL_CREATED_TOPIC =
  "0xb972970885dfb57b23da2d10eb294e5ab2eab2998ea9f393c88850fef9cd78e3";
const SELECTOR = {
  version: "0x54fd4d50",
  tradeAllowlistEnabled: "0x5878de7c",
  getTokenAllowlist: "0x20d97a5d",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
  mintFee: "0x13966db5",
  tvlFee: "0xb200deda",
  folioFeeForSelf: "0xc0062c98",
  maxAuctionLength: "0x0e519ef9",
  auctionLength: "0x325c25a2",
  getRoleMembers: "0xa3246ad3",
  feeRecipients: "0x51fe9eff",
  immutableFeeRecipients: "0xa47c803d",
  auctions: "0x571a26a0",
  governorState: "0x3e4f49e6",
  isOptimistic: "0x4c0f4e2c",
};
const ROLE = {
  defaultAdmin: "0x" + "00".repeat(32),
  brandManager:
    "0x2d8e650da9bd8c373ab2450d770f2ed39549bfc28d3630025cecc51511bcd374",
  rebalanceManager:
    "0x4ff6ae4d6a29e79ca45c6441bdc89b93878ac6118485b33c8baa3749fc3cb130",
  auctionApprover:
    "0x2be23b023f3eee571adc019cdcf3f0bcf041151e6ff405a4bf0c4bfc6faea8c9",
  auctionLauncher:
    "0x13ff1b2625181b311f257c723b5e6d366eb318b212d9dd694c48fcf227659df5",
};
// Every case the protocol sandbox can produce, and the evidence it must carry.
// The full profile requires all of them; a subset must be named in FORK_PARITY_SCENARIOS.
const CASE_EVIDENCE = {
  v5Control: "execution",
  v5OptimisticUpgrade: "upgrade",
  v5LegacyUpgrade: "upgrade",
  v6Native: "execution",
};
let rpcRequestId = 0;

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  CASE_EVIDENCE,
  selectProfile,
  planParity,
  summarizeResults,
  expectedGovernanceLinks,
};

async function main() {
  if (!fixturePath) {
    fail("pass the canonical fixture path or set INDEX_DTF_FORK_MANIFEST");
  }
  // Profile and required-case validation is pure and runs before any network check.
  const profile = selectProfile(process.env.FORK_PARITY_SCENARIOS);
  const fixture = planParity(
    JSON.parse(fs.readFileSync(fixturePath, "utf8")),
    profile,
  );
  console.log(
    `Fork parity ${profile.name} profile: checking ${fixture.cases.map((parityCase) => parityCase.name).join(", ")}` +
      (fixture.skipped.length > 0 ? `; skipping ${fixture.skipped.join(", ")}` : ""),
  );

  const meta = await query(
    `query { _meta { block { number } hasIndexingErrors deployment } }`,
  );
  assertEqual(meta._meta.hasIndexingErrors, false, "subgraph indexing errors");
  if (fixture.minimumIndexedBlock !== undefined) {
    const indexed = Number(meta._meta.block.number);
    if (indexed < fixture.minimumIndexedBlock) {
      fail(`indexed block ${indexed} is below ${fixture.minimumIndexedBlock}`);
    }
  }
  const deploymentStatus = await assertActiveDeploymentStatus(
    meta._meta.deployment,
    fixture.minimumIndexedBlock,
  );

  const results = [];
  let defeatedSetupProposals = 0;
  for (const parityCase of fixture.cases) {
    try {
      defeatedSetupProposals += await checkCase(fixture, parityCase);
      results.push({ name: parityCase.name, passed: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${parityCase.name}] ${message}`);
      results.push({ name: parityCase.name, passed: false, message });
    }
  }

  const summary = summarizeResults(fixture, results);
  if (!summary.passed) fail(summary.message);
  console.log(
    `${summary.message} at block ${meta._meta.block.number}: ${defeatedSetupProposals} harmless defeated setup proposal(s); active deployment ${meta._meta.deployment} is healthy (${deploymentStatus.historical} historical deployment(s) ignored); block-pinned event accounting, execution receipts, roles, governance links, fees, and RPC post-state match`,
  );
}

// Runs one case's checks; returns how many harmless defeated setup proposals it saw.
async function checkCase(fixture, parityCase) {
  await checkFolio(fixture, parityCase.folio);
  if (parityCase.proposal) await checkProposal(fixture, parityCase.proposal);
  if (!parityCase.execution) return 0;
  await assertExecutionParity(fixture, parityCase.execution);
  if (parityCase.name !== "v6Native") return 0;
  return assertNativeExecutionGovernance(fixture, parityCase.execution);
}

async function checkFolio(fixture, folio) {
  const data = await query(
    `query Folio($id: ID!, $block: Int!) {
      dtf(id: $id, block: { number: $block }) {
        id version proxyAdmin ownerAddress stTokenAddress
        mintingFee tvlFee auctionLength maxAuctionLength
        feeRecipients immutableFeeRecipients folioFeeForSelf
        tradeAllowlistEnabled tradeTokenAllowlist
        admins auctionApprovers auctionLaunchers brandManagers
        ownerGovernance { id }
        tradingGovernance { id }
        token {
          totalSupply totalMinted totalBurned mintCount burnCount transferCount
          currentHolderCount
          holdersBalance(first: 1000) { account { id } amount }
        }
      }
    }`,
    { id: folio.address.toLowerCase(), block: fixture.minimumIndexedBlock },
  );
  if (!data.dtf) fail(`${folio.label || folio.address}: DTF not indexed`);
  compareExpected(data.dtf, folio.expected || {}, folio.label || folio.address);
  if (fixture.rpcUrl) {
    await assertRpcParity(fixture, folio, data.dtf);
  }
}

async function checkProposal(fixture, expectedProposal) {
  const data = await query(
    `query Proposal($id: ID!, $block: Int!) {
      proposal(id: $id, block: { number: $block }) {
        id state isOptimistic targets values calldatas
      }
    }`,
    { id: expectedProposal.id, block: fixture.minimumIndexedBlock },
  );
  if (!data.proposal) fail(`${expectedProposal.id}: proposal not indexed`);
  compareExpected(
    data.proposal,
    expectedProposal.expected || {},
    expectedProposal.id,
  );
  if (expectedProposal.calldataSelectors) {
    const selectors = data.proposal.calldatas.map((calldata) =>
      calldata.slice(0, 10).toLowerCase(),
    );
    assertDeepEqual(
      selectors,
      expectedProposal.calldataSelectors.map((value) => value.toLowerCase()),
      `${expectedProposal.id}.calldataSelectors`,
    );
  }
}

async function query(document, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  if (!response.ok) fail(`GraphQL HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors) fail(JSON.stringify(payload.errors));
  return payload.data;
}

async function statusQuery(document) {
  const endpoint =
    process.env.FORK_GRAPH_STATUS_URL || "http://localhost:18030/graphql";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document }),
  });
  if (!response.ok) fail(`Graph status HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors) fail(JSON.stringify(payload.errors));
  return payload.data;
}

async function assertActiveDeploymentStatus(deployment, minimumBlock) {
  const data = await statusQuery(`query {
    indexingStatuses {
      subgraph synced health
      fatalError { message }
      chains { latestBlock { number hash } chainHeadBlock { number hash } }
    }
  }`);
  const statuses = data.indexingStatuses || [];
  const active = statuses.find((status) => status.subgraph === deployment);
  if (!active) fail(`active deployment ${deployment} is absent from Graph status`);
  assertEqual(active.health, "healthy", `${deployment}.health`);
  assertEqual(active.synced, true, `${deployment}.synced`);
  if (active.fatalError) fail(`${deployment}: ${active.fatalError.message}`);
  const latest = Number(active.chains?.[0]?.latestBlock?.number ?? -1);
  if (latest < minimumBlock) {
    fail(`${deployment}: indexed block ${latest} is below ${minimumBlock}`);
  }
  return { historical: statuses.filter((status) => status.subgraph !== deployment).length };
}

async function assertExecutionParity(fixture, execution) {
  const block = fixture.minimumIndexedBlock;
  const rebalanceId = `${execution.address.toLowerCase()}-0x${BigInt(
    execution.expected.rebalanceNonce,
  ).toString(16)}`;
  const auctionId = `${execution.address.toLowerCase()}-${execution.expected.auctionId}`;
  const data = await query(
    `query Execution($rebalanceId: ID!, $auctionId: ID!, $block: Int!) {
      rebalance(id: $rebalanceId, block: { number: $block }) {
        id nonce dtf { id } tokens { id } startedAt restrictedUntil availableUntil
        transactionHash blockNumber timestamp
      }
      auction(id: $auctionId, block: { number: $block }) {
        id dtf { id } rebalance { id nonce } tokens { id }
        startTime endTime transactionHash blockNumber timestamp
      }
    }`,
    { rebalanceId, auctionId, block },
  );
  if (!data.rebalance) fail(`${execution.name}: rebalance ${rebalanceId} not indexed`);
  if (!data.auction) fail(`${execution.name}: auction ${auctionId} not indexed`);

  const expected = execution.expected;
  assertEqual(data.rebalance.nonce, expected.rebalanceNonce, `${execution.name}.rebalance.nonce`);
  assertEqual(data.rebalance.dtf.id, execution.address, `${execution.name}.rebalance.dtf`);
  assertAddressSet(
    data.rebalance.tokens.map((token) => token.id),
    expected.tokens,
    `${execution.name}.rebalance.tokens`,
  );
  assertEqual(
    data.rebalance.transactionHash,
    expected.rebalanceTxHash,
    `${execution.name}.rebalance.transactionHash`,
  );
  assertEqual(
    data.rebalance.blockNumber,
    expected.rebalanceBlock,
    `${execution.name}.rebalance.blockNumber`,
  );
  assertEqual(data.auction.dtf.id, execution.address, `${execution.name}.auction.dtf`);
  assertEqual(data.auction.rebalance.id, rebalanceId, `${execution.name}.auction.rebalance`);
  assertEqual(
    data.auction.rebalance.nonce,
    expected.rebalanceNonce,
    `${execution.name}.auction.rebalance.nonce`,
  );
  assertAddressSet(
    data.auction.tokens.map((token) => token.id),
    expected.tokens,
    `${execution.name}.auction.tokens`,
  );
  assertEqual(
    data.auction.transactionHash,
    expected.auctionTxHash,
    `${execution.name}.auction.transactionHash`,
  );
  assertEqual(
    data.auction.blockNumber,
    expected.auctionBlock,
    `${execution.name}.auction.blockNumber`,
  );
  assertEqual(
    (BigInt(data.auction.endTime) - BigInt(data.auction.startTime)).toString(),
    expected.auctionLength,
    `${execution.name}.auction.length`,
  );

  await assertReceiptEvent(
    fixture.rpcUrl,
    expected.rebalanceTxHash,
    expected.rebalanceBlock,
    execution.address,
    REBALANCE_STARTED_TOPIC,
    [expected.rebalanceNonce],
  );
  await assertReceiptEvent(
    fixture.rpcUrl,
    expected.auctionTxHash,
    expected.auctionBlock,
    execution.address,
    AUCTION_OPENED_TOPIC,
    [expected.rebalanceNonce, expected.auctionId],
  );

  const auctionState = decodeWords(
    await ethCall(
      fixture.rpcUrl,
      execution.address,
      SELECTOR.auctions + encodeUint(expected.auctionId),
      block,
    ),
  );
  assertEqual(auctionState[0], expected.rebalanceNonce, `${execution.name}.auction RPC nonce`);
  assertEqual(auctionState[1], data.auction.startTime, `${execution.name}.auction RPC start`);
  assertEqual(auctionState[2], data.auction.endTime, `${execution.name}.auction RPC end`);

  const auctionTx = await rpcCall(fixture.rpcUrl, "eth_getTransactionByHash", [
    expected.auctionTxHash,
  ]);
  assertEqual(
    auctionTx.input.slice(0, 10),
    execution.auctionSelector,
    `${execution.name}.auction selector`,
  );
  if (execution.rebalanceSelector) {
    const rebalanceTx = await rpcCall(fixture.rpcUrl, "eth_getTransactionByHash", [
      expected.rebalanceTxHash,
    ]);
    assertEqual(
      rebalanceTx.input.slice(0, 10),
      execution.rebalanceSelector,
      `${execution.name}.rebalance selector`,
    );
  }
}

async function assertNativeExecutionGovernance(fixture, native) {
  const block = fixture.minimumIndexedBlock;
  const governanceId = native.governance.toLowerCase();
  const data = await query(
    `query NativeExecution($governanceId: ID!, $block: Int!) {
      governance(id: $governanceId, block: { number: $block }) {
        id proposals(first: 1000) {
          id txnHash description state isOptimistic creationBlock creationTime
          voteStart voteEnd executionTxnHash executionBlock targets values calldatas
        }
      }
    }`,
    { governanceId, block },
  );
  if (!data.governance) fail(`${governanceId}: native governance not indexed`);
  const proposals = data.governance.proposals || [];
  const authority = native.execution.authority;
  const rebalance = native.execution.rebalanceProposal;
  // The sandbox records id 0 when the roles were already granted and no authority proposal was needed.
  const hasAuthorityProposal = String(authority.proposalId) !== "0";
  const authorityEntity = hasAuthorityProposal ? findProposal(proposals, authority.proposalId) : null;
  const rebalanceEntity = findProposal(proposals, rebalance.proposalId);

  if (hasAuthorityProposal) await assertExecutionProposal(fixture, native, authorityEntity, authority, false);
  await assertExecutionProposal(fixture, native, rebalanceEntity, rebalance, true);
  assertEqual(
    rebalanceEntity.targets[0],
    native.address,
    "v6Native.rebalanceProposal.target",
  );
  assertEqual(
    rebalanceEntity.calldatas[0].slice(0, 10),
    native.proposalRebalanceSelector,
    "v6Native.rebalanceProposal.selector",
  );
  assertEqual(
    decodeCalldataWord(rebalanceEntity.calldatas[0], 7),
    native.execution.deadline,
    "v6Native.rebalanceProposal.deadline",
  );
  assertEqual(
    rebalanceEntity.executionTxnHash,
    native.execution.rebalanceTxHash,
    "v6Native proposal/rebalance transaction linkage",
  );
  assertEqual(
    rebalanceEntity.executionBlock,
    native.execution.rebalanceBlock,
    "v6Native proposal/rebalance block linkage",
  );
  if (hasAuthorityProposal) {
    assertDeepEqual(
      authorityEntity.calldatas.map((calldata) => calldata.slice(0, 10)),
      ["0x2f2ff15d", "0x2f2ff15d"],
      "v6Native.authority selectors",
    );
  }

  const abandoned = proposals.filter(
    (proposal) =>
      proposal.id !== String(authority.proposalId) &&
      proposal.description ===
        "Sandbox native-v6 optimistic proposer and auction launcher authority",
  );
  for (const proposal of abandoned) {
    assertEqual(proposal.isOptimistic, false, `${proposal.id}.isOptimistic`);
    assertEqual(
      await readGovernorUint(
        fixture.rpcUrl,
        native.governance,
        SELECTOR.governorState,
        proposal.id,
        block,
      ),
      3,
      `${proposal.id}.RPC state`,
    );
    // No transition event follows a time-only expiry, so the indexed state is
    // the last event-backed state while RPC is authoritative for Defeated.
    assertEqual(proposal.state, "PENDING", `${proposal.id}.event-backed state`);
    await assertReceiptEvent(
      fixture.rpcUrl,
      proposal.txnHash,
      proposal.creationBlock,
      native.governance,
      PROPOSAL_CREATED_TOPIC,
    );
  }
  return abandoned.length;
}

function findProposal(proposals, id) {
  const proposal = proposals.find((value) => value.id === String(id));
  if (!proposal) fail(`${id}: execution proposal not indexed`);
  return proposal;
}

async function assertExecutionProposal(fixture, native, graph, expected, optimistic) {
  assertEqual(graph.txnHash, expected.proposalTxHash, `${graph.id}.txnHash`);
  assertEqual(graph.description, expected.description, `${graph.id}.description`);
  assertEqual(graph.creationBlock, expected.proposalBlock, `${graph.id}.creationBlock`);
  assertEqual(graph.executionTxnHash, expected.executeTxHash, `${graph.id}.executionTxnHash`);
  assertEqual(graph.executionBlock, expected.executeBlock, `${graph.id}.executionBlock`);
  assertEqual(graph.state, "EXECUTED", `${graph.id}.state`);
  assertEqual(graph.isOptimistic, optimistic, `${graph.id}.isOptimistic`);
  assertEqual(
    await readGovernorUint(
      fixture.rpcUrl,
      native.governance,
      SELECTOR.governorState,
      graph.id,
      fixture.minimumIndexedBlock,
    ),
    7,
    `${graph.id}.RPC state`,
  );
  assertEqual(
    await readGovernorUint(
      fixture.rpcUrl,
      native.governance,
      SELECTOR.isOptimistic,
      graph.id,
      fixture.minimumIndexedBlock,
    ),
    optimistic ? 1 : 0,
    `${graph.id}.RPC optimistic flag`,
  );
  await assertReceiptEvent(
    fixture.rpcUrl,
    expected.proposalTxHash,
    expected.proposalBlock,
    native.governance,
    PROPOSAL_CREATED_TOPIC,
  );
  await assertReceiptEvent(
    fixture.rpcUrl,
    expected.executeTxHash,
    expected.executeBlock,
    native.governance,
    PROPOSAL_EXECUTED_TOPIC,
  );
  if (optimistic) {
    await assertReceiptEvent(
      fixture.rpcUrl,
      expected.proposalTxHash,
      expected.proposalBlock,
      native.governance,
      OPTIMISTIC_PROPOSAL_CREATED_TOPIC,
      [expected.proposalId],
    );
  }
}

async function assertReceiptEvent(
  rpcUrl,
  txHash,
  expectedBlock,
  address,
  eventTopic,
  indexedValues = [],
) {
  const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]);
  if (!receipt) fail(`missing transaction receipt ${txHash}`);
  assertEqual(receipt.status, "0x1", `${txHash}.receipt.status`);
  assertEqual(BigInt(receipt.blockNumber).toString(), expectedBlock, `${txHash}.receipt.block`);
  const expectedTopics = [eventTopic, ...indexedValues.map(uintTopic)];
  const match = receipt.logs.some(
    (log) =>
      log.address.toLowerCase() === address.toLowerCase() &&
      expectedTopics.every(
        (topic, index) => (log.topics[index] || "").toLowerCase() === topic.toLowerCase(),
      ),
  );
  if (!match) fail(`${txHash}: expected event ${eventTopic} from ${address}`);
}

async function readGovernorUint(rpcUrl, governor, selector, id, block) {
  return decodeUint(await ethCall(rpcUrl, governor, selector + encodeUint(id), block));
}

function decodeWords(result) {
  const hex = stripHexPrefix(result);
  if (hex.length % 64 !== 0) fail(`invalid ABI words ${result}`);
  const values = [];
  for (let offset = 0; offset < hex.length; offset += 64) {
    values.push(BigInt(`0x${hex.slice(offset, offset + 64)}`).toString());
  }
  return values;
}

function decodeCalldataWord(calldata, index) {
  const hex = stripHexPrefix(calldata).slice(8);
  const start = index * 64;
  return BigInt(`0x${hex.slice(start, start + 64)}`).toString();
}

function uintTopic(value) {
  return `0x${encodeUint(value)}`;
}

async function rpcCall(rpcUrl, method, params, allowError = false) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcRequestId,
      method,
      params,
    }),
  });
  if (!response.ok) fail(`RPC HTTP ${response.status} for ${method}`);
  const payload = await response.json();
  if (payload.error) {
    if (allowError) return null;
    fail(`RPC ${method}: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

async function ethCall(rpcUrl, to, data, block, allowRevert = false) {
  return rpcCall(
    rpcUrl,
    "eth_call",
    [{ to, data }, toQuantity(block)],
    allowRevert,
  );
}

async function readRoleMembers(rpcUrl, address, role, block) {
  const result = await ethCall(
    rpcUrl,
    address,
    SELECTOR.getRoleMembers + role.slice(2),
    block,
  );
  return decodeAddressArray(result);
}

async function readFeeRecipients(rpcUrl, address, selector, block) {
  const recipients = [];
  for (let index = 0; index < 64; index++) {
    const result = await ethCall(
      rpcUrl,
      address,
      selector + encodeUint(index),
      block,
      true,
    );
    if (result === null) return recipients.join(",");
    const [recipient, portion] = decodeAddressUintTuple(result);
    recipients.push(`${recipient}:${portion}`);
  }
  fail(`fee recipient parity exceeded the 64-entry safety limit for ${address}`);
}

function replayTransfers(logs) {
  let totalMinted = 0n;
  let totalBurned = 0n;
  let mintCount = 0;
  let burnCount = 0;
  let transferCount = 0;
  const touched = new Set();
  const balances = new Map();

  for (const log of logs) {
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);
    const amount = BigInt(log.data);
    if (amount === 0n || from === to) continue;
    if (from === ZERO_ADDRESS) {
      totalMinted += amount;
      mintCount++;
    } else if (to === ZERO_ADDRESS) {
      totalBurned += amount;
      burnCount++;
    } else {
      transferCount++;
    }
    if (from !== ZERO_ADDRESS) {
      touched.add(from);
      balances.set(from, (balances.get(from) || 0n) - amount);
    }
    if (to !== ZERO_ADDRESS) {
      touched.add(to);
      balances.set(to, (balances.get(to) || 0n) + amount);
    }
  }

  return {
    totalMinted: totalMinted.toString(),
    totalBurned: totalBurned.toString(),
    mintCount,
    burnCount,
    transferCount,
    touched: Array.from(touched),
    balances,
  };
}

function decodeUint(result) {
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result)) {
    fail(`invalid uint RPC result ${JSON.stringify(result)}`);
  }
  return BigInt(result).toString();
}

function decodeBool(result) {
  return decodeUint(result) !== "0";
}

function decodeString(result) {
  const hex = stripHexPrefix(result);
  const offset = Number(BigInt(`0x${hex.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`));
  return Buffer.from(hex.slice(offset + 64, offset + 64 + length * 2), "hex").toString(
    "utf8",
  );
}

function decodeAddressArray(result) {
  const hex = stripHexPrefix(result);
  const offset = Number(BigInt(`0x${hex.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`));
  const addresses = [];
  for (let index = 0; index < length; index++) {
    const start = offset + 64 + index * 64;
    addresses.push(`0x${hex.slice(start + 24, start + 64)}`.toLowerCase());
  }
  return addresses;
}

function decodeAddressUintTuple(result) {
  const hex = stripHexPrefix(result);
  return [
    `0x${hex.slice(24, 64)}`.toLowerCase(),
    BigInt(`0x${hex.slice(64, 128)}`).toString(),
  ];
}

function stripHexPrefix(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    fail(`invalid hex RPC result ${JSON.stringify(value)}`);
  }
  return value.slice(2);
}

function encodeAddress(address) {
  requireAddress(address, "encoded address");
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function topicAddress(topic) {
  return `0x${stripHexPrefix(topic).slice(-40)}`.toLowerCase();
}

function toQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function assertAddressSet(actual, expected, label) {
  const normalizedActual = actual.map((value) => value.toLowerCase());
  const normalizedExpected = expected.map((value) => value.toLowerCase());
  if (new Set(normalizedActual).size !== normalizedActual.length) {
    fail(`${label}: duplicate addresses in ${JSON.stringify(actual)}`);
  }
  assertDeepEqual(
    normalizedActual.sort(),
    unique(normalizedExpected).sort(),
    label,
  );
}

function unique(values) {
  return Array.from(new Set(values));
}

async function assertRpcParity(fixture, folio, graph) {
  const label = folio.label || folio.address;
  const block = fixture.minimumIndexedBlock;
  const address = folio.address;

  const version = decodeString(
    await ethCall(fixture.rpcUrl, address, SELECTOR.version, block),
  );
  assertEqual(graph.version, version, `${label}.version (RPC)`);

  const rpcSupply = decodeUint(
    await ethCall(fixture.rpcUrl, address, SELECTOR.totalSupply, block),
  );

  const logs = await rpcCall(fixture.rpcUrl, "eth_getLogs", [
    {
      address,
      fromBlock: toQuantity(folio.creationBlock),
      toBlock: toQuantity(block),
      topics: [TRANSFER_TOPIC],
    },
  ]);
  const accounting = replayTransfers(logs);
  const eventSupply = (
    BigInt(accounting.totalMinted) - BigInt(accounting.totalBurned)
  ).toString();
  assertEqual(
    graph.token.totalSupply,
    eventSupply,
    `${label}.token.totalSupply (Transfer logs)`,
  );
  if (BigInt(rpcSupply) < BigInt(eventSupply)) {
    fail(
      `${label}.token.totalSupply (RPC): ${rpcSupply} is below event-backed supply ${eventSupply}`,
    );
  }
  assertEqual(
    graph.token.totalMinted,
    accounting.totalMinted,
    `${label}.token.totalMinted (RPC logs)`,
  );
  assertEqual(
    graph.token.totalBurned,
    accounting.totalBurned,
    `${label}.token.totalBurned (RPC logs)`,
  );
  assertEqual(graph.token.mintCount, accounting.mintCount, `${label}.token.mintCount (RPC logs)`);
  assertEqual(graph.token.burnCount, accounting.burnCount, `${label}.token.burnCount (RPC logs)`);
  assertEqual(
    graph.token.transferCount,
    accounting.transferCount,
    `${label}.token.transferCount (RPC logs)`,
  );

  const graphBalances = new Map(
    graph.token.holdersBalance.map((balance) => [
      balance.account.id.toLowerCase(),
      String(balance.amount),
    ]),
  );
  if (graph.token.holdersBalance.length === 1000) {
    fail(`${label}: holder parity exceeded the 1000-row GraphQL safety limit`);
  }
  let currentHolderCount = 0;
  for (const holder of accounting.touched) {
    const rpcBalance = decodeUint(
      await ethCall(
        fixture.rpcUrl,
        address,
        SELECTOR.balanceOf + encodeAddress(holder),
        block,
      ),
    );
    const eventBalance = (accounting.balances.get(holder) || 0n).toString();
    assertEqual(
      graphBalances.get(holder) || "0",
      eventBalance,
      `${label}.balanceOf(${holder}) (Transfer logs)`,
    );
    if (BigInt(rpcBalance) < BigInt(eventBalance)) {
      fail(
        `${label}.balanceOf(${holder}) (RPC): ${rpcBalance} is below event-backed balance ${eventBalance}`,
      );
    }
    if (BigInt(eventBalance) > 0n) currentHolderCount++;
  }
  assertEqual(
    graph.token.currentHolderCount,
    currentHolderCount,
    `${label}.token.currentHolderCount (RPC)`,
  );

  await assertRoleParity(fixture.rpcUrl, address, block, graph, label, folio.governance);
  await assertFeeParity(fixture.rpcUrl, address, block, graph, version, label);
}

async function assertRoleParity(rpcUrl, address, block, graph, label, governance) {
  const admins = await readRoleMembers(rpcUrl, address, ROLE.defaultAdmin, block);
  const rebalanceManagers = await readRoleMembers(
    rpcUrl,
    address,
    ROLE.rebalanceManager,
    block,
  );
  const legacyApprovers = await readRoleMembers(
    rpcUrl,
    address,
    ROLE.auctionApprover,
    block,
  );
  const launchers = await readRoleMembers(
    rpcUrl,
    address,
    ROLE.auctionLauncher,
    block,
  );
  const brandManagers = await readRoleMembers(
    rpcUrl,
    address,
    ROLE.brandManager,
    block,
  );

  assertAddressSet(graph.admins, admins, `${label}.admins (RPC)`);
  assertAddressSet(
    graph.auctionApprovers,
    unique([...rebalanceManagers, ...legacyApprovers]),
    `${label}.auctionApprovers (RPC)`,
  );
  assertAddressSet(graph.auctionLaunchers, launchers, `${label}.auctionLaunchers (RPC)`);
  assertAddressSet(graph.brandManagers, brandManagers, `${label}.brandManagers (RPC)`);

  const links = expectedGovernanceLinks(governance, admins, [...rebalanceManagers, ...legacyApprovers]);
  assertEqual(graph.ownerGovernance?.id ?? null, links.ownerGovernance, `${label}.ownerGovernance (RPC)`);
  assertEqual(graph.tradingGovernance?.id ?? null, links.tradingGovernance, `${label}.tradingGovernance (RPC)`);
}

// The manifest pairs a scenario's governor with its timelock; RPC says which Folio roles that
// timelock holds at the state block. Owner = timelock is admin, trading = timelock manages rebalances.
function expectedGovernanceLinks(governance, admins, rebalanceManagers) {
  if (!governance) return { ownerGovernance: null, tradingGovernance: null };
  const timelock = governance.timelock.toLowerCase();
  const governor = governance.governor.toLowerCase();
  return {
    ownerGovernance: admins.includes(timelock) ? governor : null,
    tradingGovernance: rebalanceManagers.includes(timelock) ? governor : null,
  };
}

async function assertFeeParity(rpcUrl, address, block, graph, version, label) {
  const mintFee = decodeUint(await ethCall(rpcUrl, address, SELECTOR.mintFee, block));
  const tvlFee = decodeUint(await ethCall(rpcUrl, address, SELECTOR.tvlFee, block));
  assertEqual(graph.mintingFee, mintFee, `${label}.mintingFee (RPC)`);
  assertEqual(graph.tvlFee, tvlFee, `${label}.tvlFee (RPC)`);
  assertEqual(
    graph.feeRecipients,
    await readFeeRecipients(rpcUrl, address, SELECTOR.feeRecipients, block),
    `${label}.feeRecipients (RPC)`,
  );

  if (!version.startsWith("6.")) {
    const auctionLength = decodeUint(
      await ethCall(rpcUrl, address, SELECTOR.auctionLength, block),
    );
    assertEqual(graph.auctionLength, auctionLength, `${label}.auctionLength (RPC)`);
    return;
  }

  const maxAuctionLength = decodeUint(
    await ethCall(rpcUrl, address, SELECTOR.maxAuctionLength, block),
  );
  assertEqual(graph.maxAuctionLength, maxAuctionLength, `${label}.maxAuctionLength (RPC)`);
  assertEqual(graph.auctionLength, maxAuctionLength, `${label}.auctionLength compatibility`);
  assertEqual(
    graph.folioFeeForSelf,
    decodeUint(await ethCall(rpcUrl, address, SELECTOR.folioFeeForSelf, block)),
    `${label}.folioFeeForSelf (RPC)`,
  );
  assertEqual(
    graph.tradeAllowlistEnabled,
    decodeBool(await ethCall(rpcUrl, address, SELECTOR.tradeAllowlistEnabled, block)),
    `${label}.tradeAllowlistEnabled (RPC)`,
  );
  assertDeepEqual(
    graph.tradeTokenAllowlist,
    decodeAddressArray(await ethCall(rpcUrl, address, SELECTOR.getTokenAllowlist, block)),
    `${label}.tradeTokenAllowlist (RPC)`,
  );
  assertEqual(
    graph.immutableFeeRecipients || "",
    await readFeeRecipients(
      rpcUrl,
      address,
      SELECTOR.immutableFeeRecipients,
      block,
    ),
    `${label}.immutableFeeRecipients (RPC)`,
  );
}

function compareExpected(actual, expected, label) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = key.includes("Governance")
      ? actual[key] && actual[key].id
      : actual[key];
    if (Array.isArray(expectedValue)) {
      assertDeepEqual(actualValue, expectedValue, `${label}.${key}`);
    } else {
      assertEqual(actualValue, expectedValue, `${label}.${key}`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (normalize(actual) !== normalize(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const normalizedActual = (actual || []).map(normalize);
  const normalizedExpected = expected.map(normalize);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function normalize(value) {
  return typeof value === "string" ? value.toLowerCase() : String(value);
}

// Full profile unless FORK_PARITY_SCENARIOS names an explicit subset.
function selectProfile(scenarioList) {
  if (scenarioList === undefined || scenarioList.trim() === "") {
    return { name: "full", cases: Object.keys(CASE_EVIDENCE) };
  }
  const cases = scenarioList.split(",").map((name) => name.trim()).filter(Boolean);
  if (cases.length === 0) fail("FORK_PARITY_SCENARIOS names no scenarios");
  for (const name of cases) {
    if (!CASE_EVIDENCE[name]) {
      fail(`unknown parity scenario ${name}; known: ${Object.keys(CASE_EVIDENCE).join(", ")}`);
    }
  }
  if (unique(cases).length !== cases.length) fail("FORK_PARITY_SCENARIOS repeats a scenario");
  return { name: "subset", cases };
}

// Pure: validates the schema-v1 manifest against the profile and returns the cases to check.
// Every selected case must be present, bootstrapped (non-zero Folio) and carry its evidence.
function planParity(raw, profile) {
  if (raw.schemaVersion !== 1) {
    fail(`unsupported fixture schemaVersion ${JSON.stringify(raw.schemaVersion)}`);
  }
  if (!Number.isSafeInteger(raw.stateBlock) || raw.stateBlock < 0) {
    fail("schema v1 fixture requires a non-negative integer stateBlock");
  }
  if (!raw.scenarios || typeof raw.scenarios !== "object") {
    fail("schema v1 fixture requires scenarios");
  }
  if (raw.chainId !== 1) fail(`schema v1 fixture requires chainId 1, got ${raw.chainId}`);
  if (
    typeof raw.rpcUrl !== "string" ||
    !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/.test(raw.rpcUrl)
  ) {
    fail("schema v1 fixture rpcUrl must be a loopback HTTP endpoint");
  }

  for (const name of Object.keys(raw.scenarios)) {
    if (!CASE_EVIDENCE[name]) {
      fail(`fixture scenario ${name} is not a known parity case; add it to CASE_EVIDENCE`);
    }
  }
  const missing = profile.cases.filter((name) => {
    const scenario = raw.scenarios[name];
    return !scenario || isZeroAddress(scenario.folio);
  });
  if (missing.length > 0) {
    fail(
      `${profile.name} profile requires ${profile.cases.join(", ")}; missing or not bootstrapped: ${missing.join(", ")}`,
    );
  }

  const cases = profile.cases.map((name) => planCase(name, raw.scenarios[name], raw));
  return {
    profile: profile.name,
    rpcUrl: raw.rpcUrl,
    minimumIndexedBlock: raw.stateBlock,
    cases,
    skipped: Object.keys(raw.scenarios).filter((name) => !profile.cases.includes(name)),
  };
}

function planCase(name, scenario, raw) {
  requireAddress(scenario.folio, `${name}.folio`);
  requireAddress(scenario.proxyAdmin, `${name}.proxyAdmin`);
  if (typeof scenario.expectedVersion !== "string") {
    fail(`schema v1 scenario ${name} requires expectedVersion`);
  }
  if (
    !Number.isSafeInteger(scenario.creationBlock) ||
    scenario.creationBlock < raw.forkBlock ||
    scenario.creationBlock > raw.stateBlock
  ) {
    fail(`schema v1 scenario ${name} has an invalid creationBlock`);
  }

  const evidence = CASE_EVIDENCE[name];
  const hasUpgrade = Number(scenario.upgradeBlock || 0) > 0;
  if (evidence === "upgrade" && !hasUpgrade) {
    fail(`schema v1 scenario ${name} requires upgrade evidence (upgradeBlock and proposal)`);
  }
  if (evidence === "execution" && !scenario.execution) {
    fail(`schema v1 scenario ${name} requires execution evidence`);
  }

  return {
    name,
    folio: {
      label: name,
      address: scenario.folio,
      creationBlock: scenario.creationBlock,
      governance: planGovernance(name, scenario),
      expected: {
        version: scenario.expectedVersion,
        proxyAdmin: scenario.proxyAdmin,
      },
    },
    proposal: hasUpgrade ? normalizeScenarioProposal(name, scenario) : null,
    execution: scenario.execution ? normalizeExecutionScenario(name, scenario, raw) : null,
  };
}

function planGovernance(name, scenario) {
  if (scenario.governance === undefined || isZeroAddress(scenario.governance)) return null;
  const addresses = scenario.governanceAddresses || {};
  requireAddress(addresses.governor, `${name}.governanceAddresses.governor`);
  requireAddress(addresses.timelock, `${name}.governanceAddresses.timelock`);
  if (addresses.governor.toLowerCase() !== scenario.governance.toLowerCase()) {
    fail(`schema v1 scenario ${name} governance does not match governanceAddresses.governor`);
  }
  return { governor: addresses.governor, timelock: addresses.timelock };
}

// Reconciles selected/passed/failed/skipped. Only a clean full run reports a full-suite pass.
function summarizeResults(plan, results) {
  const selected = plan.cases.map((parityCase) => parityCase.name);
  const passed = results.filter((result) => result.passed).map((result) => result.name);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  const reported = [...passed, ...failed].sort();
  const counts = `${selected.length} selected, ${passed.length} passed, ${failed.length} failed, ${plan.skipped.length} skipped`;

  if (JSON.stringify(reported) !== JSON.stringify([...selected].sort())) {
    return {
      passed: false,
      message: `case accounting mismatch (${counts}): ran ${reported.join(", ") || "nothing"}, selected ${selected.join(", ")}`,
    };
  }
  if (selected.length === 0 || failed.length > 0) {
    return {
      passed: false,
      message: `${plan.profile} profile failed (${counts}): ${failed.join(", ") || "no cases"}`,
    };
  }
  const upgrades = plan.cases.filter((parityCase) => parityCase.proposal).length;
  const executions = plan.cases.filter((parityCase) => parityCase.execution).length;
  const coverage = `${selected.length} Folios, ${upgrades} upgrade proposals, ${executions} execution flows (${counts})`;
  if (plan.profile === "full") {
    return { passed: true, message: `Fork parity FULL profile passed: ${coverage}` };
  }
  return {
    passed: true,
    message: `Fork parity SUBSET passed for ${selected.join(", ")} only: ${coverage}; this does not certify the full suite`,
  };
}

function normalizeExecutionScenario(name, scenario, raw) {
  const execution = scenario.execution;
  const required = [
    "rebalanceNonce",
    "rebalanceTxHash",
    "rebalanceBlock",
    "auctionId",
    "auctionTxHash",
    "auctionBlock",
    "auctionLength",
    "tokens",
  ];
  for (const field of required) {
    if (execution[field] === undefined || execution[field] === null) {
      fail(`schema v1 execution scenario ${name} requires ${field}`);
    }
  }
  if (!Array.isArray(execution.tokens) || execution.tokens.length < 2) {
    fail(`schema v1 execution scenario ${name} requires at least two tokens`);
  }
  execution.tokens.forEach((token, index) =>
    requireAddress(token, `${name}.execution.tokens[${index}]`),
  );
  for (const field of ["rebalanceBlock", "auctionBlock"]) {
    if (
      !Number.isSafeInteger(execution[field]) ||
      execution[field] < scenario.creationBlock ||
      execution[field] > raw.stateBlock
    ) {
      fail(`schema v1 execution scenario ${name} has invalid ${field}`);
    }
  }
  if (execution.rebalanceBlock >= execution.auctionBlock) {
    fail(`schema v1 execution scenario ${name} has unordered execution blocks`);
  }
  const normalized = {
    name,
    address: scenario.folio,
    governance: scenario.governance,
    governanceAddresses: scenario.governanceAddresses,
    expectedVersion: scenario.expectedVersion,
    expected: execution,
    execution,
    rebalanceSelector: name === "v5Control" ? raw.protocol.startRebalanceSelectors.v5 : null,
    proposalRebalanceSelector: null,
    auctionSelector: name === "v5Control" ? "0x3c46570f" : "0x9bd97b3e",
  };
  if (name === "v6Native") {
    if (
      execution.governanceMechanism !== "optimistic" ||
      !execution.authority ||
      !execution.rebalanceProposal
    ) {
      fail("schema v1 v6Native execution requires optimistic governance evidence");
    }
    normalized.proposalRebalanceSelector = raw.protocol.startRebalanceSelectors.v6;
  }
  return normalized;
}

function normalizeScenarioProposal(name, scenario) {
  const proposal = scenario.proposal || {};
  const id = proposal.id ?? proposal.proposalId ?? scenario.proposalId;
  const targets = proposal.targets ?? scenario.proposalTargets;
  const values = proposal.values ?? scenario.proposalValues;
  const calldatas = proposal.calldatas ?? scenario.proposalCalldatas;

  const missing = [];
  if (id === undefined || id === null || id === "") missing.push("proposal id");
  if (!Array.isArray(targets)) missing.push("targets");
  if (!Array.isArray(values)) missing.push("values");
  if (!Array.isArray(calldatas)) missing.push("calldatas");
  if (missing.length > 0) {
    fail(
      `schema v1 upgrade scenario ${name} is missing ${missing.join(
        ", ",
      )}; regenerate the canonical manifest with proposal details`,
    );
  }
  if (proposal.kind && proposal.kind !== "standard") {
    fail(`schema v1 scenario ${name} must use a standard proposal`);
  }
  if (proposal.optimistic === true) {
    fail(`schema v1 scenario ${name} must not use an optimistic proposal`);
  }

  const expectedCallCount = Number(scenario.proposalCallCount || targets.length);
  if (
    targets.length !== expectedCallCount ||
    values.length !== expectedCallCount ||
    calldatas.length !== expectedCallCount
  ) {
    fail(
      `schema v1 scenario ${name} expected ${expectedCallCount} proposal calls, got targets=${targets.length}, values=${values.length}, calldatas=${calldatas.length}`,
    );
  }

  return {
    id: String(id),
    expected: {
      state: proposal.state || scenario.proposalState || "EXECUTED",
      // Both v5 -> v6 topologies must use the standard propose(...) path.
      isOptimistic: false,
      targets,
      values,
      calldatas,
    },
    calldataSelectors:
      proposal.selectors || calldatas.map((calldata) => calldata.slice(0, 10)),
  };
}

function requireAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    fail(`schema v1 ${label} must be an Ethereum address`);
  }
}

function isZeroAddress(value) {
  return value === "0x0000000000000000000000000000000000000000";
}

function fail(message) {
  throw new Error(`Fork parity failed: ${message}`);
}
