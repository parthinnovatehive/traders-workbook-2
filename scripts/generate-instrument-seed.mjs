#!/usr/bin/env node
/**
 * Generates supabase/migrations/0004_phase2_instrument_universe.sql from the
 * SAME JSON the app imports, so the database and the client can never disagree
 * about a contract size or a lot size.
 *
 * Run after editing either dataset:
 *   npm run gen:instruments
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const forex = read('src/constants/data/forexPairs.json');
const indian = read('src/constants/data/indianInstruments.json');

const FX_CONTRACT_SIZE = 100_000;
const TICK = 0.05;

/** Matches `parsePair` in src/constants/instruments.ts. */
const parsePair = (symbol) => {
  const [base, quote] = symbol.toUpperCase().split('/');
  return { base, quote };
};

/** Matches `defaultPipSize` in src/constants/instruments.ts. */
const defaultPipSize = (quote) => (quote === 'JPY' ? 0.01 : 0.0001);

const q = (v) =>
  v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs) =>
  xs && xs.length ? `array[${xs.map((x) => q(x)).join(', ')}]::text[]` : `'{}'::text[]`;
const bool = (b) => (b ? 'true' : 'false');
/** Avoid scientific notation, which Postgres numeric parsing dislikes. */
const num = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(10).replace(/0+$/, ''));

const rows = [];
/** Ids collected as rows are built — never re-parsed back out of the SQL. */
const ids = [];

// ---------------------------------------------------------------------------
// Forex
// ---------------------------------------------------------------------------
forex.pairs.forEach((p, i) => {
  const { base, quote } = parsePair(p.symbol);
  const pipSize = p.pipSize ?? defaultPipSize(quote);
  const contractSize = p.contractSize ?? FX_CONTRACT_SIZE;
  const tickSize = p.tickSize ?? pipSize / 10;
  const id = `FX:${p.symbol.replace('/', '')}`;
  ids.push(id);

  rows.push(
    `  (${[
      q(id),
      q('forex'),
      q(p.symbol),
      q(p.name ?? `${base} / ${quote}`),
      'null', // exchange
      arr([]), // also_on
      'null', // segment
      bool(false), // has_fno
      q(base),
      q(quote),
      num(contractSize),
      num(contractSize), // lot_size mirrors contract_size for FX
      num(pipSize),
      num(tickSize),
      q(p.category),
      String((i + 1) * 10),
    ].join(', ')})`,
  );
});

// ---------------------------------------------------------------------------
// Indian — indices first, then stocks alphabetically (matches the app's order)
// ---------------------------------------------------------------------------
indian.indices.forEach((ix, i) => {
  const id = `${ix.exchange}:${ix.symbol}`;
  ids.push(id);
  rows.push(
    `  (${[
      q(id),
      q('indian'),
      q(ix.symbol),
      q(ix.name),
      q(ix.exchange),
      arr([]),
      q('INDEX'),
      bool(true),
      'null',
      q('INR'),
      '1',
      num(ix.lotSize),
      'null',
      num(TICK),
      q('index'),
      String((i + 1) * 10),
    ].join(', ')})`,
  );
});

const stocks = indian.stocks.toSorted((a, b) => a.symbol.localeCompare(b.symbol));
stocks.forEach((s, i) => {
  const exchange = s.exchange ?? 'NSE';
  const id = `${exchange}:${s.symbol}`;
  ids.push(id);
  rows.push(
    `  (${[
      q(id),
      q('indian'),
      q(s.symbol),
      q(s.name),
      q(exchange),
      arr(s.alsoOn ?? []),
      q('EQ'),
      bool(s.hasFno),
      'null',
      q('INR'),
      '1',
      num(s.hasFno ? s.lotSize : 1),
      'null',
      num(TICK),
      q(s.hasFno ? 'fno' : 'cash'),
      String(1000 + (i + 1) * 10),
    ].join(', ')})`,
  );
});

const sql = `-- =============================================================================
-- Phase 2 · INSTRUMENT UNIVERSE
-- =============================================================================
-- GENERATED FILE — do not edit by hand.
-- Source: src/constants/data/forexPairs.json + indianInstruments.json
-- Regenerate: npm run gen:instruments
--
-- Replaces the Phase 1 starter seed with the full universe:
--   • ${forex.pairs.length} forex/CFD symbols with REAL contract specs. Metals and crypto are
--     no longer treated as 100,000-unit currency pairs — gold is 100 oz with a
--     0.01 pip, which previously overstated gold P&L by ~1000x.
--   • ${indian.indices.length} indices and ${stocks.length} NSE/BSE names as a UNION: one row per company,
--     with other listings in also_on, so RELIANCE appears once rather than
--     twice. has_fno marks the ${stocks.filter((s) => s.hasFno).length} names with a derivatives contract;
--     those trade as EQ/FUT/OPT, the rest are cash-only (lot_size 1, where
--     quantity means SHARES).
--
-- LOT SIZES: revised by the exchanges several times a year. These reflect
-- ${indian._lotSizeAsOf} and MUST be re-verified against the current circular before launch.
-- They are admin-editable and overridable per trade, so a stale value here can
-- never silently corrupt a user's P&L.
-- =============================================================================

begin;

alter table public.instruments add column if not exists has_fno boolean not null default false;

-- 'index' | 'fno' | 'cash' join the forex categories.
alter table public.instruments drop constraint if exists instruments_category_check;

insert into public.instruments
  (id, trading_mode, symbol, name, exchange, also_on, segment, has_fno,
   base_currency, quote_currency, contract_size, lot_size, pip_size, tick_size,
   category, sort_order)
values
${rows.join(',\n')}
on conflict (id) do update set
  name           = excluded.name,
  exchange       = excluded.exchange,
  also_on        = excluded.also_on,
  segment        = excluded.segment,
  has_fno        = excluded.has_fno,
  base_currency  = excluded.base_currency,
  quote_currency = excluded.quote_currency,
  contract_size  = excluded.contract_size,
  lot_size       = excluded.lot_size,
  pip_size       = excluded.pip_size,
  tick_size      = excluded.tick_size,
  category       = excluded.category,
  sort_order     = excluded.sort_order,
  is_active      = true;

-- Retire anything the Phase 1 starter seed created that is no longer in the
-- dataset (deactivated, not deleted, so existing trades keep resolving their
-- symbol).
update public.instruments
   set is_active = false
 where id not in (
${ids.map((id) => `   ${q(id)}`).join(',\n')}
 );

commit;

-- Verify: expect forex ${forex.pairs.length}, indian ${indian.indices.length + stocks.length}.
select trading_mode, count(*) filter (where is_active) as active from public.instruments group by trading_mode;

-- Spot-check the specs that were wrong before:
select symbol, contract_size, pip_size from public.instruments
where symbol in ('XAU/USD', 'XAG/USD', 'EUR/USD', 'USD/JPY') order by symbol;
`;

const out = 'supabase/migrations/0004_phase2_instrument_universe.sql';
mkdirSync(join(root, 'supabase/migrations'), { recursive: true });
writeFileSync(join(root, out), sql, 'utf8');

console.log(
  `Wrote ${out}\n  forex:  ${forex.pairs.length}\n  indian: ${indian.indices.length} indices + ${stocks.length} stocks (${stocks.filter((s) => s.hasFno).length} F&O)\n  total:  ${rows.length} rows`,
);
