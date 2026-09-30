/**
 * Seeds the users table with starter accounts.
 *
 * Usage:
 *   node scripts/seed-users.js
 *
 * Accounts created (if they don't already exist):
 *   admin@mubs.ac.ug     / admin123     → Admin
 *   hr@mubs.ac.ug        / employer123  → Employer (can post jobs)
 *   applicant@mubs.ac.ug / applicant123 → Applicant (default role)
 *
 * The model's beforeSave hook hashes passwords automatically.
 * Safe to re-run: uses findOrCreate on email.
 */

require('dotenv').config();
const { sequelize, User } = require('../models');

/* ------------------------------------------------------------------ */
/* Accounts to seed                                                    */
/* ------------------------------------------------------------------ */
const users = [
  {
    email: 'admin@mubs.ac.ug',
    name: 'MUBS Admin',
    password: 'admin123',
    role: 'admin',
    phone: '+256 414 338 131'
  },
  {
    email: 'hr@mubs.ac.ug',
    name: 'Human Resources Office',
    password: 'employer123',
    role: 'employer',
    phone: '+256 414 338 131'
  },
  {
    email: 'applicant@mubs.ac.ug',
    name: 'Jane Nakato',
    password: 'applicant123',
    role: 'applicant',
    phone: '+256 700 000 001'
  }
];

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to', sequelize.config.database);

    let created = 0;
    let skipped = 0;

    for (const u of users) {
      const [user, wasCreated] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u
      });

      if (wasCreated) {
        created++;
        console.log(`   ✅ Created: ${user.email} (${user.role})`);
      } else {
        skipped++;
        console.log(`   ⏭️  Skipped: ${user.email} — already exists`);
      }
    }

    console.log('');
    console.log(`✅ Done — ${created} created, ${skipped} skipped`);
    console.log('');
    console.log('Test credentials:');
    console.log('   Admin     →  admin@mubs.ac.ug      / admin123');
    console.log('   HR        →  hr@mubs.ac.ug         / employer123');
    console.log('   Applicant →  applicant@mubs.ac.ug  / applicant123');
    console.log('');
    console.log('⚠️  Change these passwords before going live.');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (err.original) console.error('   SQL error:', err.original.sqlMessage);
    if (err.errors) {
      err.errors.forEach((e) =>
        console.error(`   - ${e.path}: ${e.message}`)
      );
    }
    process.exit(1);
  }
})();