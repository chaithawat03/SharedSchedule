"use client";

import { useRef, useState } from "react";
import { copyInviteUrl } from "./copy-invite-url";

export function InviteControl({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const urlField = useRef<HTMLInputElement>(null);

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
      setCopyFeedback("");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    const result = await copyInviteUrl(
      url,
      urlField.current,
      navigator.clipboard,
      () => document.execCommand("copy"),
    );
    setCopyFeedback(
      result === "copied"
        ? "Invite URL copied"
        : result === "selected"
          ? "URL selected. Use Copy from the selection menu."
          : "Unable to copy. Select the URL and try again.",
    );
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
            ref={urlField}
            id="invite-url"
            type="url"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base"
          />
          <button
            type="button"
            onClick={copy}
            className="mt-3 min-h-11 rounded-xl border border-[#205545] px-5 py-2 font-semibold text-[#205545] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Copy invite URL
          </button>
          <p
            role="status"
            aria-live="polite"
            className="mt-2 min-h-5 text-sm text-[#397c61]"
          >
            {copyFeedback}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#6c8476]">
            The link is shown only now. You can also select it to copy or share.
          </p>
        </div>
      )}
    </section>
  );
}
