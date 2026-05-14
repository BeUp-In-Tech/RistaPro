import { Plan, PlanKey } from './plan.interface';

const BASE_PLAN_DATA = {
  free: {
    name: 'Free',
    dailyLikes: 100,
    superLikes: 0,
    canSeeWhoLiked: false,
    canMessage: false,
    canAudioCall: false,
    canVideoCall: false,
    canViewFullProfile: false,
    profileBoost: false,
  },
  gold: {
    name: 'Gold',
    dailyLikes: 300,
    superLikes: 10,
    canSeeWhoLiked: true,
    canMessage: true,
    canAudioCall: true,
    canVideoCall: false,
    canViewFullProfile: true,
    profileBoost: false,
  },
  platinum: {
    name: 'Platinum',
    dailyLikes: 1000,
    superLikes: 30,
    canSeeWhoLiked: true,
    canMessage: true,
    canAudioCall: true,
    canVideoCall: true,
    canViewFullProfile: true,
    profileBoost: true,
  },
} as const;

const buildFeatures = (key: PlanKey) => {
  const p = BASE_PLAN_DATA[key];
  return [
    `${p.dailyLikes} daily likes`,
    `${p.superLikes} super likes`,
    p.canSeeWhoLiked ? 'See who liked you' : 'Cannot see who liked you',
    p.canMessage ? 'Messaging unlocked' : 'Messaging locked',
    p.canAudioCall ? 'Audio calls unlocked' : 'Audio calls locked',
    p.canVideoCall ? 'Video calls unlocked' : 'Video calls locked',
    p.canViewFullProfile ? 'Full profile details unlocked' : 'Full profile details locked',
    p.profileBoost ? 'Profile boost included' : 'No profile boost',
  ];
};

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    ...BASE_PLAN_DATA.free,
    featureList: buildFeatures('free'),
  },
  gold: {
    key: 'gold',
    ...BASE_PLAN_DATA.gold,
    featureList: buildFeatures('gold'),
  },
  platinum: {
    key: 'platinum',
    ...BASE_PLAN_DATA.platinum,
    featureList: buildFeatures('platinum'),
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'gold', 'platinum'];
