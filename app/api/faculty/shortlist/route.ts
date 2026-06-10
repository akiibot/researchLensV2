import { NextRequest, NextResponse } from 'next/server';
import { ApiError, FacultyShortlistItem } from '@/lib/types';
import {
  getSupabasePublicClient,
  getSupabaseServiceClient,
  hasSupabaseConfig,
} from '@/lib/supabaseServer';

function mapShortlistRow(row: Record<string, unknown>): FacultyShortlistItem {
  const profile = row.faculty_profiles as Record<string, unknown> | null;

  return {
    id: String(row.id),
    reportId: row.report_id ? String(row.report_id) : null,
    note: row.note ? String(row.note) : null,
    createdAt: String(row.created_at),
    faculty: {
      id: profile?.id ? String(profile.id) : '',
      openAlexAuthorId: profile?.openalex_author_id
        ? String(profile.openalex_author_id)
        : String(row.openalex_author_id),
      name: profile?.name ? String(profile.name) : 'Unknown faculty',
      displayNameAlternatives: Array.isArray(profile?.display_name_alternatives)
        ? profile.display_name_alternatives.map(String)
        : [],
      institution: profile?.institution ? String(profile.institution) : null,
      country: profile?.country ? String(profile.country) : null,
      orcid: profile?.orcid ? String(profile.orcid) : null,
      worksCount: Number(profile?.works_count || 0),
      citedByCount: Number(profile?.cited_by_count || 0),
      hIndex: profile?.h_index === null ? null : Number(profile?.h_index || 0),
      topics: Array.isArray(profile?.topics) ? profile.topics.map(String) : [],
      profileUrl: profile?.profile_url ? String(profile.profile_url) : null,
      worksApiUrl: profile?.works_api_url ? String(profile.works_api_url) : null,
      source: 'supabase',
    },
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ id: string | null; configured: boolean } | ApiError>> {
  try {
    const body = await request.json();
    const openAlexAuthorId = String(body.openAlexAuthorId || '');
    const reportId = body.reportId ? String(body.reportId) : null;
    const note = body.note ? String(body.note) : null;

    if (!openAlexAuthorId) {
      return NextResponse.json(
        { error: 'OpenAlex author id is required', code: 'MISSING_AUTHOR_ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ id: null, configured: false });
    }

    const { data, error } = await supabase
      .from('faculty_shortlist')
      .upsert(
        {
          openalex_author_id: openAlexAuthorId,
          report_id: reportId,
          note,
        },
        { onConflict: 'openalex_author_id,report_id' }
      )
      .select('id')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: 'SHORTLIST_SAVE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id, configured: true });
  } catch (error) {
    console.error('[faculty/shortlist] Save failed:', error);
    return NextResponse.json(
      { error: 'Failed to save shortlist item', code: 'SHORTLIST_SAVE_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<
  NextResponse<{ items: FacultyShortlistItem[]; configured: boolean } | ApiError>
> {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ items: [], configured: false });
    }

    const supabase = getSupabasePublicClient();
    if (!supabase) {
      return NextResponse.json({ items: [], configured: false });
    }

    const { data, error } = await supabase
      .from('faculty_shortlist')
      .select('*, faculty_profiles(*)')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      return NextResponse.json(
        { error: error.message, code: 'SHORTLIST_LIST_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items: (data || []).map((row) => mapShortlistRow(row)),
      configured: true,
    });
  } catch (error) {
    console.error('[faculty/shortlist] List failed:', error);
    return NextResponse.json(
      { error: 'Failed to load shortlist', code: 'SHORTLIST_LIST_ERROR' },
      { status: 500 }
    );
  }
}
