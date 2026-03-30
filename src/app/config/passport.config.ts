/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import {Strategy as LocalStrategy} from 'passport-local';
import bcrypt from 'bcrypt';



import env from './env';
import User from './../modules/user/user.model';
import { Role } from '../modules/user/user.interface';


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
        const email = profile.emails?.[0].value;

        if (!email) {
          return done(null, false, { message: 'No email found' });
        }

        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            full_name: profile.displayName,
            email,
            picture: profile.photos?.[0].value,
            role: Role.USER,
            isVerified: true,
            auths: [
              {
                provider: 'google',
                providerId: profile.id,
              },
            ],
          });
        }

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
    

        if (isGoogleUser) {
          return done(null, false, {
            message:
              'You are authenticate through Google. Try to login with Google',
          });
        }

        if (isAppleUser) {
          return done(null, false, {
            message:
              'You are authenticate through Apple. Try to login with Apple',
          });
        }

        // Matching Password
        const isMatchPassowrd = await bcrypt.compare(
          password,
          user.password as string
        );

        if (!isMatchPassowrd) {
          return done(null, false, { message: 'Password incorrect!' });
        }

        return done(null, user);
      } catch (error) {
        console.log('Passport Local login error: ', error);
        done(error);
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
    console.log("Passort deserializeUser error: ", error.message);
    done(error);
  }
});
