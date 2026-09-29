require('dotenv').config();
const { sequelize, User, Department, Job } = require('../models');

/* ------------------------------------------------------------------ */
/* Seed                                                               */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ Connected & synced');

    /* ---------- Users ---------- */
    const [admin] = await User.findOrCreate({
      where: { email: 'admin@mubs.ac.ug' },
      defaults: {
        name: 'MUBS Admin',
        email: 'admin@mubs.ac.ug',
        password: 'admin123',
        role: 'admin'
      }
    });

    const [hr] = await User.findOrCreate({
      where: { email: 'hr@mubs.ac.ug' },
      defaults: {
        name: 'Human Resources Office',
        email: 'hr@mubs.ac.ug',
        password: 'employer123',
        role: 'employer',
        company: 'Human Resource Directorate'
      }
    });

    const [student] = await User.findOrCreate({
      where: { email: 'student@mubs.ac.ug' },
      defaults: {
        name: 'John Ssemakula',
        email: 'student@mubs.ac.ug',
        password: 'student123',
        role: 'student',
        course: 'BBA',
        yearOfStudy: 3,
        phone: '+256700000001'
      }
    });

    console.log('👤 Users ready');

    /* ---------- Look up departments (must be seeded first) ---------- */
    const findDept = async (partial) => {
      const dept = await Department.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          'LIKE',
          `%${partial.toLowerCase()}%`
        )
      });
      if (!dept) {
        console.warn(`⚠️  Department not found for "${partial}" — skipping related jobs`);
      }
      return dept;
    };

    const commerceDept  = await findDept('faculty of commerce — department of accounting');
    const cfiDept       = await findDept('faculty of computing and informatics');
    const hrDept        = await findDept('human resource directorate');
    const libraryDept   = await findDept('library');
    const financeDept   = await findDept('school bursar');
    const marketingDept = await findDept('faculty of marketing');

    /* ---------- Demo jobs ---------- */
    const jobsData = [
      {
        key: 'MUBS/HR/2025/001',
        record: {
          jobRef: 'MUBS/HR/2025/001',
          title: 'School Bursar',
          departmentId: financeDept ? financeDept.id : (commerceDept ? commerceDept.id : null),
          location: 'MUBS Main Campus, Nakawa',
          type: 'Full-time',
          contractTerms: 'Permanent',
          grade: 'M3',
          vacancies: 1,
          description: `
            <h3>Duties and Responsibilities</h3>
            <ul>
              <li>Oversee the day-to-day financial operations of the University.</li>
              <li>Prepare and present periodic financial reports to Management and Council.</li>
              <li>Ensure compliance with the Public Finance Management Act.</li>
              <li>Supervise staff in the Bursar's Office.</li>
            </ul>
            <h3>Qualifications and Experience</h3>
            <ul>
              <li>Master's degree in Accounting, Finance, or a related field.</li>
              <li>Must be a qualified Accountant (CPA, ACCA, or equivalent).</li>
              <li>At least <strong>10 years</strong> of relevant experience, 5 at senior level.</li>
              <li>Membership of a recognized professional accounting body is mandatory.</li>
            </ul>
            <p><strong>Terms of Service:</strong> Permanent and pensionable, MUBS salary scale M3.</p>
          `,
          deadline: new Date(Date.now() + 30 * 86400000),
          contactEmail: 'hr@mubs.ac.ug',
          contactPhone: '+256 414 505 200',
          userId: hr.id,
          featured: true
        }
      },
      {
        key: 'MUBS/HR/2025/002',
        record: {
          jobRef: 'MUBS/HR/2025/002',
          title: 'Assistant Lecturer – Accounting',
          departmentId: commerceDept ? commerceDept.id : null,
          location: 'MUBS Main Campus, Nakawa',
          type: 'Full-time',
          contractTerms: 'Contract',
          grade: 'M6',
          vacancies: 3,
          description: `
            <h3>Duties and Responsibilities</h3>
            <ul>
              <li>Teach undergraduate courses in Financial Accounting and Auditing.</li>
              <li>Supervise student research projects.</li>
              <li>Participate in curriculum development.</li>
            </ul>
            <h3>Qualifications</h3>
            <ul>
              <li>Master's degree in Accounting or Finance.</li>
              <li>Bachelor's degree with at least Second Class Upper Division.</li>
              <li>Prior teaching experience is an added advantage.</li>
            </ul>
            <p><em>Contract: 3 years renewable, MUBS scale M6.</em></p>
          `,
          deadline: new Date(Date.now() + 21 * 86400000),
          contactEmail: 'hr@mubs.ac.ug',
          userId: hr.id,
          featured: true
        }
      },
      {
        key: 'MUBS/HR/2025/003',
        record: {
          jobRef: 'MUBS/HR/2025/003',
          title: 'ICT Officer – Systems Administrator',
          departmentId: cfiDept ? cfiDept.id : null,
          location: 'MUBS Main Campus, Nakawa',
          type: 'Full-time',
          contractTerms: 'Permanent',
          grade: 'M5',
          vacancies: 1,
          description: `
            <h3>Duties</h3>
            <ul>
              <li>Administer University servers (Windows/Linux) and networks.</li>
              <li>Ensure backup, security, and disaster recovery of critical systems.</li>
              <li>Support staff and students on ICT-related matters.</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
              <li>Bachelor's degree in Computer Science, IT, or related field.</li>
              <li>Professional certifications (CCNA, MCSA, Linux+) are an added advantage.</li>
              <li>At least 3 years of hands-on systems administration experience.</li>
            </ul>
          `,
          deadline: new Date(Date.now() + 14 * 86400000),
          contactEmail: 'hr@mubs.ac.ug',
          userId: hr.id
        }
      },
      {
        key: 'MUBS/HR/2025/004',
        record: {
          jobRef: 'MUBS/HR/2025/004',
          title: 'Part-time Lecturer – Marketing',
          departmentId: marketingDept ? marketingDept.id : null,
          location: 'MUBS Main Campus, Nakawa',
          type: 'Part-time',
          contractTerms: 'Contract',
          grade: 'M6',
          vacancies: 2,
          description: `
            <h3>Scope</h3>
            <p>Teach evening and weekend sessions in Consumer Behaviour and Integrated Marketing Communications.</p>
            <h3>Qualifications</h3>
            <ul>
              <li>Master's in Marketing or related field.</li>
              <li>Minimum 2 years teaching or industry experience.</li>
            </ul>
          `,
          deadline: new Date(Date.now() + 10 * 86400000),
          contactEmail: 'hr@mubs.ac.ug',
          userId: hr.id
        }
      },
      {
        key: 'MUBS/HR/2025/005',
        record: {
          jobRef: 'MUBS/HR/2025/005',
          title: 'Library Assistant',
          departmentId: libraryDept ? libraryDept.id : null,
          location: 'MUBS Main Campus, Nakawa',
          type: 'Full-time',
          contractTerms: 'Permanent',
          grade: 'M7',
          vacancies: 2,
          description: `
            <h3>Duties</h3>
            <ul>
              <li>Assist users in locating books, journals and digital resources.</li>
              <li>Maintain the library catalogue and support cataloguing activities.</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
              <li>Diploma in Library &amp; Information Science.</li>
              <li>Good customer service and computer skills.</li>
            </ul>
          `,
          deadline: new Date(Date.now() + 25 * 86400000),
          contactEmail: 'hr@mubs.ac.ug',
          userId: hr.id
        }
      }
    ];

    let inserted = 0;
    let skipped = 0;

    for (const { key, record } of jobsData) {
      if (!record.departmentId) {
        console.warn(`⚠️  Skipping "${record.title}" — no matching department`);
        skipped++;
        continue;
      }
      const [, created] = await Job.findOrCreate({
        where: { jobRef: key },
        defaults: record
      });
      if (created) inserted++;
    }

    console.log(`📋 Jobs: ${inserted} inserted, ${skipped} skipped`);

    /* ---------- Summary ---------- */
    console.log('');
    console.log('✅ Seed complete');
    console.log('   Admin:   admin@mubs.ac.ug   / admin123');
    console.log('   HR:      hr@mubs.ac.ug      / employer123');
    console.log('   Student: student@mubs.ac.ug / student123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
})();