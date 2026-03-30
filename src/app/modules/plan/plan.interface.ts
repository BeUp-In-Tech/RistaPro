export type PlanKey = 'free' | 'gold' | 'platinum';

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
