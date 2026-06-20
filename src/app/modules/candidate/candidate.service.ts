import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import { deleteImageByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import { ActiveStatus } from '../user/user.interface';
import User from '../user/user.model';
import Candidate from './candidate.model';
import {
  ICandidateProfileFields,
  ICreateCandidatePayload,
  IUpdateCandidatePayload,
  IUpdateCandidateRequestPayload,
  IVerificationStatus,
  RelationToUser,
} from './candidate.interface';
import {
  buildCandidateLabels,
  buildCandidateCreatePayload,
  buildCandidateResponse,
  buildCandidateUpdatePayload,
  getCandidateCasteIdentityFields,
  getCandidateReligiousFields,
  hasVerificationBadge,
  MAX_CANDIDATE_IMAGES,
  normalizeArrayValues,
  normalizeImageLinks,
} from './candidate.utility';
import CandidateLinkedUser from './linked-user/candidateLinkedUser.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
} from './linked-user/candidateLinkedUser.interface';
import {
  ensureNoOtherActiveCandidateAccess,
  ensureSingleActiveCandidateAccessOrThrow,
} from './linked-user/candidateLinkedUser.access';
import {
  buildCandidateManagementSummary,
  mapLegacyRelationToLinkedRelation,
} from './linked-user/candidateLinkedUser.utility';
import {
  buildMyAccessResponse,
  getActiveLinkedUserAccessOrThrow,
  getCandidateManagementSummary,
  syncLegacyOwnerLinks,
} from './linked-user/candidateLinkedUser.helper';
import {
  deleteCandidatePreferenceByCandidateId,
  ensureDefaultCandidatePreference,
} from '../candidate-preference/candidatePreference.service';
import CandidatePreference from '../candidate-preference/candidatePreference.model';
import { clearPreferenceCache } from '../candidate-preference/candidatePreference.helper';
import {
  CASTE_TREE,
  InterestKey,
  PersonalityKey,
  TCasteCategoryNode,
} from '../../constant/constant';
import { PLAN_KEYS, PlanKey, IPlan } from '../plan/plan.interface';
import { PLANS } from '../plan/plan.constant';
import PlanModel from '../plan/plan.model';
import Report from '../report/report.model';
import RishtaProgress from '../rishta_progress/rishta_progress.model';
import { RishtaProgressStatus } from '../rishta_progress/rishta_progress.interface';

type TFullProfileCandidateLean = ICandidateProfileFields & {
  _id: Types.ObjectId;
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
        isVerified?: boolean;
      }
    | null;
  verification_status?: IVerificationStatus;
  isActive: ActiveStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

interface TMyFullProfileLinkedCandidateRow {
  _id: Types.ObjectId;
  accessRole: CandidateLinkedUserAccessRole;
  candidate: TFullProfileCandidateLean | null;
  relationshipToCandidate: CandidateLinkedUserRelation;
  status: CandidateLinkedUserStatus;
  isPrimary: boolean;
  linkedBy: Types.ObjectId;
  joinedAt?: Date;
};

const FULL_PROFILE_CANDIDATE_SELECT =
  '_id name dateOfBirth gender height religious casteIdentity religion sect sectDetail madhhab movement theologicalOrientation sufiOrder profile_assist relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality bio images address coordinates verification_status isActive user createdAt updatedAt';

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

const LEGACY_RELIGION_MAP: Record<string, string> = {
  islam: 'ISLAM',
  christianity: 'CHRISTIANITY',
  hinduism: 'HINDUISM',
  buddhism: 'BUDDHISM',
  sikhism: 'SIKHISM',
  judaism: 'JUDAISM',
  other: 'OTHER',
};

const LEGACY_SECT_MAP: Record<string, string> = {
  sunni: 'SUNNI',
  shia: 'SHIA',
  ahmadi: 'AHMADI',
  ismaili: 'ISMAILI',
  ibadi: 'IBADI',
  catholic: 'CATHOLIC',
  protestant: 'PROTESTANT',
  orthodox: 'ORTHODOX',
  vaishnavism: 'VAISHNAVISM',
  shaivism: 'SHAIVISM',
  shaktism: 'SHAKTISM',
  smartism: 'SMARTISM',
  theravada: 'THERAVADA',
  mahayana: 'MAHAYANA',
  vajrayana: 'VAJRAYANA',
  jat: 'JAT',
  khatri: 'KHATRI',
  arora: 'ARORA',
  conservative: 'CONSERVATIVE',
  reform: 'REFORM',
  other: 'OTHER',
};

const LEGACY_MADHHAB_MAP: Record<string, string> = {
  hanafi: 'HANAFI',
  shafii: 'SHAFII',
  maliki: 'MALIKI',
  hanbali: 'HANBALI',
};

const LEGACY_MOVEMENT_MAP: Record<string, string> = {
  deobandi: 'DEOBANDI',
  barelvi: 'BARELVI',
  ahl_e_hadith: 'AHL_E_HADITH',
};

const LEGACY_CASTE_TREE_MAP: Record<
  string,
  { casteCategory?: string; caste?: string; clan?: string }
