import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { CandidateController } from './candidate.controller';
import { createCandidateZodSchema } from './candidate.validate';
import { multerUpload } from '../../config/multer.config';

const router = Router();


// AUTHENTICATED USER CREATE CANDIDATE PROFILE
router.post(
  '/',
  checkAuth(...Object.values(Role)),
  multerUpload.array('files'),
  validateRequest(createCandidateZodSchema),
  CandidateController.createCandidate
);

export const candidateRoutes = router;
