const express = require('express');
const router = express.Router();
const { User, Application, sequelize } = require('../models');
const { Op } = require('sequelize');
const { isAdmin } = require('../middleware/auth'); 

router.get('/', isAdmin, async (req, res) => {
  try {
    const { role, startDate, endDate, sort, order, page } = req.query;

    // 1. Pagination Setup
    const currentPage = parseInt(page) || 1;
    const limit = 10; // Users per page
    const offset = (currentPage - 1) * limit;

    // 2. Filtering Setup
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

    // 3. Sorting Setup
    let orderClause = [['createdAt', 'DESC']]; // Default sort
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    if (sort === 'name') {
      orderClause = [['name', sortOrder]];
    } else if (sort === 'applications') {
      // Sort by the aggregated applicationCount
      orderClause = [[sequelize.literal('applicationCount'), sortOrder]];
    } else if (sort === 'date') {
      orderClause = [['createdAt', sortOrder]];
    }

    // 4. Execute Query
    const { count, rows: users } = await User.findAndCountAll({
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
      order: orderClause,
      limit: limit,
      offset: offset
    });

    // 5. Flatten Data (for Pug)
    const flattenedUsers = users.map(u => {
      const userJson = u.toJSON(); 
      return {
        ...userJson,
        applicationCount: userJson.applicationCount
      };
    });

    // 6. Pagination Metadata
    const totalPages = Math.ceil(count.length / limit); // count is an array when using group

    res.render('users/index', {
      title: 'User Directory',
      users: flattenedUsers,
      filters: { 
        role: role || 'all', 
        startDate: startDate || '', 
        endDate: endDate || '',
        sort: sort || 'date',
        order: order || 'desc'
      },
      pagination: {
        currentPage,
        totalPages,
        limit,
        totalItems: count.length
      }
    });

  } catch (err) {
    console.error('[USERS LIST ERROR]', err);
    req.flash('error', 'Could not load users.');
    res.redirect('/admin');
  }
});

module.exports = router;