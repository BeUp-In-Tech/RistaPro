import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { CandidateService } from './candidate.service';

// AUTH USER CREATE CANDIDATE PROFILE
const createCandidate = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const uploadedImages =
    req.files && Array.isArray(req.files)
      ? req.files.map((file) => file.path)
      : undefined;

  const payload = {
    ...req.body,
    images: uploadedImages ?? req.body.images,
  };

  const result = await CandidateService.createCandidate(userId, payload);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Candidate profile created successfully',
    data: result,
  });
});

export const CandidateController = {
  createCandidate,
};