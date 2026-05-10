import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';

export function configurePassport(): void {
  // Skip Google OAuth if credentials are not configured
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || clientID === 'your-google-client-id' || !clientSecret || clientSecret === 'your-google-client-secret') {
    console.warn('[Auth] Google OAuth not configured — guest login only');
  } else {
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ googleId: profile.id });
            if (!user) {
              user = await User.create({
                googleId: profile.id,
                username: profile.displayName?.slice(0, 20) ?? `Player${Date.now()}`,
                email: profile.emails?.[0]?.value,
                avatar: profile.photos?.[0]?.value ?? 'avatar_1',
                isGuest: false,
              });
            }
            done(null, user as any);
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user as any);
    } catch (err) {
      done(err);
    }
  });
}
