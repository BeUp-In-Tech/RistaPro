import { Schema, model } from 'mongoose';
import {
  CASTS,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  MOVE_ABROAD,
  OCCUPATIONS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  SECTS,
  SMOKE_STATUSES,
} from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';
import {
  ICandidatePreference,
  ICandidatePreferenceStrictFilters,
} from './candidatePreference.interface';

const sectKeys = Array.from(
  new Set(Object.values(SECTS).flatMap((sectMap) => Object.keys(sectMap)))
);

const strictFiltersSchema = new Schema<ICandidatePreferenceStrictFilters>(
  {
    gender: { type: Boolean, default: true },
    age: { type: Boolean, default: false },
    height: { type: Boolean, default: false },
    religion: { type: Boolean, default: false },
    caste: { type: Boolean, default: false },
    location: { type: Boolean, default: false },
  },
  { _id: false, versionKey: false }
);

const candidatePreferenceSchema = new Schema<ICandidatePreference>(
  {
    candidate: {
      type: Schema.Types.ObjectId,
      ref: 'candidate',
      required: true,
      unique: true,
    },
    preferredGenders: {
      type: [{ type: String, enum: Object.values(Gender) }],
      required: true,
      default: [],
    },
    ageMin: { type: Number, min: 18, max: 100 },
    ageMax: { type: Number, min: 18, max: 100 },
    heightMin: { type: Number, min: 1, max: 300 },
    heightMax: { type: Number, min: 1, max: 300 },
    religions: [{ type: String, enum: Object.keys(RELIGIONS) }],
    sects: [{ type: String, enum: sectKeys }],
    castes: [{ type: String, enum: Object.keys(CASTS) }],
    relationship_statuses: [
      { type: String, enum: Object.keys(RELATIONSHIP_STATUSES) },
    ],
    have_children: [{ type: String, enum: Object.keys(CHILDREN) }],
    move_abroad: [{ type: String, enum: Object.keys(MOVE_ABROAD) }],
    occupations: [{ type: String, enum: Object.keys(OCCUPATIONS) }],
    highest_educations: [
      { type: String, enum: Object.keys(HIGHEST_EDUCATION) },
    ],
    smoke_statuses: [{ type: String, enum: Object.keys(SMOKE_STATUSES) }],
    drink_statuses: [{ type: String, enum: Object.keys(DRINK_STATUSES) }],
    interests: [{ type: String, enum: Object.keys(INTERESTS) }],
    personality: [{ type: String, enum: Object.keys(PERSONALITY_TRAITS) }],
    maxDistanceKm: { type: Number, min: 1, max: 10000 },
    strictFilters: {
      type: strictFiltersSchema,
      default: () => ({}),
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user' },
  },
  { timestamps: true, versionKey: false }
);

candidatePreferenceSchema.index({ candidate: 1 }, { unique: true });

const CandidatePreference = model<ICandidatePreference>(
  'candidatePreference',
  candidatePreferenceSchema
);

export default CandidatePreference;
