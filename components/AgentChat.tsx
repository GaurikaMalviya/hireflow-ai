"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentResult, AgentStep } from "@/lib/agent/types";

type Message = { role: "user" | "model"; text: string; steps?: AgentStep[] };

const SAMPLE_PROMPTS = [
  "Find all eligible full-time jobs in Chennai or Bengaluru matching my profile.",
  "What is my match score for the Data Analyst role at Nimbus Analytics?",
  "Which jobs have the highest match score for my skillset?",
  "What missing skills should I learn to qualify for full-stack developer roles?",
];

export default function AgentChat({
  onDataChanged,
  initialPrompt,
}: {
  onDataChanged?: () => void;
  initialPrompt?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && !loading) {
      send(initialPrompt.trim());
    }
  }, [initialPrompt]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-20).map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const result = data as AgentResult;
      setMessages([...next, { role: "model", text: result.reply, steps: result.steps }]);
      if (result.steps && result.steps.some((s) => s.writes && s.ok)) {
        onDataChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[720px] max-h-[85vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold text-sm">
            AI
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">HireFlow Career Assistant</h2>
            <p className="text-xs text-slate-400">Powered by Gemini & Real Campus Placement Data</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ready
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center my-auto">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Ask HireFlow AI anything</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Ask about job eligibility, match scores, company requirements, or shortlist recommendations.
            </p>
            <div className="mt-4 grid gap-2 text-left">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-900 transition-colors text-left"
                >
                  &ldquo;{p}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-sm"
                  : "max-w-[88%] space-y-2.5"
              }
            >
              {m.steps && m.steps.length > 0 && <ToolSteps steps={m.steps} />}
              {m.role === "model" ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm leading-relaxed">
                  {m.text}
                </div>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white rounded-xl border border-slate-200 px-3 py-2 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
            HireFlow AI is analyzing database records...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about jobs, eligibility, skills gap, or shortlisting..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}

/** Shows each tool call with inspection details */
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <details
          key={i}
          className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs shadow-xs"
        >
          <summary className="cursor-pointer select-none font-medium flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  s.ok ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="font-mono text-xs font-semibold text-slate-800">{s.tool}</span>
              {s.writes && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                  Database Write
                </span>
              )}
            </div>
            <span className={`text-[11px] ${s.ok ? "text-emerald-700" : "text-red-600"}`}>
              {s.ok ? "Verified" : "Failed"}
            </span>
          </summary>
          <pre className="mt-2 max-h-48 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 border border-slate-100">
            {JSON.stringify({ args: s.args, ...(s.ok ? { result: s.result } : { error: s.error }) }, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}
