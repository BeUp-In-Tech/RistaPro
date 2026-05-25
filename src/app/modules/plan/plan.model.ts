import { Schema, model } from 'mongoose';
import { IPlan, PLAN_KEYS } from './plan.interface';

const planSchema = new Schema<IPlan>(
  {
    key: { type: String, enum: PLAN_KEYS, required: true, unique: true },
    name: { type: String, required: true },
    dailyLikes: { type: Number, required: true, min: 0 },
    superLikes: { type: Number, required: true, min: 0 },    
    canSeeWhoLiked: { type: Boolean, required: true },
    canMessage: { type: Boolean, required: true },
    canAudioCall: { type: Boolean, required: true },
    canVideoCall: { type: Boolean, required: true },
    canViewFullProfile: { type: Boolean, required: true },
    canUseConsultant: { type: Boolean, required: true },
    profileBoost: { type: Boolean, required: true },
    featureList: { type: [String], required: true },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', required: false },  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PlanModel = model<IPlan>('plan', planSchema);

export default PlanModel;
