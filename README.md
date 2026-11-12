# HireFlow AI

An AI-powered Job Matching and Career Assistance agent built for the **SRM Agent Hackathon (PS6: Job Matching Agent)**.

HireFlow AI understands a candidate's profile, retrieves real job listings, scores compatibility with a deterministic matching engine, and lets candidates save jobs to a shortlist, all through a natural-language chat with a Gemini-powered agent.

---

## Features

- **AI Career Assistant**: chat with a Gemini agent that uses real tool calls (function calling), not canned answers.
- **Job Matching Engine**: transparent, deterministic TypeScript scoring (no AI-invented scores).
- **Explainable Results**: every match shows matching skills, missing skills and a score breakdown.
- **Shortlists**: save jobs to Supabase and view them later.
- **Dashboard and Job Discovery**: browse jobs and see live stats from the database.
- **Passcode Authentication**: simple protected access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| AI | Google Gemini (function calling) |
| Database | Supabase (PostgreSQL) |
| Validation | Zod |
| Deployment | Vercel |

---

## How the Agent Works

All agent logic lives in `lib/agent/`:

| File | Responsibility |
|---|---|
| `systemPrompt.ts` | Agent role, persona, context, tasks, constraints, tool rules |
| `tools.ts` | All tool definitions (read and write) |
| `defineTool.ts` | Tool registration with Zod validation |
| `runAgent.ts` | Gemini execution and function-calling loop |

### Tools

| Tool | Type | Purpose |
|---|---|---|
| `getCandidateProfile` | Read | Fetch the candidate's profile |
| `listAvailableJobs` | Read | Fetch jobs from Supabase |
| `findJobMatches` | Read / Compute | Rank jobs with the matching engine |
| `saveJobMatch` | Write | Save a job to the shortlist (duplicate-safe) |
| `listShortlistedJobs` | Read | Retrieve saved jobs |
| `updateApplicationStatus` | Write | Update status (only if the schema supports it) |

### Matching Algorithm

| Factor | Weight |
|---|---|
| Skills | 40% |
| Experience | 25% |
| Education | 15% |
| Location | 10% |
| Role preference | 10% |

Gemini explains the calculated results; it never generates the scores.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A Supabase project
- A Google Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/learn2simple/srm-agent-hackathon-starter.git
cd srm-agent-hackathon-starter
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Use the exact variable names listed in `.env.example` (Gemini API key, Supabase URL and keys, and the access passcode). **Never commit `.env.local`.**

### 3. Set up the database

In the Supabase **SQL Editor**, run:

1. `seed/00_starter_example.sql`
2. `seed/ps6_job_match.sql`

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your passcode.

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## Try It

Ask the assistant:

1. "Find jobs matching my profile."
2. "Why is the first job a good match?"
3. "What skills am I missing?"
4. "Save the first job."
5. "Show me my shortlisted jobs."

---

## Project Structure

```
app/
  page.tsx            Main app screen
  login/page.tsx      Passcode login
  api/
    agent/route.ts    Gemini agent endpoint
    tasks/route.ts    Tasks endpoint
    health/route.ts   Health check
components/           UI components (chat, lists, job cards)
lib/
  agent/              Agent prompt, tools, execution loop
  supabase.ts         Supabase client
seed/                 SQL seed files
```

(Adjust to match your final file layout.)

---

## Deployment (Vercel)

1. Push the repo to GitHub (ensure `.env.local` is not committed).
2. Import the repo in [Vercel](https://vercel.com).
3. Add the same environment variables from `.env.local` in **Project Settings, Environment Variables**.
4. Deploy, then test `/api/health` and the agent chat.

Verify the production build locally first:

```bash
npm run build
```

---

## Security Notes

- Supabase service credentials and the Gemini key are used **server-side only**.
- All tool inputs are validated with Zod.
- Shortlist writes verify the job exists and prevent duplicates.
- No destructive database operations are performed.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 3000 in use | `npm run dev -- -p 3001` |
| No jobs or profile showing | Run the seed SQL files in Supabase |
| Agent not responding | Check the Gemini API key and rate limits |
| Env changes ignored | Restart the dev server |

---

## Hackathon

Built for the **SRM Agent Hackathon**, Problem Statement 6: Job Matching Agent.

