/** Shared report reasons — profile and chat must stay in sync. */
export const USER_REPORT_REASONS = [
  'Fake profile',
  'Scam',
  'Harassment',
  'Nudity',
  'Underage',
  'Other',
] as const;

export type UserReportReason = (typeof USER_REPORT_REASONS)[number];
