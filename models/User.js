const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: {
    type: DataTypes.STRING(160),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },

  /* Password optional — Google users have no password */
  password: { type: DataTypes.STRING(255), allowNull: true },

  /* Google OAuth ID */
  googleId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true
  },

  role: {
    type: DataTypes.ENUM('applicant', 'employer', 'admin'),
    defaultValue: 'applicant'
  },
  phone: { type: DataTypes.STRING(30) },

  passwordResetToken: { type: DataTypes.STRING(255), allowNull: true },
  passwordResetExpires: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'users',
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password') && user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

User.prototype.comparePassword = function (password) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(password, this.password);
};

User.prototype.toSafeJSON = function () {
  return { id: this.id, name: this.name, email: this.email, role: this.role };
};

User.ROLES = ['applicant', 'employer', 'admin'];

module.exports = User;