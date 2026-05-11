import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { MatchController } from './match.controller';

const router = Router();

// AUTH LINKED USER LIST ACTIVE MATCHES FOR A CANDIDATE
router.get('/', checkAuth(Role.USER), MatchController.getMatches);

// AUTH LINKED USER GET ONE MATCH
router.get('/:matchId', checkAuth(Role.USER), MatchController.getMatch);

// AUTH OWNER/EDITOR UNMATCH A CANDIDATE PAIR
router.patch(
  '/:matchId/unmatch',
  checkAuth(Role.USER),
  MatchController.unmatch
);

export const matchRoutes = router;
