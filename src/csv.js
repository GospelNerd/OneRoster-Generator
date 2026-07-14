// CSV serialization + OneRoster CSV file layouts.
//
// Header spelling and column order follow the 1EdTech OneRoster 1.1 CSV binding.
// The spec requires headers to appear in this exact order and treats them as
// case-sensitive. Verified against the 1EdTech tables rather than bergerb's
// repo, which deviated in four places: singular `termSourcedId`, an extra
// `courseSourcedId` in enrollments, `agentSourcedIds` misplaced mid-name, and a
// lowercased `stateofBirthAbbreviation`.

'use strict';

const LAYOUTS = {
  'academicSessions.csv': [
    'sourcedId', 'status', 'dateLastModified', 'title', 'type',
    'startDate', 'endDate', 'parentSourcedId', 'schoolYear',
  ],
  'orgs.csv': [
    'sourcedId', 'status', 'dateLastModified', 'name', 'type',
    'identifier', 'parentSourcedId',
  ],
  'courses.csv': [
    'sourcedId', 'status', 'dateLastModified', 'schoolYearSourcedId', 'title',
    'courseCode', 'grades', 'orgSourcedId', 'subjects', 'subjectCodes',
  ],
  'classes.csv': [
    'sourcedId', 'status', 'dateLastModified', 'title', 'grades',
    'courseSourcedId', 'classCode', 'classType', 'location', 'schoolSourcedId',
    'termSourcedIds', 'subjects', 'subjectCodes', 'periods',
  ],
  'users.csv': [
    'sourcedId', 'status', 'dateLastModified', 'enabledUser', 'orgSourcedIds',
    'role', 'username', 'userIds', 'givenName', 'familyName', 'middleName',
    'identifier', 'email', 'sms', 'phone', 'agentSourcedIds', 'grades', 'password',
  ],
  'enrollments.csv': [
    'sourcedId', 'status', 'dateLastModified', 'classSourcedId',
    'schoolSourcedId', 'userSourcedId', 'role', 'primary', 'beginDate',
    'endDate',
  ],
  'demographics.csv': [
    'sourcedId', 'status', 'dateLastModified', 'birthDate', 'sex',
    'americanIndianOrAlaskaNative', 'asian', 'blackOrAfricanAmerican',
    'nativeHawaiianOrOtherPacificIslander', 'white',
    'demographicRaceTwoOrMoreRaces', 'hispanicOrLatinoEthnicity',
    'countryOfBirthCode', 'stateOfBirthAbbreviation', 'cityOfBirth',
    'publicSchoolResidenceStatus',
  ],
  'manifest.csv': ['propertyName', 'value'],
};

// Maps dataset array keys -> output filename.
const FILE_FOR_COLLECTION = {
  academicSessions: 'academicSessions.csv',
  orgs: 'orgs.csv',
  courses: 'courses.csv',
  classes: 'classes.csv',
  users: 'users.csv',
  enrollments: 'enrollments.csv',
  demographics: 'demographics.csv',
  manifest: 'manifest.csv',
};

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  // CRLF line endings, which most SIS importers expect.
  return lines.join('\r\n') + '\r\n';
}

// dataset -> { 'orgs.csv': '...', ... }
function datasetToFiles(dataset) {
  const files = {};
  for (const [collection, filename] of Object.entries(FILE_FOR_COLLECTION)) {
    const rows = dataset[collection] || [];
    files[filename] = toCsv(LAYOUTS[filename], rows);
  }
  return files;
}

module.exports = { LAYOUTS, datasetToFiles, toCsv, escapeCell };
