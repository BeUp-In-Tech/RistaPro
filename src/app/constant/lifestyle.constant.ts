// 15. SMOKING HABITS
export const SMOKE_STATUSES = {
  NEVER: 'Never',
  OCCASIONAL: 'Occasionally',
  REGULAR: 'Regularly',
} as const;
export type SmokeStatusKey = keyof typeof SMOKE_STATUSES;

// 16. ALCOHOL HABITS
export const DRINK_STATUSES = {
  NEVER: 'Never',
  OCCASIONAL: 'Occasionally',
  SOCIAL: 'Socially',
  REGULAR: 'Regularly',
} as const;
export type DrinkStatusKey = keyof typeof DRINK_STATUSES;
