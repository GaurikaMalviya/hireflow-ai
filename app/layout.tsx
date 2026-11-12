import type { Metadata } from "next";
import "./globals.css";

// App Metadata for HireFlow AI
export const metadata: Metadata = {
  title: "HireFlow AI - AI Job Matching Platform",
  description: "Intelligent campus placement and job matching assistant powered by Gemini & Supabase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
