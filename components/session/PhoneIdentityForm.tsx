"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginResponse = {
  requiresRegistration?: boolean;
  phoneDisplay?: string;
  error?: string;
};

export function PhoneIdentityForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          registering ? { phone: phoneDisplay, displayName } : { phone },
        ),
      });
      const data = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setError(data.error ?? "Unable to continue. Please try again.");
        return;
      }
      if (data.requiresRegistration && data.phoneDisplay) {
        setPhoneDisplay(data.phoneDisplay);
        setRegistering(true);
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
    <form className="flex min-h-[360px] flex-col" onSubmit={submit}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#729080]">
        {registering ? "One more step" : "Welcome"}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#173b34]">
        {registering ? "Create your profile" : "Start with your number"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#718b7c]">
        {registering
          ? "Add a name people will recognize in shared schedules."
          : "Enter your mobile number to find your profile."}
      </p>

      <div className="mt-7 flex-1">
        {registering ? (
          <>
            <label
              htmlFor="display-name"
              className="mb-2 block text-sm font-semibold text-[#315647]"
            >
              Display name
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Smart"
              className="min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base text-[#173b34] outline-none focus:border-[#5b9877] focus:ring-2 focus:ring-[#cde6d2]"
            />
            <p className="mt-5 text-sm font-semibold text-[#315647]">Phone</p>
            <p className="mt-1 text-base text-[#5c7b6a]">{phoneDisplay}</p>
            <button
              type="button"
              onClick={() => {
                setRegistering(false);
                setError("");
              }}
              className="mt-2 min-h-11 text-sm font-semibold text-[#397c61] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466]"
            >
              Change number
            </button>
          </>
        ) : (
          <>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-semibold text-[#315647]"
            >
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              enterKeyHint="go"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0812345678"
              className="min-h-12 w-full rounded-xl border border-[#cddfd3] bg-[#fbfdfa] px-4 text-base text-[#173b34] outline-none focus:border-[#5b9877] focus:ring-2 focus:ring-[#cde6d2]"
            />
            <p className="mt-3 text-xs leading-5 text-[#839a8c]">
              No password or verification code is used.
            </p>
          </>
        )}
        <p
          className="mt-3 min-h-6 text-sm text-[#b04646]"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-12 w-full rounded-xl bg-[#205545] px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#174837] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#287466] disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Please wait…" : registering ? "Create account" : "Continue"}
      </button>
    </form>
  );
}
