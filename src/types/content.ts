import type { ISODateTime } from './common';

/**
 * Editable site content.
 *
 * Marketing copy, FAQ entries and the announcement banner used to be hardcoded
 * in components, so changing a headline or answering a new common question
 * meant a redeploy. This is the shape an admin edits at runtime; the components
 * fall back to their bundled defaults whenever a field is blank, so an empty or
 * unreachable content row can never leave the marketing site blank.
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const BANNER_TONES = ['info', 'warning', 'success'] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

/** A dismissible strip shown above the app and marketing shells. */
export interface AnnouncementBanner {
  enabled: boolean;
  message: string;
  tone: BannerTone;
  /** Optional call to action. Both must be set for the link to render. */
  linkLabel?: string;
  linkHref?: string;
}

/** Hero + closing copy on the marketing home page. */
export interface MarketingCopy {
  heroTitle: string;
  heroSubtitle: string;
  heroNote: string;
  ctaTitle: string;
}

export interface SiteContent {
  announcement: AnnouncementBanner;
  marketing: MarketingCopy;
  faqs: FaqEntry[];
  updatedAt?: ISODateTime;
}

export type SiteContentPatch = Partial<Omit<SiteContent, 'updatedAt'>>;
