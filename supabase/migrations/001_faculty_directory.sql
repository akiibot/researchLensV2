create extension if not exists pgcrypto;

create table if not exists public.faculty_profiles (
  id uuid primary key default gen_random_uuid(),
  openalex_author_id text not null unique,
  name text not null,
  display_name_alternatives jsonb not null default '[]'::jsonb,
  institution text,
  country text,
  orcid text,
  works_count integer not null default 0,
  cited_by_count integer not null default 0,
  h_index integer,
  topics jsonb not null default '[]'::jsonb,
  profile_url text,
  works_api_url text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faculty_topic_scores (
  id uuid primary key default gen_random_uuid(),
  openalex_author_id text not null references public.faculty_profiles(openalex_author_id) on delete cascade,
  query text not null,
  score numeric not null default 0,
  evidence_papers jsonb not null default '[]'::jsonb,
  source text not null default 'openalex',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(openalex_author_id, query)
);

create table if not exists public.faculty_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  openalex_author_id text not null references public.faculty_profiles(openalex_author_id) on delete cascade,
  idea_text text not null,
  draft_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists faculty_profiles_name_idx
  on public.faculty_profiles using gin (to_tsvector('english', name));

create index if not exists faculty_profiles_institution_idx
  on public.faculty_profiles using gin (to_tsvector('english', coalesce(institution, '')));

create index if not exists faculty_profiles_country_idx
  on public.faculty_profiles(country);

create index if not exists faculty_profiles_citations_idx
  on public.faculty_profiles(cited_by_count desc);

alter table public.faculty_profiles enable row level security;
alter table public.faculty_topic_scores enable row level security;
alter table public.faculty_outreach_drafts enable row level security;

drop policy if exists "Faculty profiles are publicly readable" on public.faculty_profiles;
create policy "Faculty profiles are publicly readable"
  on public.faculty_profiles
  for select
  using (true);

drop policy if exists "Faculty topic scores are publicly readable" on public.faculty_topic_scores;
create policy "Faculty topic scores are publicly readable"
  on public.faculty_topic_scores
  for select
  using (true);

drop policy if exists "Faculty outreach drafts are service role only" on public.faculty_outreach_drafts;
create policy "Faculty outreach drafts are service role only"
  on public.faculty_outreach_drafts
  for all
  using (false)
  with check (false);
