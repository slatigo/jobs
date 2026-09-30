/**
 * Seeds the departments table with the full MUBS organisational structure.
 *
 * Usage:
 *   node scripts/seed-departments.js
 *
 * Idempotent: wipes existing departments (if no jobs reference them)
 * and inserts the list below. Safe to re-run.
 */

require('dotenv').config();
const { sequelize, Department, Job } = require('../models');

/* ------------------------------------------------------------------ */
/* Department list — full MUBS structure                              */
/* ------------------------------------------------------------------ */
const departments = [
  { name: 'AFRICAN CENTRE FOR LIGHTENING & ELECTROMAGNETICS', shortName: null, type: 'Unit',        displayOrder: 1 },
  { name: 'ALUMNI, SCHOOL REGISTRAR\'S OFFICE',               shortName: null, type: 'Office',      displayOrder: 2 },
  { name: 'BOARD - RBS',                                      shortName: null, type: 'Unit',        displayOrder: 3 },
  { name: 'CAREER AND SKILLS DEVELOPMENT CENTRE, SCHOOL REGISTRAR\'S OFFICE', shortName: null, type: 'Office', displayOrder: 4 },
  { name: 'CHAPLAINCIES',                                     shortName: null, type: 'Unit',        displayOrder: 5 },
  { name: 'CLEANING & TEACHING EQUIPMENT, SCHOOL SECRETARY\'S OFFICE', shortName: null, type: 'Office', displayOrder: 6 },
  { name: 'CONTRACTS MANAGEMENT, PRINCIPAL\'S OFFICE',         shortName: null, type: 'Office',      displayOrder: 7 },
  { name: 'CREATIVE LEARNING',                                shortName: null, type: 'Unit',        displayOrder: 8 },
  { name: 'DEAN OF STUDENTS\' OFFICE',                        shortName: null, type: 'Office',      displayOrder: 9 },
  { name: 'DEPARTMENT OF ACCOUNTING, FACULTY OF COMMERCE',    shortName: null, type: 'Department',  displayOrder: 10 },
  { name: 'DEPARTMENT OF ACCOUNTING AND FINANCE, MUBS REGIONAL CAMPUS-ARUA', shortName: null, type: 'Department', displayOrder: 11 },
  { name: 'DEPARTMENT OF ACCOUNTING AND FINANCE, MUBS REGIONAL CAMPUS MBARARA', shortName: null, type: 'Department', displayOrder: 12 },
  { name: 'DEPARTMENT OF ACCOUNTING AND FINANCE, MUBS REGIONAL CAMPUS-JINJA', shortName: null, type: 'Department', displayOrder: 13 },
  { name: 'DEPARTMENT OF ACCOUNTING AND FINANCE, MUBS REGIONAL CAMPUS-MBALE', shortName: null, type: 'Department', displayOrder: 14 },
  { name: 'DEPARTMENT OF APPLIED COMPUTING & INFORMATION TECHNOLOGY, FACULTY OF COMPUTING & INFORMATICS', shortName: null, type: 'Department', displayOrder: 15 },
  { name: 'DEPARTMENT OF AUDITING & TAXATION, FACULTY OF COMMERCE', shortName: null, type: 'Department', displayOrder: 16 },
  { name: 'DEPARTMENT OF BUSINESS ADMINISTRATION, FACULTY OF BUSINESS ADMINISTRATION', shortName: null, type: 'Department', displayOrder: 17 },
  { name: 'DEPARTMENT OF BUSINESS LANGUAGES, FACULTY OF TOURISM, HOSPITALITY & LANGUAGES', shortName: null, type: 'Department', displayOrder: 18 },
  { name: 'DEPARTMENT OF BUSINESS LAW, FACULTY OF COMMERCE', shortName: null, type: 'Department', displayOrder: 19 },
  { name: 'DEPARTMENT OF COMMUNICATION, FACULTY OF BUSINESS ADMINISTRATION', shortName: null, type: 'Department', displayOrder: 20 },
  { name: 'DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING, FACULTY OF COMPUTING & INFORMATICS', shortName: null, type: 'Department', displayOrder: 21 },
  { name: 'DEPARTMENT OF ECONOMICS, FACULTY OF ECONOMICS, ENERGY AND MANAGEMENT SCIENCE', shortName: null, type: 'Department', displayOrder: 22 },
  { name: 'DEPARTMENT OF EDUCATION, FACULTY OF VOCATIONAL AND DISTANCE EDUCATION', shortName: null, type: 'Department', displayOrder: 23 },
  { name: 'DEPARTMENT OF ENERGY SCIENCE AND TECHNOLOGY, FACULTY OF ECONOMICS, ENERGY AND MANAGEMENT SCIENCE', shortName: null, type: 'Department', displayOrder: 24 },
  { name: 'DEPARTMENT OF ENTREPRENEURSHIP & INNOVATION, FACULTY OF ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', shortName: null, type: 'Department', displayOrder: 25 },
  { name: 'DEPARTMENT OF FINANCE, FACULTY OF COMMERCE', shortName: null, type: 'Department', displayOrder: 26 },
  { name: 'DEPARTMENT OF HUMAN RESOURCE MANAGEMENT, FACULTY OF MANAGEMENT', shortName: null, type: 'Department', displayOrder: 27 },
  { name: 'DEPARTMENT OF INFORMATION SYSTEMS, FACULTY OF COMPUTING & INFORMATICS', shortName: null, type: 'Department', displayOrder: 28 },
  { name: 'DEPARTMENT OF LEADERSHIP & GOVERNANCE, FACULTY OF MANAGEMENT', shortName: null, type: 'Department', displayOrder: 29 },
  { name: 'DEPARTMENT OF LEISURE, EVENTS & HOSPITALITY MANAGEMENT, FACULTY OF TOURISM, HOSPITALITY & LANGUAGES', shortName: null, type: 'Department', displayOrder: 30 },
  { name: 'DEPARTMENT OF MANAGEMENT, FACULTY OF MANAGEMENT', shortName: null, type: 'Department', displayOrder: 31 },
  { name: 'DEPARTMENT OF MANAGEMENT SCIENCE, FACULTY OF ECONOMICS, ENERGY AND MANAGEMENT SCIENCE', shortName: null, type: 'Department', displayOrder: 32 },
  { name: 'DEPARTMENT OF MARKETING AND MANAGEMENT, MUBS REGIONAL CAMPUS-ARUA', shortName: null, type: 'Department', displayOrder: 33 },
  { name: 'DEPARTMENT OF MARKETING AND MANAGEMENT, MUBS REGIONAL CAMPUS MBARARA', shortName: null, type: 'Department', displayOrder: 34 },
  { name: 'DEPARTMENT OF MARKETING AND MANAGEMENT, MUBS REGIONAL CAMPUS-JINJA', shortName: null, type: 'Department', displayOrder: 35 },
  { name: 'DEPARTMENT OF MARKETING AND MANAGEMENT, MUBS REGIONAL CAMPUS-MBALE', shortName: null, type: 'Department', displayOrder: 36 },
  { name: 'DEPARTMENT OF MARKETING AND MEDIA STUDIES, FACULTY OF MARKETING & INTERNATIONAL BUSINESS', shortName: null, type: 'Department', displayOrder: 37 },
  { name: 'DEPARTMENT OF PROCUREMENT & SUPPLY CHAIN MANAGEMENT, FACULTY OF PROCUREMENT & LOGISTICS MANAGEMENT', shortName: null, type: 'Department', displayOrder: 38 },
  { name: 'DEPARTMENT OF SMALL BUSINESS MGT, FACULTY OF ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', shortName: null, type: 'Department', displayOrder: 39 },
  { name: 'DEPARTMENT OF TOURISM MANAGEMENT, FACULTY OF TOURISM, HOSPITALITY & LANGUAGES', shortName: null, type: 'Department', displayOrder: 40 },
  { name: 'DEPARTMENT OF TRANSPORT AND LOGISTICS MANAGEMENT, FACULTY OF PROCUREMENT & LOGISTICS MANAGEMENT', shortName: null, type: 'Department', displayOrder: 41 },
  { name: 'DEPUTY PRINCIPAL\'S OFFICE',                       shortName: null, type: 'Office',      displayOrder: 42 },
  { name: 'DIRECTORATE OF LEGAL AFFAIRS',                     shortName: null, type: 'Directorate', displayOrder: 43 },
  { name: 'DIRECTORATE OF QUALITY ASSURANCE',                 shortName: null, type: 'Directorate', displayOrder: 44 },
  { name: 'DISABILITY AND RESOURCE LEARNING CENTRE',          shortName: null, type: 'Unit',        displayOrder: 45 },
  { name: 'E-LEARNING',                                       shortName: null, type: 'Unit',        displayOrder: 46 },
  { name: 'ECONOMIC FORUM, FACULTY OF ECONOMICS, ENERGY AND MANAGEMENT SCIENCE', shortName: null, type: 'Unit', displayOrder: 47 },
  { name: 'ENTREPRENEURSHIP, INNOVATION AND INCUBATION CENTRE', shortName: null, type: 'Unit',      displayOrder: 48 },
  { name: 'ENVIRONMENTAL MANAGEMENT UNIT, PRINCIPAL\'S OFFICE', shortName: null, type: 'Unit',      displayOrder: 49 },
  { name: 'ESTATES AND WORKS',                                shortName: null, type: 'Unit',        displayOrder: 50 },
  { name: 'EXAMINATIONS UNIT, DIRECTORATE OF QUALITY ASSURANCE', shortName: null, type: 'Unit',     displayOrder: 51 },
  { name: 'FACULTY OF BUSINESS ADMINISTRATION',               shortName: null, type: 'Faculty',     displayOrder: 52 },
  { name: 'FACULTY OF COMMERCE',                              shortName: null, type: 'Faculty',     displayOrder: 53 },
  { name: 'FACULTY OF COMPUTING & INFORMATICS',               shortName: null, type: 'Faculty',     displayOrder: 54 },
  { name: 'FACULTY OF ECONOMICS, ENERGY AND MANAGEMENT SCIENCE', shortName: null, type: 'Faculty',  displayOrder: 55 },
  { name: 'FACULTY OF ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', shortName: null, type: 'Faculty', displayOrder: 56 },
  { name: 'FACULTY OF GRADUATE STUDIES AND RESEARCH (FGSR)', shortName: null, type: 'Faculty',     displayOrder: 57 },
  { name: 'FACULTY OF MANAGEMENT',                            shortName: null, type: 'Faculty',     displayOrder: 58 },
  { name: 'FACULTY OF MARKETING & INTERNATIONAL BUSINESS',    shortName: null, type: 'Faculty',     displayOrder: 59 },
  { name: 'FACULTY OF PROCUREMENT & LOGISTICS MANAGEMENT',    shortName: null, type: 'Faculty',     displayOrder: 60 },
  { name: 'FACULTY OF SCIENCE EDUCATION',                     shortName: null, type: 'Faculty',     displayOrder: 61 },
  { name: 'FACULTY OF TOURISM, HOSPITALITY & LANGUAGES',      shortName: null, type: 'Faculty',     displayOrder: 62 },
  { name: 'FACULTY OF VOCATIONAL AND DISTANCE EDUCATION',     shortName: null, type: 'Faculty',     displayOrder: 63 },
  { name: 'HEALTH SERVICES CENTRE',                           shortName: null, type: 'Unit',        displayOrder: 64 },
  { name: 'HUMAN RESOURCE DIRECTORATE',                       shortName: null, type: 'Directorate', displayOrder: 65 },
  { name: 'ICT CENTRE',                                       shortName: null, type: 'Unit',        displayOrder: 66 },
  { name: 'INTERNAL AUDIT DIRECTORATE',                       shortName: null, type: 'Directorate', displayOrder: 67 },
  { name: 'INTERNATIONAL BUSINESS AND TRADE, FACULTY OF MARKETING & INTERNATIONAL BUSINESS', shortName: null, type: 'Unit', displayOrder: 68 },
  { name: 'KNOWLEDGE FOR DEVELOPMENT CENTRE, FACULTY OF MANAGEMENT', shortName: null, type: 'Unit', displayOrder: 69 },
  { name: 'LANGUAGES CENTRE',                                 shortName: null, type: 'Unit',        displayOrder: 70 },
  { name: 'LEADERSHIP CENTER',                                shortName: null, type: 'Unit',        displayOrder: 71 },
  { name: 'MANAGEMENT DEVELOPMENT SECTION, PRINCIPAL\'S OFFICE', shortName: null, type: 'Unit',      displayOrder: 72 },
  { name: 'MANAGEMENT OF INFORMATION SYSTEM (MIS)',           shortName: null, type: 'Unit',        displayOrder: 73 },
  { name: 'MICRO FINANCE CENTRE, PRINCIPAL\'S OFFICE',        shortName: null, type: 'Unit',        displayOrder: 74 },
  { name: 'MUBS REGIONAL CAMPUS MBARARA',                     shortName: null, type: 'Unit',        displayOrder: 75 },
  { name: 'MUBS REGIONAL CAMPUS-ARUA',                        shortName: null, type: 'Unit',        displayOrder: 76 },
  { name: 'MUBS REGIONAL CAMPUS-JINJA',                       shortName: null, type: 'Unit',        displayOrder: 77 },
  { name: 'MUBS REGIONAL CAMPUS-MBALE',                       shortName: null, type: 'Unit',        displayOrder: 78 },
  { name: 'OFFICE OF IMAM',                                   shortName: null, type: 'Office',      displayOrder: 79 },
  { name: 'PRINCIPAL\'S OFFICE',                              shortName: null, type: 'Office',      displayOrder: 80 },
  { name: 'PROCUREMENT AND DISPOSAL UNIT',                    shortName: null, type: 'Unit',        displayOrder: 81 },
  { name: 'PROJECT & SMALL BUSINESS MANAGEMENT, FACULTY OF ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', shortName: null, type: 'Unit', displayOrder: 82 },
  { name: 'PUBLIC RELATIONS & PROMOTIONS OFFICE',             shortName: null, type: 'Office',      displayOrder: 83 },
  { name: 'PUBLICATION UNIT',                                 shortName: null, type: 'Unit',        displayOrder: 84 },
  { name: 'RBS OFFICE, BOARD - RBS',                          shortName: null, type: 'Office',      displayOrder: 85 },
  { name: 'RISK UNIT, PRINCIPAL\'S OFFICE',                   shortName: null, type: 'Unit',        displayOrder: 86 },
  { name: 'SCHOOL BURSAR\'S OFFICE',                          shortName: null, type: 'Office',      displayOrder: 87 },
  { name: 'SCHOOL LIBRARIAN\'S OFFICE',                       shortName: null, type: 'Office',      displayOrder: 88 },
  { name: 'SCHOOL REGISTRAR\'S OFFICE',                       shortName: null, type: 'Office',      displayOrder: 89 },
  { name: 'SCHOOL SECRETARY\'S OFFICE',                       shortName: null, type: 'Office',      displayOrder: 90 },
  { name: 'SECURITY SECTION',                                 shortName: null, type: 'Unit',        displayOrder: 91 },
  { name: 'SECURITY SECTION, MUBS REGIONAL CAMPUS MBARARA',   shortName: null, type: 'Unit',        displayOrder: 92 },
  { name: 'SECURITY SECTION, MUBS REGIONAL CAMPUS-MBALE',     shortName: null, type: 'Unit',        displayOrder: 93 },
  { name: 'SECURITY SECTION, MUBS REGIONAL CAMPUS-ARUA',      shortName: null, type: 'Unit',        displayOrder: 94 },
  { name: 'SECURITY SECTION, MUBS REGIONAL CAMPUS-JINJA',     shortName: null, type: 'Unit',        displayOrder: 95 },
  { name: 'SPORTS TUTOR\'S OFFICE, DEAN OF STUDENTS\' OFFICE', shortName: null, type: 'Office',     displayOrder: 96 },
  { name: 'ST JAMES CHAPEL',                                  shortName: null, type: 'Unit',        displayOrder: 97 },
  { name: 'ST. CHARLES LWANGA CATHOLIC COMMUNITY',            shortName: null, type: 'Unit',        displayOrder: 98 },
  { name: 'STRATEGY & PROJECTS',                              shortName: null, type: 'Unit',        displayOrder: 99 },
  { name: 'STUDENTS COUNSELLING & DRUGS UNIT',                shortName: null, type: 'Unit',        displayOrder: 100 },
  { name: 'STUDENTS\' AFFAIRS SECTION, PRINCIPAL\'S OFFICE',  shortName: null, type: 'Unit',        displayOrder: 101 }
];

