"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function InviteJoiner({
  token,
  roomName,
}: {
  token: string;
  roomName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function join() {
      try {
        const response = await fetch(
          `/api/invites/${encodeURIComponent(token)}/join`,
          { method: "POST", credentials: "same-origin" },
        );
        const data = (await response.json()) as {
          roomUrl?: string;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !data.roomUrl) {
          setError(data.error ?? "Unable to join this room");
          return;
        }
        router.replace(data.roomUrl);
      } catch {
        if (active) setError("Unable to connect. Please try again.");
      }
    }
    void join();
    return () => {
      active = false;
    };
  }, [router, token]);

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
    </div>
  );
}
