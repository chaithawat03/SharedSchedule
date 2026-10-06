"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        room?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.room) {
        setError(data.error ?? "Unable to create room");
        return;
      }
      router.push(`/room/${data.room.id}`);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-[#dce8e0] bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-xl font-semibold text-[#173b34]">Create a room</h2>
      <p className="mt-1 text-sm text-[#6c8476]">
        Give your shared space a name. You can invite participants afterward.
      </p>
      <label
        htmlFor="room-name"
        className="mt-5 block text-sm font-semibold text-[#315647]"
      >
        Room name
      </label>
      <input
        id="room-name"
        name="name"
        type="text"
        maxLength={160}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Smart & Partner"
        className="mt-2 min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base outline-none focus:border-[#5b9877] focus:ring-2 focus:ring-[#cde6d2]"
      />
      <p
        role="alert"
        aria-live="polite"
        className="mt-2 min-h-6 text-sm text-[#b04646]"
      >
        {error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-12 w-full rounded-xl bg-[#205545] px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}
