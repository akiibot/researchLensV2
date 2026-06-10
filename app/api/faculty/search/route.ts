import { NextRequest, NextResponse } from 'next/server';
import { ApiError, FacultyProfile, Paper, ResearchIdea } from '@/lib/types';
import {
  discoverFacultyProfiles,
  upsertFacultyProfiles,
} from '@/lib/facultyFinder';
import { generateGeminiText, hasGeminiCredentials } from '@/lib/geminiClient';

interface FacultySearchResponse {
  faculty: FacultyProfile[];
  persisted: boolean;
}

function buildOutreachPrompt(idea: ResearchIdea, faculty: FacultyProfile): string {
  return `Write a concise supervisor outreach email for a thesis student.

Student idea: ${idea.text}
Field: ${idea.field}
Academic level: ${idea.level}

Potential supervisor:
Name: ${faculty.name}
Institution: ${faculty.institution || 'Unknown'}
Country: ${faculty.country || 'Unknown'}
Topics: ${(faculty.topics || []).join(', ') || 'Unknown'}
Evidence papers: ${(faculty.evidencePapers || []).join(' | ') || 'Unknown'}

Rules:
- 120-160 words.
- Professional, specific, and respectful.
- Mention topic fit using the evidence, but do not claim the person has agreed to supervise.
- Do not invent an email address or private contact details.
- Return only the email body.`;
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
    const body = await request.json();
    const idea: ResearchIdea = body.idea;
    const papers: Paper[] = Array.isArray(body.papers) ? body.papers : [];
    const queries: string[] = Array.isArray(body.queries) ? body.queries : [];

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
