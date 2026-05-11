import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CatchAsync } from '../../../utils/CatchAsync';
import { SendResponse } from '../../../utils/SendResponse';
import { CandidateConstantService } from './candidate.constant.service';

// PUBLIC CANDIDATE CONSTANT DATA
const getCandidateConstants = CatchAsync(async (req: Request, res: Response) => {
  const result = CandidateConstantService.getCandidateConstants();

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate constant data retrieved successfully',
    data: result,
  });
});

export const CandidateConstantController = {
  getCandidateConstants,
};
