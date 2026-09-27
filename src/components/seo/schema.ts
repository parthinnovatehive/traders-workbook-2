import type { FaqEntry } from '@/types/content';
import type { Plan } from '@/types/plan';
import { ROUTES } from '@/constants/routes';
import { SITE, siteRef, siteUrl } from '@/config/site';

/**
 * Schema.org builders.
 *
 * Every function here returns a plain object that `JsonLd` serialises. They are
 * kept separate from the component so they can be unit-tested against the
 * schema.org vocabulary without rendering anything.
 *
 * What is deliberately absent, and why:
 *
 * - No `aggregateRating`, `review` or `rating`. We have no reviews, and
 *   inventing a rating is both a structured-data violation and, on a financial
 *   product, an advertising one.
 * - No `award`, `numberOfEmployees`, `founder`, `address` or `telephone`. None
 *   of those facts exist in this repository, and a plausible-looking invented
 *   one is worse than an absent one.
 * - No `potentialAction`/`SearchAction` on the `WebSite`. There is no site
 *   search, so advertising a search box that 404s is a broken feature claim.
 * - No `FinancialProduct`, `InvestmentProduct` or `FinancialService`. This is a
 *   journal and analytics tool. It takes no deposits, gives no advice, holds no
 *   funds and executes nothing, so any financial-product schema would
 *   misrepresent it to exactly the audience most likely to be harmed by the
 *   misrepresentation.
 * - No `aggregateRating` on the `SoftwareApplication` either — see above.
 *
 * Every price emitted comes from the plan rows the page is already rendering.
 * The pricing page passes the live plans, so an admin price change is reflected
 * without a redeploy rather than being quietly wrong in the markup.
 */

const SCHEMA_CONTEXT = 'https://schema.org';

/** Organization — the business behind the product. */
export function organizationSchema() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    name: SITE.name,
    url: siteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: siteUrl('/favicon.svg'),
    },
    email: SITE.supportEmail,
    description:
      'Trader\'s Workbook is a trading journal and performance analytics tool for Forex and Indian market traders. It records trades entered manually and computes performance statistics from them.',
  };
}

/** WebSite — the site itself, tying the origin to a name. */
export function webSiteSchema() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    name: SITE.name,
    url: siteUrl('/'),
    inLanguage: SITE.lang,
    publisher: { '@id': siteRef('organization') },
  };
}

/** WebPage — a single indexable page, part of the site above. */
export function webPageSchema(input: { name: string; description: string; path: string }) {
  const url = siteUrl(input.path);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url,
    inLanguage: SITE.lang,
    isPartOf: { '@id': siteRef('website') },
    about: { '@id': siteRef('organization') },
  };
}

/**
 * SoftwareApplication — the app itself, with the real plan prices.
 *
 * `offers` is built from the plan rows passed in, deduplicated by billing period
 * so the free tier, Pro monthly and Elite monthly are described once each rather
 * than once per row. Google requires an `offers` array here to be valid, and a
 * wrong price is a genuine problem on a page whose whole job is stating prices,
 * so this is fed live data rather than a copy.
 */
export function softwareApplicationSchema(plans: readonly Plan[]) {
  const offers = plans
    .filter((plan) => plan.isActive)
    .map((plan) => ({
      '@type': 'Offer',
      name: `${plan.name} (${plan.billingPeriod})`,
      price: plan.price,
      priceCurrency: plan.currency,
      availability: 'https://schema.org/InStock',
      url: siteUrl(ROUTES.pricing),
    }))
    .filter(
      (offer, index, all) =>
        all.findIndex((other) => other.name === offer.name && other.price === offer.price) ===
        index,
    );

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'SoftwareApplication',
    name: SITE.name,
    url: siteUrl('/'),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    inLanguage: SITE.lang,
    description:
      'A trading journal and performance analytics tool. Records Forex and Indian market trades manually and computes expectancy, R-multiples, drawdown, risk and strategy analytics from them.',
    offers,
  };
}

/**
 * FAQPage — built from the entries the page is actually rendering.
 *
 * The FAQ list is admin-editable, so this must be derived from the same array
 * the `<Faq />` component maps over. A schema block that drifts from the visible
 * content is a manual-action risk, and entries with no text are dropped rather
 * than emitted as an empty `Question`.
 */
export function faqPageSchema(faqs: readonly FaqEntry[]) {
  const entities = faqs
    .filter((faq) => faq.question.trim() && faq.answer.trim())
    .map((faq) => ({
      '@type': 'Question',
      name: faq.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: faq.answer.trim() },
    }));

  if (entities.length === 0) return null;

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: entities,
  };
}

/** A single `ListItem` in a `BreadcrumbList`. */
export interface BreadcrumbListSchema {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: { '@type': 'ListItem'; position: number; name: string; item: string }[];
}

/**
 * BreadcrumbList — from a trail of `{ name, path }`, home first.
 *
 * The last crumb is left off. Marking the current page as a breadcrumb tells a
 * search engine the page is its own parent, which is not what the trail means.
 */
export function breadcrumbSchema(
  trail: readonly { name: string; path: string }[],
): BreadcrumbListSchema | null {
  const crumbs = trail.length > 1 ? trail.slice(0, -1) : [];
  if (crumbs.length === 0) return null;

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: siteUrl(crumb.path),
    })),
  };
}

/** The shared trail every marketing page sits under. */
export const MARKETING_TRAIL: readonly { name: string; path: string }[] = [
  { name: 'Home', path: ROUTES.home },
];
