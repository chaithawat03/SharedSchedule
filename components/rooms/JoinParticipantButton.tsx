"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinParticipantButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    if (pending || joined) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Unable to join the room");
        return;
      }
      setJoined(true);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={join}
        disabled={pending || joined}
        className="min-h-11 rounded-xl bg-[#205545] px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {joined ? "Joined" : pending ? "Joining…" : "Join as Participant"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#b04646]">
          {error}
        </p>
      )}
    </div>
  );
}