> = {
  PATHAN: { casteCategory: 'PASHTUN' },
  PASHTUN: { casteCategory: 'PASHTUN' },
  PUNJABI: { casteCategory: 'PUNJABI' },
  SINDHI: { casteCategory: 'SINDHI' },
  KASHMIRI: { casteCategory: 'KASHMIRI' },
  BALOCH: { casteCategory: 'BALOCH_BRAHUI' },
  BENGALI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'BENGALI' },
  GUJARATI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'GUJARATI' },
  MARATHI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'MARATHI' },
  TAMIL: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'TAMIL' },
  TELUGU: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'TELUGU' },
  MALAYALI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'MALAYALI' },
  SARAIKI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'SARAIKI' },
  KAYASTHA: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'KAYASTHA' },
  KAYESTHA: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'KAYASTHA' },
  BRAHMIN: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'BRAHMIN' },
  KHATRI: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'KHATRI' },
  OTHER: { casteCategory: 'SOUTH_ASIAN_REGIONAL', caste: 'OTHER' },
  JATT: { casteCategory: 'PUNJABI', caste: 'JATT' },
  RAJPUT: { casteCategory: 'PUNJABI', caste: 'RAJPUT' },
  ARAIN: { casteCategory: 'PUNJABI', caste: 'ARAIN' },
  GUJJAR: { casteCategory: 'PUNJABI', caste: 'GUJJAR' },
  AWAN: { casteCategory: 'PUNJABI', caste: 'AWAN' },
  GAKHAR: { casteCategory: 'PUNJABI', caste: 'GAKHAR' },
  DOGAR: { casteCategory: 'PUNJABI', caste: 'DOGAR' },
  KAMBOH: { casteCategory: 'PUNJABI', caste: 'KAMBOH' },
  KAKAZAI: { casteCategory: 'PUNJABI', caste: 'KAKAZAI' },
  SYED: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED' },
  CHEEMA: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'CHEEMA' },
  BAJWA: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'BAJWA' },
  GHUMMAN: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'GHUMMAN' },
  TARAR: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'TARAR' },
  GONDAL: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'GONDAL' },
  SIDHU: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'SIDHU' },
  GILL: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'GILL' },
  SANDHU: { casteCategory: 'PUNJABI', caste: 'JATT', clan: 'SANDHU' },
  BHATTI: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'BHATTI' },
  JANJUA: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'JANJUA' },
  KHOKHAR: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'KHOKHAR' },
  WATTOO: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'WATTOO' },
  CHOUHAN: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'CHOUHAN' },
  MINHAS: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'MINHAS' },
  NIAZ: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'NIAZ' },
  JOYA: { casteCategory: 'PUNJABI', caste: 'RAJPUT', clan: 'JOYA' },
  GILLANI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED', clan: 'GILLANI' },
  HASHMI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED', clan: 'HASHMI' },
  RIZVI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED', clan: 'RIZVI' },
  BUKHARI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED', clan: 'BUKHARI' },
  ZAIDI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SYED', clan: 'ZAIDI' },
  QURESHI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'QURESHI' },
  SHEIKH: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SHEIKH' },
  SIDDIQUI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SHEIKH', clan: 'SIDDIQUI' },
  FAROOQI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SHEIKH', clan: 'FAROOQI' },
  USMANI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'SHEIKH', clan: 'USMANI' },
  MUGHAL: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'MUGHAL' },
  ABBASI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'ABBASI' },
  ALVI: { casteCategory: 'RELIGIOUS_LINEAGE', caste: 'ALVI' },
  YOUSEFZAI: { casteCategory: 'PASHTUN', caste: 'YOUSEFZAI' },
  YOUSAFZAI: { casteCategory: 'PASHTUN', caste: 'YOUSEFZAI' },
  AFRIDI: { casteCategory: 'PASHTUN', caste: 'AFRIDI' },
  KHATTAK: { casteCategory: 'PASHTUN', caste: 'KHATTAK' },
  DURRANI: { casteCategory: 'PASHTUN', caste: 'DURRANI' },
  MEHSUD: { casteCategory: 'PASHTUN', caste: 'MEHSUD' },
  WAZIR: { casteCategory: 'PASHTUN', caste: 'WAZIR' },
  BANGASH: { casteCategory: 'PASHTUN', caste: 'BANGASH' },
  SHINWARI: { casteCategory: 'PASHTUN', caste: 'SHINWARI' },
  KAKARI: { casteCategory: 'PASHTUN', caste: 'KAKARI' },
  ACHAKZAI: { casteCategory: 'PASHTUN', caste: 'ACHAKZAI' },
  ALIZAI: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'ALIZAI' },
  BAHLULZAI: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'BAHLULZAI' },
  SHAMAN_KHEL: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'SHAMAN_KHEL' },
  MANZAI: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'MANZAI' },
  BALIZAI: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'BALIZAI' },
  JALAL_KHEL: { casteCategory: 'PASHTUN', caste: 'MEHSUD', clan: 'JALAL_KHEL' },
  AHMADZAI_WAZIR: { casteCategory: 'PASHTUN', caste: 'WAZIR', clan: 'AHMADZAI_WAZIR' },
  UTMANZAI_WAZIR: { casteCategory: 'PASHTUN', caste: 'WAZIR', clan: 'UTMANZAI_WAZIR' },
  BAKA_KHEL: { casteCategory: 'PASHTUN', caste: 'WAZIR', clan: 'BAKA_KHEL' },
  JANI_KHEL: { casteCategory: 'PASHTUN', caste: 'WAZIR', clan: 'JANI_KHEL' },
  RIND: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND' },
  BUGTI: { casteCategory: 'BALOCH_BRAHUI', caste: 'BUGTI' },
  MARRI: { casteCategory: 'BALOCH_BRAHUI', caste: 'MARRI' },
  LASHARI: { casteCategory: 'BALOCH_BRAHUI', caste: 'LASHARI' },
  MENGAL: { casteCategory: 'BALOCH_BRAHUI', caste: 'MENGAL' },
  MAZARI: { casteCategory: 'BALOCH_BRAHUI', caste: 'MAZARI' },
  LEGHARI: { casteCategory: 'BALOCH_BRAHUI', caste: 'LEGHARI' },
  JATOI: { casteCategory: 'BALOCH_BRAHUI', caste: 'JATOI' },
  TALPUR: { casteCategory: 'BALOCH_BRAHUI', caste: 'TALPUR' },
  KHOSA: { casteCategory: 'BALOCH_BRAHUI', caste: 'KHOSA' },
  CHANDIO: { casteCategory: 'BALOCH_BRAHUI', caste: 'CHANDIO' },
  RAISANI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RAISANI' },
  MIRANZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'MIRANZAI' },
  TAHIRZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'TAHIRZAI' },
  SHAHALZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'SHAHALZAI' },
  PEROZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'PEROZAI' },
  MIROZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'MIROZAI' },
  KHIAZAI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'KHIAZAI' },
  NUHANI: { casteCategory: 'BALOCH_BRAHUI', caste: 'RIND', clan: 'NUHANI' },
  GAZANI: { casteCategory: 'BALOCH_BRAHUI', caste: 'MARRI', clan: 'GAZANI' },
  LOHARANI: { casteCategory: 'BALOCH_BRAHUI', caste: 'MARRI', clan: 'LOHARANI' },
  SOOMRO: { casteCategory: 'SINDHI', caste: 'SOOMRO' },
  SAMMO: { casteCategory: 'SINDHI', caste: 'SAMMO' },
  JUNEJO: { casteCategory: 'SINDHI', caste: 'JUNEJO' },
  BHUTTO: { casteCategory: 'SINDHI', caste: 'BHUTTO' },
  SHAH: { casteCategory: 'SINDHI', caste: 'SHAH' },
  MEMON: { casteCategory: 'SINDHI', caste: 'MEMON' },
  MAKHDOOM: { casteCategory: 'SINDHI', caste: 'MAKHDOOM' },
  PALIJO: { casteCategory: 'SINDHI', caste: 'PALIJO' },
  BUTT: { casteCategory: 'KASHMIRI', caste: 'BUTT' },
  DAR: { casteCategory: 'KASHMIRI', caste: 'DAR' },
  LONE: { casteCategory: 'KASHMIRI', caste: 'LONE' },
  MIR: { casteCategory: 'KASHMIRI', caste: 'MIR' },
  PIRACHA: { casteCategory: 'KASHMIRI', caste: 'PIRACHA' },
  PARACHA: { casteCategory: 'KASHMIRI', caste: 'PIRACHA' },
  WANI: { casteCategory: 'KASHMIRI', caste: 'WANI' },
  RATHER: { casteCategory: 'KASHMIRI', caste: 'RATHER' },
  LOHAR: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'LOHAR_MISTRI' },
  MISTRI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'LOHAR_MISTRI' },
  LOHAR_MISTRI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'LOHAR_MISTRI' },
  TARKHAN: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'TARKHAN' },
  KUMHAR: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'KUMHAR' },
  MOCHI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'MOCHI' },
  NAI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'NAI' },
  ANSARI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'ANSARI' },
  QASSAB: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'QASSAB' },
  DHOBI: { casteCategory: 'ARTISAN_PROFESSIONAL', caste: 'DHOBI' },
};

