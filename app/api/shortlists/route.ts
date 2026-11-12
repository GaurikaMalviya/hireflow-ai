import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { shortlistCreateSchema, shortlistDeleteSchema } from "@/lib/schemas";

export const runtime = "nodejs";

/** GET /api/shortlists?profile_id=S001 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profile_id")?.trim() || "S001";

  const { data, error } = await getSupabase()
    .from("shortlists")
    .select("id, profile_id, job_id, match_score, reason, created_at, jobs(*)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shortlists: data || [] });
}

/** POST /api/shortlists body: { profile_id?, job_id, match_score?, reason? } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = shortlistCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shortlist payload", details: parsed.error.issues }, { status: 400 });
  }

  const { profile_id, job_id, match_score, reason } = parsed.data;

  // Insert or return existing record
  const { data, error } = await getSupabase()
    .from("shortlists")
    .insert({
      profile_id,
      job_id,
      match_score: match_score ?? null,
      reason: reason ?? "Shortlisted by candidate via HireFlow AI",
    })
    .select("id, profile_id, job_id, match_score, reason, created_at")
    .single();

  if (error) {
    // If already shortlisted (unique constraint violation: 23505)
    if (error.code === "23505") {
      const { data: existing } = await getSupabase()
        .from("shortlists")
        .select("id, profile_id, job_id, match_score, reason, created_at")
        .eq("profile_id", profile_id)
        .eq("job_id", job_id)
        .single();
      return NextResponse.json({ shortlist: existing, already_exists: true }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shortlist: data }, { status: 201 });
}

/** DELETE /api/shortlists body: { id?, job_id?, profile_id? } */
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = shortlistDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete payload", details: parsed.error.issues }, { status: 400 });
  }

  const { id, job_id, profile_id } = parsed.data;
  const supabase = getSupabase();

  let query = supabase.from("shortlists").delete();
  if (id) {
    query = query.eq("id", id);
  } else if (job_id && profile_id) {
    query = query.eq("job_id", job_id).eq("profile_id", profile_id);
  } else {
    return NextResponse.json({ error: "Must provide either 'id' or both 'job_id' and 'profile_id'." }, { status: 400 });
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

