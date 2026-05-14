import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import { PLAN_ORDER, PLANS } from './plan.constant';
import {
  CreatePlanPayload,
  IPlan,
  PlanAdminConfig,
  PlanKey,
  UpdatePlanPayload,
} from './plan.interface';
import PlanModel from './plan.model';
import { redisClient } from '../../config/redis.config';
import { invalidateAllMachineryCache } from '../../utils/dynamicCacheInvalidator';

// PLAN TYPE CHECKER
const isPlanKey = (value: string): value is PlanKey =>
  PLAN_ORDER.includes(value as PlanKey);

// PLAN TYPE VALIDATOR
const getPlanTypeOrThrow = (value: string): PlanKey => {
  if (!isPlanKey(value)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid plan type');
  }

  return value;
};

// PLAN PRICE VALIDATOR
const validatePriceForPlanType = (planType: PlanKey, price: number) => {
  if (planType === 'free' && price !== 0) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Free plan price must be 0');
  }

  if (planType !== 'free' && price <= 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Paid plan price must be greater than 0'
    );
  }
};

// BUILD DATABASE PAYLOAD FROM CONSTANT TEMPLATE
const buildPlanPayload = (
  planType: PlanKey,
  adminId: string,
  config: Pick<PlanAdminConfig, 'price' | 'isActive'>
) => {
  const planTemplate = PLANS[planType];

  return {
    ...planTemplate,
    price: config.price,
    isActive: config.isActive,
    sortOrder: PLAN_ORDER.indexOf(planType),
    updatedBy: adminId,
  };
};

// READ PLANS FROM DATABASE
const getPlans = async () => {
  const cacheKey = 'plans';

  // CHECK REDIS CACHE
  const cachedPlans = await redisClient.get(cacheKey);
  if (cachedPlans) {
    return JSON.parse(cachedPlans);
  }

  // FETCH FROM DB
  const plans = await PlanModel.find().sort({ sortOrder: 1 }).lean();

  // STORE IN REDIS CACHE
  await redisClient.set(cacheKey, JSON.stringify(plans), {
    EX: 60 * 60, // 1 hour
  });

  return plans;
};

const getPlan = async (planType: string) => {
  // CHECK REDIS CACHE
  const cacheKey = `plan:${planType}`;
  const cachedPlan = await redisClient.get(cacheKey);
  if (cachedPlan) {
    return JSON.parse(cachedPlan);
  }

  // FETCH FROM DB
  const parsedPlanType = getPlanTypeOrThrow(planType);
  const plan = await PlanModel.findOne({ key: parsedPlanType }).lean();

  if (!plan) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Plan not found');
  }


  // STORE IN REDIS
  await redisClient.set(cacheKey, JSON.stringify(plan), {
    EX: 60 * 60, // 1 hour
  });

  // RETURN OUPUT
  return plan;
};

// CREATE A PLAN USING ADMIN INPUT PLUS CONSTANT FEATURES
const createPlan = async (
  adminId: string,
  payload: CreatePlanPayload
): Promise<IPlan> => {
  validatePriceForPlanType(payload.planType, payload.price);

  // CHECK ALREADY EXIST
  const isPlanExists = await PlanModel.findOne({ key: payload.planType });

  if (isPlanExists) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `${PLANS[payload.planType].name} plan already exists. Use update API instead`
    );
  }

  // CREATE PLAN
  const createdPlan = await PlanModel.create({
    ...buildPlanPayload(payload.planType, adminId, {
      price: payload.price,
      isActive: true,
    }),
    createdBy: adminId,
  });

  // INVALIDATE REDIS CACHE KEY
  await redisClient.del('plans');

  // RETURN OUPUT
  return createdPlan;
};

// UPDATE ADMIN-CONTROLLED PLAN FIELDS AND REFRESH TEMPLATE DATA
const updatePlan = async (
  adminId: string,
  planType: string,
  payload: UpdatePlanPayload
) => {
  const parsedPlanType = getPlanTypeOrThrow(planType);
  const existingPlan = await PlanModel.findOne({ key: parsedPlanType });

  if (!existingPlan) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      `${PLANS[parsedPlanType].name} plan is not created yet. Use create API first`
    );
  }

  const nextPrice = payload.price ?? existingPlan.price;
  const nextIsActive = payload.isActive ?? existingPlan.isActive;

  // VALIDATE PRICE

  validatePriceForPlanType(parsedPlanType, nextPrice);

  // UPDATE PLAN
  const updatedPlan = await PlanModel.findOneAndUpdate(
    { key: parsedPlanType },
    {
      ...buildPlanPayload(parsedPlanType, adminId, {
        price: nextPrice,
        isActive: nextIsActive,
      }),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedPlan) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Plan not found');
  }

  // INVALIDATE REDIS CACHE KEY
  await redisClient.del('plans');
  await invalidateAllMachineryCache('plan:*');

  // RETURN OUPUT
  return updatedPlan;
};

export const PlanService = {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
};
