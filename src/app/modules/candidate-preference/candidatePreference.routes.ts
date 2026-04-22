import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { CandidatePreferenceController } from './candidatePreference.controller';
import {
  replaceCandidatePreferenceZodSchema,
  updateCandidatePreferenceZodSchema,
} from './candidatePreference.validate';

const router = Router();

// AUTH LINKED USER READ CANDIDATE PREFERENCES
router.get(
  '/:candidateId',
  checkAuth(Role.USER),
  CandidatePreferenceController.getCandidatePreference
);

// AUTH OWNER/EDITOR REPLACE CANDIDATE PREFERENCES
router.put(
  '/:candidateId',
  checkAuth(Role.USER),
  validateRequest(replaceCandidatePreferenceZodSchema),
  CandidatePreferenceController.replaceCandidatePreference
);

// AUTH OWNER/EDITOR PARTIAL UPDATE CANDIDATE PREFERENCES
router.patch(
  '/:candidateId',
  checkAuth(Role.USER),
  validateRequest(updateCandidatePreferenceZodSchema),
  CandidatePreferenceController.updateCandidatePreference
);

export const candidatePreferenceRoutes = router;
