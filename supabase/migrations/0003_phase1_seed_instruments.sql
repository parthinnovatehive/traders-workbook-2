-- =============================================================================
-- Phase 1 · Step 3 of 3 — SEED THE INSTRUMENT MASTER
-- =============================================================================
-- Run AFTER 0002. Idempotent (upserts on id) — safe to re-run.
--
-- This seeds PARITY with what the app currently hardcodes in
-- src/constants/instruments.ts and src/constants/indianInstruments.ts, so the
-- table can become the source of truth with zero behaviour change.
--
-- Phase 2 replaces this with the full universe: ~65 forex pairs with correct
-- per-category contract specs (incl. XAU/XAG, which are wrong today), and the
-- NSE+BSE union of ~550 names. Lot sizes are editable from the admin panel
-- afterwards, so exchange revisions never need a redeploy.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Forex — 1 standard lot = 100,000 units of the base currency.
-- pip_size is 0.0001, or 0.01 when the quote currency is JPY.
-- -----------------------------------------------------------------------------
insert into public.instruments
  (id, trading_mode, symbol, name, base_currency, quote_currency,
   contract_size, lot_size, pip_size, tick_size, category, sort_order)
select
  'FX:' || replace(pair, '/', '')          as id,
  'forex',
  pair,
  split_part(pair, '/', 1) || ' / ' || split_part(pair, '/', 2),
  split_part(pair, '/', 1),
  split_part(pair, '/', 2),
  100000,
  100000,
  case when split_part(pair, '/', 2) = 'JPY' then 0.01 else 0.0001 end,
  case when split_part(pair, '/', 2) = 'JPY' then 0.001 else 0.00001 end,
  cat,
  ord
from (values
  ('EUR/USD','major',10), ('GBP/USD','major',20), ('USD/JPY','major',30),
  ('USD/CHF','major',40), ('AUD/USD','major',50), ('USD/CAD','major',60),
  ('NZD/USD','major',70),

  ('EUR/GBP','minor',110), ('EUR/JPY','minor',120), ('GBP/JPY','minor',130),
  ('EUR/CHF','minor',140), ('AUD/JPY','minor',150), ('CHF/JPY','minor',160),
  ('EUR/AUD','minor',170), ('GBP/CHF','minor',180), ('AUD/NZD','minor',190),
  ('EUR/CAD','minor',200), ('GBP/AUD','minor',210), ('CAD/JPY','minor',220),
  ('NZD/JPY','minor',230),

  ('USD/INR','exotic',310), ('USD/SGD','exotic',320), ('USD/ZAR','exotic',330),
  ('USD/MXN','exotic',340), ('USD/TRY','exotic',350), ('USD/HKD','exotic',360),
  ('EUR/TRY','exotic',370)
) as t(pair, cat, ord)
on conflict (id) do update set
  base_currency  = excluded.base_currency,
  quote_currency = excluded.quote_currency,
  contract_size  = excluded.contract_size,
  lot_size       = excluded.lot_size,
  pip_size       = excluded.pip_size,
  tick_size      = excluded.tick_size,
  category       = excluded.category,
  sort_order     = excluded.sort_order,
  is_active      = true;


-- -----------------------------------------------------------------------------
-- Indian — all settle in INR. lot_size 1 = cash equity (quantity is SHARES).
--
-- WARNING: index and F&O lot sizes are revised by NSE/BSE periodically. These
-- are the values currently hardcoded in the app. Verify against the latest
-- exchange circular before launch — Admin → Instruments (Phase 3) is the place
-- to correct them without a deploy.
-- -----------------------------------------------------------------------------
insert into public.instruments
  (id, trading_mode, symbol, name, exchange, segment,
   quote_currency, contract_size, lot_size, tick_size, sort_order)
values
  ('NSE:NIFTY',      'indian', 'NIFTY',      'Nifty 50',            'NSE', 'INDEX', 'INR', 1,  75,  0.05, 10),
  ('NSE:BANKNIFTY',  'indian', 'BANKNIFTY',  'Bank Nifty',          'NSE', 'INDEX', 'INR', 1,  35,  0.05, 20),
  ('NSE:FINNIFTY',   'indian', 'FINNIFTY',   'Fin Nifty',           'NSE', 'INDEX', 'INR', 1,  65,  0.05, 30),
  ('NSE:MIDCPNIFTY', 'indian', 'MIDCPNIFTY', 'Midcap Nifty',        'NSE', 'INDEX', 'INR', 1, 140,  0.05, 40),
  ('BSE:SENSEX',     'indian', 'SENSEX',     'Sensex',              'BSE', 'INDEX', 'INR', 1,  20,  0.05, 50),
  ('NSE:RELIANCE',   'indian', 'RELIANCE',   'Reliance Industries', 'NSE', 'FUT',   'INR', 1, 500,  0.05, 110),
  ('NSE:HDFCBANK',   'indian', 'HDFCBANK',   'HDFC Bank',           'NSE', 'FUT',   'INR', 1, 550,  0.05, 120),
  ('NSE:INFY',       'indian', 'INFY',       'Infosys',             'NSE', 'FUT',   'INR', 1, 400,  0.05, 130),
  ('NSE:TCS',        'indian', 'TCS',        'Tata Consultancy',    'NSE', 'FUT',   'INR', 1, 175,  0.05, 140),
  ('NSE:TATASTEEL',  'indian', 'TATASTEEL',  'Tata Steel',          'NSE', 'EQ',    'INR', 1,   1,  0.05, 210),
  ('NSE:ITC',        'indian', 'ITC',        'ITC Ltd',             'NSE', 'EQ',    'INR', 1,   1,  0.05, 220)
on conflict (id) do update set
  name       = excluded.name,
  exchange   = excluded.exchange,
  segment    = excluded.segment,
  lot_size   = excluded.lot_size,
  tick_size  = excluded.tick_size,
  sort_order = excluded.sort_order,
  is_active  = true;

commit;

-- Verify: expect 27 forex + 11 indian.
select trading_mode, count(*) from public.instruments group by trading_mode;