interface TCasteIdentityMigrationValue {
  casteCategory?: string;
  caste?: string;
  clan?: string;
};

const CASTE_TREE_LOOKUP = (CASTE_TREE as readonly TCasteCategoryNode[]).reduce<{
  categories: Set<string>;
  castes: Record<string, TCasteIdentityMigrationValue>;
  clans: Record<string, TCasteIdentityMigrationValue>;
}>(
  (lookup, category) => {
    lookup.categories.add(category.id);

    for (const caste of category.castes) {
      lookup.castes[caste.id] = {
        casteCategory: category.id,
        caste: caste.id,
      };

      for (const clan of caste.clans ?? []) {
        lookup.clans[clan.id] = {
          casteCategory: category.id,
          caste: caste.id,
          clan: clan.id,
        };
      }
    }

    return lookup;
  },
  { categories: new Set<string>(), castes: {}, clans: {} }
);

const buildFullCandidateProfileResponse = (
  candidate: TFullProfileCandidateLean,
  userIsVerified: boolean
) => {
  const age = Math.floor(
    (Date.now() - candidate.dateOfBirth.getTime()) / MS_PER_YEAR
  );
  const religious = getCandidateReligiousFields(candidate);
  const casteIdentity = getCandidateCasteIdentityFields(candidate);

  return {
    _id: candidate._id,
    name: candidate.name,
    age,
    dateOfBirth: candidate.dateOfBirth,
    gender: candidate.gender,
    height: candidate.height,
    religious,
    casteIdentity,
    religion: religious.religion,
    sect: religious.sect,
    sectDetail: religious.sectDetail,
    madhhab: religious.madhhab,
    movement: religious.movement,
    theologicalOrientation: religious.theologicalOrientation,
    sufiOrder: religious.sufiOrder,
    profile_assist: candidate.profile_assist,
    relationship_status: candidate.relationship_status,
    have_children: candidate.have_children,
    move_abroad: candidate.move_abroad,
    occupation: candidate.occupation,
    highest_education: candidate.highest_education,
    smoke_status: candidate.smoke_status,
    drink_status: candidate.drink_status,
    interests: candidate.interests ?? [],
    personality: candidate.personality ?? [],
    bio: candidate.bio,
    images: candidate.images ?? [],
    address: candidate.address,
    coordinates: candidate.coordinates,
    verification_status: candidate.verification_status,
    badge: hasVerificationBadge({
      userIsVerified,
      verificationStatus: candidate.verification_status,
    }),
    labels: buildCandidateLabels(candidate),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
};

// 1. BUILD AUTHENTICATED USER'S CANDIDATE PROFILE
const createCandidate = async (
  userId: string,
  payload: ICreateCandidatePayload
) => {
  const creatorRelation = mapLegacyRelationToLinkedRelation(
    payload.relationToUser ?? RelationToUser.SELF
  );

  const user = await User.findById(userId)
    .select('isVerified')
    .lean<{ isVerified?: boolean } | null>();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (!user.isVerified) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Please verify your account before creating a candidate profile'
    );
  }

  // Each account can belong to only one active candidate profile.
  await ensureNoOtherActiveCandidateAccess({
    userId,
    message: 'This account is already linked to an active candidate profile',
    images: payload.images
  });

  let createdCandidateId: Types.ObjectId | null = null;

  // CREATE CANDIDATE PROFILE & LINKED USER ACCOUNT
  try {
    const normalizedImages = payload.images
      ? normalizeImageLinks(payload.images)
      : undefined;

    if (normalizedImages && normalizedImages.length > MAX_CANDIDATE_IMAGES) {
      // DELETE EXISTING IMAGE
      await deleteImageByBullMQ(payload.images ?? [], `delete_image_${Date.now()}_${userId}`);

      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Candidate profile can have a maximum of ${MAX_CANDIDATE_IMAGES} images`
      );
    }

    const createdCandidate = await Candidate.create(
      buildCandidateCreatePayload(userId, {
        ...payload,
        ...(normalizedImages ? { images: normalizedImages } : {}),
      })
    );
    createdCandidateId = createdCandidate._id;

    const ownerLink = await CandidateLinkedUser.create({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: createdCandidate._id,
      isPrimary: true,
      linkedBy: userId,
      name: payload.name.trim(),
      relationshipToCandidate: creatorRelation,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: userId,
    });

    // Create the feed preference immediately so later swipe/feed reads are fast and predictable.
    await ensureDefaultCandidatePreference({
      candidateGender: createdCandidate.gender,
      candidateId: createdCandidate._id,
      createdBy: userId,
    });

    const candidateResponse = buildCandidateResponse(createdCandidate.toObject(), {
      userIsVerified: Boolean(user.isVerified),
    });

    return {
      ...candidateResponse,
      management: buildCandidateManagementSummary([
        {
          accessRole: ownerLink.accessRole,
          relationshipToCandidate: ownerLink.relationshipToCandidate,
          status: ownerLink.status,
        },
      ]),
      myAccess: {
        _id: ownerLink._id,
        accessRole: ownerLink.accessRole,
        relationshipToCandidate: ownerLink.relationshipToCandidate,
        status: ownerLink.status,
        isPrimary: ownerLink.isPrimary,
        linkedBy: ownerLink.linkedBy,
        joinedAt: ownerLink.joinedAt,
      },
    };
  } catch (error) {
    if (createdCandidateId) {
      // Keep the create flow atomic-ish without a transaction: remove records made in this request.
      await Promise.all([
        CandidateLinkedUser.deleteMany({ candidate: createdCandidateId }),
        deleteCandidatePreferenceByCandidateId(createdCandidateId),
        Candidate.deleteOne({ _id: createdCandidateId }),
      ]);
    }

    throw error;
  }
};

// 2. AUTHENTICATED LINKED USER UPDATE CANDIDATE PROFILE
const updateCandidate = async (
  userId: string,
  candidateId: string,
  payload: IUpdateCandidateRequestPayload,
  uploadedImages: string[] = []
) => {
  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId,
    userId,
  });

  // VIEWER ACCESS IS READ-ONLY.
  if (access.accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot update candidate profile'
    );
  }

  const existingCandidate = await Candidate.findById(candidateId)
    .select('_id user images interests personality')
    .lean<{
      _id: Types.ObjectId;
      user: Types.ObjectId;
      images?: string[];
      interests?: InterestKey[];
      personality?: PersonalityKey[];
    } | null>();

  if (!existingCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  const candidateOwner = await User.findById(existingCandidate.user)
    .select('isVerified')
    .lean<{ isVerified?: boolean } | null>();

  if (!candidateOwner) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate owner not found');
  }

  const {
    deletedInterests = [],
    deletedImages = [],
    deletedPersonality = [],
    interests: incomingInterests,
    personality: incomingPersonality,
    ...candidateFieldPayload
  } = payload;

  const updatePayload = buildCandidateUpdatePayload(
    candidateFieldPayload as IUpdateCandidatePayload
  );

  const existingImages = normalizeImageLinks(existingCandidate.images ?? []);
  const deleteTargets = normalizeImageLinks(deletedImages);
  const newImageLinks = normalizeImageLinks(uploadedImages);
  const deleteTargetSet = new Set(deleteTargets);
  const retainedImages = existingImages.filter((image) => !deleteTargetSet.has(image));
  const deletedImagesFromProfile = existingImages.filter((image) =>
    deleteTargetSet.has(image)
  );
  const retainedImageSet = new Set(retainedImages);
  const hasNewImages = newImageLinks.some((image) => !retainedImageSet.has(image));
  const hasImageChange = deletedImagesFromProfile.length > 0 || hasNewImages;

  if (hasImageChange) {
    const mergedImages = normalizeImageLinks([...retainedImages, ...newImageLinks]);

    if (mergedImages.length > MAX_CANDIDATE_IMAGES) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Candidate profile can have a maximum of ${MAX_CANDIDATE_IMAGES} images`
      );
    }

    updatePayload.images = mergedImages;
  }

  const existingInterests = normalizeArrayValues(existingCandidate.interests ?? []);
  const addedInterestKeys = normalizeArrayValues(incomingInterests ?? []);
  const deletedInterestSet = new Set(normalizeArrayValues(deletedInterests));
  const hasInterestsChange =
    addedInterestKeys.length > 0 ||
    deletedInterestSet.size > 0;

  if (hasInterestsChange) {
    const mergedInterests = normalizeArrayValues([
      ...existingInterests.filter((interest) => !deletedInterestSet.has(interest)),
      ...addedInterestKeys,
    ]);

    updatePayload.interests = mergedInterests;
  }

  const existingPersonality = normalizeArrayValues(
    existingCandidate.personality ?? []
  );
  const addedPersonalityKeys = normalizeArrayValues(incomingPersonality ?? []);
  const deletedPersonalitySet = new Set(normalizeArrayValues(deletedPersonality));
  const hasPersonalityChange =
    addedPersonalityKeys.length > 0 ||
    deletedPersonalitySet.size > 0;

  if (hasPersonalityChange) {
    const mergedPersonality = normalizeArrayValues([
      ...existingPersonality.filter((trait) => !deletedPersonalitySet.has(trait)),
      ...addedPersonalityKeys,
    ]);

    updatePayload.personality = mergedPersonality;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one valid field or array change is required to update candidate profile'
    );
  }

  const updatedCandidate = await Candidate.findByIdAndUpdate(
    candidateId,
    { $set: updatePayload },
    {
      new: true,
      runValidators: true,
    }
  ).lean();

  if (!updatedCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (deletedImagesFromProfile.length > 0) {
    const deleteJobId = `delete_image_${Date.now()}_${candidateId}`;
    await deleteImageByBullMQ(deletedImagesFromProfile, deleteJobId);
  }

  return buildCandidateResponse(updatedCandidate, {
    userIsVerified: Boolean(candidateOwner.isVerified),
  });
};

