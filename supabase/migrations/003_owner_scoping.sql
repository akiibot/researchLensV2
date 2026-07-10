-- Scope saved_reports and faculty_shortlist to an opaque per-browser owner_id
-- and stop serving them to any anonymous visitor. Previously both tables had
-- `for select using (true)` with no owner column at all, so any visitor with
-- the public anon key could read every other visitor's saved research ideas
-- and shortlists. Reads now happen exclusively through the app's API routes
-- using the service-role client, filtered by owner_id — the anon key no
-- longer has a working SELECT policy on either table.

alter table public.saved_reports
  add column if not exists owner_id text;

alter table public.faculty_shortlist
  add column if not exists owner_id text;

create index if not exists saved_reports_owner_idx
  on public.saved_reports(owner_id);

create index if not exists faculty_shortlist_owner_idx
  on public.faculty_shortlist(owner_id);

drop policy if exists "Saved reports are publicly readable" on public.saved_reports;
drop policy if exists "Faculty shortlist is publicly readable" on public.faculty_shortlist;

-- No SELECT policy is created for the anon/authenticated roles: all reads
-- go through API routes using the service-role client (which bypasses RLS),
-- scoped explicitly by owner_id in the query.
create policy "Saved reports are not directly readable by clients"
  on public.saved_reports
  for select
  using (false);

create policy "Faculty shortlist is not directly readable by clients"
  on public.faculty_shortlist
  for select
  using (false);
