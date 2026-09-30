const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL
      || 'http://localhost:3000/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = (profile.emails?.[0]?.value || '').toLowerCase();
      if (!email) return done(new Error('Google did not return an email'));

      /* ---- 1. Try to find by googleId ---- */
      let user = await User.findOne({ where: { googleId: profile.id } });
      if (user) return done(null, user);

      /* ---- 2. Try to find by email (link accounts) ---- */
      user = await User.findOne({ where: { email } });

      if (user) {
        // Existing account — link Google to it
        user.googleId = profile.id;
        if (!user.name && profile.displayName) user.name = profile.displayName;
        await user.save();
        return done(null, user);
      }

      /* ---- 3. Create a new applicant account ---- */
      user = await User.create({
        name: profile.displayName || email.split('@')[0],
        email,
        googleId: profile.id,
        password: null,           // no password for Google users
        role: 'applicant'
      });

      return done(null, user);
    } catch (err) {
      console.error('[GOOGLE OAUTH]', err);
      return done(err, null);
    }
  }
));

module.exports = passport;