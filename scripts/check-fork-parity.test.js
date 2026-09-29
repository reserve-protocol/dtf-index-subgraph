// Offline tests for the fork parity gate's case accounting. No Anvil or Graph Node needed:
// profile selection, manifest planning and result reconciliation are pure.
// Run with `pnpm test:fork:parity:offline`.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");
const {
  selectProfile,
  planParity,
  summarizeResults,
  expectedGovernanceLinks,
} = require("./check-fork-parity.js");

const FULL_FIXTURE = path.join(__dirname, "fixtures/fork-parity-full.json");
// The 2026-09-21 audit repro: a real manifest with `scenarios: {}`. It used to exit 0.
const EMPTY_FIXTURE = path.join(__dirname, "fixtures/fork-parity-empty-scenarios.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function fullFixture() {
  return structuredClone(require(FULL_FIXTURE));
}

function passAll(plan) {
  return plan.cases.map((parityCase) => ({ name: parityCase.name, passed: true }));
}

test("full profile plans every case with its evidence", () => {
  const plan = planParity(fullFixture(), selectProfile(undefined));

  assert.equal(plan.profile, "full");
  assert.deepEqual(
    plan.cases.map((parityCase) => parityCase.name),
    ["v5Control", "v5OptimisticUpgrade", "v5LegacyUpgrade", "v6Native"],
  );
  assert.equal(plan.cases.filter((parityCase) => parityCase.proposal).length, 2);
  assert.equal(plan.cases.filter((parityCase) => parityCase.execution).length, 2);
  assert.deepEqual(plan.skipped, []);
  assert.match(summarizeResults(plan, passAll(plan)).message, /^Fork parity FULL profile passed: 4 Folios, 2 upgrade proposals, 2 execution flows \(4 selected, 4 passed, 0 failed, 0 skipped\)$/);
});

test("full profile rejects the empty-scenario fixture from the audit", () => {
  const empty = require(EMPTY_FIXTURE);
  assert.deepEqual(empty.scenarios, {});
  assert.throws(
    () => planParity(empty, selectProfile(undefined)),
    /full profile requires .*missing or not bootstrapped: v5Control, v5OptimisticUpgrade, v5LegacyUpgrade, v6Native/,
  );
});

test("full profile rejects a missing upgrade", () => {
  const withoutScenario = fullFixture();
  delete withoutScenario.scenarios.v5LegacyUpgrade;
  assert.throws(
    () => planParity(withoutScenario, selectProfile(undefined)),
    /missing or not bootstrapped: v5LegacyUpgrade$/,
  );

  const withoutEvidence = fullFixture();
  delete withoutEvidence.scenarios.v5OptimisticUpgrade.upgradeBlock;
  assert.throws(
    () => planParity(withoutEvidence, selectProfile(undefined)),
    /v5OptimisticUpgrade requires upgrade evidence/,
  );
});

test("full profile rejects a missing execution", () => {
  const withoutEvidence = fullFixture();
  delete withoutEvidence.scenarios.v6Native.execution;
  assert.throws(
    () => planParity(withoutEvidence, selectProfile(undefined)),
    /v6Native requires execution evidence/,
  );

  const withoutScenario = fullFixture();
  delete withoutScenario.scenarios.v5Control;
  assert.throws(
    () => planParity(withoutScenario, selectProfile(undefined)),
    /missing or not bootstrapped: v5Control$/,
  );
});

test("full profile rejects a scenario the sandbox did not bootstrap", () => {
  // SANDBOX_SCENARIOS subsets leave the other scenarios with a zero Folio.
  const fixture = fullFixture();
  fixture.scenarios.v5LegacyUpgrade.folio = ZERO_ADDRESS;
  assert.throws(
    () => planParity(fixture, selectProfile(undefined)),
    /missing or not bootstrapped: v5LegacyUpgrade$/,
  );
});

test("an unknown fixture scenario fails instead of being skipped", () => {
  const fixture = fullFixture();
  fixture.scenarios.bscNative = fixture.scenarios.v6Native;
  assert.throws(
    () => planParity(fixture, selectProfile(undefined)),
    /bscNative is not a known parity case/,
  );
});

test("a subset profile is explicit and never reports a full-suite pass", () => {
  const fixture = fullFixture();
  fixture.scenarios.v5LegacyUpgrade.folio = ZERO_ADDRESS;
  const plan = planParity(fixture, selectProfile("v5Control, v6Native"));

  assert.equal(plan.profile, "subset");
  assert.deepEqual(plan.cases.map((parityCase) => parityCase.name), ["v5Control", "v6Native"]);
  assert.deepEqual(plan.skipped, ["v5OptimisticUpgrade", "v5LegacyUpgrade"]);
  const summary = summarizeResults(plan, passAll(plan));
  assert.equal(summary.passed, true);
  assert.equal(
    summary.message,
    "Fork parity SUBSET passed for v5Control, v6Native only: 2 Folios, 0 upgrade proposals, 2 execution flows (2 selected, 2 passed, 0 failed, 2 skipped); this does not certify the full suite",
  );
  assert.doesNotMatch(summary.message, /FULL/);
});

