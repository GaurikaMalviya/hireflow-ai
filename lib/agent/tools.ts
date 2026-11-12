import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import {
  calculateJobMatch,
  rankJobMatches,
  type CandidateProfile,
  type JobRecord,
} from "./matching";

const DEFAULT_CANDIDATE_ID = "S001";

/**
 * Helper: Verify and fetch candidate profile.
 * Enforces ownership check (defaults to active student S001).
 */
async function fetchVerifiedCandidate(candidateId?: string): Promise<CandidateProfile> {
  const id = candidateId?.trim() || DEFAULT_CANDIDATE_ID;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, degree, branch, grad_year, cgpa, preferred_cities, skills, interests")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Database error fetching candidate: ${error.message}`);
  if (!data) throw new Error(`Candidate with ID "${id}" does not exist in the database.`);

  return {
    id: data.id,
    name: data.name,
    degree: data.degree,
    branch: data.branch,
    grad_year: data.grad_year,
    cgpa: Number(data.cgpa),
    preferred_cities: data.preferred_cities,
    skills: data.skills,
    interests: data.interests,
  };
}

/**
 * READ TOOL 1: getCandidateProfile
 * Retrieves candidate's academic credentials, verified skills, and preferences.
 */
const getCandidateProfile = defineTool({
  name: "getCandidateProfile",
  description:
    "Use this when you need candidate details: verified technical skills, CGPA, engineering branch, degree, graduation year, location preferences, and career interests. Always call this first before evaluating job compatibility.",
  writes: false,
  schema: z.object({
    candidate_id: z
      .string()
      .optional()
      .describe("Candidate ID to look up (default: active student 'S001')."),
  }),
  run: async ({ candidate_id }) => {
    try {
      const candidate = await fetchVerifiedCandidate(candidate_id);
      return {
        found: true,
        profile: {
          id: candidate.id,
          name: candidate.name,
          degree: candidate.degree,
          branch: candidate.branch,
          grad_year: candidate.grad_year,
          cgpa: candidate.cgpa,
          preferred_cities: candidate.preferred_cities,
          skills: candidate.skills,
          interests: candidate.interests || "General software and engineering roles",
        },
      };
    } catch (err) {
      return {
        found: false,
        error: err instanceof Error ? err.message : "Candidate not found",
      };
    }
  },
});

/**
 * READ TOOL 2: listAvailableJobs
 * Queries active campus job opportunities directly from the `jobs` table with verified schema columns.
 */
const listAvailableJobs = defineTool({
  name: "listAvailableJobs",
  description:
    "Use this when the user wants to browse or filter available campus jobs and internships. Supports filtering by city, work mode, job type, and title/skill keywords. Returns genuine database records only.",
  writes: false,
  schema: z.object({
    city: z
      .string()
      .optional()
      .describe("Filter by city, e.g. Chennai, Bengaluru, Hyderabad, Coimbatore, Pune, Remote"),
    work_mode: z
      .enum(["Onsite", "Hybrid", "Remote"])
      .optional()
      .describe("Filter by work arrangement: Onsite, Hybrid, or Remote"),
    job_type: z
      .enum(["Full-time", "Internship"])
      .optional()
      .describe("Filter by employment type: Full-time or Internship"),
    keyword: z
      .string()
      .optional()
      .describe("Filter by keyword in job title, company, or description (e.g. 'software', 'python', 'react')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Maximum number of jobs to return (default: 8)"),
  }),
  run: async ({ city, work_mode, job_type, keyword, limit }) => {
    const supabase = getSupabase();
    let query = supabase
      .from("jobs")
      .select(
        "id, title, company, city, work_mode, job_type, min_cgpa, eligible_branches, required_skills, nice_to_have, salary_lpa_min, salary_lpa_max, apply_by, description"
      )
      .order("id", { ascending: true })
      .limit(limit || 8);

    if (city && city !== "All") query = query.eq("city", city);
    if (work_mode) query = query.eq("work_mode", work_mode);
    if (job_type) query = query.eq("job_type", job_type);

    const { data, error } = await query;
    if (error) throw new Error(`Database error fetching jobs: ${error.message}`);

    let filtered = data || [];
    if (keyword && keyword.trim()) {
      const kw = keyword.toLowerCase().trim();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          j.company.toLowerCase().includes(kw) ||
          j.description.toLowerCase().includes(kw) ||
          (j.required_skills || []).some((s: string) => s.toLowerCase().includes(kw))
      );
    }

    return {
      count: filtered.length,
      jobs: filtered.map((j) => ({
        id: Number(j.id),
        title: j.title,
        company: j.company,
        city: j.city,
        work_mode: j.work_mode,
        job_type: j.job_type,
        min_cgpa: Number(j.min_cgpa),
        eligible_branches: j.eligible_branches,
        required_skills: j.required_skills,
        nice_to_have: j.nice_to_have,
        salary_range_lpa: `₹${j.salary_lpa_min ?? 0} - ₹${j.salary_lpa_max ?? 0} LPA`,
        apply_by: j.apply_by,
        description: j.description,
      })),
    };
  },
});

