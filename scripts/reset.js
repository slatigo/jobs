require('dotenv').config();
const readline = require('readline');
const { sequelize } = require('../models');

/* ------------------------------------------------------------------ */
/* Confirm prompt — prevents accidental data loss in dev/prod         */
/* ------------------------------------------------------------------ */
function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    console.log(`   Database: ${sequelize.config.database}`);
    console.log(`   Host:     ${sequelize.config.host}:${sequelize.config.port}`);
    console.log('');

    // Allow --yes / -y flag to skip the prompt (useful for CI)
    const skipPrompt = process.argv.includes('--yes') || process.argv.includes('-y');

    if (!skipPrompt) {
      const answer = await confirm(
        '⚠️  This will DROP ALL TABLES and recreate them. Type "yes" to continue: '
      );
      if (answer !== 'yes') {
        console.log('❌ Aborted. Nothing was changed.');
        process.exit(0);
      }
    }

    console.log('');
    console.log('🔄 Dropping and recreating all tables...');
    await sequelize.sync({ force: true });
    console.log('✅ Database reset complete.');
    console.log('');
    console.log('Next steps:');
    console.log('   npm run db:seed:depts   # seed departments');
    console.log('   npm run db:seed         # seed users + demo jobs');
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  }
})();