// Core generator. Pure and deterministic given (params, seed): builds an
// in-memory OneRoster dataset. No file or network I/O here so it is reusable
// from the HTTP API and the CLI alike.

'use strict';

const { Rng } = require('./rng');
const { NameFactory, LEVELS, slugify } = require('./naming');

const TYPES = ['school', 'district'];
const SIZES = ['small', 'medium', 'large'];

// Per-school scale knobs.
const SIZE_PRESETS = {
  small: { studentsPerGrade: 12, classSize: 15 },
  medium: { studentsPerGrade: 35, classSize: 22 },
  large: { studentsPerGrade: 80, classSize: 28 },
};

// For type=school, size also picks a default level (override with opts.level).
const SCHOOL_LEVEL_BY_SIZE = { small: 'elementary', medium: 'middle', large: 'high' };

// For type=district: [level, per-school size] repeated. Controls both the
// number of schools and the student volume.
const DISTRICT_COMPOSITION = {
  small: [
    ['elementary', 'small'],
    ['middle', 'small'],
    ['high', 'medium'],
  ],
  medium: [
    ['elementary', 'small'], ['elementary', 'small'], ['elementary', 'small'], ['elementary', 'small'],
    ['middle', 'medium'], ['middle', 'medium'],
    ['high', 'medium'], ['high', 'medium'],
  ],
  large: [
    ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'],
    ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'], ['elementary', 'medium'],
    ['middle', 'medium'], ['middle', 'medium'], ['middle', 'medium'], ['middle', 'medium'], ['middle', 'medium'],
    ['high', 'large'], ['high', 'large'], ['high', 'large'], ['high', 'large'], ['high', 'large'],
  ],
};

const MAX_TEACHER_CLASS_COUNT = 8;

// name, code prefix (reference scheme). subjectCode left blank to match reference.
const SUBJECTS = [
  { name: 'Homeroom', prefix: 'HR' },
  { name: 'English', prefix: '01' },
  { name: 'Mathematics', prefix: '02' },
  { name: 'Science', prefix: '03' },
  { name: 'Social Studies', prefix: '04' },
  { name: 'Art', prefix: '05' },
  { name: 'Physical Education', prefix: '08' },
];

const CITIES = ['Riverton', 'Fairview', 'Lakeside', 'Kingsport', 'Brookhaven', 'Millbrook', 'Ashford', 'Cedar Falls'];
const STATES = ['TX', 'CA', 'NY', 'FL', 'IL', 'OH', 'WA', 'CO'];

function pad2(n) {
  return String(n).padStart(2, '0');
}
function fmtDate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function gradeIndex(grade) {
  return grade === 'KG' ? 0 : parseInt(grade, 10);
}
function courseCodeFor(subject, grade) {
  if (subject.prefix === 'HR') {
    return 'HR' + String(gradeIndex(grade)).padStart(5, '0');
  }
  const g = grade === 'KG' ? '91' : grade;
  return `${subject.prefix}${g}100`;
}

function resolveOptions(opts = {}) {
  const type = TYPES.includes(opts.type) ? opts.type : 'school';
  const size = SIZES.includes(opts.size) ? opts.size : 'medium';
  const seed =
    opts.seed !== undefined && opts.seed !== null && opts.seed !== ''
      ? opts.seed
      : Math.floor(Math.random() * 0xffffffff);
  let level = opts.level && LEVELS[opts.level] ? opts.level : null;
  // asOf pins dateLastModified (and the academic year) for reproducible
  // fixtures. Left null it defaults to generation time.
  const asOf = opts.asOf ? new Date(opts.asOf) : null;
  return {
    type, size, seed, level,
    domain: opts.domain || null,
    asOf: asOf && !isNaN(asOf.getTime()) ? asOf : null,
  };
}

