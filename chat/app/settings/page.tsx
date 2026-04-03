"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { CliAlwaysAllowTab } from "@/components/settings/cli-always-allow-tab";
import { ModelSettingsTab } from "@/components/settings/model-settings-tab";
import { SkillsSettingsTab } from "@/components/settings/skills-settings-tab";

const tabBtn =
  "rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const tabActive =
  "bg-[#e8f0fe] text-[#174ea6] dark:bg-[#1e3a5f]/60 dark:text-[#8ab4f8]";
const tabIdle = "text-[#5f6368] hover:bg-black/[0.04] dark:text-[#9aa0a6] dark:hover:bg-white/[0.06]";

export default function SettingsPage() {
  const [tab, setTab] = useState<"general" | "cli" | "skills">("skills");

  return (
    <div className="min-h-[100dvh] bg-[#f8f9fa] dark:bg-[#0a0d12]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e8eaed] bg-[#f8f9fa] px-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[#1a73e8] hover:bg-[#e8f0fe] dark:text-[#8ab4f8] dark:hover:bg-[#1e3a5f]/40"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Chat
        </Link>
        <span className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Settings
        </span>
      </header>

      <div className="flex gap-1 border-b border-[#e8eaed] px-4 pt-2 dark:border-[#3c4043]">
        <button
          type="button"
          className={`${tabBtn} ${tab === "general" ? tabActive : tabIdle}`}
          onClick={() => setTab("general")}
        >
          General
        </button>
        <button
          type="button"
          className={`${tabBtn} ${tab === "cli" ? tabActive : tabIdle}`}
          onClick={() => setTab("cli")}
        >
          CLI run
        </button>
        <button
          type="button"
          className={`${tabBtn} ${tab === "skills" ? tabActive : tabIdle}`}
          onClick={() => setTab("skills")}
        >
          Skills
        </button>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {tab === "general" ? (
          <ModelSettingsTab />
        ) : tab === "cli" ? (
          <CliAlwaysAllowTab />
        ) : (
          <SkillsSettingsTab />
        )}
      </main>
    </div>
  );
}
