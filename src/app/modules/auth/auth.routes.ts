import { Router } from 'express';
import passport from 'passport';
import { authController } from './auth.controller';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';

const router = Router();

// GOOGLE
router.get('/google', authController.googleRegister);
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback
);

// GOOGLE AUTH FOR APPLE DEVICES
router.post('/google/auth', authController.googleAuthSystem);

// CREDENTIALS
router.post('/login', authController.credentialsLogin);


// CHANGE PASSWORD
router.patch('/change_password', checkAuth(...Object.keys(Role)), authController.changePassword);
// FORGET PASSWORD
router.post('/forget_password', authController.forgetPassword);
// VERIFY FORGET PASSWORD OTP
router.post('/verify_forget_password_otp', authController.verifyForgetPasswordOTP);
// RESET PASSWORD
router.post('/reset_password', authController.resetPassword);
// GET NEW ACCESS TOKEN
router.get('/get_new_access_token', checkAuth(...Object.keys(Role)), authController.getNewAccessToken);

export const authRouter = router;
