# Mainnet fork indexing

The fork manifest lists the v5 deployers statically and the `FolioVersionRegistry` at the fork block; the sandbox
registers its locally deployed 6.0.0 `FolioDeployer` on that registry, so the v6 Folios are discovered through the
registry template exactly as they will be on mainnet.

This profile indexes contracts and transactions created on a local Ethereum
mainnet fork. It is deliberately separate from `networks.json`, which remains
the production deployment configuration.

## Contract fixture handshake

The protocol fixture must publish at least:

- `FORK_BLOCK`: the block passed to Anvil's `--fork-block-number`.
- `V6_FOLIO_DEPLOYER_ADDRESS`: the locally deployed 6.0 FolioDeployer.

The profile defaults to the production Ethereum 5.0 FolioDeployer, 5.0
GovernanceDeployer, ReserveOptimisticGovernorDeployer, and RSR addresses. They
can be overridden with `V5_FOLIO_DEPLOYER_ADDRESS`,
`V5_GOVERNANCE_DEPLOYER_ADDRESS`, and
`OPTIMISTIC_GOVERNOR_DEPLOYER_ADDRESS`.

The v6 deployment fixture may run before the subgraph is deployed. Test flows
that create Folios must run only after the fork block; Graph Node will replay
those local blocks after deployment.

Start Anvil first, then deploy the protocol fixture and export the resulting
v6 FolioDeployer address:

```bash
export MAINNET_RPC_URL=https://your-mainnet-archive-rpc.example
# Reviewed fixture block used by the v6 spell fork suite. Change it only with
# the matching protocol fixture and address manifest.
export FORK_BLOCK=25834864

docker compose -f docker-compose.yml -f docker-compose.fork.yml up -d anvil

# Run the protocol fixture against http://localhost:8545, then:
export V6_FOLIO_DEPLOYER_ADDRESS=0x0000000000000000000000000000000000000001
```

## Generate and validate the manifest

```bash
pnpm prepare:fork

pnpm parse:fork
pnpm codegen:fork
pnpm build:fork
```

The generated `.fork/networks.json` and `subgraph.fork.yaml` are ignored. Both
the production v5 and local v6 FolioDeployers start at `FORK_BLOCK`, so Graph
Node observes only deployments made by the test fixture and does not replay
years of mainnet history.

## Run Anvil and Graph Node

After generating the manifest, start Graph Node. Compose starts its Postgres and
IPFS dependencies and waits for the Anvil healthcheck:

```bash
GRAPH_IPFS_DATA=.fork/data/ipfs \
GRAPH_POSTGRES_DATA=.fork/data/postgres \
docker compose -f docker-compose.yml -f docker-compose.fork.yml up -d graph-node
pnpm create-local:fork
pnpm deploy-local:fork
```

Anvil uses chain ID 1, twenty deterministic accounts derived from the standard
public test mnemonic, and deterministic automining so each transaction is indexed
between test transactions. The fork RPC is exposed on host port 8545 by default;
set `ANVIL_PORT` to change only the host-side port. These accounts are public and
must never hold real assets.

Anvil writes its current chain state to `.fork/data/anvil`, alongside the Graph
stack's fork-specific data. Anvil 1.5.1 does not reliably restore the local
historical snapshots needed by block-pinned upgrade assertions after a full
Compose `down`/`up`. Use the guarded sandbox `reset` + `all` workflow for a full
SDK replay, and reset or archive all three stores together; never reuse only one
side.

The reviewed defaults are `ghcr.io/foundry-rs/foundry:v1.5.1` and
`graphprotocol/graph-node:v0.45.0`. They remain overridable through
`ANVIL_IMAGE` and `GRAPH_NODE_IMAGE`; record the resolved image digests alongside
the protocol, SDK, subgraph commits, and `FORK_BLOCK` in CI evidence.

Wait for the services before deploying the subgraph:

```bash
docker compose -f docker-compose.yml -f docker-compose.fork.yml ps
docker compose -f docker-compose.yml -f docker-compose.fork.yml logs anvil graph-node
```

The fork profile uses conflict-resistant host ports: GraphQL `18000`, Graph Node
admin `18020`, indexing status `18030`, metrics `18040`, and IPFS API `15001`.
Postgres is not exposed to the host. Override any `FORK_*_PORT` variable when
needed. Every exposed port is bound to `127.0.0.1`, not the LAN. The query endpoint is
`http://localhost:18000/subgraphs/name/dtf-index-subgraph-fork`; the indexing
status endpoint is `http://localhost:18030/graphql`.

The Foundry image runs natively on Apple Silicon. The default Graph Node image
is pinned to `linux/amd64` because it currently lacks an arm64 image, so Docker
uses emulation and startup/indexing is slower. Set `GRAPH_NODE_IMAGE` and
`GRAPH_NODE_PLATFORM` to a reviewed native-compatible image/platform when one
is available.

CPU and memory limits, Ethereum polling, entity cache, and query cache are
configurable through the `*_CPUS`, `*_MEMORY`,
`GRAPH_ETHEREUM_POLLING_INTERVAL_MS`, `GRAPH_ENTITY_CACHE_SIZE_KB`,
`GRAPH_QUERY_CACHE_BLOCKS`, `GRAPH_QUERY_CACHE_MAX_MEM_MB`, and
`GRAPH_ETHEREUM_CLEANUP_BLOCKS` variables. The default two-second poll interval
detects explicitly mined Anvil blocks without constant RPC polling, and cleanup
is enabled to bound Graph Node's block cache in this disposable fork stack.
The defaults favor a small local/CI stack. `GRAPH_POI_ACCESS_TOKEN` defaults to
a known local-only value and must be overridden anywhere beyond this
loopback-only test profile.