// 3. AUTHENTICATED USER'S FULL CANDIDATE PROFILE DETAILS
const getMyFullCandidateProfile = async (userId: string) => {
  const activeCandidateAccesses = await ensureSingleActiveCandidateAccessOrThrow({
    userId,
    message:
      'This account is linked to multiple active candidate profiles. Please resolve the duplicate assignments first',
  });

  if (!activeCandidateAccesses.length) {
    return null;
  }

  const candidateIds = activeCandidateAccesses.map((access) => access.candidateId);
  await syncLegacyOwnerLinks({ userId, candidateIds });

  const linkedCandidate = await CandidateLinkedUser.findOne({
    candidate: { $in: candidateIds },
    user: userId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .populate({
      path: 'candidate',
      select: FULL_PROFILE_CANDIDATE_SELECT,
      populate: {
        path: 'user',
        select: '_id isActive isDeleted isVerified',
      },
    })
    .lean<TMyFullProfileLinkedCandidateRow | null>();

  if (!linkedCandidate?.candidate) {
    return null;
  }

  const candidate = linkedCandidate.candidate;
  const candidateOwner =
    candidate.user && typeof candidate.user === 'object' && 'isVerified' in candidate.user
      ? candidate.user
      : null;

  return {
    candidate: buildFullCandidateProfileResponse(
      candidate,
      Boolean(candidateOwner?.isVerified)
    ),
    management: await getCandidateManagementSummary(candidate._id.toString()),
    myAccess: buildMyAccessResponse(linkedCandidate),
  };
};

// 4. PLAN-GATED FULL CANDIDATE PROFILE DETAILS
const getFullCandidateProfileDetails = async (
  userId: string,
  viewerCandidateId: string,
  targetCandidateId: string
) => {
  if (!viewerCandidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Candidate id is required');
  }

  if (!targetCandidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Target candidate id is required');
  }

  if (!Types.ObjectId.isValid(viewerCandidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  if (!Types.ObjectId.isValid(targetCandidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid target candidate id');
  }

  const viewerObjectId = new Types.ObjectId(viewerCandidateId);
  const targetObjectId = new Types.ObjectId(targetCandidateId);

  if (viewerObjectId.equals(targetObjectId)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You cannot view your own candidate profile from this endpoint'
    );
  }

  const [
    linkedAccess,
    legacyOwnerAccess,
    viewerCandidate,
    targetCandidate,
    reportBetweenCandidates,
    marriedProgress,
  ] = await Promise.all([
    CandidateLinkedUser.exists({
      candidate: viewerObjectId,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.exists({
      _id: viewerObjectId,
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.findById(viewerObjectId)
      .select('_id plan isActive')
      .lean<{ _id: Types.ObjectId; plan?: PlanKey; isActive?: ActiveStatus } | null>(),
    Candidate.findOne({
      _id: targetObjectId,
      isActive: ActiveStatus.ACTIVE,
    })
      .select(FULL_PROFILE_CANDIDATE_SELECT)
      .populate({
        match: {
          isActive: ActiveStatus.ACTIVE,
          isDeleted: false,
          isVerified: true,
        },
        path: 'user',
        select: '_id isActive isDeleted isVerified',
      })
      .lean<TFullProfileCandidateLean | null>(),
    Report.exists({
      $or: [
        {
          reportedBy: viewerObjectId,
          reportedCandidate: targetObjectId,
        },
        {
          reportedBy: targetObjectId,
          reportedCandidate: viewerObjectId,
        },
      ],
    }),
    RishtaProgress.exists({
      candidates: { $in: [viewerObjectId, targetObjectId] },
      status: RishtaProgressStatus.MARRIED,
    }),
  ]);

  if (!viewerCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (viewerCandidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate profile is not active');
  }

  if (!linkedAccess && !legacyOwnerAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to manage this candidate profile'
    );
  }

  const planKey = PLAN_KEYS.includes(viewerCandidate.plan as PlanKey)
    ? (viewerCandidate.plan as PlanKey)
    : 'free';
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  })
    .select('canViewFullProfile')
    .lean<Pick<IPlan, 'canViewFullProfile'> | null>();
  const currentPlan = {
    ...PLANS[planKey],
    ...(planDocument ?? {}),
  };

  if (!currentPlan.canViewFullProfile) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Need gold plan access to view full candidate profile details'
    );
  }

  if (!targetCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Target candidate profile not found');
  }

  const targetOwner =
    targetCandidate.user &&
    typeof targetCandidate.user === 'object' &&
    'isVerified' in targetCandidate.user
      ? targetCandidate.user
      : null;

  if (!targetOwner) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Target candidate profile is not available'
    );
  }

  if (reportBetweenCandidates) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Profile details are blocked because a report exists between these candidates'
    );
  }

  if (marriedProgress) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Married candidates are not available for full profile details'
    );
  }

  return buildFullCandidateProfileResponse(
    targetCandidate,
    Boolean(targetOwner.isVerified)
  );
};

