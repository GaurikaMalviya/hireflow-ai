"use client";

import { useEffect, useState, useTransition } from "react";
import AgentChat from "@/components/AgentChat";

// Types corresponding strictly to the Supabase PS6 schema
export type Profile = {
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

export type Job = {
  id: number;
  title: string;
  company: string;
  city: string;
  work_mode: "Onsite" | "Hybrid" | "Remote";
  job_type: "Full-time" | "Internship";
  min_cgpa: number;
  eligible_branches: string[];
  required_skills: string[];
  nice_to_have: string[];
  salary_lpa_min: number | null;
  salary_lpa_max: number | null;
  apply_by: string;
  description: string;
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  is_eligible: boolean;
  eligibility_notes: string[];
  is_saved: boolean;
  shortlist_id?: number | null;
  saved_reason?: string | null;
};

export type ShortlistItem = {
  id: number;
  profile_id: string;
  job_id: number;
  match_score: number | null;
  reason: string | null;
  created_at: string;
  jobs: Job;
};

export type DashboardStats = {
  totalJobs: number;
  eligibleJobs: number;
  shortlistedCount: number;
  highestMatchScore: number;
};

type Tab = "dashboard" | "discovery" | "saved" | "profile" | "applications" | "assistant";

export default function HireFlowApp() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  // Profile and stats
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    eligibleJobs: 0,
    shortlistedCount: 0,
    highestMatchScore: 0,
  });

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [sortOption, setSortOption] = useState<"match" | "salary" | "deadline">("match");

  // Shortlists state
  const [shortlists, setShortlists] = useState<ShortlistItem[]>([]);
  const [loadingShortlists, setLoadingShortlists] = useState(false);

  // Modal detail state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);

  // Mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  // 1. Fetch Profile & Stats
  useEffect(() => {
    fetch("/api/profile?id=S001")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load candidate profile");
        const data = await res.json();
        setProfile(data.profile);
        setStats(data.stats);
      })
      .catch((err) => console.error(err));
  }, [refreshKey]);

  // 2. Fetch Jobs
  useEffect(() => {
    setLoadingJobs(true);
    setJobsError("");
    const params = new URLSearchParams({
      profile_id: "S001",
      city: cityFilter,
      work_mode: modeFilter,
      job_type: typeFilter,
      eligible_only: String(eligibleOnly),
      sort: sortOption,
    });
    if (search.trim()) params.set("q", search.trim());

    fetch(`/api/jobs?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to fetch jobs");
        setJobs(data.jobs || []);
      })
      .catch((err) => setJobsError(err.message))
      .finally(() => setLoadingJobs(false));
  }, [refreshKey, search, cityFilter, modeFilter, typeFilter, eligibleOnly, sortOption]);

  // 3. Fetch Shortlists
  useEffect(() => {
    setLoadingShortlists(true);
    fetch("/api/shortlists?profile_id=S001")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load shortlists");
        const data = await res.json();
        setShortlists(data.shortlists || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingShortlists(false));
  }, [refreshKey]);

  // Toggle Shortlist action
  async function toggleShortlist(job: Job) {
    if (job.is_saved) {
      // Remove
      await fetch("/api/shortlists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: "S001", job_id: job.id }),
      });
    } else {
      // Add
      await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: "S001",
          job_id: job.id,
          match_score: job.match_score,
          reason: `Match score ${job.match_score}% with ${job.matching_skills.length} matching skills: ${job.matching_skills.join(", ")}`,
        }),
      });
    }
    // Refresh data
    startTransition(() => {
      setRefreshKey((k) => k + 1);
    });
  }

  // Handle logout
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Open job in AI Assistant
  function askAssistantAboutJob(job: Job) {
    setSelectedJob(null);
    setAssistantPrompt(
      `Analyze my fit for the ${job.title} role at ${job.company} in ${job.city}. My match score is ${job.match_score}%. What skills should I highlight or prepare?`
    );
    setActiveTab("assistant");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex w-64 flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-xs shrink-0">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-sm">
              H
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">HireFlow AI</h1>
              <p className="text-[11px] font-medium text-slate-500">AI Job Matching Platform</p>
            </div>
          </div>

          {/* Candidate Profile Widget */}
          {profile && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Candidate</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {profile.id}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
                <p className="text-xs text-slate-500">
                  {profile.degree} {profile.branch} &middot; CGPA {profile.cgpa}
                </p>
              </div>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {profile.preferred_cities.slice(0, 2).join(", ")}
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "dashboard"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab("discovery")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "discovery"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Job Discovery
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {stats.totalJobs}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("saved")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "saved"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Shortlists & Saved
              </span>
              {stats.shortlistedCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                  {stats.shortlistedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "profile"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Candidate Profile
            </button>

            <button
              onClick={() => setActiveTab("applications")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "applications"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Application Tracking
            </button>

            <button
              onClick={() => setActiveTab("assistant")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "assistant"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Career Assistant
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Supabase Database</span>
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Live
            </span>
          </div>
          <button
            onClick={logout}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
            H
          </div>
          <span className="font-bold text-slate-900 text-sm">HireFlow AI</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white p-4 space-y-2 sticky top-[57px] z-20 shadow-md">
          <button
            onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "dashboard" ? "bg-slate-900 text-white" : "text-slate-700"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => { setActiveTab("discovery"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "discovery" ? "bg-slate-900 text-white" : "text-slate-700"}`}
          >
            Job Discovery ({stats.totalJobs})
          </button>
          <button
            onClick={() => { setActiveTab("saved"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "saved" ? "bg-slate-900 text-white" : "text-slate-700"}`}
          >
            Shortlists & Saved ({stats.shortlistedCount})
          </button>
          <button
            onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "profile" ? "bg-slate-900 text-white" : "text-slate-700"}`}
          >
            Candidate Profile
          </button>
          <button
            onClick={() => { setActiveTab("applications"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "applications" ? "bg-slate-900 text-white" : "text-slate-700"}`}
          >
            Application Tracking
          </button>
          <button
            onClick={() => { setActiveTab("assistant"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "assistant" ? "bg-indigo-600 text-white" : "text-indigo-700 bg-indigo-50"}`}
          >
            AI Career Assistant
          </button>
          <button onClick={logout} className="w-full text-left px-3 py-2 text-xs font-medium text-red-600">
            Log out
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* TOP BAR / BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>HireFlow AI</span>
              <span>/</span>
              <span className="text-slate-800 capitalize font-semibold">{activeTab}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {activeTab === "dashboard" && "Placement & Match Dashboard"}
              {activeTab === "discovery" && "Job Discovery & Search"}
              {activeTab === "saved" && "Saved Jobs & Shortlists"}
              {activeTab === "profile" && "Candidate Profile & Eligibility"}
              {activeTab === "applications" && "Application Lifecycle Tracking"}
              {activeTab === "assistant" && "Gemini AI Career Assistant"}
            </h2>
          </div>

          {/* Quick Header Indicators */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              {stats.eligibleJobs} Eligible Roles
            </span>
            <button
              onClick={() => setActiveTab("assistant")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ask AI
            </button>
          </div>
        </div>

        {/* SCREEN 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* 4 Metric Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Campus Jobs</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stats.totalJobs}</p>
                <p className="mt-1 text-xs text-slate-500">Active campus postings</p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-2xs">
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Eligible For You</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-700">{stats.eligibleJobs}</p>
                <p className="mt-1 text-xs text-emerald-600">Meets CGPA {profile?.cgpa} & branch</p>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-2xs">
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Shortlisted Jobs</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-indigo-700">{stats.shortlistedCount}</p>
                <p className="mt-1 text-xs text-indigo-600">Saved in your pipeline</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Best Match Score</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stats.highestMatchScore}%</p>
                <p className="mt-1 text-xs text-slate-500">Highest skill compatibility</p>
              </div>
            </div>

            {/* Profile Overview Card + Quick Prompt Launcher */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Candidate Info */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      Active Candidate Profile
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">{profile?.name}</h3>
                    <p className="text-xs text-slate-500">
                      ID: {profile?.id} &middot; {profile?.degree} in {profile?.branch} &middot; Graduating {profile?.grad_year}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Current CGPA</span>
                    <span className="text-xl font-extrabold text-slate-900">{profile?.cgpa} / 10.0</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Verified Skill Set (for deterministic matching):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile?.skills.map((s) => (
                      <span key={s} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200/60">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>Preferred Cities: <strong>{profile?.preferred_cities.join(", ")}</strong></span>
                  <button onClick={() => setActiveTab("profile")} className="text-indigo-600 font-semibold hover:underline">
                    View Full Profile &rarr;
                  </button>
                </div>
              </div>

              {/* AI Career Assistant Prompt Box */}
              <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-900 to-slate-900 p-6 text-white shadow-xs flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Gemini AI Assistant
                  </div>
                  <h3 className="text-base font-bold text-white mt-3">Smart Career Guidance</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Ask Gemini to evaluate your eligibility, calculate exact match percentages, or prepare for interviews.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => {
                      setAssistantPrompt("What are the top 3 jobs with the highest skill match score for me?");
                      setActiveTab("assistant");
                    }}
                    className="w-full text-left rounded-xl bg-white/10 hover:bg-white/20 p-2.5 text-xs text-slate-100 transition-colors border border-white/10"
                  >
                    &ldquo;What are my top 3 matching jobs?&rdquo; &rarr;
                  </button>
                  <button
                    onClick={() => {
                      setAssistantPrompt("Which skills should I learn to qualify for full-stack developer roles?");
                      setActiveTab("assistant");
                    }}
                    className="w-full text-left rounded-xl bg-white/10 hover:bg-white/20 p-2.5 text-xs text-slate-100 transition-colors border border-white/10"
                  >
                    &ldquo;Which skills should I learn next?&rdquo; &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Top Recommended Eligible Jobs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Top Recommended Matches</h3>
                  <p className="text-xs text-slate-500">Highest compatibility roles matching your academic criteria</p>
                </div>
                <button
                  onClick={() => setActiveTab("discovery")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  View All {stats.totalJobs} Jobs &rarr;
                </button>
              </div>

              {loadingJobs ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                  Loading campus jobs...
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {jobs.filter((j) => j.is_eligible).slice(0, 4).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onSelect={() => setSelectedJob(job)}
                      onToggleShortlist={() => toggleShortlist(job)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 2: JOB DISCOVERY */}
        {activeTab === "discovery" && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3.5 top-3 h-4 w-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by job title, company, or required skill (e.g. python, sql)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={eligibleOnly}
                      onChange={(e) => setEligibleOnly(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Eligible Only
                  </label>
                </div>
              </div>

              {/* Dropdown Filters Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">City</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-medium text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="All">All Cities</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Coimbatore">Coimbatore</option>
                    <option value="Pune">Pune</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Work Mode</label>
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-medium text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="All">All Modes</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Job Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-medium text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="All">All Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sort By</label>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as "match" | "salary" | "deadline")}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-medium text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="match">Highest Match Score</option>
                    <option value="salary">Salary (High to Low)</option>
                    <option value="deadline">Application Deadline</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Showing <strong>{jobs.length}</strong> available positions</span>
              {(cityFilter !== "All" || modeFilter !== "All" || typeFilter !== "All" || eligibleOnly || search) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setCityFilter("All");
                    setModeFilter("All");
                    setTypeFilter("All");
                    setEligibleOnly(false);
                  }}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Jobs Grid */}
            {loadingJobs && (
              <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                Fetching matching jobs from Supabase...
              </div>
            )}

            {jobsError && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
                {jobsError}
              </div>
            )}

            {!loadingJobs && !jobsError && jobs.length === 0 && (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                <p className="text-sm font-semibold text-slate-800">No jobs found matching your criteria</p>
                <p className="text-xs text-slate-500">Try adjusting your search terms or unchecking &ldquo;Eligible Only&rdquo;.</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSelect={() => setSelectedJob(job)}
                  onToggleShortlist={() => toggleShortlist(job)}
                />
              ))}
            </div>
          </div>
        )}

        {/* SCREEN 3: JOB DETAILS MODAL */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 my-8">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {selectedJob.company}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {selectedJob.city} &middot; {selectedJob.work_mode}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-2">{selectedJob.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedJob.job_type} &middot; Package: ₹{selectedJob.salary_lpa_min ?? 0} - ₹{selectedJob.salary_lpa_max ?? 0} LPA
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Eligibility Audit Box */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${
                selectedJob.is_eligible ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Academic Eligibility Check (Candidate S001)
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    selectedJob.is_eligible ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {selectedJob.is_eligible ? "100% Eligible" : "Ineligible for Direct Apply"}
                  </span>
                </div>
                <ul className="text-xs space-y-1 text-slate-700">
                  {selectedJob.eligibility_notes.map((note, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-slate-400">&bull;</span> {note}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">&bull;</span>
                    Eligible Branches: {selectedJob.eligible_branches.join(", ")}
                  </li>
                </ul>
              </div>

              {/* Skills Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Skills Compatibility</h4>
                  <span className="text-xs font-bold text-indigo-600">
                    {selectedJob.match_score}% Skill Match
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Required Skills You Have ({selectedJob.matching_skills.length}):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.matching_skills.length > 0 ? (
                      selectedJob.matching_skills.map((s) => (
                        <span key={s} className="rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs px-2 py-0.5 font-medium">
                          ✓ {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">None matched</span>
                    )}
                  </div>
                </div>

                {selectedJob.missing_skills.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Missing Required Skills ({selectedJob.missing_skills.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.missing_skills.map((s) => (
                        <span key={s} className="rounded-md bg-slate-100 text-slate-700 font-mono text-xs px-2 py-0.5 font-medium border border-slate-200">
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedJob.nice_to_have.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Nice-to-Have Skills:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.nice_to_have.map((s) => (
                        <span key={s} className="rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs px-2 py-0.5">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Role Description</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100 whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  onClick={() => askAssistantAboutJob(selectedJob)}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Ask AI About This Role
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleShortlist(selectedJob)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                      selectedJob.is_saved
                        ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {selectedJob.is_saved ? "Remove From Shortlist" : "Save to Shortlist"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 4: CANDIDATE PROFILE */}
        {activeTab === "profile" && profile && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                    Candidate Profile #{profile.id}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{profile.name}</h3>
                  <p className="text-xs text-slate-500">
                    {profile.degree} in {profile.branch} &middot; Class of {profile.grad_year}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 block">Cumulative GPA</span>
                  <span className="text-2xl font-black text-indigo-600">{profile.cgpa}</span>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">Location Preferences</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.preferred_cities.map((city) => (
                        <span key={city} className="rounded-lg bg-slate-100 px-3 py-1 font-medium text-slate-700 border border-slate-200">
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">Career Interests</h4>
                    <p className="rounded-xl bg-slate-50 p-3 text-slate-700 border border-slate-100">
                      {profile.interests || "General Software and Technology"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Registered Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <span key={s} className="rounded-lg bg-indigo-50 border border-indigo-200/60 font-mono text-xs px-2.5 py-1 text-indigo-900 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Placement Standing Insights */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Placement Eligibility Overview</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xl font-bold text-slate-900">{stats.totalJobs}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Total Campus Openings</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-center">
                    <p className="text-xl font-bold text-emerald-700">{stats.eligibleJobs}</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">Strictly Eligible for S001</p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 text-center">
                    <p className="text-xl font-bold text-indigo-700">{stats.shortlistedCount}</p>
                    <p className="text-[11px] text-indigo-800 mt-0.5">Saved in Shortlist</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: SAVED JOBS / SHORTLISTS */}
        {activeTab === "saved" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Shortlisted Opportunities</h3>
                  <p className="text-xs text-slate-500">Live records from Supabase `shortlists` table for candidate S001</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                  {shortlists.length} Saved
                </span>
              </div>

              {loadingShortlists ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading saved shortlists...</div>
              ) : shortlists.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">No saved jobs yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Browse the Job Discovery section to explore campus roles and save them to your shortlist.
                  </p>
                  <button
                    onClick={() => setActiveTab("discovery")}
                    className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Browse Jobs
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {shortlists.map((item) => (
                    <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">{item.jobs?.title}</span>
                          <span className="text-xs text-slate-500">&middot; {item.jobs?.company}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            {item.jobs?.city} ({item.jobs?.work_mode})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Saved: {new Date(item.created_at).toLocaleDateString()} &middot; Package: ₹{item.jobs?.salary_lpa_min ?? 0} - ₹{item.jobs?.salary_lpa_max ?? 0} LPA
                        </p>
                        {item.reason && (
                          <p className="text-xs text-indigo-700 italic bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/60 mt-1">
                            Rationale: {item.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="text-right mr-2">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Match</span>
                          <span className="text-sm font-bold text-emerald-700">{item.match_score ?? 100}%</span>
                        </div>
                        <button
                          onClick={() => {
                            if (item.jobs) {
                              const enrichedJob: Job = {
                                ...item.jobs,
                                match_score: item.match_score ?? 0,
                                matching_skills: item.jobs.required_skills.filter((s: string) => profile?.skills.includes(s)),
                                missing_skills: item.jobs.required_skills.filter((s: string) => !profile?.skills.includes(s)),
                                is_eligible: Number(profile?.cgpa || 0) >= Number(item.jobs.min_cgpa),
                                eligibility_notes: [`Saved on ${new Date(item.created_at).toLocaleDateString()}`],
                                is_saved: true,
                                shortlist_id: item.id,
                              };
                              setSelectedJob(enrichedJob);
                            }
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => {
                            fetch("/api/shortlists", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: item.id }),
                            }).then(() => setRefreshKey((k) => k + 1));
                          }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 6: APPLICATION TRACKING */}
        {activeTab === "applications" && (
          <div className="space-y-6">
            {/* Schema Notice Banner */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold">Schema Limitation Notice (Audited Rule 4)</h4>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                As documented in the Phase 1 audit, the official hackathon database schema (<code>seed/ps6_job_match.sql</code>) supports saving matches to the <code>shortlists</code> table, but does not currently include an <code>application_status</code> column. In strict accordance with the non-negotiable rules (&ldquo;never invent columns&rdquo; and &ldquo;Application tracking, ONLY if the audited schema supports it&rdquo;), application status tracking is accurately presented as your validated <strong>Shortlist Pipeline</strong> until a migration is authorized.
              </p>
            </div>

            {/* Pipeline Stage Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">1. Shortlisted (Saved)</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {shortlists.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {shortlists.map((s) => (
                    <div key={s.id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1">
                      <p className="font-bold text-slate-900">{s.jobs?.title}</p>
                      <p className="text-slate-500 text-[11px]">{s.jobs?.company} &middot; {s.jobs?.city}</p>
                      <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Score: {s.match_score ?? 100}%
                      </span>
                    </div>
                  ))}
                  {shortlists.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No jobs in shortlist</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500">2. Applied / Interviewing</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">0</span>
                </div>
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Requires <code>status</code> column migration to persist interview lifecycle.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500">3. Placement Offer</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">0</span>
                </div>
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Requires <code>status</code> column migration to persist offer acceptance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 7: GEMINI AI CAREER ASSISTANT */}
        {activeTab === "assistant" && (
          <div className="space-y-4">
            <AgentChat
              onDataChanged={() => setRefreshKey((k) => k + 1)}
              initialPrompt={assistantPrompt}
            />
          </div>
        )}
      </main>
    </div>
  );
}

/** Rich Job Card Component */
function JobCard({
  job,
  onSelect,
  onToggleShortlist,
}: {
  job: Job;
  onSelect: () => void;
  onToggleShortlist: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
      {/* Header & Badges */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500">{job.company}</span>
            <h4 className="text-base font-bold text-slate-900 leading-snug">{job.title}</h4>
          </div>
          {/* Match Score Badge */}
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                job.match_score >= 80
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : job.match_score >= 50
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {job.match_score}% Match
            </span>
          </div>
        </div>

        {/* Location, Mode & Compensation */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">{job.city}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">{job.work_mode}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">{job.job_type}</span>
          <span className="font-semibold text-slate-900">
            ₹{job.salary_lpa_min ?? 0} - ₹{job.salary_lpa_max ?? 0} LPA
          </span>
        </div>
      </div>

      {/* Academic Eligibility Badge */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 font-medium">Eligibility:</span>
          <span
            className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${
              job.is_eligible
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {job.is_eligible ? "✓ Eligible for S001" : `✕ Min CGPA: ${job.min_cgpa}`}
          </span>
        </div>
      </div>

      {/* Skills Chips */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-500">Required Skills:</p>
        <div className="flex flex-wrap gap-1">
          {job.required_skills.slice(0, 4).map((s) => {
            const hasSkill = job.matching_skills.includes(s.toLowerCase());
            return (
              <span
                key={s}
                className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                  hasSkill
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-50 text-slate-600 border border-slate-200"
                }`}
              >
                {hasSkill ? "✓ " : ""}{s}
              </span>
            );
          })}
          {job.required_skills.length > 4 && (
            <span className="text-[11px] text-slate-400 self-center">
              +{job.required_skills.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
        <button
          onClick={onSelect}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-center"
        >
          View Details
        </button>
        <button
          onClick={onToggleShortlist}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            job.is_saved
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {job.is_saved ? "Saved ✓" : "Shortlist"}
        </button>
      </div>
    </div>
  );
}
