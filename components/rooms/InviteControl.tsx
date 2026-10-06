"use client";

import { useState } from "react";

export function InviteControl({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(maxUses ? { maxUses: Number(maxUses) } : {}),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Unable to create invite");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="rounded-3xl border border-[#dce8e0] bg-white p-5 sm:p-6"
      aria-labelledby="invite-heading"
    >
      <h2 id="invite-heading" className="text-xl font-semibold">
        Invite participants
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#6c8476]">
        The link expires after 7 days. Anyone with the link can join after phone
        identity lookup.
      </p>
      <label
        htmlFor="invite-max-uses"
        className="mt-5 block text-sm font-semibold"
      >
        Usage limit (optional)
      </label>
      <input
        id="invite-max-uses"
        type="number"
        inputMode="numeric"
        min={1}
        max={2147483647}
        value={maxUses}
        onChange={(event) => setMaxUses(event.target.value)}
        placeholder="Unlimited"
        className="mt-2 min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base"
      />
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="mt-4 min-h-12 w-full rounded-xl bg-[#205545] px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create invite"}
      </button>
      <p
        role="alert"
        aria-live="polite"
        className="mt-2 min-h-5 text-sm text-[#b04646]"
      >
        {error}
      </p>
      {url && (
        <div className="mt-4">
          <label htmlFor="invite-url" className="block text-sm font-semibold">
            Share this link now
          </label>
          <input
            id="invite-url"
            type="url"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base"
          />
          <p className="mt-2 text-xs leading-5 text-[#6c8476]">
            The link is shown only now. Select it to copy or share.
          </p>
        </div>
      )}
    </section>
  );
}
