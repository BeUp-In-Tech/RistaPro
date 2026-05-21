
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { CallController } from './call.controller';

const router = Router();

router.post('/start', checkAuth(Role.USER), CallController.startCall);

router.post('/:callId/accept', checkAuth(Role.USER), CallController.acceptCall);

router.post('/:callId/reject', checkAuth(Role.USER), CallController.rejectCall);

router.post('/:callId/end', checkAuth(Role.USER), CallController.endCall);

router.post('/:callId/token', checkAuth(Role.USER), CallController.renewCallToken);

router.post(
  '/:callId/participants/invite',
  checkAuth(Role.USER),
  CallController.inviteCallParticipant
);

router.post(
  '/:callId/participants/respond',
  checkAuth(Role.USER),
  CallController.respondCallParticipant
);

router.get('/:callId', checkAuth(Role.USER), CallController.getCall);

export const callRoutes = router;
