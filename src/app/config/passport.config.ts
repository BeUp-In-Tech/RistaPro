// import passport from 'passport';
// import { Strategy as LocalStrategy } from 'passport-local';
// import {
//   Strategy as GoogleStrategy,
//   Profile,
//   VerifyCallback,
// } from 'passport-google-oauth20';
// import {
//   Strategy as FacebookStrategy,
//   // Profile as FacebookProfile,
// } from 'passport-facebook';
// import env from './env';
// import bcrypt from 'bcrypt';

// CREDENTIALS LOGIN LOCAL STRATEGY
// passport.use(
//   new LocalStrategy(
//     { usernameField: 'email', passwordField: 'password' },
//     async (email: string, password: string, done: any) => {
//       try {
//         const user = await User.findOne({ email });

//         if (!user) {
//           return done(null, false, { message: 'User does not exist!' });
//         }

//         const isGoogleUser = user.auths?.some(
//           (provider) => provider.provider === 'google'
//         );
//         const isFacebookUser = user.auths?.some(
//           (provider) => provider.provider === 'facebook'
//         );

//         if (isGoogleUser) {
//           return done(null, false, {
//             message:
//               'You are authenticate through Google. If you want to login with credentials, then at first login with Google and set a password to your gmail an then you can login with email and password!',
//           });
//         }

//         if (isFacebookUser) {
//           return done(null, false, {
//             message:
//               'You are authenticate through Facebook. If you want to login with credentials, then at first login with Facebook and set a password to your gmail an then you can login with email and password!',
//           });
//         }

//         // Matching Password
//         const isMatchPassowrd = await bcrypt.compare(
//           password,
//           user.password as string
//         );

//         if (!isMatchPassowrd) {
//           return done(null, false, { message: 'Password incorrect!' });
//         }

//         return done(null, user);
//       } catch (error) {
//         console.log('Passport Local login error: ', error);
//         done(error);
//       }
//     }
//   )
// );

// USER GOOGLE REGISTER STRATEGY
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: env.GOOGLE_OAUTH_ID,
//       clientSecret: env.GOOGLE_OAUTH_SECRET,
//       callbackURL: env.GOOGLE_CALLBACK_URL,
//     },

//     async (
//       _accessToken: string,
//       _refreshToken: string,
//       profile: Profile,
//       done: VerifyCallback
//     ) => {
//       try {
//         const email = profile.emails?.[0].value;

//         if (!email) {
//           return done(null, false, { message: 'No email found' });
//         }

//         let user = await User.findOne({ email });

//         if (!user) {
//           user = await User.create({
//             name: profile.displayName,
//             email,
//             picture: profile.photos?.[0].value,
//             role: Role.USER,
//             isVerified: true,
//             auths: [
//               {
//                 provider: 'google',
//                 providerId: profile.id,
//               },
//             ],
//           });
//         }

//         return done(null, user);
//       } catch (error) {
//         console.log('Google strategy error', error);
//         done(error);
//       }
//     }
//   )
// );

// passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
//   done(null, user._id);
// });

// passport.deserializeUser(async (id: string, done: any) => {
//   try {
//     const user = await User.findById(id);
//     done(null, user);
//   } catch (error) {
//     console.log(error);
//     done(error);
//   }
// });
