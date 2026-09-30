require('dotenv').config();
const express = require('express');

const path = require('path');
const fs = require('fs');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const flash = require('connect-flash');
const methodOverride = require('method-override');
const passport = require('./config/passport');

/* ------------------------------------------------------------------ */
/* Ensure required folders exist                                       */
/* ------------------------------------------------------------------ */
const REQUIRED_DIRS = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads', 'resumes'),
  path.join(__dirname, 'public')
];

REQUIRED_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Created folder:', dir);
  }
});

/* ------------------------------------------------------------------ */
/* Models & app                                                        */
/* ------------------------------------------------------------------ */
const { sequelize } = require('./models');
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ */
/* View engine                                                         */
/* ------------------------------------------------------------------ */
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

/* ------------------------------------------------------------------ */
/* Core middleware                                                     */
/* ------------------------------------------------------------------ */
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

/* ------------------------------------------------------------------ */
/* Request logger                                                      */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  console.log('>>>', req.method, req.originalUrl);
  next();
});

/* ------------------------------------------------------------------ */
/* Session (must come BEFORE passport.session)                         */
/* ------------------------------------------------------------------ */
const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });

app.use(session({
  secret: process.env.SESSION_SECRET || 'mubs-secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(flash());

/* ------------------------------------------------------------------ */
/* Passport (must come AFTER session + flash)                          */
/* ------------------------------------------------------------------ */
app.use(passport.initialize());
app.use(passport.session());

/* ------------------------------------------------------------------ */
/* Global view locals                                                  */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;

  // Form repopulation flashes
  res.locals.formName    = req.flash('formName');
  res.locals.formEmail   = req.flash('formEmail');
  res.locals.formRole    = req.flash('formRole');
  res.locals.formPhone   = req.flash('formPhone');

  next();
});

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */
app.use('/',            require('./routes/index'));
app.use('/jobs',        require('./routes/jobs'));
app.use('/auth',        require('./routes/auth'));
app.use('/admin',       require('./routes/admin'));
app.use('/departments', require('./routes/departments'));
app.use('/files',       require('./routes/files'));
app.use('/j', require('./routes/jobs/share'));
/* ------------------------------------------------------------------ */
/* 404 handler                                                         */
/* ------------------------------------------------------------------ */
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

/* ------------------------------------------------------------------ */
/* Error handler                                                       */
/* ------------------------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error('[APP ERROR]', err.stack);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render('500', { title: 'Server Error', error: err });
});

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    await sequelize.sync({ alter: false });

    await sessionStore.sync();
    console.log('✅ Sessions table ready');

    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
})();