function buildDataset(rawOpts = {}) {
  const opts = resolveOptions(rawOpts);
  const rng = new Rng(opts.seed);
  const names = new NameFactory(rng);

  const now = opts.asOf || new Date();
  const dlm = now.toISOString(); // yyyy-MM-ddTHH:mm:ss.fffZ

  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const endYear = startYear + 1;
  const yearLabel = `${startYear}-${endYear}`;
  const termStart = fmtDate(new Date(Date.UTC(startYear, 7, 15)));
  const termEnd = fmtDate(new Date(Date.UTC(endYear, 5, 10)));

  const dataset = {
    academicSessions: [],
    orgs: [],
    courses: [],
    classes: [],
    users: [],
    enrollments: [],
    demographics: [],
    manifest: [],
  };

  // --- Academic sessions -------------------------------------------------
  const schoolYearId = rng.uuid();
  const termId = rng.uuid();
  dataset.academicSessions.push({
    sourcedId: schoolYearId, status: 'active', dateLastModified: dlm,
    title: `${yearLabel} School Year`, type: 'schoolYear',
    startDate: termStart, endDate: termEnd, parentSourcedId: '', schoolYear: yearLabel,
  });
  dataset.academicSessions.push({
    sourcedId: termId, status: 'active', dateLastModified: dlm,
    title: 'Full Year', type: 'term',
    startDate: termStart, endDate: termEnd, parentSourcedId: schoolYearId, schoolYear: yearLabel,
  });

  // --- Orgs (district + schools) -----------------------------------------
  let districtOrg = null;
  const schools = []; // { org, level, grades, preset }
  let orgIdentifier = 1000;

  if (opts.type === 'district') {
    districtOrg = {
      sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
      name: names.districtName(), type: 'district',
      identifier: String(orgIdentifier++), parentSourcedId: '',
    };
    dataset.orgs.push(districtOrg);

    for (const [level, sizeKey] of DISTRICT_COMPOSITION[opts.size]) {
      const L = LEVELS[level];
      const org = {
        sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
        name: names.schoolName(L.word), type: 'school',
        identifier: String(orgIdentifier++), parentSourcedId: districtOrg.sourcedId,
      };
      dataset.orgs.push(org);
      schools.push({ org, level, grades: L.grades, preset: SIZE_PRESETS[sizeKey] });
    }
  } else {
    const level = opts.level || SCHOOL_LEVEL_BY_SIZE[opts.size];
    const L = LEVELS[level];
    const org = {
      sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
      name: names.schoolName(L.word), type: 'school',
      identifier: String(orgIdentifier++), parentSourcedId: '',
    };
    dataset.orgs.push(org);
    schools.push({ org, level, grades: L.grades, preset: SIZE_PRESETS[opts.size] });
  }

  // Courses live at the top org: the district if present, else the school.
  const topOrg = districtOrg || schools[0].org;

  // Email domain: explicit override, else derived from the top org name.
  const domain = opts.domain || `${slugify(topOrg.name).slice(0, 24)}.edu`;

  // --- Course catalog (per grade + subject, at the top org) --------------
  const gradesPresent = new Set();
  for (const s of schools) for (const g of s.grades) gradesPresent.add(g);
  const courseByKey = new Map(); // `${grade}|${subject.name}` -> course
  const orderedGrades = LEVELS.k12.grades.filter((g) => gradesPresent.has(g));
  for (const grade of orderedGrades) {
    for (const subject of SUBJECTS) {
      const course = {
        sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
        schoolYearSourcedId: schoolYearId,
        title: `${subject.name} ${grade}`,
        courseCode: courseCodeFor(subject, grade),
        grades: grade, orgSourcedId: topOrg.sourcedId,
        subjects: subject.name, subjectCodes: '',
      };
      dataset.courses.push(course);
      courseByKey.set(`${grade}|${subject.name}`, course);
    }
  }

  // --- Per-school users, classes, enrollments, demographics --------------
  const emailUsed = new Set();
  const usernameUsed = new Set();
  let studentId = 910000000;
  let teacherId = 1;
  let adminId = 900000;

  const makeEmail = (given, family) => {
    const base = `${slugify(given)}.${slugify(family)}`;
    let email = `${base}@${domain}`;
    let n = 2;
    while (emailUsed.has(email)) email = `${base}${n++}@${domain}`;
    emailUsed.add(email);
    return email;
  };

  // OneRoster `username` is a plain string, not an email. Several consumers
  // reject an email address in this field, so build a distinct handle.
  const makeUsername = (given, family) => {
    let base = `${slugify(given)}.${slugify(family)}`;
    if (base.length < 5) base = `${base}.${slugify(given)}`.slice(0, 12);
    let username = base;
    let n = 2;
    while (usernameUsed.has(username)) username = `${base}${n++}`;
    usernameUsed.add(username);
    return username;
  };

  const addUser = (role, org, grade) => {
    const { given, family } = names.personName();
    const email = makeEmail(given, family);
    let identifier;
    if (role === 'student') identifier = String(studentId++);
    else if (role === 'administrator') identifier = String(adminId++);
    else identifier = String(teacherId++);
    const user = {
      sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
      enabledUser: 'true', orgSourcedIds: org.sourcedId, role,
      username: makeUsername(given, family), userIds: '', givenName: given, agentSourcedIds: '',
      familyName: family, middleName: '', identifier, email, sms: '', phone: '',
      grades: grade || '', password: '',
    };
    dataset.users.push(user);
    return user;
  };

  const addDemographic = (student, grade) => {
    const age = gradeIndex(grade) + 5;
    const birthYear = startYear - age;
    const birth = new Date(Date.UTC(birthYear, rng.int(0, 11), rng.int(1, 28)));
    // Pick a single primary race flag most of the time.
    const raceFlags = {
      americanIndianOrAlaskaNative: 'false', asian: 'false',
      blackOrAfricanAmerican: 'false', nativeHawaiianOrOtherPacificIslander: 'false',
      white: 'false', demographicRaceTwoOrMoreRaces: 'false',
    };
    const raceKeys = Object.keys(raceFlags);
    if (rng.bool(0.08)) {
      raceFlags.demographicRaceTwoOrMoreRaces = 'true';
    } else {
      raceFlags[rng.pick(raceKeys.slice(0, 5))] = 'true';
    }
    dataset.demographics.push({
      sourcedId: student.sourcedId, status: 'active', dateLastModified: dlm,
      birthDate: fmtDate(birth), sex: rng.pick(['male', 'female']),
      ...raceFlags,
      hispanicOrLatinoEthnicity: rng.bool(0.25) ? 'true' : 'false',
      countryOfBirthCode: 'US', stateOfBirthAbbreviation: rng.pick(STATES),
      cityOfBirth: rng.pick(CITIES), publicSchoolResidenceStatus: '',
    });
  };

  for (const school of schools) {
    const { org, grades, preset } = school;

    // One principal per school.
    addUser('administrator', org, '');

    // Teacher pool for this school, grown on demand as sections need staff.
    const teacherPool = []; // { user, load }
    const assignTeacher = () => {
      let t = teacherPool.find((x) => x.load < MAX_TEACHER_CLASS_COUNT);
      if (!t) {
        t = { user: addUser('teacher', org, ''), load: 0 };
        teacherPool.push(t);
      }
      t.load++;
      return t.user;
    };

    for (const grade of grades) {
      // Students in this grade.
      const gradeStudents = [];
      for (let i = 0; i < preset.studentsPerGrade; i++) {
        gradeStudents.push(addUser('student', org, grade));
      }
      for (const st of gradeStudents) addDemographic(st, grade);

      const sectionCount = Math.max(1, Math.ceil(gradeStudents.length / preset.classSize));

      for (const subject of SUBJECTS) {
        const course = courseByKey.get(`${grade}|${subject.name}`);
        // Build sections for this subject/grade.
        const sections = [];
        for (let s = 0; s < sectionCount; s++) {
          const teacher = assignTeacher();
          const cls = {
            sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
            title: names.classTitle(), grades: grade,
            courseSourcedId: course.sourcedId,
            classCode: `${course.courseCode}-${String.fromCharCode(65 + s)}`,
            classType: subject.name === 'Homeroom' ? 'homeroom' : 'scheduled', location: '',
            schoolSourcedId: org.sourcedId, termSourcedIds: termId,
            subjects: subject.name, subjectCodes: '', periods: '',
          };
          dataset.classes.push(cls);
          sections.push({ cls, teacher });

          // Teacher enrollment (primary).
          dataset.enrollments.push({
            sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
            classSourcedId: cls.sourcedId, schoolSourcedId: org.sourcedId,
            userSourcedId: teacher.sourcedId, role: 'teacher', primary: 'true',
            beginDate: termStart, endDate: termEnd,
          });
        }

        // Spread students across this subject's sections (reshuffled per
        // subject so a student's classmates vary by class).
        const shuffled = rng.shuffle(gradeStudents);
        shuffled.forEach((student, idx) => {
          const section = sections[idx % sections.length];
          dataset.enrollments.push({
            sourcedId: rng.uuid(), status: 'active', dateLastModified: dlm,
            classSourcedId: section.cls.sourcedId, schoolSourcedId: org.sourcedId,
            userSourcedId: student.sourcedId, role: 'student', primary: '',
            beginDate: termStart, endDate: termEnd,
          });
        });
      }
    }
  }

  // District-level administrator.
  if (districtOrg) addUser('administrator', districtOrg, '');

  // --- Manifest ----------------------------------------------------------
  const manifestRows = [
    ['manifest.version', '1.0'],
    ['oneroster.version', '1.1'],
    ['file.academicSessions', 'bulk'],
    ['file.categories', 'absent'],
    ['file.classes', 'bulk'],
    ['file.classResources', 'absent'],
    ['file.courses', 'bulk'],
    ['file.courseResources', 'absent'],
    ['file.demographics', 'bulk'],
    ['file.enrollments', 'bulk'],
    ['file.lineItems', 'absent'],
    ['file.orgs', 'bulk'],
    ['file.resources', 'absent'],
    ['file.results', 'absent'],
    ['file.users', 'bulk'],
    ['source.systemName', 'Merge Labs OneRoster Sample Generator'],
    ['source.systemCode', 'merge-oneroster-gen'],
  ];
  dataset.manifest = manifestRows.map(([propertyName, value]) => ({ propertyName, value }));

  // --- Meta summary ------------------------------------------------------
  const counts = {
    orgs: dataset.orgs.length,
    academicSessions: dataset.academicSessions.length,
    courses: dataset.courses.length,
    classes: dataset.classes.length,
    users: dataset.users.length,
    students: dataset.users.filter((u) => u.role === 'student').length,
    teachers: dataset.users.filter((u) => u.role === 'teacher').length,
    administrators: dataset.users.filter((u) => u.role === 'administrator').length,
    enrollments: dataset.enrollments.length,
    demographics: dataset.demographics.length,
  };

  dataset.meta = {
    type: opts.type,
    size: opts.size,
    seed: opts.seed,
    domain,
    schoolYear: yearLabel,
    topOrgName: topOrg.name,
    generatedAt: dlm,
    counts,
  };

  return dataset;
}

module.exports = { buildDataset, resolveOptions, TYPES, SIZES, SIZE_PRESETS };
