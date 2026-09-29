require('dotenv').config();
const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connection established.');
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synced.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync error:', err);
    process.exit(1);
  }
})();