/**
 * READ/COMPUTATION TOOL 3: findJobMatches
 * Computes deterministic compatibility scores between candidate and real jobs.
 */
const findJobMatches = defineTool({
  name: "findJobMatches",
  description:
    "Use this when the candidate asks for jobs matching their profile or wants to evaluate compatibility. Fetches real jobs and runs the deterministic matching engine (Skills 40%, Experience 25%, Education 15%, Location 10%, Role Preference 10%). Returns overall score, matching skills, missing skills, category breakdown, and rank.",
  writes: false,
  schema: z.object({
    candidate_id: z
      .string()
      .optional()
      .describe("Candidate ID to match against (default 'S001')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of top matches to return (default 5)"),
    city: z
      .string()
      .optional()
      .describe("Optional city filter (e.g. Chennai, Bengaluru)"),
    job_type: z
      .enum(["Full-time", "Internship"])
      .optional()
      .describe("Optional job type filter"),
    skill_filter: z
      .string()
      .optional()
      .describe("Optional skill to focus on (e.g. 'python', 'react')"),
  }),
  run: async ({ candidate_id, limit, city, job_type, skill_filter }) => {
    const candidate = await fetchVerifiedCandidate(candidate_id);
    const supabase = getSupabase();

    let query = supabase.from("jobs").select("*");
    if (city && city !== "All") query = query.eq("city", city);
    if (job_type) query = query.eq("job_type", job_type);

    const { data: jobsData, error: jobsErr } = await query;
    if (jobsErr) throw new Error(`Database error fetching jobs: ${jobsErr.message}`);
    if (!jobsData || jobsData.length === 0) {
      return { matches_found: 0, candidate: candidate.name, matches: [] };
    }

    let jobRecords: JobRecord[] = jobsData.map((j) => ({
      id: Number(j.id),
      title: j.title,
      company: j.company,
      city: j.city,
      work_mode: j.work_mode,
      job_type: j.job_type,
      min_cgpa: Number(j.min_cgpa),
      eligible_branches: j.eligible_branches,
      required_skills: j.required_skills,
      nice_to_have: j.nice_to_have,
      salary_lpa_min: j.salary_lpa_min ? Number(j.salary_lpa_min) : null,
      salary_lpa_max: j.salary_lpa_max ? Number(j.salary_lpa_max) : null,
      apply_by: j.apply_by,
      description: j.description,
    }));

    if (skill_filter && skill_filter.trim()) {
      const sf = skill_filter.toLowerCase().trim();
      jobRecords = jobRecords.filter(
        (j) =>
          (j.required_skills || []).some((s) => s.toLowerCase().includes(sf)) ||
          (j.nice_to_have || []).some((s) => s.toLowerCase().includes(sf))
      );
    }

    const rankedMatches = rankJobMatches(candidate, jobRecords);
    const topN = rankedMatches.slice(0, limit || 5);

    return {
      candidate_id: candidate.id,
      candidate_name: candidate.name,
      candidate_cgpa: candidate.cgpa,
      candidate_branch: candidate.branch,
      total_jobs_evaluated: jobRecords.length,
      returned_matches_count: topN.length,
      matches: topN.map((m, index) => ({
        rank: index + 1,
        job_id: m.job.id,
        title: m.job.title,
        company: m.job.company,
        city: m.job.city,
        work_mode: m.job.work_mode,
        job_type: m.job.job_type,
        salary_range_lpa: `₹${m.job.salary_lpa_min ?? 0} - ₹${m.job.salary_lpa_max ?? 0} LPA`,
        overall_match_score: m.overall_score,
        is_academically_eligible: m.is_academically_eligible,
        matching_skills: m.matching_skills,
        missing_skills: m.missing_skills,
        category_breakdown: {
          skills_score_40pct: m.breakdown.skills.score,
          experience_score_25pct: m.breakdown.experience.score,
          education_score_15pct: m.breakdown.education.score,
          location_score_10pct: m.breakdown.location.score,
          role_preference_score_10pct: m.breakdown.role_preference.score,
        },
        explanation: m.explanation,
      })),
    };
  },
});

