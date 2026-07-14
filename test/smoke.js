// Smoke test / validator. Run with: node test/smoke.js
// Checks spec-exact headers, referential integrity, determinism, and a valid zip.

'use strict';

const assert = require('assert');
const { buildDataset } = require('../src/generator');
const { datasetToFiles } = require('../src/csv');
const { createZip } = require('../src/zip');

const EXPECTED_HEADERS = {
  'academicSessions.csv':
    'sourcedId,status,dateLastModified,title,type,startDate,endDate,parentSourcedId,schoolYear',
  'orgs.csv':
    'sourcedId,status,dateLastModified,name,type,identifier,parentSourcedId',
  'courses.csv':
    'sourcedId,status,dateLastModified,schoolYearSourcedId,title,courseCode,grades,orgSourcedId,subjects,subjectCodes',
  'classes.csv':
    'sourcedId,status,dateLastModified,title,grades,courseSourcedId,classCode,classType,location,schoolSourcedId,termSourcedIds,subjects,subjectCodes,periods',
  'users.csv':
    'sourcedId,status,dateLastModified,enabledUser,orgSourcedIds,role,username,userIds,givenName,familyName,middleName,identifier,email,sms,phone,agentSourcedIds,grades,password',
  'enrollments.csv':
    'sourcedId,status,dateLastModified,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate,endDate',
  'demographics.csv':
    'sourcedId,status,dateLastModified,birthDate,sex,americanIndianOrAlaskaNative,asian,blackOrAfricanAmerican,nativeHawaiianOrOtherPacificIslander,white,demographicRaceTwoOrMoreRaces,hispanicOrLatinoEthnicity,countryOfBirthCode,stateOfBirthAbbreviation,cityOfBirth,publicSchoolResidenceStatus',
  'manifest.csv': 'propertyName,value',
};

// Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/quotes).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // skip; \n handles row break
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function toObjects(text) {
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function checkHeaders(files) {
  for (const [name, expected] of Object.entries(EXPECTED_HEADERS)) {
    const firstLine = files[name].split('\r\n')[0];
    assert.strictEqual(firstLine, expected, `Header mismatch in ${name}`);
  }
  console.log('  headers: match OneRoster 1.1 spec exactly');
}

function checkReferentialIntegrity(dataset) {
  const orgIds = new Set(dataset.orgs.map((o) => o.sourcedId));
  const schoolIds = new Set(dataset.orgs.filter((o) => o.type === 'school').map((o) => o.sourcedId));
  const courseIds = new Set(dataset.courses.map((c) => c.sourcedId));
  const classIds = new Set(dataset.classes.map((c) => c.sourcedId));
  const userIds = new Set(dataset.users.map((u) => u.sourcedId));
  const sessionIds = new Set(dataset.academicSessions.map((s) => s.sourcedId));

  for (const c of dataset.courses) {
    assert(orgIds.has(c.orgSourcedId), 'course.orgSourcedId dangling');
    assert(sessionIds.has(c.schoolYearSourcedId), 'course.schoolYearSourcedId dangling');
  }
  for (const cls of dataset.classes) {
    assert(courseIds.has(cls.courseSourcedId), 'class.courseSourcedId dangling');
    assert(schoolIds.has(cls.schoolSourcedId), 'class.schoolSourcedId dangling');
    assert(sessionIds.has(cls.termSourcedIds), 'class.termSourcedIds dangling');
  }
  for (const u of dataset.users) {
    assert(orgIds.has(u.orgSourcedIds), 'user.orgSourcedIds dangling');
  }
  for (const e of dataset.enrollments) {
    assert(classIds.has(e.classSourcedId), 'enrollment.classSourcedId dangling');
    assert(schoolIds.has(e.schoolSourcedId), 'enrollment.schoolSourcedId dangling');
    assert(userIds.has(e.userSourcedId), 'enrollment.userSourcedId dangling');
  }
  const studentIds = new Set(dataset.users.filter((u) => u.role === 'student').map((u) => u.sourcedId));
  for (const d of dataset.demographics) {
    assert(studentIds.has(d.sourcedId), 'demographic references non-student');
  }
  console.log('  referential integrity: all foreign keys resolve');
}

function checkParsedCounts(files, dataset) {
  const users = toObjects(files['users.csv']);
  const enrollments = toObjects(files['enrollments.csv']);
  assert.strictEqual(users.length, dataset.meta.counts.users, 'user row count mismatch');
  assert.strictEqual(enrollments.length, dataset.meta.counts.enrollments, 'enrollment row count mismatch');
  // Every teacher enrollment marked primary; students blank.
  for (const e of enrollments) {
    if (e.role === 'teacher') assert.strictEqual(e.primary, 'true');
    if (e.role === 'student') assert.strictEqual(e.primary, '');
  }
  // No usernames are emails.
  for (const u of users) assert(!u.username.includes('@'), 'username must not be an email');
  console.log('  parsed row counts + role/primary + username rules: ok');
}

function checkDeterminism() {
  const asOf = '2026-01-15T00:00:00.000Z';
  const a = datasetToFiles(buildDataset({ type: 'school', size: 'small', seed: 'regression-1', asOf }));
  const b = datasetToFiles(buildDataset({ type: 'school', size: 'small', seed: 'regression-1', asOf }));
  assert.deepStrictEqual(a, b, 'same seed produced different output');
  const c = datasetToFiles(buildDataset({ type: 'school', size: 'small', seed: 'regression-2', asOf }));
  assert.notDeepStrictEqual(a, c, 'different seed produced identical output');
  console.log('  determinism: same seed reproduces, different seed differs');
}

function checkZip(dataset) {
  const files = datasetToFiles(dataset);
  const zip = createZip(Object.entries(files).map(([name, data]) => ({ name, data })));
  assert.strictEqual(zip.readUInt32LE(0), 0x04034b50, 'bad local header signature');
  // EOCD present at the end.
  assert.strictEqual(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'bad EOCD signature');
  const entryCount = zip.readUInt16LE(zip.length - 22 + 10);
  assert.strictEqual(entryCount, Object.keys(files).length, 'zip entry count mismatch');
  console.log(`  zip: valid store archive, ${entryCount} entries`);
}

function run() {
  for (const [type, size] of [['school', 'small'], ['school', 'large'], ['district', 'small'], ['district', 'large']]) {
    const dataset = buildDataset({ type, size, seed: `${type}-${size}` });
    const files = datasetToFiles(dataset);
    console.log(`\n[${type} / ${size}] org="${dataset.meta.topOrgName}"`);
    console.log(`  counts: ${JSON.stringify(dataset.meta.counts)}`);
    checkHeaders(files);
    checkReferentialIntegrity(dataset);
    checkParsedCounts(files, dataset);
    checkZip(dataset);
  }
  console.log('\n[determinism]');
  checkDeterminism();
  console.log('\nAll checks passed.');
}

run();
