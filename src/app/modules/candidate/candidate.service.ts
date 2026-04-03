import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import Candidate from './candidate.model';
import {
  ICreateCandidatePayload,
} from './candidate.interface';
import { buildCandidateCreatePayload, buildCandidateResponse } from './candidate.utility';




// 1. BUILD AUTHENTICATED USER'S CANDIDATE PROFILE
const createCandidate = async (
  userId: string,
  payload: ICreateCandidatePayload
) => {
  const existingCandidate = await Candidate.findOne({ user: userId })
    .select('_id')
    .lean();

  if (existingCandidate) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Candidate profile already exists for this user'
    );
  }

  const createdCandidate = await Candidate.create(
    buildCandidateCreatePayload(userId, payload)
  );

  return buildCandidateResponse(createdCandidate.toObject());
};

export const CandidateService = {
  createCandidate,
};
