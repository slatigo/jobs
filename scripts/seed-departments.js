require('dotenv').config();
const { sequelize, Department, Job } = require('../models');

/* ------------------------------------------------------------------ */
/* Curated list of MUBS departments for the job board                  */
/* ------------------------------------------------------------------ */
const departments = [
  // Faculties
  { mubsId: 18, name: 'Faculty of Commerce',                                      type: 'Faculty',     shortName: 'FOC',   displayOrder: 10 },
  { mubsId: 24, name: 'Faculty of Business Administration',                       type: 'Faculty',     shortName: 'FBA',   displayOrder: 20 },
  { mubsId: 23, name: 'Faculty of Entrepreneurship & Small Business Management',  type: 'Faculty',     shortName: 'FESBM', displayOrder: 30 },
  { mubsId: 16, name: 'Faculty of Computing & Informatics',                       type: 'Faculty',     shortName: 'FCI',   displayOrder: 40 },
  { mubsId: 31, name: 'Faculty of Management',                                    type: 'Faculty',     shortName: 'FOM',   displayOrder: 50 },
  { mubsId: 34, name: 'Faculty of Marketing & International Business',            type: 'Faculty',     shortName: 'FMIB',  displayOrder: 60 },
  { mubsId: 33, name: 'Faculty of Economics, Energy and Management Science',      type: 'Faculty',     shortName: 'FEEMS', displayOrder: 70 },
  { mubsId: 104, name: 'Faculty of Tourism, Hospitality & Languages',             type: 'Faculty',     shortName: 'FTHL',  displayOrder: 80 },
  { mubsId: 113, name: 'Faculty of Procurement & Logistics Management',           type: 'Faculty',     shortName: 'FPLM',  displayOrder: 90 },
  { mubsId: 30, name: 'Faculty of Vocational and Distance Education',             type: 'Faculty',     shortName: 'FVDE',  displayOrder: 100 },
  { mubsId: 32, name: 'Faculty of Graduate Studies and Research',                 type: 'Faculty',     shortName: 'FGSR',  displayOrder: 110 },
  { mubsId: 179, name: 'Faculty of Science Education',                            type: 'Faculty',     shortName: 'FSE',   displayOrder: 120 },

  // Directorates
  { mubsId: 6,   name: 'Human Resource Directorate',                              type: 'Directorate', shortName: 'HRD',   displayOrder: 200 },
  { mubsId: 69,  name: 'Directorate of Quality Assurance',                        type: 'Directorate', shortName: 'DQA',   displayOrder: 210 },
  { mubsId: 124, name: 'Internal Audit Directorate',                              type: 'Directorate', shortName: 'IAD',   displayOrder: 220 },
  { mubsId: 190, name: 'Directorate of Legal Affairs',                            type: 'Directorate', shortName: 'DLA',   displayOrder: 230 },

  // Departments & Units
  { mubsId: 74,  name: 'ICT Centre',                                              type: 'Department',  shortName: 'ICT',   displayOrder: 300 },
  { mubsId: 132, name: "School Bursar's Office",                                  type: 'Department',  shortName: 'Bursar',displayOrder: 310 },
  { mubsId: 66,  name: "School Registrar's Office",                               type: 'Office',      shortName: 'Registrar', displayOrder: 320 },
  { mubsId: 75,  name: "School Librarian's Office",                               type: 'Office',      shortName: 'Library', displayOrder: 330 },
  { mubsId: 106, name: 'Procurement and Disposal Unit',                           type: 'Unit',        shortName: 'PDU',   displayOrder: 340 },
  { mubsId: 57,  name: 'Estates and Works',                                       type: 'Department',  shortName: 'Estates', displayOrder: 350 },
  { mubsId: 83,  name: 'Public Relations & Promotions Office',                    type: 'Office',      shortName: 'PR',    displayOrder: 360 },
  { mubsId: 80,  name: "Dean of Students' Office",                                type: 'Office',      shortName: 'DOS',   displayOrder: 370 },

  // Regional Campuses
  { mubsId: 87,  name: 'MUBS Regional Campus - Mbale',                            type: 'Faculty',     shortName: 'Mbale', displayOrder: 400 },
  { mubsId: 101, name: 'MUBS Regional Campus - Jinja',                            type: 'Faculty',     shortName: 'Jinja', displayOrder: 410 },
  { mubsId: 102, name: 'MUBS Regional Campus - Mbarara',                          type: 'Faculty',     shortName: 'Mbarara', displayOrder: 420 },
  { mubsId: 103, name: 'MUBS Regional Campus - Arua',                             type: 'Faculty',     shortName: 'Arua',  displayOrder: 430 },

  // Fallback
  { mubsId: 999, name: 'Other',                                                   type: 'Unit',        shortName: 'Other', displayOrder: 999 }
];

/* ------------------------------------------------------------------ */
/* Slug helper                                                         */
/* ------------------------------------------------------------------ */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ Connected & synced');

    // Wipe existing departments
    // Comment this line out if you want to keep existing rows and only upsert.
    const wiped = await Department.destroy({ where: {}, truncate: false });
    if (wiped) console.log(`🧹 Removed ${wiped} existing departments`);

    // Insert
    const prepared = departments.map((d) => ({
      mubsId: d.mubsId,
      name: d.name,
      slug: slugify(d.name),
      shortName: d.shortName || null,
      type: d.type,
      active: true,
      displayOrder: d.displayOrder || 100
    }));

    await Department.bulkCreate(prepared, { validate: true });
    console.log(`✅ Seeded ${prepared.length} departments`);

    // Summary by type
    const counts = await Department.findAll({
      attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['type'],
      raw: true
    });
    console.log('📊 By type:');
    counts.forEach((c) => console.log(`   ${c.type}: ${c.n}`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
})();