const pushUnique = (values: string[], value?: string) => {
  if (value && !values.includes(value)) {
    values.push(value);
  }
};

const buildUnsetForExistingFields = (
  document: Record<string, unknown>,
  fields: string[]
) =>
  fields.reduce<Record<string, ''>>((unset, field) => {
    if (document[field] !== undefined) {
      unset[field] = '';
    }

    return unset;
  }, {});

const toLegacyLookupKey = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const mapLegacyKey = (value: unknown, mapper: Record<string, string> = {}) => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const rawValue = value.trim();
  const upperValue = toLegacyLookupKey(rawValue);

  return mapper[rawValue] ?? mapper[upperValue] ?? upperValue;
};

const normalizeCasteIdentityValue = (
  value?: string
): TCasteIdentityMigrationValue | undefined => {
  if (!value?.trim()) {
    return undefined;
  }

  const key = toLegacyLookupKey(value);

  return (
    LEGACY_CASTE_TREE_MAP[value] ??
    LEGACY_CASTE_TREE_MAP[key] ??
    CASTE_TREE_LOOKUP.clans[key] ??
    CASTE_TREE_LOOKUP.castes[key] ??
    (CASTE_TREE_LOOKUP.categories.has(key) ? { casteCategory: key } : undefined)
  );
};

