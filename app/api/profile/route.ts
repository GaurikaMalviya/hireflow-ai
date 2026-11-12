import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/profile?id=S001
 * Fetches candidate profile and real calculated statistics from Supabase.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("id")?.trim() || "S001";

  const supabase = getSupabase();

  // 1. Fetch candidate profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: `Candidate profile '${profileId}' not found.` }, { status: 404 });
  }

  // 2. Fetch all jobs for real stat calculations
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, min_cgpa, eligible_branches, required_skills, apply_by");

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  // 3. Fetch candidate's shortlists count
  const { data: shortlists, error: shortlistsError } = await supabase
    .from("shortlists")
    .select("job_id, match_score")
    .eq("profile_id", profileId);

  if (shortlistsError) {
    return NextResponse.json({ error: shortlistsError.message }, { status: 500 });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const candidateSkills = (profile.skills || []).map((s: string) => s.toLowerCase());

  let eligibleJobsCount = 0;
  let highestMatchScore = 0;

  for (const job of jobs || []) {
    const cgpaOk = Number(profile.cgpa) >= Number(job.min_cgpa);
    const branchOk = (job.eligible_branches || []).includes(profile.branch);
    const dateOk = !job.apply_by || job.apply_by >= todayStr;
    const isEligible = cgpaOk && branchOk && dateOk;

    if (isEligible) {
      eligibleJobsCount++;
      const reqSkills = (job.required_skills || []).map((s: string) => s.toLowerCase());
      const matched = reqSkills.filter((s: string) => candidateSkills.includes(s));
      const score = reqSkills.length > 0 ? Math.round((matched.length / reqSkills.length) * 100) : 100;
      if (score > highestMatchScore) {
        highestMatchScore = score;
      }
    }
  }

  return NextResponse.json({
    profile,
    stats: {
      totalJobs: jobs?.length || 0,
      eligibleJobs: eligibleJobsCount,
      shortlistedCount: shortlists?.length || 0,
      highestMatchScore,
    },
  });
}

