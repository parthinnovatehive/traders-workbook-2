import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_ORIGIN, absoluteUrl, assetPath, normalizeOrigin, normalizePath } from '../url';

describe('normalizeOrigin', () => {
  it('defaults to the production origin when unset', () => {
    expect(normalizeOrigin(undefined)).toBe(DEFAULT_SITE_ORIGIN);
    expect(normalizeOrigin(null)).toBe(DEFAULT_SITE_ORIGIN);
    expect(normalizeOrigin('   ')).toBe(DEFAULT_SITE_ORIGIN);
  });

  it('keeps a configured origin intact', () => {
    expect(normalizeOrigin('https://tradersworkbook.com')).toBe('https://tradersworkbook.com');
    expect(normalizeOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('strips trailing slashes, paths and whitespace so one misconfiguration cannot fork canonicals', () => {
    expect(normalizeOrigin('https://tradersworkbook.com/')).toBe('https://tradersworkbook.com');
    expect(normalizeOrigin('  https://tradersworkbook.com///  ')).toBe('https://tradersworkbook.com');
    expect(normalizeOrigin('https://tradersworkbook.com/app')).toBe('https://tradersworkbook.com');
  });

  it('assumes https for a bare host, so a typo cannot emit a canonical over http', () => {
    expect(normalizeOrigin('tradersworkbook.com')).toBe('https://tradersworkbook.com');
  });

  it('falls back rather than emitting garbage for an unparseable value', () => {
    for (const bad of ['not a url', 'https://', 'ftp://tradersworkbook.com', 'javascript:alert(1)']) {
      expect(normalizeOrigin(bad), bad).toBe(DEFAULT_SITE_ORIGIN);
    }
  });
});

describe('normalizePath', () => {
  it('keeps the root as a single slash', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('///')).toBe('/');
  });

  it('drops the query string and the hash', () => {
    expect(normalizePath('/pricing?utm_source=twitter')).toBe('/pricing');
    expect(normalizePath('/pricing#plans')).toBe('/pricing');
    expect(normalizePath('/pricing?a=1#b')).toBe('/pricing');
  });

  it('strips a trailing slash but not a leading one', () => {
    expect(normalizePath('/pricing/')).toBe('/pricing');
    expect(normalizePath('/app/journal///')).toBe('/app/journal');
  });

  it('collapses repeated slashes', () => {
    expect(normalizePath('/app//journal')).toBe('/app/journal');
  });

  it('does not treat a prefix lookalike as the same path', () => {
    expect(normalizePath('/apparel')).toBe('/apparel');
  });
});

describe('absoluteUrl', () => {
  it('joins the origin and a normalised path', () => {
    expect(absoluteUrl('/pricing')).toBe('https://tradersworkbook.com/pricing');
    expect(absoluteUrl('/pricing/?utm_source=x')).toBe('https://tradersworkbook.com/pricing');
    expect(absoluteUrl('/')).toBe('https://tradersworkbook.com/');
  });

  it('honours an explicit origin for staging builds', () => {
    expect(absoluteUrl('/pricing', 'https://staging.example.com')).toBe(
      'https://staging.example.com/pricing',
    );
  });

  it('produces one canonical for every spelling of the same page', () => {
    const spellings = ['/features', '/features/', '/features?utm_medium=cpc', '/features#top'];
    const canonicals = spellings.map((p) => absoluteUrl(p));
    expect(new Set(canonicals).size).toBe(1);
  });
});

describe('assetPath', () => {
  it('always returns a root-absolute path', () => {
    expect(assetPath('og-image.png')).toBe('/og-image.png');
    expect(assetPath('/og-image.png')).toBe('/og-image.png');
  });
});
