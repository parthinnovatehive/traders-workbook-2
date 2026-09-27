import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PLANS } from '@/config/plans';
import { DEFAULT_CONTENT } from '@/config/content';
import {
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  softwareApplicationSchema,
  webPageSchema,
  webSiteSchema,
} from '../schema';

const ORIGIN = 'https://tradersworkbook.com';

describe('organizationSchema', () => {
  const schema = organizationSchema();

  it('identifies the business with a resolvable logo', () => {
    expect(schema['@type']).toBe('Organization');
    expect(schema.url).toBe(`${ORIGIN}/`);
    expect(schema.logo).toMatchObject({ '@type': 'ImageObject', url: `${ORIGIN}/favicon.svg` });
  });

  it('does not invent facts the repository does not have', () => {
    for (const key of ['aggregateRating', 'review', 'award', 'address', 'telephone', 'founder']) {
      expect(schema, `must not fabricate ${key}`).not.toHaveProperty(key);
    }
  });
});

describe('webSiteSchema', () => {
  const schema = webSiteSchema();

  it('names the site and declares the language', () => {
    expect(schema).toMatchObject({ '@type': 'WebSite', url: `${ORIGIN}/`, inLanguage: 'en' });
  });

  it('does not advertise a search box the site does not have', () => {
    // There is no site search. A SearchAction would be a broken feature claim.
    expect(schema).not.toHaveProperty('potentialAction');
  });
});

describe('webPageSchema', () => {
  it('describes the page and ties it to the site', () => {
    const schema = webPageSchema({
      name: 'Pricing',
      description: 'Plans and prices.',
      path: ROUTES.pricing,
    });
    expect(schema).toMatchObject({
      '@type': 'WebPage',
      name: 'Pricing',
      url: `${ORIGIN}/pricing`,
      inLanguage: 'en',
    });
    expect(schema.isPartOf).toEqual({ '@id': `${ORIGIN}/#website` });
  });
});

describe('softwareApplicationSchema', () => {
  const schema = softwareApplicationSchema(DEFAULT_PLANS);

  it('categorises the product without claiming to be a financial product', () => {
    expect(schema['@type']).toBe('SoftwareApplication');
    expect(schema.applicationCategory).toBe('FinanceApplication');
    expect(schema.operatingSystem).toBe('Web');
  });

  it('never claims a rating, because the product has no reviews', () => {
    expect(schema).not.toHaveProperty('aggregateRating');
    expect(schema).not.toHaveProperty('review');
  });

  it('states the real plan prices and currency', () => {
    const offers = schema.offers;
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.priceCurrency).toBe('INR');
      expect(typeof offer.price).toBe('number');
      expect(offer.availability).toBe('https://schema.org/InStock');
    }
    const elite = offers.find((offer) => offer.name.startsWith('Elite'));
    expect(elite?.price).toBe(3299);
  });

  it('omits inactive plans', () => {
    const active = DEFAULT_PLANS.filter((plan) => plan.isActive).length;
    expect(DEFAULT_PLANS.length >= active).toBe(true);
    for (const plan of DEFAULT_PLANS.filter((p) => !p.isActive)) {
      expect(JSON.stringify(schema)).not.toContain(plan.id);
    }
  });

  it('deduplicates offers that repeat the same tier and period', () => {
    const names = schema.offers.map((offer) => offer.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('faqPageSchema', () => {
  it('is built from the entries the page actually renders', () => {
    const schema = faqPageSchema(DEFAULT_CONTENT.faqs);
    expect(schema?.['@type']).toBe('FAQPage');
    expect(schema?.mainEntity).toHaveLength(DEFAULT_CONTENT.faqs.length);
    expect(schema?.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: DEFAULT_CONTENT.faqs[0]?.question,
    });
  });

  it('drops entries an admin has left blank instead of emitting an empty question', () => {
    const schema = faqPageSchema([
      { id: 'ok', question: 'Real question?', answer: 'Real answer.' },
      { id: 'blank-q', question: '   ', answer: 'Orphan answer.' },
      { id: 'blank-a', question: 'Orphan question?', answer: '' },
    ]);
    expect(schema?.mainEntity).toHaveLength(1);
  });

  it('returns null when there is nothing to describe, so no empty FAQPage is emitted', () => {
    expect(faqPageSchema([])).toBeNull();
    expect(faqPageSchema([{ id: 'x', question: '', answer: '' }])).toBeNull();
  });

  it('trims whitespace so the markup matches the rendered text', () => {
    const schema = faqPageSchema([{ id: 'x', question: '  Q?  ', answer: '  A.  ' }]);
    expect(schema?.mainEntity[0]).toMatchObject({ name: 'Q?', acceptedAnswer: { text: 'A.' } });
  });
});

describe('breadcrumbSchema', () => {
  it('marks up a trail and positions items from one', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: ROUTES.home },
      { name: 'Features', path: ROUTES.features },
    ]);
    expect(schema?.['@type']).toBe('BreadcrumbList');
    expect(schema?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
    ]);
  });

  it('omits the current page, so a page is never its own parent', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: ROUTES.home },
      { name: 'Pricing', path: ROUTES.pricing },
    ]);
    expect(JSON.stringify(schema)).not.toContain('/pricing');
  });

  it('returns null for a trail with no ancestors', () => {
    expect(breadcrumbSchema([{ name: 'Home', path: ROUTES.home }])).toBeNull();
  });
});

describe('all schema objects', () => {
  it('serialise to JSON without circular references', () => {
    const all = [
      organizationSchema(),
      webSiteSchema(),
      webPageSchema({ name: 'x', description: 'y', path: '/x' }),
      softwareApplicationSchema(DEFAULT_PLANS),
      faqPageSchema(DEFAULT_CONTENT.faqs),
      breadcrumbSchema([
        { name: 'Home', path: ROUTES.home },
        { name: 'X', path: '/x' },
      ]),
    ].filter((schema): schema is NonNullable<typeof schema> => schema !== null);

    expect(all).toHaveLength(6);
    for (const schema of all) {
      expect(() => JSON.stringify(schema)).not.toThrow();
      expect(schema['@context']).toBe('https://schema.org');
    }
  });
});
