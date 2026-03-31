import { Types } from 'mongoose';

export const PLAN_KEYS = ['free', 'gold', 'platinum'] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

export interface Plan {
  key: PlanKey;
  name: string;
  dailyLikes: number;
  superLikes: number;
  canSeeWhoLiked: boolean;
  canMessage: boolean;
  canAudioCall: boolean;
  canVideoCall: boolean;
  profileBoost: boolean;
  featureList: string[];
}

export interface PlanAdminConfig {
  price: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface IPlan extends Plan {
  price: number;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

export interface CreatePlanPayload {
  planType: PlanKey;
  price: number;
}

export interface UpdatePlanPayload {
  price?: number;
  isActive?: boolean;
}