/* ------------------------------------------------------------------ */
/* Slug helper — matches the model's hook                             */
/* ------------------------------------------------------------------ */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to', sequelize.config.database);

    /* ---- Guard: refuse to wipe if jobs reference departments ---- */
    const existing = await Department.count();
    if (existing > 0) {
      const jobCount = await Job.count();
      if (jobCount > 0) {
        console.error(`❌ Cannot re-seed: ${jobCount} job(s) currently reference departments.`);
        console.error('   Delete the jobs first, or seed into a fresh database.');
        process.exit(1);
      }
      console.log(`🧹 Removing ${existing} existing departments...`);
      await Department.destroy({ where: {}, truncate: true });
    }

    /* ---- Prepare rows ---- */
    const rows = departments.map((d) => ({
      name: d.name.trim(),
      shortName: d.shortName,
      slug: slugify(d.name),
      type: d.type,
      description: null,
      active: true,
      displayOrder: d.displayOrder
    }));

    /* ---- Insert ---- */
    await Department.bulkCreate(rows, { validate: true });

    /* ---- Report ---- */
    const total = await Department.count();
    console.log(`✅ Seeded ${total} departments`);

    const byType = await Department.findAll({
      attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['type'],
      raw: true
    });
    console.log('📊 By type:');
    byType
      .sort((a, b) => a.type.localeCompare(b.type))
      .forEach((r) => console.log(`   ${r.type}: ${r.n}`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (err.original) console.error('   SQL error:', err.original.sqlMessage);
    if (err.errors) {
      err.errors.forEach((e) =>
        console.error(`   - ${e.path}: ${e.message} (value: ${e.value})`)
      );
    }
    process.exit(1);
  }
})();