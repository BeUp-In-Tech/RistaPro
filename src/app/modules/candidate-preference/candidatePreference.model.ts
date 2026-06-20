import { Schema, model } from 'mongoose';
import {
  CASTE_CATEGORIES,
  CASTE_CLANS,
  CASTE_TREE_CASTES,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  MADHHABS,
  RELIGION_TREE_MADHHABS,
  RELIGION_TREE_MOVEMENTS,
  RELIGION_TREE_RELIGIONS,
  RELIGION_TREE_SECTS,
  MOVE_ABROAD,
  OCCUPATIONS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  SECTS,
  SECT_DETAIL_VALUES,
  SMOKE_STATUSES,
  SUFI_ORDERS,
  THEOLOGICAL_ORIENTATIONS,
} from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';
import {
  ICandidatePreference,
  ICandidatePreferenceStrictFilters,
} from './candidatePreference.interface';

const sectKeys = Array.from(
  new Set([
    ...Object.values(SECTS).flatMap((sectMap) => Object.keys(sectMap)),
    ...Object.keys(RELIGION_TREE_SECTS),
  ])
);

const religionKeys = Array.from(
  new Set([...Object.keys(RELIGIONS), ...Object.keys(RELIGION_TREE_RELIGIONS)])
);

const casteKeys = Object.keys(CASTE_TREE_CASTES);

const madhhabKeys = Array.from(
  new Set([...Object.keys(MADHHABS), ...Object.keys(RELIGION_TREE_MADHHABS)])
);

const strictFiltersSchema = new Schema<ICandidatePreferenceStrictFilters>(
  {
    gender: { type: Boolean, default: true },
    age: { type: Boolean, default: false },
    height: { type: Boolean, default: false },
    religion: { type: Boolean, default: false },
    sectDetail: { type: Boolean, default: false },
    caste: { type: Boolean, default: false },
    casteCategory: { type: Boolean, default: false },
    clan: { type: Boolean, default: false },
    madhhab: { type: Boolean, default: false },
    movement: { type: Boolean, default: false },
    theologicalOrientation: { type: Boolean, default: false },
    sufiOrder: { type: Boolean, default: false },
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
    religions: [{ type: String, enum: religionKeys }],
    sects: [{ type: String, enum: sectKeys }],
    sectDetails: [{ type: String, enum: Object.keys(SECT_DETAIL_VALUES) }],
    casteCategories: [{ type: String, enum: Object.keys(CASTE_CATEGORIES) }],
    castes: [{ type: String, enum: casteKeys }],
    clans: [{ type: String, enum: Object.keys(CASTE_CLANS) }],
    madhhabs: [{ type: String, enum: madhhabKeys }],
    movements: [{ type: String, enum: Object.keys(RELIGION_TREE_MOVEMENTS) }],
    theologicalOrientations: [
      { type: String, enum: Object.keys(THEOLOGICAL_ORIENTATIONS) },
    ],
    sufiOrders: [{ type: String, enum: Object.keys(SUFI_ORDERS) }],
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
