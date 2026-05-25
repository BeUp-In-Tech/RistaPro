
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { MeetingScheduleController } from './meetingSchedule.controller';

const router = Router();

router.post(
  '/',
  checkAuth(Role.USER),
  MeetingScheduleController.createMeetingSchedule
);

router.get(
  '/',
  checkAuth(Role.USER, Role.CONSULTANT),
  MeetingScheduleController.getMeetingSchedules
);

router.get(
  '/:meetingId',
  checkAuth(Role.USER, Role.CONSULTANT),
  MeetingScheduleController.getMeetingSchedule
);

router.patch(
  '/:meetingId/confirm',
  checkAuth(Role.CONSULTANT),
  MeetingScheduleController.confirmMeetingSchedule
);

router.patch(
  '/:meetingId/reschedule',
  checkAuth(Role.USER, Role.CONSULTANT),
  MeetingScheduleController.rescheduleMeeting
);

router.post(
  '/:meetingId/join',
  checkAuth(Role.USER, Role.CONSULTANT),
  MeetingScheduleController.joinMeetingSchedule
);

export const meetingScheduleRoutes = router;
