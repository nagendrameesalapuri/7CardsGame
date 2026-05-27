import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { generateUniqueReferralCode } from '../utils/referral';

const JOINING_BONUS = 30; // ₹30 for new Google sign-ups

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
            const googleAvatar = profile.photos?.[0]?.value ?? null;
            let user = await User.findOne({ googleId: profile.id });
            if (!user) {
              const referralCode = await generateUniqueReferralCode();
              user = await User.create({
                googleId: profile.id,
                username: profile.displayName?.slice(0, 20) ?? `Player${Date.now()}`,
                email: profile.emails?.[0]?.value,
                avatar: googleAvatar ?? 'avatar_1',
                isGuest: false,
                walletBalance: JOINING_BONUS,
                referralCode,
              });
              // Log the joining bonus as a transaction for audit trail
              await Transaction.create({
                userId: String(user._id),
                type: 'bonus',
                amount: JOINING_BONUS,
                status: 'completed',
                description: 'Welcome bonus — new account joining reward',
                balanceBefore: 0,
                balanceAfter: JOINING_BONUS,
                heldBefore: 0,
                heldAfter: 0,
                metadata: { reason: 'joining_bonus' },
              });
              console.info(`[Auth] New user ${user.username} — ₹${JOINING_BONUS} joining bonus credited`);
            } else if (googleAvatar && user.avatar !== googleAvatar) {
              // Keep avatar in sync with Google profile photo
              user.avatar = googleAvatar;
              await user.save();
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
