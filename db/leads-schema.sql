-- ─────────────────────────────────────────────────────────────────────────
-- Verkstadsgolvet — Leads-modul: Supabase/Postgres-schema
-- Kör i Supabase SQL-editorn EN gång (nytt EU-projekt). Idempotent där det går.
--
-- Arkitektur: n8n skriver leads hit (upsert på place_id). Appen läser/skriver
-- via service-key (server-side, kringgår RLS). Klienten ansluter ALDRIG direkt.
--
-- BÄRANDE PRINCIP: scoring-vikterna är KONFIGURERBAR DATA (score_vikter), aldrig
-- hårdkodade. Kalibrera genom att lägga en ny version + nya viktrader — ingen
-- omdeploy. score_versioner bär trösklarna. Se lib/leads-scoring.ts för regel-
-- logiken (vilken bucket ett råvärde faller i); POÄNGEN kommer härifrån.
-- ─────────────────────────────────────────────────────────────────────────

-- === ENUMS ==================================================================
do $$ begin
  create type lead_status as enum
    ('kandidat','kvalificerad','diskvalificerad','demo_byggd','kontaktad','svar','mote','kund','nej');
exception when duplicate_object then null; end $$;

do $$ begin
  create type svar_ton as enum ('positiv','neutral','negativ');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bildmaterial_bedomning as enum ('bra','tunt','saknas','ej_bedomd');
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_aktivitet as enum ('aktiv','sporadisk','dod','ej_bedomd');
exception when duplicate_object then null; end $$;

-- === LEADS ==================================================================
create table if not exists leads (
  id                          uuid primary key default gen_random_uuid(),
  skapad_at                   timestamptz not null default now(),
  uppdaterad_at               timestamptz not null default now(),

  -- identitet (n8n fyller ur Places)
  namn                        text not null,
  bransch                     text,
  ort                         text,
  adress                      text,
  telefon                     text,
  place_id                    text not null unique,   -- dedup: aldrig samma lead två ggr

  -- sajt / GBP
  gbp_url                     text,
  har_sajt                    boolean,
  sajt_url                    text,

  -- volym
  betyg                       numeric(2,1),
  recensioner_antal           integer,

  -- FÄRSKHET (ofta starkare än volym)
  senaste_recension_at        timestamptz,
  recensioner_senaste_6man    integer,

  -- ENGAGEMANG ("bryr sig redan")
  agare_svarar_pa_recensioner boolean,                -- null = okänd (fabricera aldrig)
  gbp_har_foton               boolean,
  gbp_har_oppettider          boolean,
  gbp_har_beskrivning         boolean,

  -- socialt (n8n lämnar null i v1 → bedöms manuellt via direktlänk)
  fb_url                      text,
  ig_url                      text,

  -- MANUELL BEDÖMNING (Johnny sätter i detaljvyn — matar kalibreringen)
  bildmaterial_bedomning      bildmaterial_bedomning not null default 'ej_bedomd',
  social_aktivitet            social_aktivitet       not null default 'ej_bedomd',
  bedomning_anteckning        text,

  -- SCORING (beräknas i appen ur score_vikter; se lib/leads-scoring.ts)
  score                       integer,
  score_version               integer,

  -- FLÖDE
  status                      lead_status not null default 'kandidat',
  diskvalificerings_skal      text,
  demo_url                    text,
  demo_byggd_at               timestamptz,
  demo_byggtid_min            integer,
  sms_text                    text,                   -- FÖRBEREDD; systemet skickar aldrig
  sms_skickat_at              timestamptz,            -- sätts manuellt när Johnny skickat
  svar_at                     timestamptz,
  svar_ton                    svar_ton,
  svar_text                   text,
  anteckningar                text
);

create index if not exists leads_status_idx  on leads (status);
create index if not exists leads_score_idx   on leads (score desc nulls last);
create index if not exists leads_bransch_idx on leads (bransch);
create index if not exists leads_ort_idx     on leads (ort);

-- uppdaterad_at-trigger
create or replace function set_uppdaterad_at() returns trigger as $$
begin
  new.uppdaterad_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists leads_set_uppdaterad_at on leads;
create trigger leads_set_uppdaterad_at
  before update on leads
  for each row execute function set_uppdaterad_at();

-- === SCORE-KONFIG (kalibrerbar, ej hårdkodad) ==============================
-- Version-metadata + TRÖSKLAR. En rad per viktuppsättning.
create table if not exists score_versioner (
  version           integer primary key,
  aktiv             boolean not null default false,
  bygg_demo_min     integer not null,   -- >= detta = "bygg demo först"
  kvalificerad_min  integer not null,   -- >= detta = "kvalificerad", annars låg prio
  kommentar         text,
  skapad_at         timestamptz not null default now()
);

