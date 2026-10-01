#!/usr/bin/env node
// Compares every DTF field two Goldsky deployments share, at a block both have indexed, and reports the
// newer deployment's health. Run it after a grafted deploy has synced, before tagging anything.
//
//   node scripts/graft-parity.mjs <mainnet|base|bsc> <baseVersion> <newVersion>
//   node scripts/graft-parity.mjs base 1.11.0 1.11.1-test
//
// Fields only one side has (e.g. the ones the new release adds) are listed, not compared.
// Exits 1 on any difference, a missing DTF, or indexing errors on either side.
const [net, baseVersion, newVersion] = process.argv.slice(2);
if (!net || !baseVersion || !newVersion) {
  console.error("usage: node scripts/graft-parity.mjs <mainnet|base|bsc> <baseVersion> <newVersion>");
  process.exit(2);
}

const PROJECT = process.env.GOLDSKY_PROJECT || "project_cmgzim3e100095np2gjnbh6ry";
const url = (version) =>
  `https://api.goldsky.com/api/public/${PROJECT}/subgraphs/dtf-index-${net}/${version}/gn`;

async function query(version, text) {
  const response = await fetch(url(version), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: text }),
  });
  const body = await response.json();
  if (body.errors) throw new Error(`${version}: ${JSON.stringify(body.errors)}`);
  return body.data;
}

const TYPE_QUERY = `{ __type(name: "DTF") { fields { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }`;

// Unwraps NON_NULL / LIST to the named type and whether it is an object (entity reference).
function describeField(field) {
  let type = field.type;
  let isList = false;
  while (type.kind === "NON_NULL" || type.kind === "LIST") {
    if (type.kind === "LIST") isList = true;
    type = type.ofType;
  }
  return { name: field.name, isList, isObject: type.kind === "OBJECT" || type.kind === "INTERFACE" };
}

function selection(field) {
  if (!field.isObject) return field.name;
  if (field.name === "token") return "token { id totalSupply currentHolderCount transferCount }";
  if (field.isList) return `${field.name}(first: 1000, orderBy: id) { id }`;
  return `${field.name} { id }`;
}

async function allDTFs(version, fields, block) {
  const out = [];
  let lastId = "";
  for (;;) {
    const data = await query(
      version,
      `{ dtfs(first: 1000, orderBy: id, where: { id_gt: "${lastId}" }, block: { number: ${block} }) { ${fields} } }`
    );
    out.push(...data.dtfs);
    if (data.dtfs.length < 1000) return out;
    lastId = data.dtfs[data.dtfs.length - 1].id;
  }
}

const [baseType, newType] = await Promise.all([query(baseVersion, TYPE_QUERY), query(newVersion, TYPE_QUERY)]);
const baseFields = new Map(baseType.__type.fields.map((f) => [f.name, describeField(f)]));
const newFieldNames = new Set(newType.__type.fields.map((f) => f.name));
const shared = [...baseFields.values()].filter((f) => newFieldNames.has(f.name));
const onlyNew = [...newFieldNames].filter((name) => !baseFields.has(name));
const onlyBase = [...baseFields.keys()].filter((name) => !newFieldNames.has(name));

const META = "{ _meta { block { number } hasIndexingErrors deployment } }";
const [baseMeta, newMeta] = await Promise.all([query(baseVersion, META), query(newVersion, META)]);
const block = Math.min(baseMeta._meta.block.number, newMeta._meta.block.number) - 5;

const fields = shared.map(selection).join(" ");
const [baseDTFs, newDTFs] = await Promise.all([
  allDTFs(baseVersion, fields, block),
  allDTFs(newVersion, fields, block),
]);

const newById = new Map(newDTFs.map((dtf) => [dtf.id, dtf]));
const diffsByField = {};
let differingDTFs = 0;
let missing = 0;
for (const dtf of baseDTFs) {
  const other = newById.get(dtf.id);
  if (!other) {
    missing++;
    console.log(`missing in ${newVersion}: ${dtf.id}`);
    continue;
  }
  let differs = false;
  for (const key of Object.keys(dtf)) {
    const a = JSON.stringify(dtf[key]);
    const b = JSON.stringify(other[key]);
    if (a === b) continue;
    differs = true;
    diffsByField[key] = (diffsByField[key] || 0) + 1;
    console.log(`diff ${dtf.id} ${key}: ${a.slice(0, 80)} vs ${b.slice(0, 80)}`);
  }
  if (differs) differingDTFs++;
}
const extra = newDTFs.length - (baseDTFs.length - missing);

const result = {
  net,
  comparedAt: block,
  base: { version: baseVersion, ...baseMeta._meta, block: baseMeta._meta.block.number },
  new: { version: newVersion, ...newMeta._meta, block: newMeta._meta.block.number },
  dtfs: [baseDTFs.length, newDTFs.length],
  sharedFields: shared.length,
  onlyNewFields: onlyNew,
  onlyBaseFields: onlyBase,
  differingDTFs,
  diffsByField,
  missingInNew: missing,
  extraInNew: extra,
};
console.log(JSON.stringify(result, null, 1));

const failed =
  differingDTFs > 0 || missing > 0 || extra > 0 || baseMeta._meta.hasIndexingErrors || newMeta._meta.hasIndexingErrors;
process.exit(failed ? 1 : 0);
