"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export function OnboardingForm({
  openaiConfigured,
  exportsFolder
}: {
  openaiConfigured: boolean;
  exportsFolder: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        setBusy(true);
        setMessage("Saving setup...");
        const form = new FormData(formElement);
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-api-keys",
            openaiApiKey: String(form.get("openaiApiKey") || "").trim(),
            exportsFolder: String(form.get("exportsFolder") || "").trim()
          })
        });
        const data = await readJsonResponse(response);
        setBusy(false);

        if (!response.ok || !data.ok) {
          setMessage(data.message || data.error || "Could not save credentials.");
          return;
        }

        setMessage("Setup saved. UGC Content Factory is ready.");
        router.refresh();
        router.push("/kids");
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-pilot-ink">
          OpenAI API key
          <input
            name="openaiApiKey"
            type="password"
            required={!openaiConfigured}
            placeholder={openaiConfigured ? "Already saved" : "Paste OpenAI key"}
            className="mt-2 h-12 w-full rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-pilot-ink">
        Default export folder
        <input
          name="exportsFolder"
          defaultValue={exportsFolder}
          className="mt-2 h-12 w-full rounded-xl border border-pilot-line px-3 text-sm outline-none focus:border-pilot-purple"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy}>{busy ? "Saving..." : "Complete Setup"}</Button>
        <span className="text-sm text-pilot-muted">OpenAI: {openaiConfigured ? "Saved" : "Needed"}</span>
      </div>
      {message ? <p className="text-sm text-pilot-muted">{message}</p> : null}
    </form>
  );
}
