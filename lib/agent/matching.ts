import "server-only";

export type CandidateProfile = {
  id: string;
  name: string;
  degree: string;
  branch: string;
  grad_year: number;
  cgpa: number;
  preferred_cities: string[];
  skills: string[];
  interests: string | null;
};

export type JobRecord = {
  id: number;
  title: string;
  company: string;
  city: string;
  work_mode: string;
  job_type: string;
  min_cgpa: number;
  eligible_branches: string[];
  required_skills: string[];
  nice_to_have: string[];
  salary_lpa_min: number | null;
  salary_lpa_max: number | null;
  apply_by: string;
  description: string;
};

export type MatchResult = {
  job: JobRecord;
  overall_score: number;
  matching_skills: string[];
  missing_skills: string[];
  is_academically_eligible: boolean;
  breakdown: {
    skills: { score: number; weight: string; matching: string[]; missing: string[] };
    experience: { score: number; weight: string; rule: string };
    education: { score: number; weight: string; cgpaMet: boolean; branchMet: boolean };
    location: { score: number; weight: string; detail: string };
    role_preference: { score: number; weight: string; detail: string };
  };
  explanation: string;
};

/**
 * Deterministic Matching Engine
 * Weights:
 * - Skills: 40%
 * - Experience: 25%
 * - Education: 15%
 * - Location: 10%
 * - Role Preference: 10%
 *
 * All calculations are pure TypeScript logic (no LLM, no random numbers).
 */
