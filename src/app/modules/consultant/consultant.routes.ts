import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { MeetingScheduleController } from '../meeting_schedule/meetingSchedule.controller';
import { Role } from '../user/user.interface';
import { ConsultantController } from './consultant.controller';

const router = Router();

//------------------ GUEST HANDLING--------------
router.post(
  '/guest-invites/:token/meetings/:meetingId/join',
  MeetingScheduleController.joinGuestMeetingSchedule
);

router.post(
  '/guest-invites/:token/messages',
  ConsultantController.sendGuestMessage
);

router.get(
  '/guest-invites/:token/messages',
  ConsultantController.getGuestMessages
);

router.get('/guest-invites/:token', ConsultantController.getGuestInvite);




router.get(
  '/available',
  checkAuth(Role.USER),
  ConsultantController.getAvailableConsultants
);


//-----------------------CASE--------------------
router.post(
  '/cases/start',
  checkAuth(Role.USER),
  ConsultantController.startConsultationCase
);

router.post(
  '/cases',
  checkAuth(Role.CONSULTANT),
  ConsultantController.createConsultationCase
);

router.get(
  '/cases',
  checkAuth(Role.USER, Role.CONSULTANT),
  ConsultantController.getConsultationCases
);

router.get(
  '/cases/:caseId',
  checkAuth(Role.USER, Role.CONSULTANT),
  ConsultantController.getConsultationCase
);

router.post(
  '/cases/:caseId/candidates',
  checkAuth(Role.CONSULTANT),
  ConsultantController.addCandidateToCase
);

router.post(
  '/cases/:caseId/candidate-invites',
  checkAuth(Role.CONSULTANT),
  ConsultantController.createCandidateInvite
);

router.post(
  '/candidate-invites/:inviteId/accept',
  checkAuth(Role.USER),
  ConsultantController.acceptCandidateInvite
);

router.post(
  '/candidate-invites/:inviteId/decline',
  checkAuth(Role.USER),
  ConsultantController.declineCandidateInvite
);

router.get(
  '/cases/:caseId/messages',
  checkAuth(Role.USER, Role.CONSULTANT),
  ConsultantController.getConsultationMessages
);

router.post(
  '/cases/:caseId/messages',
  checkAuth(Role.USER, Role.CONSULTANT),
  ConsultantController.sendConsultationMessage
);

router.post(
  '/cases/:caseId/guest-invites',
  checkAuth(Role.CONSULTANT),
  ConsultantController.createGuestInvite
);


// -----------------MARRIAGE REQUESTS-----------------------
router.post(
  '/marriage-records',
  checkAuth(Role.CONSULTANT),
  ConsultantController.createConsultantMarriageRecord
);

router.get(
  '/marriage-records',
  checkAuth(Role.CONSULTANT),
  ConsultantController.getConsultantMarriageRecords
);

export const consultantRoutes = router;
