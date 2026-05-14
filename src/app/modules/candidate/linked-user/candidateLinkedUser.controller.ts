import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../../utils/CatchAsync';
import { SendResponse } from '../../../utils/SendResponse';
import { CandidateLinkedUserService } from './candidateLinkedUser.service';

// AUTH USER LIST MANAGED CANDIDATE PROFILES
const getMyLinkedCandidates = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await CandidateLinkedUserService.getMyLinkedCandidates(userId);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Linked candidate access retrieved successfully',
    data: result,
  });
});

// AUTH USER GET BASIC CANDIDATE PROFILE
const getMyCandidateBasicProfile = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidateLinkedUserService.getMyCandidateBasicProfile(
      userId
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Candidate basic profile retrieved successfully',
      data: result,
    });
  }
);

// AUTH USER LIST LINKED USERS OF A CANDIDATE PROFILE
const getCandidateLinkedUsers = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await CandidateLinkedUserService.getCandidateLinkedUsers(
    userId,
    String(req.params.candidateId)
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidate linked users retrieved successfully',
    data: result,
  });
});

// AUTH OWNER ADD LINKED USER
const addCandidateLinkedUser = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await CandidateLinkedUserService.addCandidateLinkedUser(
    userId,
    String(req.params.candidateId),
    req.body
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Linked user added successfully',
    data: result,
  });
});

// AUTH OWNER UPDATE LINKED USER
const updateCandidateLinkedUser = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidateLinkedUserService.updateCandidateLinkedUser(
      userId,
      String(req.params.candidateId),
      String(req.params.linkedUserId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Linked user updated successfully',
      data: result,
    });
  }
);

// AUTH OWNER REMOVE LINKED USER
const removeCandidateLinkedUser = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await CandidateLinkedUserService.removeCandidateLinkedUser(
      userId,
      String(req.params.candidateId),
      String(req.params.linkedUserId)
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Linked user removed successfully',
      data: result,
    });
  }
);

export const CandidateLinkedUserController = {
  addCandidateLinkedUser,
  getCandidateLinkedUsers,
  getMyCandidateBasicProfile,
  getMyLinkedCandidates,
  removeCandidateLinkedUser,
  updateCandidateLinkedUser,
};