export function calculateJobMatch(candidate: CandidateProfile, job: JobRecord): MatchResult {
  const candidateSkills = (candidate.skills || []).map((s) => s.toLowerCase().trim());
  const reqSkills = (job.required_skills || []).map((s) => s.toLowerCase().trim());
  const niceSkills = (job.nice_to_have || []).map((s) => s.toLowerCase().trim());

  // 1. SKILLS SCORE (40% weight)
  const matchingSkills = reqSkills.filter((s) => candidateSkills.includes(s));
  const missingSkills = reqSkills.filter((s) => !candidateSkills.includes(s));
  const matchedNice = niceSkills.filter((s) => candidateSkills.includes(s));

  const baseSkillScore = reqSkills.length > 0 ? (matchingSkills.length / reqSkills.length) * 100 : 100;
  // Bonus: +5% for each matched nice-to-have skill (capped at 100)
  const skillBonus = matchedNice.length * 5;
  const skillsScore = Math.min(100, Math.round(baseSkillScore + skillBonus));

  // 2. EXPERIENCE SCORE (25% weight)
  // NEUTRAL SCORE RULE: Neither `profiles` nor `jobs` has a dedicated numeric `experience_years` column.
  // In campus hiring, all students are 2027 batch freshers.
  // - If job_type is 'Internship', freshers are a 100% direct fit.
  // - If job_type is 'Full-time' and description mentions 'fresher', 'trainee', or 'intern', score is 100%.
  // - For general full-time positions, assign a documented neutral baseline of 80% rather than penalizing for an unrecorded field.
  const descLower = (job.description || "").toLowerCase();
  const titleLower = (job.title || "").toLowerCase();
  let expScore = 80;
  let expRule = "Documented neutral baseline (80%) for campus fresher applying to full-time role.";

  if (job.job_type === "Internship") {
    expScore = 100;
    expRule = "100% match: Role is an Internship explicitly targeted at college students.";
  } else if (
    descLower.includes("fresher") ||
    descLower.includes("trainee") ||
    descLower.includes("junior") ||
    titleLower.includes("trainee") ||
    titleLower.includes("intern")
  ) {
    expScore = 100;
    expRule = "100% match: Job explicitly welcomes freshers/trainees from candidate's batch.";
  }

  // 3. EDUCATION SCORE (15% weight)
  // Evaluates CGPA threshold and branch eligibility.
  const cgpaMet = Number(candidate.cgpa) >= Number(job.min_cgpa);
  const candidateBranchUpper = candidate.branch.toUpperCase().trim();
  const eligibleBranchesUpper = (job.eligible_branches || []).map((b) => b.toUpperCase().trim());
  const branchMet = eligibleBranchesUpper.includes(candidateBranchUpper);

  let eduScore = 0;
  if (cgpaMet && branchMet) {
    eduScore = 100;
  } else if (!cgpaMet && branchMet) {
    // Proportional CGPA score (e.g. 8.1 / 8.5)
    const ratio = Number(job.min_cgpa) > 0 ? Number(candidate.cgpa) / Number(job.min_cgpa) : 0;
    eduScore = Math.round(ratio * 50); // half weight since CGPA is unmet
  } else if (cgpaMet && !branchMet) {
    eduScore = 40; // CGPA met but branch differs
  } else {
    eduScore = 10; // neither met
  }

  // 4. LOCATION SCORE (10% weight)
  // Evaluates candidate's preferred cities against job city and work mode.
  const prefCities = (candidate.preferred_cities || []).map((c) => c.toLowerCase().trim());
  const jobCity = (job.city || "").toLowerCase().trim();
  let locScore = 40; // default relocation baseline
  let locDetail = `Job city (${job.city}) is outside preferred locations (${candidate.preferred_cities.join(", ")}).`;

  if (job.work_mode === "Remote" || prefCities.includes("remote")) {
    locScore = 100;
    locDetail = "100% match: Remote work option eliminates location constraint.";
  } else if (prefCities.includes(jobCity)) {
    locScore = 100;
    locDetail = `100% match: Job city (${job.city}) matches candidate preference.`;
  } else if (job.work_mode === "Hybrid") {
    // NEUTRAL SCORE RULE: Hybrid roles offer flexibility, assigned 65% neutral score if city differs.
    locScore = 65;
    locDetail = "65% score: Hybrid role outside preferred city with partial remote flexibility.";
  }

  // 5. ROLE PREFERENCE SCORE (10% weight)
  // Compares candidate's declared interests against job title and description.
  let roleScore = 70;
  let roleDetail = "Neutral baseline (70%): Candidate has broad technological interests.";

  if (candidate.interests && candidate.interests.trim().length > 0) {
    const interestKeywords = candidate.interests
      .toLowerCase()
      .split(/[\s,;&]+/)
      .filter((w) => w.length > 2 && !["and", "the", "for", "with"].includes(w));

    const matchesTitle = interestKeywords.some((w) => titleLower.includes(w));
    const matchesDesc = interestKeywords.some((w) => descLower.includes(w));

    if (matchesTitle) {
      roleScore = 100;
      roleDetail = `100% match: Job title aligns directly with candidate interest in "${candidate.interests}".`;
    } else if (matchesDesc) {
      roleScore = 85;
      roleDetail = `85% match: Job description aligns with candidate interest in "${candidate.interests}".`;
    } else {
      // NEUTRAL SCORE RULE: When interests don't conflict, assign 70% neutral baseline.
      roleScore = 70;
      roleDetail = `Neutral baseline (70%): Candidate interests ("${candidate.interests}") do not conflict.`;
    }
  }

  // WEIGHTED TOTAL
  const weightedTotal =
    skillsScore * 0.40 +
    expScore * 0.25 +
    eduScore * 0.15 +
    locScore * 0.10 +
    roleScore * 0.10;

  const overallScore = Math.max(0, Math.min(100, Math.round(weightedTotal)));
  const isAcademicallyEligible = cgpaMet && branchMet;

  // Build human-readable explanation
  const explanation = `${job.title} at ${job.company} (${job.city}): Overall compatibility is ${overallScore}%. Skills Match: ${skillsScore}% (${matchingSkills.length}/${reqSkills.length} required skills matched: ${matchingSkills.join(", ") || "none"}). ${
    missingSkills.length > 0 ? `Missing skills: ${missingSkills.join(", ")}. ` : "All required skills met! "
  }Academic eligibility: ${isAcademicallyEligible ? "Fully eligible" : `Unmet criteria (${!cgpaMet ? `CGPA ${candidate.cgpa} < ${job.min_cgpa}` : ""}${!branchMet ? `Branch ${candidate.branch} not in [${job.eligible_branches.join(", ")}]` : ""})`}. Location: ${job.city} (${job.work_mode}).`;

  return {
    job,
    overall_score: overallScore,
    matching_skills: matchingSkills,
    missing_skills: missingSkills,
    is_academically_eligible: isAcademicallyEligible,
    breakdown: {
      skills: { score: skillsScore, weight: "40%", matching: matchingSkills, missing: missingSkills },
      experience: { score: expScore, weight: "25%", rule: expRule },
      education: { score: eduScore, weight: "15%", cgpaMet, branchMet },
      location: { score: locScore, weight: "10%", detail: locDetail },
      role_preference: { score: roleScore, weight: "10%", detail: roleDetail },
    },
    explanation,
  };
}

/** Rank multiple jobs against a candidate in descending order of compatibility */
export function rankJobMatches(candidate: CandidateProfile, jobs: JobRecord[]): MatchResult[] {
  const scored = jobs.map((job) => calculateJobMatch(candidate, job));
  // Sort descending by overall score, then eligible first, then salary
  scored.sort((a, b) => {
    if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score;
    if (b.is_academically_eligible !== a.is_academically_eligible) {
      return Number(b.is_academically_eligible) - Number(a.is_academically_eligible);
    }
    return Number(b.job.id) - Number(a.job.id);
  });
  return scored;
}

