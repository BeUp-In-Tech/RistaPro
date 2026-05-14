import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { CandidatePreferenceService } from './candidatePreference.service';

// AUTH LINKED USER GET CANDIDATE PREFERENCES
const getCandidatePreference = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidatePreferenceService.getCandidatePreference(
      String(userId),
      String(req.params.candidateId)
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Candidate preferences retrieved successfully',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR REPLACE CANDIDATE PREFERENCES
const replaceCandidatePreference = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidatePreferenceService.replaceCandidatePreference(
      String(userId),
      String(req.params.candidateId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Candidate preferences saved successfully',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR PARTIAL UPDATE CANDIDATE PREFERENCES
const updateCandidatePreference = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidatePreferenceService.updateCandidatePreference(
      String(userId),
      String(req.params.candidateId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Candidate preferences updated successfully',
      data: result,
    });
  }
);

export const CandidatePreferenceController = {
  getCandidatePreference,
  replaceCandidatePreference,
  updateCandidatePreference,
};
