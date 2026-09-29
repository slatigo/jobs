exports.isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Please login to continue');
  res.redirect('/auth/login');
};

exports.isEmployer = (req, res, next) => {
  const u = req.session.user;
  if (u && (u.role === 'employer' || u.role === 'admin')) return next();
  req.flash('error', 'Access denied');
  res.redirect('/');
};

exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Access denied');
  res.redirect('/');
};