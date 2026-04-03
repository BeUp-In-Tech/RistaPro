/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import env from './env';
import User from './../modules/user/user.model';
import { Role } from '../modules/user/user.interface';
import { ensureNotificationPreference } from '../modules/notification/notification.service';

// USER GOOGLE REGISTER STRATEGY
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_OAUTH_ID,
      clientSecret: env.GOOGLE_OAUTH_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },

    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: 'No email found' });
        }

        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            full_name: profile.displayName,
            email,
            picture: profile.photos?.[0]?.value,
            isVerified: true,
            auths: [
              {
                provider: 'google',
                providerId: profile.id,
              },
            ],
          });
        }

        await ensureNotificationPreference(
          user._id.toString(),
          user.role ?? Role.USER
        );

        return done(null, user);
      } catch (error) {
        console.log('Google strategy error', error);
        done(error);
      }
    }
  )
);

// CREDENTIALS LOGIN LOCAL STRATEGY
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email: string, password: string, done: any) => {
      try {
        const user = await User.findOne({ email });

        if (!user) {
          return done(null, false, { message: 'User does not exist!' });
        }

        const isGoogleUser = user.auths?.some(
          (provider) => provider.provider === 'google'
        );
        const isAppleUser = user.auths?.some(
          (provider) => provider.provider === 'apple'
        );

        if (isGoogleUser && !user.password) {
          return done(null, false, {
            message:
              'You are authenticate through Google. Try to login with Google',
          });
        }

        if (isAppleUser && !user.password) {
          return done(null, false, {
            message:
              'You are authenticate through Apple. Try to login with Apple',
          });
        }
 
        if (!user.password) {
          return done(null, false, {
            message: 'Password not set for this account',
          });
        }

        // Matching Password
        const isMatchPassword = await bcrypt.compare(password, user.password);

        if (!isMatchPassword) {
          return done(null, false, { message: 'Password incorrect!' });
        }
      } catch (e: any) {
        console.log('Passport Local login error: ', e.message);
      }
    }
  )
);

passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done: any) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error: any) {
    console.log('Passport deserializeUser error: ', error.message);
    done(error);
  }
});
