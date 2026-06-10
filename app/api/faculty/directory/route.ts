import { NextRequest, NextResponse } from 'next/server';
import { ApiError, FacultyProfile } from '@/lib/types';
import {
  getSupabasePublicClient,
  hasSupabaseConfig,
} from '@/lib/supabaseServer';

interface FacultyDirectoryResponse {
  faculty: FacultyProfile[];
  configured: boolean;
}

function mapRow(row: Record<string, unknown>): FacultyProfile {
  return {
    id: String(row.id || row.openalex_author_id || ''),
    openAlexAuthorId: String(row.openalex_author_id || ''),
    name: String(row.name || ''),
    displayNameAlternatives: Array.isArray(row.display_name_alternatives)
      ? row.display_name_alternatives.map(String)
      : [],
    institution: row.institution ? String(row.institution) : null,
    country: row.country ? String(row.country) : null,
    orcid: row.orcid ? String(row.orcid) : null,
    worksCount: Number(row.works_count || 0),
    citedByCount: Number(row.cited_by_count || 0),
    hIndex: row.h_index === null ? null : Number(row.h_index || 0),
    topics: Array.isArray(row.topics) ? row.topics.map(String) : [],
    profileUrl: row.profile_url ? String(row.profile_url) : null,
    worksApiUrl: row.works_api_url ? String(row.works_api_url) : null,
    matchReasons: [
      row.institution ? `Institution: ${String(row.institution)}.` : '',
      Number(row.works_count || 0) > 0
        ? `${Number(row.works_count).toLocaleString()} indexed works.`
        : '',
      Number(row.cited_by_count || 0) > 0
        ? `${Number(row.cited_by_count).toLocaleString()} citations.`
        : '',
    ].filter(Boolean),
    source: 'supabase',
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<FacultyDirectoryResponse | ApiError>> {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ faculty: [], configured: false });
    }

    const supabase = getSupabasePublicClient();
    if (!supabase) {
      return NextResponse.json({ faculty: [], configured: false });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const authorId = searchParams.get('authorId')?.trim();
    const country = searchParams.get('country')?.trim();

    let query = supabase
      .from('faculty_profiles')
      .select('*')
      .order('cited_by_count', { ascending: false })
      .limit(60);

    if (authorId) {
      query = query.eq('openalex_author_id', authorId);
    } else if (q) {
      query = query.or(`name.ilike.%${q}%,institution.ilike.%${q}%`);
    }

    if (country) {
      query = query.eq('country', country);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message, code: 'FACULTY_DIRECTORY_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      faculty: (data || []).map((row) => mapRow(row)),
      configured: true,
    });
  } catch (error) {
    console.error('[faculty/directory] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to load faculty directory', code: 'FACULTY_DIRECTORY_ERROR' },
      { status: 500 }
    );
  }
}
