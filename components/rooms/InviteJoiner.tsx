"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function InviteJoiner({
  token,
  roomName,
}: {
  token: string;
  roomName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const join = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setRetryable(false);
    try {
      const response = await fetch(
        `/api/invites/${encodeURIComponent(token)}/join`,
        { method: "POST", credentials: "same-origin" },
      );
      const data = (await response.json()) as {
        roomUrl?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.roomUrl) {
        setError(data.error ?? "Unable to join this room");
        setRetryable(response.status >= 500);
        return;
      }
      router.replace(data.roomUrl);
    } catch {
      setError("Unable to connect. Please try again.");
      setRetryable(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [router, token]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void join();
    });
    return () => {
      active = false;
    };
  }, [join]);

  return (
    <div role="status" aria-live="polite">
      <h2 className="text-2xl font-semibold">
        Joining {roomName ?? "the room"}…
      </h2>
      <p className="mt-3 text-sm text-[#6c8476]">Opening your shared room.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[#b04646]">
          {error}
        </p>
      )}
      {retryable && (
        <button
          type="button"
          onClick={() => void join()}
          disabled={pending}
          className="mt-4 min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545] disabled:opacity-50"
        >
          Retry joining room
        </button>
      )}
    </div>
  );
}
