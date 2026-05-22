import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { CandidateConstantController } from './constant/candidate.constant.controller';
import { CandidateController } from './candidate.controller';
import { CandidateLinkedUserController } from './linked-user/candidateLinkedUser.controller';
import {
  createCandidateLinkedUserZodSchema,
  updateCandidateLinkedUserZodSchema,
} from './linked-user/candidateLinkedUser.validate';
import {
  createCandidateZodSchema,
  updateCandidateZodSchema,
} from './candidate.validate';
import { multerUpload } from '../../config/multer.config';

const router = Router();

// PUBLIC CANDIDATE CONSTANT DATA
router.get('/constants', CandidateConstantController.getCandidateConstants);

// AUTHENTICATED USER CREATE CANDIDATE PROFILE
router.post(
  '/',
  checkAuth(Role.USER),
  multerUpload.array('files'),
  validateRequest(createCandidateZodSchema),
  CandidateController.createCandidate
);

// AUTHENTICATED LINKED USER UPDATE CANDIDATE PROFILE
router.patch(
  '/:candidateId',
  checkAuth(Role.USER),
  multerUpload.array('files'),
  validateRequest(updateCandidateZodSchema),
  CandidateController.updateCandidate
);

// AUTHENTICATED USER ACCESS TO CANDIDATE PROFILES
router.get(
  '/my_linked_profiles',
  checkAuth(Role.USER),
  CandidateLinkedUserController.getMyLinkedCandidates
);

// AUTHENTICATED USER BASIC CANDIDATE PROFILE
router.get(
  '/my_basic_profile',
  checkAuth(Role.USER),
  CandidateLinkedUserController.getMyCandidateBasicProfile
);

// AUTHENTICATED LINKED USER FULL CANDIDATE PROFILE DETAILS
router.get(
  '/:targetCandidateId/full_profile',
  checkAuth(Role.USER),
  CandidateController.getFullCandidateProfileDetails
);

// AUTHENTICATED USER LIST LINKED USERS OF A CANDIDATE PROFILE
router.get(
  '/:candidateId/linked_users',
  checkAuth(Role.USER),
  CandidateLinkedUserController.getCandidateLinkedUsers
);

// AUTHENTICATED OWNER ADD LINKED USER
router.post(
  '/:candidateId/linked_users',
  checkAuth(Role.USER),
  validateRequest(createCandidateLinkedUserZodSchema),
  CandidateLinkedUserController.addCandidateLinkedUser
);

// AUTHENTICATED OWNER UPDATE LINKED USER
router.patch(
  '/:candidateId/linked_users/:linkedUserId',
  checkAuth(Role.USER, Role.ADMIN),
  validateRequest(updateCandidateLinkedUserZodSchema),
  CandidateLinkedUserController.updateCandidateLinkedUser
);

// AUTHENTICATED OWNER REMOVE LINKED USER
router.delete(
  '/:candidateId/linked_users/:linkedUserId',
  checkAuth(Role.USER, Role.ADMIN),
  CandidateLinkedUserController.removeCandidateLinkedUser
);

export const candidateRoutes = router;
