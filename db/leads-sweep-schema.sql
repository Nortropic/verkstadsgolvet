-- ─────────────────────────────────────────────────────────────────────────
-- Verkstadsgolvet — Leads: schemalagt insamlingssvep (jobb-kö + budget + täckning)
-- Kör i Supabase SQL-editorn EN gång, EFTER db/leads-schema.sql. Idempotent.
--
-- Arkitektur: appen ENQUEUEAR kommun×kategori-kombon hit (status 'ko'). n8n cron läser
-- kön + dagsbudget, kör Places per kombo, upsertar leads, markerar kombo 'klar' och ökar
-- dagsloggen. Allt via service-key (kringgår RLS). Klienten ansluter aldrig direkt.
-- ─────────────────────────────────────────────────────────────────────────

-- === KÖN: en rad per kommun × kategori ====================================
create table if not exists sok_kombinationer (
  id             uuid primary key default gen_random_uuid(),
  lan            text not null,
  kommun         text not null,
  kategori_id    text not null,
  kategori_label text not null,
  -- 'includedType' → query_varde är Googles place type; 'text' → svensk fritext-term
  query_typ      text not null check (query_typ in ('includedType', 'text')),
  query_varde    text not null,
  status         text not null default 'ko' check (status in ('ko', 'klar', 'fel')),
  placer_hittade integer,          -- antal Places-träffar i sökningen
  kandidater     integer,          -- antal utan sajt (som gick vidare till Details)
  fel_text       text,
  skapad_at      timestamptz not null default now(),
  kord_at        timestamptz,
  unique (kommun, kategori_id)      -- idempotent enqueue + dedup
);

create index if not exists sok_komb_status_idx on sok_kombinationer (status);
create index if not exists sok_komb_lan_idx    on sok_kombinationer (lan);

-- === CONFIG: takt & paus (1 rad) ==========================================
create table if not exists sok_config (
  id            integer primary key default 1 check (id = 1),
  dygns_budget  integer not null default 400,   -- max Places-anrop/dygn (håll < GCP-kvoten 500)
  aktiv         boolean not null default true,  -- pausa/återuppta svepet
  uppdaterad_at timestamptz not null default now()
);
insert into sok_config (id, dygns_budget, aktiv) values (1, 400, true)
on conflict (id) do nothing;

-- === DAGSLOGG: anropsräknare per dygn (n8n ökar, jämför mot budget) ========
create table if not exists sok_dagslogg (
  datum        date primary key,
  sok_anrop    integer not null default 0,
  detalj_anrop integer not null default 0
);

-- === TÄCKNINGSVY: progress per län/kommun =================================
create or replace view sok_tackning as
select
  k.lan,
  k.kommun,
  count(*)                                   as kombon_total,
  count(*) filter (where k.status = 'klar')  as klar,
  count(*) filter (where k.status = 'ko')    as ko,
  count(*) filter (where k.status = 'fel')   as fel,
  (select count(*) from leads l where l.ort = k.kommun) as leads
from sok_kombinationer k
group by k.lan, k.kommun
order by k.lan, k.kommun;

-- === RLS ===================================================================
alter table sok_kombinationer enable row level security;
alter table sok_config        enable row level security;
alter table sok_dagslogg      enable row level security;