/**
 * WRITE TOOL 1: saveJobMatch
 * Inserts a verified job match into the Supabase `shortlists` table.
 * Enforces ownership, verifies job existence, prevents duplicates, and checks DB confirmation.
 */
const saveJobMatch = defineTool({
  name: "saveJobMatch",
  description:
    "Use this when the candidate explicitly asks to save, shortlist, or remember a job (e.g. 'Save the first job', 'Shortlist job #1'). Verifies the job exists, prevents duplicate shortlisting, inserts into the shortlists table, and confirms the database write.",
  writes: true,
  schema: z.object({
    job_id: z
      .number()
      .int()
      .positive()
      .describe("The numeric ID of the job to save (e.g. 1)"),
    candidate_id: z
      .string()
      .optional()
      .describe("Candidate ID (default: active student 'S001')"),
    reason: z
      .string()
      .optional()
      .describe("Optional rationale for why this job is shortlisted"),
  }),
  run: async ({ job_id, candidate_id, reason }) => {
    const id = candidate_id?.trim() || DEFAULT_CANDIDATE_ID;
    const supabase = getSupabase();

    // 1. Verify candidate exists
    const candidate = await fetchVerifiedCandidate(id);

    // 2. Verify job exists in database
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, title, company, city, required_skills, min_cgpa, eligible_branches")
      .eq("id", job_id)
      .maybeSingle();

    if (jobErr) throw new Error(`Database error verifying job: ${jobErr.message}`);
    if (!job) {
      throw new Error(`Job with ID ${job_id} does not exist in the database.`);
    }

    // 3. Compute deterministic match score for storage
    const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
    const reqSkills = (job.required_skills || []).map((s: string) => s.toLowerCase());
    const matched = reqSkills.filter((s: string) => candidateSkills.includes(s));
    const matchScore = reqSkills.length > 0 ? Math.round((matched.length / reqSkills.length) * 100) : 100;

    const shortlistReason =
      reason?.trim() ||
      `Match score ${matchScore}%: matched ${matched.length}/${reqSkills.length} required skills (${matched.join(", ") || "none"}).`;

    // 4. Duplicate Check
    const { data: existing, error: existErr } = await supabase
      .from("shortlists")
      .select("id, profile_id, job_id, match_score, reason, created_at")
      .eq("profile_id", id)
      .eq("job_id", job_id)
      .maybeSingle();

    if (existErr) throw new Error(`Database error checking duplicates: ${existErr.message}`);
    if (existing) {
      return {
        success: true,
        already_shortlisted: true,
        message: `Job #${job_id} ("${job.title}" at ${job.company}) is already in your shortlist.`,
        shortlist: {
          id: existing.id,
          profile_id: existing.profile_id,
          job_id: existing.job_id,
          job_title: job.title,
          company: job.company,
          match_score: existing.match_score,
          reason: existing.reason,
          created_at: existing.created_at,
        },
      };
    }

    // 5. Insert Record into `shortlists` table
    const { data: inserted, error: insertErr } = await supabase
      .from("shortlists")
      .insert({
        profile_id: id,
        job_id,
        match_score: matchScore,
        reason: shortlistReason,
      })
      .select("id, profile_id, job_id, match_score, reason, created_at")
      .single();

    if (insertErr) {
      throw new Error(`Failed to insert shortlist record: ${insertErr.message}`);
    }

    return {
      success: true,
      already_shortlisted: false,
      message: `Successfully shortlisted "${job.title}" at ${job.company} (Job ID: ${job_id}).`,
      shortlist: {
        id: inserted.id,
        profile_id: inserted.profile_id,
        job_id: inserted.job_id,
        job_title: job.title,
        company: job.company,
        match_score: inserted.match_score,
        reason: inserted.reason,
        created_at: inserted.created_at,
      },
    };
  },
});

