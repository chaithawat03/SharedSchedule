"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/session/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("Unable to log out. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p
        className="mb-2 min-h-5 text-sm text-[#b04646]"
        role="alert"
        aria-live="polite"
      >
        {error}
      </p>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="min-h-12 w-full rounded-xl border border-[#bcd7c7] px-5 py-3 text-base font-semibold text-[#276451] hover:bg-[#f1f8f2] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#287466] disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Logging out…" : "Logout"}
      </button>
    </div>
  );
}
