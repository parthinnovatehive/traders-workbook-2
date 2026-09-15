import type { ISODateTime, UUID } from './common';

export const FEEDBACK_TYPES = ['bug', 'feature', 'general'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ['new', 'in_review', 'resolved', 'wont_fix'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Something is broken',
  feature: 'Feature request',
  general: 'General feedback',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  in_review: 'In review',
  resolved: 'Resolved',
  wont_fix: "Won't fix",
};

/** A message from a user to the admins. */
export interface Feedback {
  id: UUID;
  userId: UUID | null; // null once the author deletes their account
  type: FeedbackType;
  rating?: number; // 1–5
  message: string;
  /** Route it was submitted from — makes bug reports actionable. */
  page?: string;
  appVersion?: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FeedbackDraft = Pick<Feedback, 'type' | 'message'> &
  Partial<Pick<Feedback, 'rating' | 'page' | 'appVersion'>>;

export type FeedbackPatch = Partial<Pick<Feedback, 'status' | 'adminNote'>>;

/** Feedback joined with the author's display name, for the admin inbox. */
export interface FeedbackWithAuthor extends Feedback {
  authorName?: string;
  authorEmail?: string;
}
