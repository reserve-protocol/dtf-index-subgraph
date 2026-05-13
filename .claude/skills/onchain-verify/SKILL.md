---
name: onchain-verify
description: Write ad-hoc viem scripts to verify on-chain events and contract state when investigating subgraph mismatches, missed events, or deployment timing questions. Use this when comparing indexer output against the actual chain — e.g., "where did this event fire", "when was this contract deployed", "did the deployer event we expect actually exist". Triggers on questions about missing/mismatched indexed data, mysterious deployer addresses, or graft-related coverage gaps.
---

# On-chain verification with viem

A pragmatic playbook for writing one-shot viem scripts to cross-check chain state vs. subgraph state. Used when something doesn't add up — entities are missing, counts are off, or you suspect a missed deployer event.

## When to reach for this

- Subgraph entity counts don't match what's expected (e.g. `delegatedVotes: 0` despite active proposals)
- Need to find when a contract was deployed (binary-search bytecode)
- Need to identify an unknown event signature (`topic0` hash → name guess)
- Verifying graft coverage: did the events we care about fire before/after the graft block?
- Cross-checking a suspect deployer address against known deployers in `networks.json`

## Setup pattern (no permanent install)

Use `--no-save` so the temp dep doesn't pollute `package.json`. ESM script with `.mjs` extension.

```bash
npm install --no-save viem@2
node scripts/verify-something.mjs
# when done:
rm -rf node_modules/viem node_modules/abitype node_modules/ws node_modules/isows
# or just `npm prune` if package.json is clean
```

For a project that already has viem, skip the install.

## Script skeleton

```js
import { createPublicClient, http, fallback, parseAbiItem } from "viem";
import { base } from "viem/chains"; // or mainnet, optimism, etc.

const client = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://base.gateway.tenderly.co"),     // ← lead with a reliable one
    http("https://base-rpc.publicnode.com"),      // ← fallback
  ]),
});
```

## RPC gotchas learned the hard way

**Some public RPCs (e.g. base-rpc.publicnode.com) silently return `[]` for `eth_getLogs` queries they don't want to serve.** No error, no rate-limit message, just empty results. This is the single most likely reason a "correct" script returns nothing.

→ Always lead with **tenderly** (`https://base.gateway.tenderly.co`, `https://mainnet.gateway.tenderly.co`, etc.) when running getLogs. Fall back to others only for sanity.

**Block-range limit: 50,000.** Public RPCs reject `eth_getLogs` over a 50k block range:

```
exceed maximum block range: 50000
```

→ Chunk loops in steps of `≤ 10000n` (or `50000n` if you want to push it). Helper:

```js
async function getLogsChunked(args, chunk = 10000n) {
  const all = [];
  for (let from = args.fromBlock; from <= args.toBlock; from += chunk) {
    const to = from + chunk - 1n > args.toBlock ? args.toBlock : from + chunk - 1n;
    const logs = await client.getLogs({ ...args, fromBlock: from, toBlock: to });
    all.push(...logs);
  }
  return all;
}
```

## Common queries

### Get logs for a specific event with args filter

```js
const evt = parseAbiItem(
  "event FolioDeployed(address indexed folioOwner, address indexed folio, address folioAdmin)"
);
const logs = await getLogsChunked({
  address: DEPLOYER_ADDRESS,
  event: evt,
  args: { folio: DTF_ADDRESS },
  fromBlock: 45040000n,
  toBlock: 45200000n,
});
```

`args` filtering uses indexed parameters only.

### Raw topic-only filter (when you don't know the event yet)

```js
const logs = await getLogsChunked({
  address: CONTRACT,
  fromBlock: from,
  toBlock: to,
});
// inspect topic0:
for (const l of logs) console.log(l.blockNumber, l.topics[0], l.topics.length);
```

### Find when a contract was deployed (binary search on bytecode)

```js
let lo = 25_000_000n, hi = CURRENT_BLOCK;
while (hi - lo > 1n) {
  const mid = (lo + hi) / 2n;
  const code = await client.getCode({ address: CONTRACT, blockNumber: mid });
  if (code && code.length > 2) hi = mid; else lo = mid;
}
console.log("deployed at block:", hi);
```

### Identify an unknown `topic0`

Compute keccak256 of candidate signatures and compare. The Reserve protocol often uses non-standard event names — guess broadly.

```js
import { keccak256, toBytes } from "viem";
const target = "0x92f46afc87b173381dda20d5aff23e07c3d76e43114603d9f6adb58b20bad7c3";
const candidates = [
  "DeployedGovernedStakingToken(address,address,address,address)",
  "GovernedStakingTokenDeployed(address,address,address,address)",
  "GovernanceDeployed(address,address,address,address)",
  // ... etc
];
for (const sig of candidates) {
  const h = keccak256(toBytes(sig));
  console.log(h.slice(0, 12), sig, h === target ? "★ MATCH" : "");
}
```

If nothing matches, look at the topic count + data shape to narrow:
- `topics.length === 4` → 3 indexed args
- `data.length` (bytes minus `0x`) / 64 → number of non-indexed args
- Check 4byte.directory or basescan if available

### Find who deployed a contract (parent contract / factory)

Get all logs in the deployment block, filter by topic that includes the contract address as a topic:

```js
const stTokenTopic = "0x000000000000000000000000" + CONTRACT.slice(2);
const logs = await client.getLogs({ fromBlock: DEPLOY_BLOCK, toBlock: DEPLOY_BLOCK });
const related = logs.filter(l => l.topics.includes(stTokenTopic));
for (const l of related) console.log("emitter:", l.address, "topic0:", l.topics[0]);
```

The emitter address is your factory/deployer candidate.

## Output format

Print a compact table with a `BEFORE-GRAFT ⚠️` / `after-graft ✓` tag per event when investigating graft coverage. Helps spot at a glance which events fell into the gap:

```js
const GRAFT_BLOCK = 45049500n;
const tag = (bn) => bn < GRAFT_BLOCK ? "BEFORE-GRAFT ⚠️" : "after-graft ✓";
console.log(`  DelegateChanged @ ${l.blockNumber} [${tag(l.blockNumber)}]`);
```

## Cross-checking with the subgraph

After getting on-chain truth, query the subgraph for the same entity to confirm the mismatch. Use Goldsky's public endpoint:

```
https://api.goldsky.com/api/public/<project_id>/subgraphs/<name>/<version>/gn
```

```bash
curl -s -X POST <endpoint> \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ dtf(id: \"0x...\") { id stToken { id } } _meta { block { number } hasIndexingErrors } }"}'
```

Always include `_meta { block { number } hasIndexingErrors }` — if `hasIndexingErrors: true`, queries return `{"errors":[{"message":"indexing_error"}]}` and no data; that's the signal the subgraph crashed, not that the entity is missing.

## Cleanup

When the investigation is done, remove the script and the temp install:

```bash
rm scripts/verify-*.mjs
rm -rf node_modules/viem node_modules/abitype
```

Or leave the script in `scripts/` if it's useful as a recurring diagnostic — but only if it answers a question you'll ask again.

## Reserve / DTF subgraph specifics

- Known deployer addresses live in `networks.json` (`FolioDeployer`, `GovernanceDeployer` arrays per network)
- Tracked event signatures live in `subgraph.yaml.mustache`
- If a chain contract emits a topic0 that matches neither known deployer nor known event sig, that's a clue you have an **untracked deployer** — flag it for the user
- Graft block lives in `networks.json` under `<network>.grafting.block`; use it as the BEFORE/after divider
