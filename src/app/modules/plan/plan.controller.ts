import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import { PlanService } from './plan.service';

// PUBLIC PLAN LIST
const getPlans = CatchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.getPlans();

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Plans retrieved successfully',
    data: result,
  });
});

// PUBLIC SINGLE PLAN
const getPlan = CatchAsync(async (req: Request, res: Response) => {
  const result = await PlanService.getPlan(String(req.params.planType));

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Plan retrieved successfully',
    data: result,
  });
});

// ADMIN PLAN CREATE
const createPlan = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await PlanService.createPlan(userId as string, req.body);

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Plan created successfully',
    data: result,
  });
});

// ADMIN PLAN UPDATE
const updatePlan = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const result = await PlanService.updatePlan(
    userId as string,
    req.params.planType as string,
    req.body
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Plan updated successfully',
    data: result,
  });
});

export const PlanController = {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
};
