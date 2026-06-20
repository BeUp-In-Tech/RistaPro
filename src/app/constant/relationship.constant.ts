// 10. RELATIONSHIP STATUS
export const RELATIONSHIP_STATUSES = {
  SINGLE: 'Single',
  NEVER_MARRIED: 'Never Married',
  ENGAGED: 'Engaged',
  MARRIED: 'Married',
  SEPARATED: 'Separated',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
} as const;
export type RelationshipStatusKey = keyof typeof RELATIONSHIP_STATUSES;


// 11. CHILDREN
export const CHILDREN = {
  NONE: 'No children',
  WITH_ME: 'Yes, living with me',
  NOT_WITH_ME: 'Yes, not living with me',
} as const;
export type ChildrenKey = keyof typeof CHILDREN;

// 12. MOVE ABROAD
export const MOVE_ABROAD = {
  YES: 'Yes, open to relocating',
  MAYBE: 'Maybe, depends on opportunity',
  NO: 'No, prefer staying local',
} as const;
export type MoveAbroadKey = keyof typeof MOVE_ABROAD;
