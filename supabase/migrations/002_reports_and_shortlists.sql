create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  idea jsonb not null,
  result jsonb not null,
  queries jsonb not null default '[]'::jsonb,
  mode text generated always as (idea->>'mode') stored,
  idea_text text generated always as (idea->>'text') stored,
  created_at timestamptz not null default now()
);

create table if not exists public.faculty_shortlist (
  id uuid primary key default gen_random_uuid(),
  openalex_author_id text not null references public.faculty_profiles(openalex_author_id) on delete cascade,
  report_id uuid references public.saved_reports(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique(openalex_author_id, report_id)
);

create index if not exists saved_reports_created_at_idx
  on public.saved_reports(created_at desc);

create index if not exists saved_reports_mode_idx
  on public.saved_reports(mode);

create index if not exists saved_reports_idea_text_idx
  on public.saved_reports using gin (to_tsvector('english', coalesce(idea_text, '')));

create index if not exists faculty_shortlist_report_idx
  on public.faculty_shortlist(report_id);

alter table public.saved_reports enable row level security;
alter table public.faculty_shortlist enable row level security;

drop policy if exists "Saved reports are publicly readable" on public.saved_reports;
create policy "Saved reports are publicly readable"
  on public.saved_reports
  for select
  using (true);

drop policy if exists "Faculty shortlist is publicly readable" on public.faculty_shortlist;
create policy "Faculty shortlist is publicly readable"
  on public.faculty_shortlist
  for select
  using (true);
