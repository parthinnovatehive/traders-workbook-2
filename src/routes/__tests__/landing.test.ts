import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/constants/routes';
import { landingRouteFor, resolvePostAuthRoute } from '../landing';

const trader = { role: 'user' } as const;
const admin = { role: 'admin' } as const;

describe('landingRouteFor', () => {
  it('sends an admin to the admin section', () => {
    expect(landingRouteFor(admin)).toBe(ROUTES.admin);
  });

  it('sends a trader to the app', () => {
    expect(landingRouteFor(trader)).toBe(ROUTES.app);
  });

  it('falls back to the app when there is no user', () => {
    expect(landingRouteFor(null)).toBe(ROUTES.app);
    expect(landingRouteFor(undefined)).toBe(ROUTES.app);
  });
});

describe('resolvePostAuthRoute', () => {
  it('uses the landing route when nothing was requested', () => {
    expect(resolvePostAuthRoute(admin)).toBe(ROUTES.admin);
    expect(resolvePostAuthRoute(trader)).toBe(ROUTES.app);
  });

  it('returns the user to the page they were bounced off', () => {
    expect(resolvePostAuthRoute(trader, ROUTES.journal)).toBe(ROUTES.journal);
    expect(resolvePostAuthRoute(trader, '/app/reports')).toBe('/app/reports');
  });

  it('honours a deep link even for an admin, over their landing route', () => {
    // They asked for a specific page; that intent beats the default.
    expect(resolvePostAuthRoute(admin, ROUTES.calendar)).toBe(ROUTES.calendar);
  });

  it('lets an admin return to an admin deep link', () => {
    expect(resolvePostAuthRoute(admin, ROUTES.adminUsers)).toBe(ROUTES.adminUsers);
  });

  it('does not send a trader to an admin page they cannot open', () => {
    expect(resolvePostAuthRoute(trader, ROUTES.adminUsers)).toBe(ROUTES.app);
    expect(resolvePostAuthRoute(trader, ROUTES.admin)).toBe(ROUTES.app);
  });

  it('never lands anyone back on an auth or marketing page', () => {
    for (const path of [ROUTES.login, ROUTES.register, ROUTES.home, ROUTES.pricing]) {
      expect(resolvePostAuthRoute(trader, path)).toBe(ROUTES.app);
    }
  });

  it('rejects anything that is not an in-app absolute path', () => {
    const hostile = [
      'https://evil.example.com',
      '//evil.example.com',
      'app/journal',
      '',
      42,
      null,
      undefined,
      { toString: () => '/app' },
    ];
    for (const from of hostile) {
      expect(resolvePostAuthRoute(trader, from)).toBe(ROUTES.app);
    }
  });

  it('does not treat a lookalike prefix as an app path', () => {
    // `/apparel` starts with `/app` as a string but is not inside the app.
    expect(resolvePostAuthRoute(trader, '/apparel')).toBe(ROUTES.app);
    expect(resolvePostAuthRoute(admin, '/administrator')).toBe(ROUTES.admin);
  });
});
