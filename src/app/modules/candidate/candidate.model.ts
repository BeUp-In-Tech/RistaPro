import { Schema, model } from 'mongoose';
import { Gender, ICandidate, IVerificationDetail, IVerificationStatus, VerificationState } from './candidate.interface';
import { ActiveStatus } from '../user/user.interface';
import {
  RELIGIONS,
  SECTS,
  CASTS,
  RELATIONSHIP_STATUSES,
  CHILDREN,
  MOVE_ABROAD,
  HIGHEST_EDUCATION,
  SMOKE_STATUSES,
  DRINK_STATUSES,
  INTERESTS,
  PERSONALITY_TRAITS,
} from '../../constant/constant';

const verificationDetailSchema = new Schema<IVerificationDetail>(
  {
    status: {
      type: String,
      enum: Object.values(VerificationState),
      default: VerificationState.NONE,
    },
    date: { type: Date },
    success: { type: Boolean },
    device: { type: String },
  },
  { _id: false, versionKey: false }
);

const verificationStatusSchema = new Schema<IVerificationStatus>(
  {
    face_verified: { type: verificationDetailSchema, default: () => ({}) },
    id_verified: { type: verificationDetailSchema, default: () => ({}) },
    parent_verified: { type: verificationDetailSchema, default: () => ({}) },
    education_verified: { type: verificationDetailSchema, default: () => ({}) },
    admin_verified: { type: verificationDetailSchema, default: () => ({}) },
  },
  { _id: false, versionKey: false }
);

const candidateSchema = new Schema<ICandidate>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    height: { type: Number },
    religion: { type: String, enum: Object.keys(RELIGIONS) },
    sect: {
      type: String,
      enum: Array.from(
        new Set(
          Object.values(SECTS).flatMap((map) => Object.keys(map))
        )
      ),
    },
    cast: { type: String, enum: Object.keys(CASTS) },
    caste: { type: String },
    profile_assist: { type: String },
    relationship_status: {
      type: String,
      enum: Object.keys(RELATIONSHIP_STATUSES),
    },
    have_children: { type: String, enum: Object.keys(CHILDREN) },
    move_abroad: { type: String, enum: Object.keys(MOVE_ABROAD) },
    occupation: { type: String },
    highest_education: { type: String, enum: Object.keys(HIGHEST_EDUCATION) },
    smoke_status: { type: String, enum: Object.keys(SMOKE_STATUSES) },
    drink_status: { type: String, enum: Object.keys(DRINK_STATUSES) },
    interests: [{ type: String, enum: Object.keys(INTERESTS) }],
    personality: [{ type: String, enum: Object.keys(PERSONALITY_TRAITS) }],
    relationToUser: { type: String },
    partnerExpectation: { type: String },
    bio: { type: String },
    image: [{ type: String }],
    face_verify_logs: { type: [verificationDetailSchema], default: [] },
    address: { type: String },
    coordinates: [{ type: Number }],
    verification_status: { type: verificationStatusSchema },
    isActive: {
      type: String,
      enum: Object.values(ActiveStatus),
      default: ActiveStatus.ACTIVE,
    },
  },
  { timestamps: true, versionKey: false }
);

const Candidate = model<ICandidate>('candidate', candidateSchema);

export default Candidate;