test("a subset still requires its own cases and evidence", () => {
  assert.throws(
    () => planParity(require(EMPTY_FIXTURE), selectProfile("v6Native")),
    /subset profile requires v6Native; missing or not bootstrapped: v6Native/,
  );
  const fixture = fullFixture();
  delete fixture.scenarios.v5Control.execution;
  assert.throws(
    () => planParity(fixture, selectProfile("v5Control")),
    /v5Control requires execution evidence/,
  );
});

test("subset selection rejects unknown, repeated and empty lists", () => {
  assert.throws(() => selectProfile("v5Control,v7Native"), /unknown parity scenario v7Native/);
  assert.throws(() => selectProfile("v5Control,v5Control"), /repeats a scenario/);
  assert.throws(() => selectProfile(" , "), /names no scenarios/);
  assert.equal(selectProfile("").name, "full");
});

test("results reconcile against the selected cases", () => {
  const plan = planParity(fullFixture(), selectProfile(undefined));

  const oneFailed = passAll(plan);
  oneFailed[3] = { name: "v6Native", passed: false, message: "boom" };
  assert.deepEqual(summarizeResults(plan, oneFailed), {
    passed: false,
    message: "full profile failed (4 selected, 3 passed, 1 failed, 0 skipped): v6Native",
  });

  const oneMissing = passAll(plan).slice(0, 3);
  const missingSummary = summarizeResults(plan, oneMissing);
  assert.equal(missingSummary.passed, false);
  assert.match(missingSummary.message, /^case accounting mismatch \(4 selected, 3 passed, 0 failed, 0 skipped\)/);

  const noCases = { profile: "full", cases: [], skipped: [] };
  assert.equal(summarizeResults(noCases, []).passed, false);
});

test("governance links follow the roles the scenario's timelock holds", () => {
  const governance = {
    governor: "0xBf39A799ef57E712b88419CC254e002dd167a94C",
    timelock: "0xF35B864552c26D4581Ab3973207556FdC43EdDfb",
  };
  const timelock = governance.timelock.toLowerCase();
  const governor = governance.governor.toLowerCase();
  const actor = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

  // Optimistic topology: the timelock is both admin and rebalance manager.
  assert.deepEqual(expectedGovernanceLinks(governance, [timelock], [timelock]), {
    ownerGovernance: governor,
    tradingGovernance: governor,
  });
  // Legacy sandbox topology: an EOA manages rebalances, so no trading governance.
  assert.deepEqual(expectedGovernanceLinks(governance, [timelock], [actor]), {
    ownerGovernance: governor,
    tradingGovernance: null,
  });
  // Ungoverned control Folio.
  assert.deepEqual(expectedGovernanceLinks(null, [actor], [actor]), {
    ownerGovernance: null,
    tradingGovernance: null,
  });
});

test("the manifest pairs every governed scenario with its governor and timelock", () => {
  const plan = planParity(fullFixture(), selectProfile(undefined));
  const governanceByCase = Object.fromEntries(
    plan.cases.map((parityCase) => [parityCase.name, parityCase.folio.governance]),
  );
  assert.equal(governanceByCase.v5Control, null);
  for (const name of ["v5OptimisticUpgrade", "v5LegacyUpgrade", "v6Native"]) {
    assert.ok(governanceByCase[name].governor && governanceByCase[name].timelock, name);
  }

  const mismatched = fullFixture();
  mismatched.scenarios.v6Native.governance = mismatched.scenarios.v5LegacyUpgrade.governance;
  assert.throws(
    () => planParity(mismatched, selectProfile(undefined)),
    /v6Native governance does not match governanceAddresses.governor/,
  );
});

test("the CLI rejects the empty fixture before touching the network", () => {
  // Port 9 (discard) is never a Graph Node; reaching it would fail with a fetch error instead.
  const result = spawnSync(process.execPath, [path.join(__dirname, "check-fork-parity.js"), EMPTY_FIXTURE], {
    env: {
      ...process.env,
      FORK_PARITY_SCENARIOS: "",
      FORK_SUBGRAPH_URL: "http://127.0.0.1:9/subgraphs/name/none",
      FORK_GRAPH_STATUS_URL: "http://127.0.0.1:9/graphql",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Fork parity failed: full profile requires .*missing or not bootstrapped/);
  assert.doesNotMatch(result.stdout, /passed/);
});
