import { Schema, model } from 'mongoose';
import {
  Gender,
  ICandidate,
  IVerificationDetail,
  IVerificationStatus,
  RelationToUser,
  VerificationState,
} from './candidate.interface';
import { ActiveStatus } from '../user/user.interface';
import { PLAN_KEYS } from '../plan/plan.interface';
import {
  RELIGIONS,
  SECTS,
  SECT_DETAIL_VALUES,
  CASTE_CATEGORIES,
  CASTE_CLANS,
  CASTE_TREE_CASTES,
  MADHHABS,
  RELIGION_TREE_MADHHABS,
  RELIGION_TREE_MOVEMENTS,
  RELIGION_TREE_RELIGIONS,
  RELIGION_TREE_SECTS,
  SUFI_ORDERS,
  THEOLOGICAL_ORIENTATIONS,
  RELATIONSHIP_STATUSES,
  CHILDREN,
  MOVE_ABROAD,
  OCCUPATIONS,
  HIGHEST_EDUCATION,
  SMOKE_STATUSES,
  DRINK_STATUSES,
  INTERESTS,
  PERSONALITY_TRAITS,
} from '../../constant/constant';

const religionKeys = Array.from(
  new Set([...Object.keys(RELIGIONS), ...Object.keys(RELIGION_TREE_RELIGIONS)])
);

const sectKeys = Array.from(
  new Set([
    ...Object.values(SECTS).flatMap((map) => Object.keys(map)),
    ...Object.keys(RELIGION_TREE_SECTS),
  ])
);

const casteKeys = Object.keys(CASTE_TREE_CASTES);

const madhhabKeys = Array.from(
  new Set([...Object.keys(MADHHABS), ...Object.keys(RELIGION_TREE_MADHHABS)])
);

// Reusable shape for verification activity logs and current verification state.
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

// Keeps the latest verification status grouped by verification type.
const verificationStatusSchema = new Schema<IVerificationStatus>(
  {
    face_verified: { type: verificationDetailSchema, default: () => ({}) },
    id_verified: { type: verificationDetailSchema, default: () => ({}) },
    parent_verified: { type: verificationDetailSchema, default: () => ({}) },
    education_verified: { type: verificationDetailSchema, default: () => ({}) }
  },
  { _id: false, versionKey: false }
);

const religiousSchema = new Schema(
  {
    religion: { type: String, enum: religionKeys },
    sect: { type: String, enum: sectKeys },
    sectDetail: { type: String, enum: Object.keys(SECT_DETAIL_VALUES) },
    madhhab: { type: String, enum: madhhabKeys },
    movement: { type: String, enum: Object.keys(RELIGION_TREE_MOVEMENTS) },
    theologicalOrientation: {
      type: String,
      enum: Object.keys(THEOLOGICAL_ORIENTATIONS),
    },
    sufiOrder: { type: String, enum: Object.keys(SUFI_ORDERS) },
  },
  { _id: false, versionKey: false }
);

const casteIdentitySchema = new Schema(
  {
    category: { type: String, enum: Object.keys(CASTE_CATEGORIES) },
    caste: { type: String, enum: casteKeys },
    clan: { type: String, enum: Object.keys(CASTE_CLANS) },
  },
  { _id: false, versionKey: false }
);

const candidateSchema = new Schema<ICandidate>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    plan: { type: String, enum: PLAN_KEYS, default: 'free', trim: true },
    name: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    height: { type: Number },
    religious: { type: religiousSchema, default: undefined },
    casteIdentity: { type: casteIdentitySchema, default: undefined },
    // Deprecated flat fields are kept temporarily so old documents and clients keep working.
    religion: { type: String, enum: religionKeys },
    sect: {
      type: String,
      enum: sectKeys,
    },
    sectDetail: { type: String, enum: Object.keys(SECT_DETAIL_VALUES) },
    madhhab: { type: String, enum: madhhabKeys },
    movement: { type: String, enum: Object.keys(RELIGION_TREE_MOVEMENTS) },
    theologicalOrientation: {
      type: String,
      enum: Object.keys(THEOLOGICAL_ORIENTATIONS),
    },
    sufiOrder: { type: String, enum: Object.keys(SUFI_ORDERS) },
    profile_assist: { type: String, trim: true },
    relationship_status: {
      type: String,
      enum: Object.keys(RELATIONSHIP_STATUSES),
    },
    have_children: { type: String, enum: Object.keys(CHILDREN) },
    move_abroad: { type: String, enum: Object.keys(MOVE_ABROAD) },
    occupation: { type: String, enum: Object.keys(OCCUPATIONS) },
    highest_education: { type: String, enum: Object.keys(HIGHEST_EDUCATION) },
    smoke_status: { type: String, enum: Object.keys(SMOKE_STATUSES) },
    drink_status: { type: String, enum: Object.keys(DRINK_STATUSES) },
    interests: [{ type: String, enum: Object.keys(INTERESTS) }],
    personality: [{ type: String, enum: Object.keys(PERSONALITY_TRAITS) }],
    relationToUser: { type: String, enum: RelationToUser, default: RelationToUser.SELF, trim: true },
    bio: { type: String, trim: true },
    images: [{ type: String }],
    face_verify_logs: { type: [verificationDetailSchema], default: [] },
    address: { type: String, trim: true },
    coordinates: [{ type: Number }],
    // Always create the container so each nested verification step gets its default status.
    verification_status: {
      type: verificationStatusSchema,
      default: () => ({}),
    },
    isActive: {
      type: String,
      enum: Object.values(ActiveStatus),
      default: ActiveStatus.ACTIVE,
    },
  },
  { timestamps: true, versionKey: false }
);

candidateSchema.index({ isActive: 1, gender: 1, dateOfBirth: 1, createdAt: -1 });
candidateSchema.index({
  isActive: 1,
  'religious.religion': 1,
  'casteIdentity.caste': 1,
  createdAt: -1,
});
candidateSchema.index({
  isActive: 1,
  'casteIdentity.category': 1,
  'casteIdentity.clan': 1,
  createdAt: -1,
});
candidateSchema.index({ isActive: 1, height: 1, createdAt: -1 });
candidateSchema.index({ user: 1, isActive: 1 });

const Candidate = model<ICandidate>('candidate', candidateSchema);

export default Candidate;
