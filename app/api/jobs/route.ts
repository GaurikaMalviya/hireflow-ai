import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("id");
  const profileId = searchParams.get("profile_id")?.trim() || "S001";
  const search = searchParams.get("q")?.toLowerCase().trim();
  const city = searchParams.get("city")?.trim();
  const workMode = searchParams.get("work_mode")?.trim();
  const jobType = searchParams.get("job_type")?.trim();
  const eligibleOnly = searchParams.get("eligible_only") === "true";
  const sort = searchParams.get("sort") || "match";

  const supabase = getSupabase();

  // 1. Fetch candidate profile for dynamic calculations
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  // 2. Fetch candidate's shortlists to check saved state
  const { data: shortlists } = await supabase
    .from("shortlists")
    .select("id, job_id, match_score, reason")
    .eq("profile_id", profileId);

  const shortlistMap = new Map<number, { id: number; match_score: number | null; reason: string | null }>();
  for (const s of shortlists || []) {
    shortlistMap.set(Number(s.job_id), { id: Number(s.id), match_score: s.match_score, reason: s.reason });
  }

  // 3. Build query for jobs
  let query = supabase.from("jobs").select("*");

  if (jobId) {
    query = query.eq("id", Number(jobId));
  } else {
    if (city && city !== "All") query = query.eq("city", city);
    if (workMode && workMode !== "All") query = query.eq("work_mode", workMode);
    if (jobType && jobType !== "All") query = query.eq("job_type", jobType);
  }

  const { data: rawJobs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayStr = new Date().toISOString().split("T")[0];
  const candidateSkills = (profile?.skills || []).map((s: string) => s.toLowerCase());
  const candidateCgpa = profile ? Number(profile.cgpa) : 0;
  const candidateBranch = profile?.branch || "";

  // 4. Enrich every job with deterministic calculations
  let enriched = (rawJobs || []).map((job) => {
    const minCgpa = Number(job.min_cgpa);
    const cgpaOk = candidateCgpa >= minCgpa;
    const branchOk = (job.eligible_branches || []).includes(candidateBranch);
    const dateOk = !job.apply_by || job.apply_by >= todayStr;
    const isEligible = cgpaOk && branchOk && dateOk;

    const reqSkills = (job.required_skills || []).map((s: string) => s.toLowerCase());
    const matchingSkills = reqSkills.filter((s: string) => candidateSkills.includes(s));
    const missingSkills = reqSkills.filter((s: string) => !candidateSkills.includes(s));

    // Match score formula as per hackathon specification:
    // (required skills candidate has / total required skills) * 100
    const matchScore = reqSkills.length > 0 ? Math.round((matchingSkills.length / reqSkills.length) * 100) : 100;

    const savedRecord = shortlistMap.get(Number(job.id));

    const eligibilityNotes: string[] = [];
    if (!cgpaOk) eligibilityNotes.push(`CGPA ${candidateCgpa} below required ${minCgpa}`);
    else eligibilityNotes.push(`CGPA requirement met (${candidateCgpa} ≥ ${minCgpa})`);

    if (!branchOk) eligibilityNotes.push(`Branch ${candidateBranch} not in eligible branches`);
    else eligibilityNotes.push(`Branch ${candidateBranch} is eligible`);

    if (!dateOk) eligibilityNotes.push(`Application deadline passed on ${job.apply_by}`);
    else eligibilityNotes.push(`Open until ${job.apply_by}`);

    return {
      ...job,
      match_score: matchScore,
      matching_skills: matchingSkills,
      missing_skills: missingSkills,
      is_eligible: isEligible,
      eligibility_notes: eligibilityNotes,
      is_saved: Boolean(savedRecord),
      shortlist_id: savedRecord ? savedRecord.id : null,
      saved_reason: savedRecord ? savedRecord.reason : null,
    };
  });

  // 5. Apply search filter if provided
  if (search) {
    enriched = enriched.filter((j) => {
      const matchTitle = j.title?.toLowerCase().includes(search);
      const matchCompany = j.company?.toLowerCase().includes(search);
      const matchCity = j.city?.toLowerCase().includes(search);
      const matchSkills = (j.required_skills || []).some((s: string) => s.toLowerCase().includes(search));
      return matchTitle || matchCompany || matchCity || matchSkills;
    });
  }

  // 6. Apply eligible_only filter
  if (eligibleOnly) {
    enriched = enriched.filter((j) => j.is_eligible);
  }

  // 7. Sort
  if (sort === "salary") {
    enriched.sort((a, b) => Number(b.salary_lpa_max || b.salary_lpa_min || 0) - Number(a.salary_lpa_max || a.salary_lpa_min || 0));
  } else if (sort === "deadline") {
    enriched.sort((a, b) => (a.apply_by || "").localeCompare(b.apply_by || ""));
  } else {
    // Default: Highest match score first, then eligible first
    enriched.sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      if (b.is_eligible !== a.is_eligible) return Number(b.is_eligible) - Number(a.is_eligible);
      return Number(b.id) - Number(a.id);
    });
  }

  if (jobId) {
    if (enriched.length === 0) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job: enriched[0] });
  }

  return NextResponse.json({ jobs: enriched, total: enriched.length });
}