const applyCasteIdentityMigrationValue = (
  target: TCasteIdentityMigrationValue,
  source?: TCasteIdentityMigrationValue
) => {
  if (!source) {
    return;
  }

  target.casteCategory ??= source.casteCategory;
  target.caste ??= source.caste;
  target.clan ??= source.clan;
};

const resolveLegacyCasteIdentity = (
  values: unknown[]
): TCasteIdentityMigrationValue => {
  const identity: TCasteIdentityMigrationValue = {};

  for (const value of values) {
    if (typeof value === 'string') {
      applyCasteIdentityMigrationValue(
        identity,
        normalizeCasteIdentityValue(value)
      );
    }
  }

  return identity;
};

const buildCandidateTaxonomySet = (candidate: Record<string, unknown>) => {
  const $set: Record<string, unknown> = {};
  const existingReligious =
    candidate.religious && typeof candidate.religious === 'object'
      ? (candidate.religious as Record<string, unknown>)
      : {};
  const existingCasteIdentity =
    candidate.casteIdentity && typeof candidate.casteIdentity === 'object'
      ? (candidate.casteIdentity as Record<string, unknown>)
      : {};
  const religion = String(candidate.religion ?? '');
  const sect = String(candidate.sect ?? '');
  const caste = String(candidate.caste ?? '');
  const casteCategory = String(candidate.casteCategory ?? '');
  const clan = String(candidate.clan ?? '');
  const lineage = String(candidate.lineage ?? '');
  const tribe = String(candidate.tribe ?? '');
  const madhhab = String(candidate.madhhab ?? '');
  const movement = String(candidate.movement ?? '');
  const theologicalOrientation = String(candidate.theologicalOrientation ?? '');
  const sufiOrder = String(candidate.sufiOrder ?? '');
  const sectDetail = String(candidate.sectDetail ?? '');

  const existingReligion = mapLegacyKey(
    existingReligious.religion,
    LEGACY_RELIGION_MAP
  );
  const existingSect = mapLegacyKey(existingReligious.sect, LEGACY_SECT_MAP);
  const existingMadhhab = mapLegacyKey(
    existingReligious.madhhab,
    LEGACY_MADHHAB_MAP
  );
  const existingMovement = mapLegacyKey(
    existingReligious.movement,
    LEGACY_MOVEMENT_MAP
  );
  const existingIdentity = resolveLegacyCasteIdentity([
    existingCasteIdentity.clan,
    existingCasteIdentity.caste,
    existingCasteIdentity.category,
  ]);
  const legacyIdentity = resolveLegacyCasteIdentity([
    clan,
    lineage,
    caste,
    tribe,
    casteCategory,
  ]);

  const mappedReligion = mapLegacyKey(religion, LEGACY_RELIGION_MAP);
  const mappedSect = mapLegacyKey(sect, LEGACY_SECT_MAP);
  const mappedMadhhab = mapLegacyKey(madhhab, LEGACY_MADHHAB_MAP);
  const mappedMovement =
    mapLegacyKey(movement, LEGACY_MOVEMENT_MAP) ||
    mapLegacyKey(theologicalOrientation, LEGACY_MOVEMENT_MAP);

  if (
    existingReligious.religion &&
    existingReligion !== existingReligious.religion
  ) {
    $set['religious.religion'] = existingReligion;
  }

  if (!existingReligious.religion && mappedReligion) {
    $set['religious.religion'] = mappedReligion;
  }

  if (existingReligious.sect && existingSect !== existingReligious.sect) {
    $set['religious.sect'] = existingSect;
  }

  if (!existingReligious.sect && mappedSect) {
    $set['religious.sect'] = mappedSect;
  }

  if (!existingReligious.sectDetail && sectDetail) {
    $set['religious.sectDetail'] = mapLegacyKey(sectDetail);
  } else if (
    existingReligious.sectDetail &&
    mapLegacyKey(existingReligious.sectDetail) !== existingReligious.sectDetail
  ) {
    $set['religious.sectDetail'] = mapLegacyKey(existingReligious.sectDetail);
  }

  if (
    existingReligious.madhhab &&
    existingMadhhab !== existingReligious.madhhab
  ) {
    $set['religious.madhhab'] = existingMadhhab;
  }

  if (!existingReligious.madhhab && mappedMadhhab) {
    $set['religious.madhhab'] = mappedMadhhab;
  }

  if (
    existingReligious.movement &&
    existingMovement !== existingReligious.movement
  ) {
    $set['religious.movement'] = existingMovement;
  }

  if (!existingReligious.movement && mappedMovement) {
    $set['religious.movement'] = mappedMovement;
  }

  if (!existingReligious.theologicalOrientation && theologicalOrientation) {
    $set['religious.theologicalOrientation'] = mapLegacyKey(
      theologicalOrientation
    );
  } else if (
    existingReligious.theologicalOrientation &&
    mapLegacyKey(existingReligious.theologicalOrientation) !==
      existingReligious.theologicalOrientation
  ) {
    $set['religious.theologicalOrientation'] = mapLegacyKey(
      existingReligious.theologicalOrientation
    );
  }

  if (!existingReligious.sufiOrder && sufiOrder) {
    $set['religious.sufiOrder'] = mapLegacyKey(sufiOrder);
  } else if (
    existingReligious.sufiOrder &&
    mapLegacyKey(existingReligious.sufiOrder) !== existingReligious.sufiOrder
  ) {
    $set['religious.sufiOrder'] = mapLegacyKey(existingReligious.sufiOrder);
  }

  if (
    existingCasteIdentity.category &&
    existingIdentity.casteCategory &&
    existingIdentity.casteCategory !== existingCasteIdentity.category
  ) {
    $set['casteIdentity.category'] = existingIdentity.casteCategory;
  }

  if (!existingCasteIdentity.category && legacyIdentity.casteCategory) {
    $set['casteIdentity.category'] = legacyIdentity.casteCategory;
  }

  if (
    existingCasteIdentity.caste &&
    existingIdentity.caste &&
    existingIdentity.caste !== existingCasteIdentity.caste
  ) {
    $set['casteIdentity.caste'] = existingIdentity.caste;
  }

  if (!existingCasteIdentity.caste && legacyIdentity.caste) {
    $set['casteIdentity.caste'] = legacyIdentity.caste;
  }

  if (
    existingCasteIdentity.clan &&
    existingIdentity.clan &&
    existingIdentity.clan !== existingCasteIdentity.clan
  ) {
    $set['casteIdentity.clan'] = existingIdentity.clan;
  }

  if (!existingCasteIdentity.clan && legacyIdentity.clan) {
    $set['casteIdentity.clan'] = legacyIdentity.clan;
  }

  return $set;
};