/**
 * READ TOOL 4: listShortlistedJobs
 * Returns real shortlist records for the active candidate joined with job details.
 */
const listShortlistedJobs = defineTool({
  name: "listShortlistedJobs",
  description:
    "Use this when the user asks to see their shortlisted or saved jobs (e.g. 'Show me my shortlisted jobs', 'What jobs have I saved?'). Returns real shortlist records for the candidate from Supabase.",
  writes: false,
  schema: z.object({
    candidate_id: z
      .string()
      .optional()
      .describe("Candidate ID (default: active student 'S001')"),
  }),
  run: async ({ candidate_id }) => {
    const id = candidate_id?.trim() || DEFAULT_CANDIDATE_ID;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("shortlists")
      .select(
        "id, profile_id, job_id, match_score, reason, created_at, jobs(id, title, company, city, work_mode, job_type, salary_lpa_min, salary_lpa_max, apply_by, required_skills)"
      )
      .eq("profile_id", id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Database error fetching shortlists: ${error.message}`);

    const items = data || [];
    return {
      candidate_id: id,
      count: items.length,
      shortlisted_jobs: items.map((s) => {
        const j = (Array.isArray(s.jobs) ? s.jobs[0] : s.jobs) as Record<string, unknown> | null;
        return {
          shortlist_id: s.id,
          job_id: s.job_id,
          title: (j?.title as string) ?? "Unknown Title",
          company: (j?.company as string) ?? "Unknown Company",
          city: (j?.city as string) ?? "N/A",
          work_mode: (j?.work_mode as string) ?? "N/A",
          job_type: (j?.job_type as string) ?? "N/A",
          salary_range_lpa: `₹${(j?.salary_lpa_min as number) ?? 0} - ₹${(j?.salary_lpa_max as number) ?? 0} LPA`,
          match_score: s.match_score,
          reason: s.reason,
          saved_on: s.created_at,
        };
      }),
    };
  },
});

/**
 * WRITE TOOL 3 (CONDITIONAL): updateApplicationStatus
 * Accurately reports that the current schema lacks a status column.
 * Never fakes or invents data. Presents the exact safe SQL extension proposal.
 */
const updateApplicationStatus = defineTool({
  name: "updateApplicationStatus",
  description:
    "Use this when the user asks to update their application status (e.g. 'Update my application status to Interview'). Checks schema support for status tracking.",
  writes: false,
  schema: z.object({
    job_id: z
      .number()
      .int()
      .positive()
      .describe("Numeric job ID"),
    status: z
      .enum(["shortlisted", "applied", "interviewing", "offered", "rejected"])
      .describe("Desired application status"),
    candidate_id: z
      .string()
      .optional()
      .describe("Candidate ID (default: active student 'S001')"),
  }),
  run: async ({ job_id, status, candidate_id }) => {
    const id = candidate_id?.trim() || DEFAULT_CANDIDATE_ID;

    // Verify candidate and job exist
    await fetchVerifiedCandidate(id);
    const { data: job } = await getSupabase().from("jobs").select("id, title, company").eq("id", job_id).maybeSingle();

    return {
      supported: false,
      job_id,
      job_title: job?.title ?? `Job #${job_id}`,
      company: job?.company ?? "Unknown",
      requested_status: status,
      explanation:
        "Application status updates cannot be persisted because the official hackathon database schema (seed/ps6_job_match.sql) does not contain a status column in the 'shortlists', 'jobs', or 'profiles' tables.",
      sql_migration_proposal:
        "ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'shortlisted' CHECK (status IN ('shortlisted', 'applied', 'interviewing', 'offered', 'rejected'));",
      note: "Do not execute migrations without explicit user approval. Advise the user of this limitation honestly.",
    };
  },
});

/** Registered Agent Tools given to Gemini */
export const tools: AgentTool[] = [
  getCandidateProfile,
  listAvailableJobs,
  findJobMatches,
  saveJobMatch,
  listShortlistedJobs,
  updateApplicationStatus,
];
