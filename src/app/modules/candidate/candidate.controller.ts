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

// AUTH LINKED USER UPDATE CANDIDATE PROFILE
const updateCandidate = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const uploadedImages =
    req.files && Array.isArray(req.files)
      ? req.files.map((file) => file.path)
      : [];

  const result = await CandidateService.updateCandidate(
    userId,
    String(req.params.candidateId),
    req.body,
    uploadedImages
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate profile updated successfully',
    data: result,
  });
});

// AUTH LINKED USER VIEW PLAN-GATED FULL CANDIDATE PROFILE
const getFullCandidateProfileDetails = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidateService.getFullCandidateProfileDetails(
      String(userId),
      typeof req.query.candidateId === 'string' ? req.query.candidateId : '',
      String(req.params.targetCandidateId)
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Full candidate profile retrieved successfully',
      data: result,
    });
  }
);

// AUTH USER VIEW OWN FULL CANDIDATE PROFILE
const getMyFullCandidateProfile = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidateService.getMyFullCandidateProfile(String(userId));

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'My full candidate profile retrieved successfully',
      data: result,
    });
  }
);

// ADMIN MIGRATE LEGACY FLAT TAXONOMY VALUES TO TREE-BASED FIELDS
const migrateLegacyTaxonomy = CatchAsync(async (req: Request, res: Response) => {
  const result = await CandidateService.migrateLegacyTaxonomy({
    dryRun: req.query.dryRun === 'true',
  });

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.dryRun
      ? 'Legacy taxonomy migration dry run completed'
      : 'Legacy taxonomy migration completed',
    data: result,
  });
});

export const CandidateController = {
  createCandidate,
  getFullCandidateProfileDetails,
  getMyFullCandidateProfile,
  migrateLegacyTaxonomy,
  updateCandidate,
};