const appendMappedArrayValues = (
  source: unknown,
  mapper: Record<string, string>,
  existing: unknown = []
) => {
  const values: string[] = [];
  const sourceValues = [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(source) ? source : []),
  ];

  for (const value of sourceValues) {
    pushUnique(values, mapLegacyKey(value, mapper));
  }

  return values;
};

const normalizeKeyArray = (source: unknown) =>
  Array.isArray(source)
    ? source.reduce<string[]>((values, value) => {
        pushUnique(values, mapLegacyKey(value));
        return values;
      }, [])
    : [];

const normalizeCasteCategoryArray = (source: unknown) =>
  Array.isArray(source)
    ? source.reduce<string[]>((values, value) => {
        const mappedIdentity = normalizeCasteIdentityValue(String(value));
        pushUnique(
          values,
          mappedIdentity?.casteCategory ?? mapLegacyKey(value)
        );
        return values;
      }, [])
    : [];

const normalizeCasteArray = (source: unknown) =>
  Array.isArray(source)
    ? source.reduce<string[]>((values, value) => {
        const mappedIdentity = normalizeCasteIdentityValue(String(value));
        pushUnique(values, mappedIdentity?.caste ?? mapLegacyKey(value));
        return values;
      }, [])
    : [];

const normalizeClanArray = (source: unknown) =>
  Array.isArray(source)
    ? source.reduce<string[]>((values, value) => {
        const mappedIdentity = normalizeCasteIdentityValue(String(value));
        pushUnique(values, mappedIdentity?.clan ?? mapLegacyKey(value));
        return values;
      }, [])
    : [];

