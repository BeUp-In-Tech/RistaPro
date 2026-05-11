import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { MatchService } from './match.service';


// AUTH LINKED USER LIST ACTIVE MATCHES FOR A CANDIDATE
const getMatches = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const candidateId = req.query.candidateId as string;
  const result = await MatchService.getMatches( userId as string, candidateId );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Matches retrieved successfully',
    data: result,
  });
});

// AUTH LINKED USER GET ONE MATCH
const getMatch = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
   const candidateId = req.query.candidateId as string;
   const matchId = req.query.matchId as string;
  const result = await MatchService.getMatch( userId, matchId, candidateId );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Match retrieved successfully',
    data: result,
  });
});

// AUTH OWNER/EDITOR UNMATCH A CANDIDATE PAIR
const unmatch = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const candidateId = req.query.candidateId as string;
  const matchId = req.query.matchId as string;
  const result = await MatchService.unmatch( userId, matchId, candidateId );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Candidates unmatched successfully',
    data: result,
  });
});

export const MatchController = {
  getMatch,
  getMatches,
  unmatch,
};
