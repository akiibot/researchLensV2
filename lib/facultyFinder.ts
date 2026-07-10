import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FacultyProfile, Paper, ResearchIdea } from './types';
import { withRetry } from './retry';
import { getSupabaseServiceClient } from './supabaseServer';
import { searchRorOrganizations } from './rorClient';

const OPENALEX_WORKS_BASE = 'https://api.openalex.org/works';
const MAX_AUTHOR_ENRICHMENT = 12;
const ROR_CACHE_MAX_ENTRIES = 500;
const rorCache = new Map<string, { country: string | null }>();

function setRorCache(institution: string, value: { country: string | null }) {
  // Simple bounded FIFO cache: Map preserves insertion order, so evicting
  // the oldest key keeps this from growing unbounded on a long-running
  // instance handling many distinct institution names.
  if (rorCache.size >= ROR_CACHE_MAX_ENTRIES && !rorCache.has(institution)) {
    const oldestKey = rorCache.keys().next().value;
    if (oldestKey !== undefined) rorCache.delete(oldestKey);
  }
  rorCache.set(institution, value);
}

interface CandidateAuthor {
  openAlexAuthorId: string;
  name: string;
  institution: string | null;
  country: string | null;
  evidencePapers: string[];
  citationSignal: number;
}

function normalizeOpenAlexId(id: string): string {
  return id.replace('https://openalex.org/', '');
}

function getEmail(): string {
  return process.env.OPENALEX_EMAIL || 'team@researchlens.com';
}

function scoreFaculty(profile: FacultyProfile): number {
  const evidence = profile.evidencePapers?.length || 0;
  const citations = Math.log10(Math.max(profile.citedByCount, 1));
  const works = Math.log10(Math.max(profile.worksCount, 1));
  const hIndex = profile.hIndex ? Math.log10(profile.hIndex + 1) : 0;
  const metadata = [profile.institution, profile.country, profile.orcid].filter(Boolean).length;

  return Number(
    (evidence * 35 + citations * 12 + works * 8 + hIndex * 10 + metadata * 3).toFixed(2)
  );
}

function createFitSummary(profile: FacultyProfile): string {
  const institution = profile.institution ? ` at ${profile.institution}` : '';
  const topicText = profile.topics.length
    ? ` Their recent OpenAlex topics include ${profile.topics.slice(0, 3).join(', ')}.`
    : '';
  const evidenceText = profile.evidencePapers?.length
    ? ` Matched through ${profile.evidencePapers.length} related paper signal(s).`
    : '';

  return `${profile.name}${institution} appears relevant based on topic and publication metadata.${topicText}${evidenceText}`;
}

function createMatchReasons(profile: FacultyProfile): string[] {
  const reasons: string[] = [];

  if ((profile.evidencePapers?.length || 0) > 0) {
    reasons.push(
      `Matched through ${profile.evidencePapers?.length} related publication signal(s).`
    );
  }
  if (profile.topics.length > 0) {
    reasons.push(`OpenAlex topics include ${profile.topics.slice(0, 3).join(', ')}.`);
  }
  if (profile.worksCount > 0) {
    reasons.push(`${profile.worksCount.toLocaleString()} works are indexed.`);
  }
  if (profile.citedByCount > 0) {
    reasons.push(`${profile.citedByCount.toLocaleString()} citation signal.`);
  }
  if (profile.institution) {
    reasons.push(`Current or recent institution: ${profile.institution}.`);
  }

  return reasons.slice(0, 5);
}

async function normalizeInstitutionCountry(
  institution: string | null,
  country: string | null
): Promise<string | null> {
  if (!institution || country) return country;

  const cached = rorCache.get(institution);
  if (cached) return cached.country;

  const matches = await searchRorOrganizations(institution);
  const normalizedCountry = matches[0]?.country || null;
  setRorCache(institution, { country: normalizedCountry });
  return normalizedCountry || country;
}

async function searchOpenAlexWorks(query: string): Promise<CandidateAuthor[]> {
  const response = await withRetry(() =>
    axios.get(OPENALEX_WORKS_BASE, {
      params: {
        search: query,
        filter: 'has_abstract:true',
        'per-page': 10,
        mailto: getEmail(),
      },
      timeout: 15000,
    })
  );

  const results = response.data?.results;
  if (!Array.isArray(results)) return [];

  const candidates: CandidateAuthor[] = [];

  for (const work of results) {
    const title = typeof work.title === 'string' ? work.title : '';
    const citationSignal = Number(work.cited_by_count || 0);
    const authorships = Array.isArray(work.authorships) ? work.authorships : [];

    for (const authorship of authorships.slice(0, 6)) {
      const author = authorship.author;
      const authorId = author?.id;
      const name = author?.display_name;
      if (!authorId || !name) continue;

      const institutions = Array.isArray(authorship.institutions)
        ? authorship.institutions
        : [];
      const firstInstitution = institutions[0];

      candidates.push({
        openAlexAuthorId: normalizeOpenAlexId(authorId),
        name,
        institution: firstInstitution?.display_name || null,
        country: firstInstitution?.country_code || null,
        evidencePapers: title ? [title] : [],
        citationSignal,
      });
    }
  }

  return candidates;
}

