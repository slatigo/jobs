const express = require('express');
const router = express.Router();
const { User, Application, sequelize } = require('../models');
const { Op } = require('sequelize');
const { isAdmin } = require('../middleware/auth'); 

router.get('/', isAdmin, async (req, res) => {
  try {
    const { role, startDate, endDate } = req.query;

    let whereClause = {};
    if (role && role !== 'all') {
      whereClause.role = role;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = end;
      }
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: {
        include: [
          [sequelize.fn('COUNT', sequelize.col('applicationRecords.id')), 'applicationCount']
        ]
      },
      include: [{
        model: Application,
        as: 'applicationRecords',
        attributes: [], 
        required: false 
      }],
      group: ['User.id'], 
      subQuery: false,
      order: [['createdAt', 'DESC']]
    });

    // 🟢 Flatten the data so Pug can read `u.applicationCount` directly
    const flattenedUsers = users.map(u => {
      const userJson = u.toJSON(); 
      return {
        ...userJson,
        applicationCount: userJson.applicationCount
      };
    });

    res.render('users/index', {
      title: 'User Directory',
      users: flattenedUsers, // Pass the flattened users to the view
      filters: { role: role || 'all', startDate: startDate || '', endDate: endDate || '' }
    });

  } catch (err) {
    console.error('[USERS LIST ERROR]', err);
    req.flash('error', 'Could not load users.');
    res.redirect('/admin');
  }
});
module.exports = router;