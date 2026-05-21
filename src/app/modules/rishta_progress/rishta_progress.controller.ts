import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { Role } from '../user/user.interface';
import { RishtaProgressService } from './rishta_progress.service';
import {
  marriageRequestListQueryZodSchema,
  marriedListQueryZodSchema,
  rishtaProgressQueryZodSchema,
} from './rishta_progress.validate';

const getProgress = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await rishtaProgressQueryZodSchema.parseAsync(req.query);
  const result = await RishtaProgressService.getProgress(String(userId), query);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Rishta progress retrieved successfully',
    data: result,
  });
});

const createMarriageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { role, userId } = req.user as JwtPayload;
    const result = await RishtaProgressService.createMarriageRequest(
      String(userId),
      role as Role,
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: 'Marriage request created successfully',
      data: result,
    });
  }
);

const acceptMarriageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await RishtaProgressService.acceptMarriageRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Marriage request accepted successfully',
      data: result,
    });
  }
);

const rejectMarriageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await RishtaProgressService.rejectMarriageRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Marriage request rejected successfully',
      data: result,
    });
  }
);

const getMarriageRequests = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await marriageRequestListQueryZodSchema.parseAsync(req.query);
  const result = await RishtaProgressService.getMarriageRequests(
    String(userId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Marriage requests retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const adminMarkMarried = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await RishtaProgressService.adminMarkMarried(
    String(userId),
    req.body
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Marriage confirmed successfully',
    data: result,
  });
});

const getMarriedList = CatchAsync(async (req: Request, res: Response) => {
  const { role, userId } = req.user as JwtPayload;
  const query = await marriedListQueryZodSchema.parseAsync(req.query);
  const result = await RishtaProgressService.getMarriedList(
    String(userId),
    role as Role,
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Married couples retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const RishtaProgressController = {
  acceptMarriageRequest,
  adminMarkMarried,
  createMarriageRequest,
  getMarriageRequests,
  getMarriedList,
  getProgress,
  rejectMarriageRequest,
};
