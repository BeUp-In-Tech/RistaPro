import { Document, Types } from 'mongoose';
import {
  CastKey,
  ChildrenKey,
  DrinkStatusKey,
  HighestEducationKey,
  InterestKey,
  MoveAbroadKey,
  OccupationKey,
  PersonalityKey,
  RelationshipStatusKey,
  ReligionKey,
  SectKey,
  SmokeStatusKey,
} from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';

export interface ICandidatePreferenceStrictFilters {
  gender: boolean;
  age: boolean;
  height: boolean;
  religion: boolean;
  caste: boolean;
  location: boolean;
}

export interface ICandidatePreference extends Document {
  candidate: Types.ObjectId;
  preferredGenders: Gender[];
  ageMin?: number;
  ageMax?: number;
  heightMin?: number;
  heightMax?: number;
  religions?: ReligionKey[];
  sects?: SectKey[];
  castes?: CastKey[];
  relationship_statuses?: RelationshipStatusKey[];
  have_children?: ChildrenKey[];
  move_abroad?: MoveAbroadKey[];
  occupations?: OccupationKey[];
  highest_educations?: HighestEducationKey[];
  smoke_statuses?: SmokeStatusKey[];
  drink_statuses?: DrinkStatusKey[];
  interests?: InterestKey[];
  personality?: PersonalityKey[];
  maxDistanceKm?: number;
  strictFilters: ICandidatePreferenceStrictFilters;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICandidatePreferencePayload {
  preferredGenders?: Gender[];
  ageMin?: number | null;
  ageMax?: number | null;
  heightMin?: number | null;
  heightMax?: number | null;
  religions?: ReligionKey[];
  sects?: SectKey[];
  castes?: CastKey[];
  relationship_statuses?: RelationshipStatusKey[];
  have_children?: ChildrenKey[];
  move_abroad?: MoveAbroadKey[];
  occupations?: OccupationKey[];
  highest_educations?: HighestEducationKey[];
  smoke_statuses?: SmokeStatusKey[];
  drink_statuses?: DrinkStatusKey[];
  interests?: InterestKey[];
  personality?: PersonalityKey[];
  maxDistanceKm?: number | null;
  strictFilters?: Partial<ICandidatePreferenceStrictFilters>;
}

export type TCandidatePreferenceLean = Omit<ICandidatePreference, keyof Document>;