-- Bara EN aktiv version åt gången.
create unique index if not exists score_versioner_en_aktiv
  on score_versioner (aktiv) where aktiv;

-- Per-signal-vikter. Ändra = ny version + nya rader (gamla leads behåller sin score_version).
create table if not exists score_vikter (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null references score_versioner(version) on delete cascade,
  signal      text not null,
  poang       integer not null,
  beskrivning text,
  unique (version, signal)
);

-- === SEED: v1 =============================================================
-- OBS: dessa vikter är GISSNINGAR från 2026-07 baserade på hypotesen
-- "bryr sig redan men saknar sajt". INGEN empirisk grund. Kalibrera mot
-- faktiska svar efter 30 dagar / ~15 utfall.
insert into score_versioner (version, aktiv, bygg_demo_min, kvalificerad_min, kommentar)
values (1, true, 85, 60,
        'v1 startmodell 2026-07 — gissningar, hypotes "bryr sig redan men saknar sajt", ingen empiri. Kalibrera efter ~15 utfall.')
on conflict (version) do nothing;

insert into score_vikter (version, signal, poang, beskrivning) values
  (1,'ingen_sajt',            40,'Kärnsignal — hela premissen: har GBP-närvaro men ingen sajt'),
  (1,'rec_20plus',           15,'Recensioner ≥20 (lever, volym)'),
  (1,'rec_10_19',            12,'Recensioner 10–19'),
  (1,'rec_5_9',               8,'Recensioner 5–9'),
  (1,'rec_1_4',               4,'Recensioner 1–4'),
  (1,'betyg_45plus',         12,'Betyg ≥4,5'),
  (1,'betyg_40_44',           8,'Betyg 4,0–4,4'),
  (1,'betyg_35_39',           3,'Betyg 3,5–3,9'),
  (1,'farskhet_u3man',       20,'Senaste recension <3 mån (färskt kundflöde)'),
  (1,'farskhet_3_6man',      15,'Senaste recension 3–6 mån'),
  (1,'farskhet_6_12man',      8,'Senaste recension 6–12 mån'),
  (1,'farskhet_over12man',  -15,'Senaste recension >12 mån (vilande-varning)'),
  (1,'flode_6man',           10,'≥3 recensioner senaste 6 mån (aktivt flöde av kunder)'),
  (1,'agare_svarar',         20,'Ägaren svarar på recensioner (starkaste enskilda köpsignalen)'),
  (1,'gbp_foton',            10,'GBP har foton uppladdade'),
  (1,'gbp_oppettider',        5,'GBP har öppettider ifyllda'),
  (1,'gbp_beskrivning',       5,'GBP har tjänster/beskrivning ifylld'),
  (1,'har_fb_ig',             8,'Har Facebook eller Instagram'),
  (1,'bildmaterial_bra',     15,'Bildmaterial räcker för bra demo (manuell bedömning)'),
  (1,'bildmaterial_saknas', -20,'Bildmaterial saknas → svag demo → svag krok (manuell bedömning)'),
  (1,'bransch_ring1',        15,'Bransch i Ring 1 (tjänst med offertflöde)'),
  (1,'noll_recensioner',    -20,'0 recensioner (kan vara vilande/nystartat utan spår)'),
  (1,'betyg_u35',           -10,'Betyg <3,5')
on conflict (version, signal) do nothing;

-- === KALIBRERINGSVY ========================================================
-- Per score_version + score-intervall: antal leads, antal svar, svarsfrekvens.
-- "Svar" = leaden har rört sig till svar/möte/kund (faktiskt utfall).
create or replace view kalibrering_vy as
select
  coalesce(score_version, 0) as score_version,
  case
    when score is null    then 'oscoradad'
    when score >= 85      then '85+'
    when score >= 60      then '60–84'
    when score >= 40      then '40–59'
    else                       '<40'
  end as score_intervall,
  count(*)                                                        as antal_leads,
  count(*) filter (where status in ('svar','mote','kund'))        as antal_svar,
  count(*) filter (where status = 'kund')                         as antal_kunder,
  round(
    100.0 * count(*) filter (where status in ('svar','mote','kund'))
    / nullif(count(*), 0), 1)                                     as svarsfrekvens_pct
from leads
group by 1, 2
order by 1 desc, 2 desc;

-- === RLS ===================================================================
-- Appen använder service-key (kringgår RLS). Klienten ansluter aldrig direkt.
-- Slå på RLS utan policies = neka all anon/authenticated-åtkomst (säker default).
alter table leads            enable row level security;
alter table score_versioner  enable row level security;
alter table score_vikter     enable row level security;
