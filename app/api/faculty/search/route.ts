import { NextRequest, NextResponse } from 'next/server';
import { ApiError, FacultyProfile, Paper, ResearchIdea } from '@/lib/types';
import {
  discoverFacultyProfiles,
  upsertFacultyProfiles,
} from '@/lib/facultyFinder';
import { generateGeminiText, hasGeminiCredentials } from '@/lib/geminiClient';
import { enforceRateLimit, readJsonWithLimit } from '@/lib/apiGuards';
import { buildOutreachPrompt } from '@/lib/facultyOutreach';

interface FacultySearchResponse {
  faculty: FacultyProfile[];
  persisted: boolean;
}

async function addOutreachDrafts(
  idea: ResearchIdea,
  faculty: FacultyProfile[]
): Promise<FacultyProfile[]> {
  if (!hasGeminiCredentials()) return faculty;

  const topProfiles = faculty.slice(0, 5);
  const drafted = await Promise.all(
    topProfiles.map(async (profile) => {
      try {
        const outreachDraft = await generateGeminiText({
          prompt: buildOutreachPrompt(idea, profile),
          purpose: 'summary',
        });
        return { ...profile, outreachDraft: outreachDraft.trim() };
      } catch {
        return profile;
      }
    })
  );

  return [...drafted, ...faculty.slice(5)];
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<FacultySearchResponse | ApiError>> {
  try {
    const limited = enforceRateLimit(request, 'faculty-search', 20, 60_000);
    if (limited) return limited;

    let body: { idea: ResearchIdea; papers?: unknown; queries?: unknown };
    try {
      body = await readJsonWithLimit(request, 2 * 1024 * 1024);
    } catch {
      return NextResponse.json(
        { error: 'Request body is too large', code: 'BODY_TOO_LARGE' },
        { status: 413 }
      );
    }
    const idea: ResearchIdea = body.idea;
    const papers: Paper[] = Array.isArray(body.papers) ? (body.papers as Paper[]) : [];
    const queries: string[] = Array.isArray(body.queries) ? (body.queries as string[]) : [];

    if (!idea?.text) {
      return NextResponse.json(
        { error: 'Research idea is required', code: 'MISSING_IDEA' },
        { status: 400 }
      );
    }

    const faculty = await addOutreachDrafts(
      idea,
      await discoverFacultyProfiles(idea, queries, papers)
    );

    await upsertFacultyProfiles(faculty, idea.text);

    return NextResponse.json({
      faculty,
      persisted: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  } catch (error) {
    console.error('[faculty/search] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to search faculty profiles', code: 'FACULTY_SEARCH_ERROR' },
      { status: 500 }
    );
  }
}
