#!/usr/bin/env node
// CLI for writing a roster to disk, for QA or CI that would rather shell out
// than hit the API.
//
//   node src/cli.js --type district --size large --domain sample.edu --out ./out
//   node src/cli.js --type school --size small --zip --seed regression-1
//
// Flags:
//   --type    school | district        (default school)
//   --size    small | medium | large   (default medium)
//   --domain  email domain             (optional)
//   --level   elementary|middle|high|k12 (optional, type=school only)
//   --seed    any string/number        (optional; reproducible output)
//   --out     output directory         (default ./oneroster-out)
//   --zip     also write a .zip beside the csv folder

'use strict';

const fs = require('fs');
const path = require('path');
const { buildDataset } = require('./generator');
const { datasetToFiles } = require('./csv');
const { createZip } = require('./zip');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'zip') {
      args.zip = true;
    } else {
      args[key] = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out || './oneroster-out';

  const dataset = buildDataset({
    type: args.type,
    size: args.size,
    domain: args.domain,
    level: args.level,
    seed: args.seed,
    asOf: args['as-of'],
  });

  const files = datasetToFiles(dataset);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), content);
  }

  if (args.zip) {
    const entries = Object.entries(files).map(([name, data]) => ({ name, data }));
    const zip = createZip(entries);
    const zipPath = path.join(
      outDir,
      `oneroster-${dataset.meta.type}-${dataset.meta.size}.zip`
    );
    fs.writeFileSync(zipPath, zip);
  }

  const c = dataset.meta.counts;
  console.log(`Generated ${dataset.meta.type} "${dataset.meta.topOrgName}" (${dataset.meta.size})`);
  console.log(`  seed:        ${dataset.meta.seed}`);
  console.log(`  domain:      ${dataset.meta.domain}`);
  console.log(`  orgs:        ${c.orgs}`);
  console.log(`  students:    ${c.students}`);
  console.log(`  teachers:    ${c.teachers}`);
  console.log(`  admins:      ${c.administrators}`);
  console.log(`  classes:     ${c.classes}`);
  console.log(`  enrollments: ${c.enrollments}`);
  console.log(`  written to:  ${path.resolve(outDir)}`);
}

if (require.main === module) main();