`graph create` fails when the name already exists; that is harmless on a
redeploy. A completely new Anvil fork must use a fresh Graph Node database. The
fork-specific paths above isolate it from the normal local profile; replace or
remove `.fork/data` only while this Compose stack is stopped. Do not reuse a
Postgres chain store across forks with different fork blocks or upstream state.

Stop this profile with:

```bash
docker compose -f docker-compose.yml -f docker-compose.fork.yml down
```

### Ephemeral CI storage

CI can add the tmpfs overlay to avoid persistent Graph/IPFS state and host disk
growth:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.fork.yml \
  -f docker-compose.fork-ci.yml \
  up -d graph-node
```

It replaces the Anvil, Postgres, and IPFS data mounts with bounded in-memory
filesystems (256 MB, 768 MB, and 256 MB by default). Override
`FORK_CI_ANVIL_TMPFS_SIZE`, `FORK_CI_POSTGRES_TMPFS_SIZE`, or
`FORK_CI_IPFS_TMPFS_SIZE` when required. All
indexed state disappears when the containers stop, making this profile suitable
for clean CI runs but not local debugging. The normal fork overlay keeps bind
mount persistence and never prunes unrelated Docker data.

## Supported fork scenarios

The deployer data sources create dynamic templates for every Folio, staking
vault, governor, and timelock emitted after `FORK_BLOCK`. This supports:

1. Deploy a new 5.0 Folio through the production v5 deployer, then execute the
   standard-governance v5-to-v6 spell.
2. Deploy a new 6.0 Folio through the local v6 deployer.
3. Exercise standard and optimistic governance and query the resulting
   proposal, vote, timelock, rebalance, auction, transfer, and fee entities.

An implementation upgrade keeps the Folio proxy address, so the existing DTF
dynamic data source continues indexing compatible events after the spell
executes. Once v6 handlers are declared in the manifest, the same template also
receives those new event signatures; no replacement data source is needed.

For each transaction-driven assertion, first query `_meta` and wait until the
indexed block is at least the transaction receipt's block with
`hasIndexingErrors: false`. The minimum scenario assertions are:

- one DTF entity per proxy address, with its ProxyAdmin, staking token, unified
  governance, and timelock linked;
- a standard upgrade `Proposal` whose targets, zero values, and calldata preserve
  the exact two-call or four-call spell order, and whose final state is
  `EXECUTED`;
- the upgraded Folio remains the same DTF entity and subsequently indexes v6
  rebalance, auction, transfer, and fee events;
- a directly deployed v6 Folio creates the same entity and governance graph
  without relying on any v5-only address or event signature.

The fixture runner turns those GraphQL checks into a repeatable gate. It consumes
the same schema-v1 manifest produced by the protocol sandbox (`stateBlock` and
`scenarios`), so the chain fixture, SDK assertions, and subgraph assertions have
one source of truth. The default sandbox writes it to `.fork/fixture.json`:

```bash
INDEX_DTF_FORK_MANIFEST=.fork/fixture.json pnpm test:fork:parity
```

The manifest may also be passed as the first command argument. Set
`FORK_SUBGRAPH_URL` when using non-default ports. Upgrade scenarios must include
their proposal ID, targets, values, and calldatas; the checker fails explicitly
when these fields have not yet been emitted. It asserts those exact calls and
their ordered selectors, including standard-proposal semantics for both the
optimistic four-call topology and legacy two-call topology.

## Important boundary

Existing Folios deployed before `FORK_BLOCK` are not discovered by this fast
profile because their deployer events predate every configured data source.
Use a Folio freshly deployed on the fork for the v5-to-v6 scenario. Testing a
specific pre-existing Folio requires either replaying from its original deploy
block or adding explicit static sources for the Folio and all of its governance
contracts.

In both v5 and v6 the Folio initializer, seed transfer, settings events, basket
events, and initial role events run before `FolioDeployed`. Graph Node replays
the matching creation-block logs after the deployer handler creates the dynamic
DTF template. The deployer mapping therefore hydrates only `version()`, which
has no initialization event; hydrating event-backed supply, balances, roles, or
settings there would double-count them. The proxy's later `Upgraded` event does
trigger getter rehydration of settings, preserving one DTF ID across the 5.0 to 6.0
flow while populating newly available v6 state. Role arrays are never rehydrated:
getters return the block's final state, which already includes grants later in the
upgrade transaction, so their `RoleGranted` handlers would add them twice.

The v6 mappings cover max auction length, self Folio fee and pending fee shares,
immutable fee recipients, and trade-allowlist settings. `auctionLength` is kept
populated from `maxAuctionLength` on v6 so existing GraphQL consumers remain
compatible while migrating to the new nullable field.

Fork parity pins both RPC calls and GraphQL assertions to the fixture's
`stateBlock`, including token supply/mint accounting, balances, roles, and fee
configuration. This catches accidental creation-block replay changes instead
of relying on current-head state.