const buildPreferenceTaxonomySet = (preference: Record<string, unknown>) => {
  const $set: Record<string, unknown> = {};
  const casteCategories = normalizeCasteCategoryArray(preference.casteCategories);
  const castes = normalizeCasteArray(preference.castes);
  const clans = normalizeClanArray(preference.clans);
  const legacyLineages = normalizeCasteArray(preference.lineages);
  const tribes = normalizeCasteArray(preference.tribes);
  const sectDetails = normalizeKeyArray(preference.sectDetails);
  const theologicalOrientations = normalizeKeyArray(
    preference.theologicalOrientations
  );
  const sufiOrders = normalizeKeyArray(preference.sufiOrders);

  for (const value of [
    ...castes,
    ...legacyLineages,
    ...tribes,
  ]) {
    const mapped = normalizeCasteIdentityValue(value);
    pushUnique(casteCategories, mapped?.casteCategory);
    pushUnique(castes, mapped?.caste);
    pushUnique(clans, mapped?.clan);
  }

  if (casteCategories.length) {
    $set.casteCategories = casteCategories;
  }

  if (castes.length) {
    $set.castes = castes;
  }

  if (clans.length) {
    $set.clans = clans;
  }

  if (sectDetails.length) {
    $set.sectDetails = sectDetails;
  }

  const religions = appendMappedArrayValues(
    preference.religions,
    LEGACY_RELIGION_MAP
  );
  const sects = appendMappedArrayValues(preference.sects, LEGACY_SECT_MAP);
  const madhhabs = appendMappedArrayValues(
    preference.madhhabs,
    LEGACY_MADHHAB_MAP
  );
  const movements = appendMappedArrayValues(
    preference.theologicalOrientations,
    LEGACY_MOVEMENT_MAP,
    preference.movements
  );

  if (religions.length) {
    $set.religions = religions;
  }

  if (sects.length) {
    $set.sects = sects;
  }

  if (madhhabs.length) {
    $set.madhhabs = madhhabs;
  }

  if (movements.length) {
    $set.movements = movements;
  }

  if (theologicalOrientations.length) {
    $set.theologicalOrientations = theologicalOrientations;
  }

  if (sufiOrders.length) {
    $set.sufiOrders = sufiOrders;
  }

  return $set;
};

const migrateLegacyTaxonomy = async (options: { dryRun?: boolean } = {}) => {
  const dryRun = Boolean(options.dryRun);
  const [candidates, preferences] = await Promise.all([
    Candidate.collection
      .find(
        {},
        {
          projection: {
            _id: 1,
            caste: 1,
            casteCategory: 1,
            casteIdentity: 1,
            clan: 1,
            lineage: 1,
            madhhab: 1,
            movement: 1,
            religion: 1,
            religious: 1,
            sect: 1,
            sectDetail: 1,
            sufiOrder: 1,
            theologicalOrientation: 1,
            tribe: 1,
          },
        }
      )
      .toArray() as Promise<Record<string, unknown>[]>,
    CandidatePreference.collection
      .find(
        {},
        {
          projection: {
            _id: 1,
            candidate: 1,
            casteCategories: 1,
            castes: 1,
            clans: 1,
            lineages: 1,
            madhhabs: 1,
            movements: 1,
            religions: 1,
            sectDetails: 1,
            sects: 1,
            strictFilters: 1,
            sufiOrders: 1,
            theologicalOrientations: 1,
            tribes: 1,
          },
        }
      )
      .toArray() as Promise<Record<string, unknown>[]>,
  ]);

  const candidateOps = candidates
    .map((candidate) => {
      const $set = buildCandidateTaxonomySet(candidate);
      const $unset = buildUnsetForExistingFields(candidate, [
        'caste',
        'casteCategory',
        'clan',
        'lineage',
        'madhhab',
        'movement',
        'religion',
        'sect',
        'sectDetail',
        'sufiOrder',
        'theologicalOrientation',
        'tribe',
      ]);

      return { candidate, $set, $unset };
    })
    .filter(
      (item) =>
        Object.keys(item.$set).length > 0 ||
        Object.keys(item.$unset).length > 0
    );
  const preferenceOps = preferences
    .map((preference) => {
      const $set = buildPreferenceTaxonomySet(preference);
      const $unset = {
        ...buildUnsetForExistingFields(preference, ['lineages', 'tribes']),
        ...(preference.strictFilters &&
        typeof preference.strictFilters === 'object' &&
        'lineage' in preference.strictFilters
          ? { 'strictFilters.lineage': '' }
          : {}),
        ...(preference.strictFilters &&
        typeof preference.strictFilters === 'object' &&
        'tribe' in preference.strictFilters
          ? { 'strictFilters.tribe': '' }
          : {}),
      };

      return { preference, $set, $unset };
    })
    .filter(
      (item) =>
        Object.keys(item.$set).length > 0 ||
        Object.keys(item.$unset).length > 0
    );

  if (!dryRun) {
    await Promise.all([
      candidateOps.length
        ? Candidate.bulkWrite(
            candidateOps.map((item) => ({
              updateOne: {
                filter: { _id: item.candidate._id },
                update: {
                  ...(Object.keys(item.$set).length ? { $set: item.$set } : {}),
                  ...(Object.keys(item.$unset).length
                    ? { $unset: item.$unset }
                    : {}),
                },
              },
            }))
          )
        : Promise.resolve(),
      preferenceOps.length
        ? CandidatePreference.bulkWrite(
            preferenceOps.map((item) => ({
              updateOne: {
                filter: { _id: item.preference._id },
                update: {
                  ...(Object.keys(item.$set).length ? { $set: item.$set } : {}),
                  ...(Object.keys(item.$unset).length
                    ? { $unset: item.$unset }
                    : {}),
                },
              },
            }))
          )
        : Promise.resolve(),
    ]);

    await Promise.all(
      preferenceOps.map((item) =>
        clearPreferenceCache(String(item.preference.candidate))
      )
    );
  }

  return {
    dryRun,
    candidates: {
      scanned: candidates.length,
      planned: candidateOps.length,
      modified: dryRun ? 0 : candidateOps.length,
    },
    preferences: {
      scanned: preferences.length,
      planned: preferenceOps.length,
      modified: dryRun ? 0 : preferenceOps.length,
    },
  };
};

export const CandidateService = {
  createCandidate,
  getFullCandidateProfileDetails,
  getMyFullCandidateProfile,
  migrateLegacyTaxonomy,
  updateCandidate,
};