async function enrichAuthor(candidate: CandidateAuthor): Promise<FacultyProfile> {
  const authorUrl = `https://api.openalex.org/authors/${candidate.openAlexAuthorId}`;

  try {
    const response = await withRetry(() =>
      axios.get(authorUrl, {
        params: { mailto: getEmail() },
        timeout: 15000,
      })
    );

    const author = response.data || {};
    const institution =
      author.last_known_institutions?.[0]?.display_name ||
      candidate.institution ||
      null;
    const rawCountry =
      author.last_known_institutions?.[0]?.country_code ||
      candidate.country ||
      null;
    const country = await normalizeInstitutionCountry(institution, rawCountry);
    const topics = Array.isArray(author.topics)
      ? author.topics
          .map((topic: { display_name?: string }) => topic.display_name)
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const profile: FacultyProfile = {
      id: uuidv4(),
      openAlexAuthorId: candidate.openAlexAuthorId,
      name: author.display_name || candidate.name,
      displayNameAlternatives: author.display_name_alternatives || [],
      institution,
      country,
      orcid: author.orcid || null,
      worksCount: Number(author.works_count || 0),
      citedByCount: Number(author.cited_by_count || candidate.citationSignal || 0),
      hIndex: author.summary_stats?.h_index || null,
      topics,
      profileUrl: author.id || `https://openalex.org/${candidate.openAlexAuthorId}`,
      worksApiUrl: author.works_api_url || null,
      evidencePapers: candidate.evidencePapers,
      source: 'openalex',
    };

    profile.relevanceScore = scoreFaculty(profile);
    profile.fitSummary = createFitSummary(profile);
    profile.matchReasons = createMatchReasons(profile);
    return profile;
  } catch {
    const profile: FacultyProfile = {
      id: uuidv4(),
      openAlexAuthorId: candidate.openAlexAuthorId,
      name: candidate.name,
      institution: candidate.institution,
      country: await normalizeInstitutionCountry(candidate.institution, candidate.country),
      orcid: null,
      worksCount: 0,
      citedByCount: candidate.citationSignal,
      hIndex: null,
      topics: [],
      profileUrl: `https://openalex.org/${candidate.openAlexAuthorId}`,
      worksApiUrl: null,
      evidencePapers: candidate.evidencePapers,
      source: 'openalex',
    };

    profile.relevanceScore = scoreFaculty(profile);
    profile.fitSummary = createFitSummary(profile);
    profile.matchReasons = createMatchReasons(profile);
    return profile;
  }
}

function mergeCandidates(candidates: CandidateAuthor[]): CandidateAuthor[] {
  const merged = new Map<string, CandidateAuthor>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.openAlexAuthorId);
    if (!existing) {
      merged.set(candidate.openAlexAuthorId, candidate);
      continue;
    }

    existing.citationSignal = Math.max(
      existing.citationSignal,
      candidate.citationSignal
    );
    existing.evidencePapers = Array.from(
      new Set([...existing.evidencePapers, ...candidate.evidencePapers])
    ).slice(0, 5);
    existing.institution = existing.institution || candidate.institution;
    existing.country = existing.country || candidate.country;
  }

  return Array.from(merged.values());
}

export async function discoverFacultyProfiles(
  idea: ResearchIdea,
  queries: string[] = [],
  papers: Paper[] = []
): Promise<FacultyProfile[]> {
  const querySet = Array.from(
    new Set([
      ...queries.slice(0, 3),
      idea.text,
      ...papers.slice(0, 2).map((paper) => paper.title),
    ])
  ).filter((query) => query && query.length > 8);

  const candidateGroups = await Promise.all(
    querySet.slice(0, 4).map((query) => searchOpenAlexWorks(query))
  );
  const candidates = mergeCandidates(candidateGroups.flat())
    .sort((a, b) => b.evidencePapers.length - a.evidencePapers.length)
    .slice(0, MAX_AUTHOR_ENRICHMENT);

  const profiles = await Promise.all(candidates.map(enrichAuthor));
  return profiles
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 8);
}

export async function upsertFacultyProfiles(
  profiles: FacultyProfile[],
  query: string
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase || profiles.length === 0) return;

  const rows = profiles.map((profile) => ({
    openalex_author_id: profile.openAlexAuthorId,
    name: profile.name,
    display_name_alternatives: profile.displayNameAlternatives || [],
    institution: profile.institution,
    country: profile.country,
    orcid: profile.orcid,
    works_count: profile.worksCount,
    cited_by_count: profile.citedByCount,
    h_index: profile.hIndex,
    topics: profile.topics,
    profile_url: profile.profileUrl,
    works_api_url: profile.worksApiUrl,
    last_seen_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('faculty_profiles')
    .upsert(rows, { onConflict: 'openalex_author_id' });

  if (error) {
    console.warn('[faculty] Supabase profile upsert failed:', error.message);
    return;
  }

  const scoreRows = profiles.map((profile) => ({
    openalex_author_id: profile.openAlexAuthorId,
    query,
    score: profile.relevanceScore || 0,
    evidence_papers: profile.evidencePapers || [],
    source: 'openalex',
  }));

  const { error: scoreError } = await supabase
    .from('faculty_topic_scores')
    .upsert(scoreRows, { onConflict: 'openalex_author_id,query' });

  if (scoreError) {
    console.warn('[faculty] Supabase score upsert failed:', scoreError.message);
  }
}
