import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { Role } from '../user/user.interface';
import { ConsultantService } from './consultant.service';
import {
  addCaseCandidateZodSchema,
  availableConsultantsQueryZodSchema,
  consultationCaseListQueryZodSchema,
  consultationMessagesQueryZodSchema,
  createCandidateInviteZodSchema,
  createConsultantMarriageRecordZodSchema,
  createConsultationCaseZodSchema,
  createGuestInviteZodSchema,
  sendConsultationMessageZodSchema,
  startConsultationCaseZodSchema,
  consultantMarriageRecordListQueryZodSchema,
} from './consultant.validate';

const getAvailableConsultants = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await availableConsultantsQueryZodSchema.parseAsync(req.query);
  const result = await ConsultantService.getAvailableConsultants(
    String(userId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Available consultants retrieved successfully',
    data: result,
  });
});

const startConsultationCase = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await startConsultationCaseZodSchema.parseAsync(req.body);
  const result = await ConsultantService.startConsultationCase(
    String(userId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Consultation case started successfully',
    data: result,
  });
});

const createConsultationCase = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await createConsultationCaseZodSchema.parseAsync(req.body);
  const result = await ConsultantService.createConsultationCase(
    String(userId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Consultation case created successfully',
    data: result,
  });
});

const getConsultationCases = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const query = await consultationCaseListQueryZodSchema.parseAsync(req.query);
  const result = await ConsultantService.getConsultationCases(
    String(userId),
    role as Role,
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultation cases retrieved successfully',
    data: result,
  });
});

const getConsultationCase = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const result = await ConsultantService.getConsultationCase(
    String(userId),
    role as Role,
    String(req.params.caseId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultation case retrieved successfully',
    data: result,
  });
});

const addCandidateToCase = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await addCaseCandidateZodSchema.parseAsync(req.body);
  const result = await ConsultantService.addCandidateToCase(
    String(userId),
    String(req.params.caseId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate added to consultation case successfully',
    data: result,
  });
});

const createCandidateInvite = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await createCandidateInviteZodSchema.parseAsync(req.body);
  const result = await ConsultantService.createCandidateInvite(
    String(userId),
    String(req.params.caseId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Candidate invite created successfully',
    data: result,
  });
});

const acceptCandidateInvite = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await ConsultantService.acceptCandidateInvite(
    String(userId),
    String(req.params.inviteId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate invite accepted successfully',
    data: result,
  });
});

const declineCandidateInvite = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await ConsultantService.declineCandidateInvite(
    String(userId),
    String(req.params.inviteId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate invite declined successfully',
    data: result,
  });
});

const sendConsultationMessage = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const payload = await sendConsultationMessageZodSchema.parseAsync(req.body);
  const result = await ConsultantService.sendConsultationMessage(
    String(userId),
    role as Role,
    String(req.params.caseId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Consultation message sent successfully',
    data: result,
  });
});

const getConsultationMessages = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const query = await consultationMessagesQueryZodSchema.parseAsync(req.query);
  const result = await ConsultantService.getConsultationMessages(
    String(userId),
    role as Role,
    String(req.params.caseId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Consultation messages retrieved successfully',
    data: result,
  });
});

const createGuestInvite = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = await createGuestInviteZodSchema.parseAsync(req.body);
  const result = await ConsultantService.createGuestInvite(
    String(userId),
    String(req.params.caseId),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Guest invite created successfully',
    data: result,
  });
});

const getGuestInvite = CatchAsync(async (req: Request, res: Response) => {
  const result = await ConsultantService.getGuestInvite(String(req.params.token));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Guest invite retrieved successfully',
    data: result,
  });
});

const sendGuestMessage = CatchAsync(async (req: Request, res: Response) => {
  const payload = await sendConsultationMessageZodSchema.parseAsync(req.body);
  const result = await ConsultantService.sendGuestMessage(
    String(req.params.token),
    payload
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Guest message sent successfully',
    data: result,
  });
});

const getGuestMessages = CatchAsync(async (req: Request, res: Response) => {
  const query = await consultationMessagesQueryZodSchema.parseAsync(req.query);
  const result = await ConsultantService.getGuestMessages(
    String(req.params.token),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Guest messages retrieved successfully',
    data: result,
  });
});

const createConsultantMarriageRecord = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const payload = await createConsultantMarriageRecordZodSchema.parseAsync(
      req.body
    );
    const result = await ConsultantService.createConsultantMarriageRecord(
      String(userId),
      payload
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: 'Consultant marriage record created successfully',
      data: result,
    });
  }
);

const getConsultantMarriageRecords = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const query = await consultantMarriageRecordListQueryZodSchema.parseAsync(
      req.query
    );
    const result = await ConsultantService.getConsultantMarriageRecords(
      String(userId),
      query
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Consultant marriage records retrieved successfully',
      data: result,
    });
  }
);

export const ConsultantController = {
  acceptCandidateInvite,
  addCandidateToCase,
  createCandidateInvite,
  createConsultantMarriageRecord,
  createConsultationCase,
  createGuestInvite,
  declineCandidateInvite,
  getAvailableConsultants,
  getConsultantMarriageRecords,
  getConsultationCase,
  getConsultationCases,
  getConsultationMessages,
  getGuestInvite,
  getGuestMessages,
  sendConsultationMessage,
  sendGuestMessage,
  startConsultationCase,
};
