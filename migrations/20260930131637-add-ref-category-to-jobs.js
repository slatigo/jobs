'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'ref_category', {
      type: Sequelize.ENUM('ADM', 'ACA', 'SUP', 'TEC', 'INT', 'GEN'),
      allowNull: false,
      defaultValue: 'GEN'
    });

    await queryInterface.addIndex('jobs', ['ref_category']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('jobs', ['ref_category']);
    await queryInterface.removeColumn('jobs', 'ref_category');
  }
};