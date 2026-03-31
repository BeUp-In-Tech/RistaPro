import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from './user.interface';
import { UserController } from './user.controller';
import {
  createConsultantZodSchema,
  registerDeviceTokenZodSchema,
  updateMyProfileZodSchema,
  updateUserByAdminZodSchema,
  verifyProfileOtpZodSchema,
} from './user.validate';
import { multerUpload } from '../../config/multer.config';



const router = Router();


// AUTHENTICATED USER ROUTES

// GET ME
router.get('/me', checkAuth(...Object.values(Role)), UserController.getMe);

// UPDATE USER
router.patch(
  '/me',
  checkAuth(...Object.values(Role)),
  multerUpload.single('file'),
  validateRequest(updateMyProfileZodSchema),
  UserController.updateMyProfile
);

// SEND VERIFY OTP
router.post(
  '/me/send_verification_otp',
  checkAuth(...Object.values(Role)),
  UserController.sendVerificationOtp
);

// VERIFY PROFILE
router.post(
  '/me/verify_profile',
  checkAuth(...Object.values(Role)),
  validateRequest(verifyProfileOtpZodSchema),
  UserController.verifyMyProfile
);

// DEVICES
router.get('/devices', checkAuth(...Object.values(Role)), UserController.listMyDevices);

// REGISTER DEVICE TOKEN   
router.post(
  '/devices',
  checkAuth(...Object.values(Role)),
  validateRequest(registerDeviceTokenZodSchema),
  UserController.registerPushToken
);

// UNREGISTER TOKEN
router.patch(
  '/devices/:deviceId/inactive',
  checkAuth(...Object.values(Role)),
  UserController.unregisterPushToken
);


// ------------------ADMIN ROUTES---------------------

// CREATE CONSULTANT
router.post(
  '/',
  checkAuth(Role.ADMIN),
  validateRequest(createConsultantZodSchema),
  UserController.createConsultant
);

// LIST USERS
router.get('/', checkAuth(Role.ADMIN), UserController.getUsers);

// GET SINGLE USER
router.get('/:id', checkAuth(Role.ADMIN), UserController.getUserById);

// UPDATE USER
router.patch(
  '/:id',
  checkAuth(Role.ADMIN),
  multerUpload.single('file'),
  validateRequest(updateUserByAdminZodSchema),
  UserController.updateUserByAdmin
);
router.delete('/:id', checkAuth(Role.ADMIN), UserController.deleteUser);

export const userRoutes = router;
