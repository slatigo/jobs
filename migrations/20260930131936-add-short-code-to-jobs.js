'use strict';
const crypto = require('crypto');

/* Alphabet excludes I, O, 0, 1, l — visual lookalikes */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateShortCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    /* 1. Add the column (nullable, will backfill next) */
    await queryInterface.addColumn('jobs', 'short_code', {
      type: Sequelize.STRING(12),
      allowNull: true
    });

    /* 2. Backfill existing jobs with unique codes */
    const [jobs] = await queryInterface.sequelize.query(
      'SELECT id FROM jobs WHERE short_code IS NULL'
    );

    const used = new Set();

    for (const row of jobs) {
      let code;
      do {
        code = generateShortCode();
      } while (used.has(code));
      used.add(code);

      await queryInterface.sequelize.query(
        'UPDATE jobs SET short_code = ? WHERE id = ?',
        { replacements: [code, row.id] }
      );
    }

    /* 3. Add the unique index (now that all rows have a value) */
    await queryInterface.addIndex('jobs', ['short_code'], {
      unique: true,
      name: 'jobs_short_code_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('jobs', 'jobs_short_code_unique');
    await queryInterface.removeColumn('jobs', 'short_code');
  }
};