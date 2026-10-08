"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { STATUS_ICON_TOKENS } from "../../lib/master-data/icons";
import { DEFAULT_STATUS_CODES } from "../../lib/rooms/default-statuses";
import { AppNavigation } from "../navigation/AppNavigation";

type Status = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  active: boolean;
};
type Location = { id: string; name: string; active: boolean };
type Editor =
  { kind: "status"; row?: Status } | { kind: "location"; row?: Location };

const fieldClass =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cddfd3] bg-white px-3 text-base text-[#18332f]";
const actionClass =
  "min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-3 text-sm font-semibold text-[#205545] disabled:opacity-50";
const primaryClass =
  "min-h-11 rounded-xl bg-[#205545] px-4 font-semibold text-white disabled:opacity-50";

function MasterEditor({
  editor,
  pending,
  error,
  onClose,
  onSave,
}: {
  editor: Editor;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState(
    editor.kind === "status" ? (editor.row?.code ?? "") : "",
  );
  const [name, setName] = useState(editor.row?.name ?? "");
  const [color, setColor] = useState(
    editor.kind === "status" ? (editor.row?.color ?? "") : "",
  );
  const [icon, setIcon] = useState(
    editor.kind === "status" ? (editor.row?.icon ?? "") : "",
  );
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload =
      editor.kind === "status"
        ? editor.row
          ? { name, color: color || null, icon: icon || null }
          : { code, name, color: color || null, icon: icon || null }
        : { name };
    if (await onSave(payload)) onClose();
  }
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="master-editor-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-[#10221b]/50"
    >
      <div className="flex min-h-full items-end sm:items-center sm:justify-center">
        <form
          onSubmit={(event) => void submit(event)}
          className="flex max-h-dvh min-h-dvh w-full flex-col overflow-y-auto bg-[#f6f8f5] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[#18332f] sm:min-h-0 sm:max-h-[90dvh] sm:max-w-xl sm:rounded-3xl sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="master-editor-heading" className="text-xl font-semibold">
              {editor.row ? "Edit" : "Add"} {editor.kind}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              disabled={pending}
              aria-label="Close editor"
              className="min-h-11 min-w-11 rounded-full bg-[#e2eee5] text-xl"
            >
              ×
            </button>
          </div>
          <fieldset disabled={pending} className="mt-6 flex-1 space-y-5">
            {editor.kind === "status" && (
              <label className="block text-sm font-semibold">
                Code
                {editor.row ? (
                  <span className="mt-1 block rounded-xl bg-[#e9f1e9] px-3 py-3 font-mono text-base">
                    {editor.row.code}
                  </span>
                ) : (
                  <input
                    className={fieldClass}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    maxLength={48}
                    autoCapitalize="characters"
                  />
                )}
              </label>
            )}
            <label className="block text-sm font-semibold">
              {editor.kind === "status" ? "Display name" : "Name"}
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={editor.kind === "status" ? 100 : 160}
              />
            </label>
            {editor.kind === "status" && (
              <>
                <label className="block text-sm font-semibold">
                  Color (#RRGGBB)
                  <input
                    className={fieldClass}
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    placeholder="#3366AA"
                    maxLength={7}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Icon
                  <select
                    className={fieldClass}
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                  >
                    <option value="">None</option>
                    {STATUS_ICON_TOKENS.map((token) => (
                      <option key={token} value={token}>
                        {token}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </fieldset>
          <p role="alert" className="mt-3 min-h-6 text-sm text-[#a02f25]">
            {error}
          </p>
          <div className="sticky bottom-0 mt-2 flex gap-2 bg-[#f6f8f5] pb-[env(safe-area-inset-bottom)] pt-3 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={`${actionClass} flex-1`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${primaryClass} flex-1`}
            >
              {pending ? "Saving…" : `Save ${editor.kind}`}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export function RoomMastersSettings({
  roomId,
  initialStatuses,
  initialLocations,
}: {
  roomId: string;
  initialStatuses: Status[];
  initialLocations: Location[];
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [locations, setLocations] = useState(initialLocations);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const base = `/api/rooms/${roomId}`;
  const activeStatuses = statuses
    .filter((row) => row.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const inactiveStatuses = statuses.filter((row) => !row.active);
  const activeLocations = locations.filter((row) => row.active);
  const inactiveLocations = locations.filter((row) => !row.active);

  async function refresh() {
    try {
      const [statusResponse, locationResponse] = await Promise.all([
        fetch(`${base}/statuses?includeInactive=1`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch(`${base}/locations?includeInactive=1`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);
      if (!statusResponse.ok || !locationResponse.ok)
        throw new Error("Unable to refresh master lists");
      setStatuses(
        ((await statusResponse.json()) as { statuses: Status[] }).statuses,
      );
      setLocations(
        ((await locationResponse.json()) as { locations: Location[] })
          .locations,
      );
      setNeedsRefresh(false);
      setError("");
    } catch {
      setNeedsRefresh(true);
      setError(
        "Saved, but the lists could not refresh. Retry list refresh below.",
      );
    }
  }

  async function mutate(
    method: string,
    path: string,
    payload?: unknown,
  ): Promise<boolean> {
    if (pending || needsRefresh) return false;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        credentials: "same-origin",
        headers:
          payload === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Unable to save master");
        return false;
      }
      await refresh();
      return true;
    } catch {
      setError("Unable to connect. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function moveStatus(index: number, delta: number) {
    const next = activeStatuses.map((row) => row.id);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void mutate("PUT", "/statuses/order", { ids: next });
  }

  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href={`/room/${roomId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[#397c61]"
        >
          ← Back to room
        </a>
        <AppNavigation current="settings" roomId={roomId} isOwner />
        <h1 className="mt-5 text-3xl font-semibold">Room settings</h1>
        <p className="mt-3 rounded-xl bg-[#e7efe8] p-3 text-sm leading-6 text-[#315647]">
          Deactivating removes this choice from new events. Existing events keep
          their reference.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[#a02f25]">
            {error}
          </p>
        )}
        {needsRefresh && (
          <button
            type="button"
            onClick={() => void refresh()}
            className={`${primaryClass} mt-3 w-full`}
          >
            Retry list refresh
          </button>
        )}

        <section
          aria-labelledby="statuses-heading"
          className="mt-6 rounded-3xl border border-[#dce8e0] bg-white p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="statuses-heading" className="text-xl font-semibold">
              Statuses
            </h2>
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditor({ kind: "status" });
              }}
              disabled={pending || needsRefresh}
              className={primaryClass}
            >
              Add status
            </button>
          </div>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#567269]">
            Active
          </h3>
          <ul className="mt-2 space-y-3">
            {activeStatuses.map((row, index) => (
              <li key={row.id} className="rounded-2xl bg-[#f4f8f3] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="font-mono text-xs text-[#567269]">
                      {row.code}
                      {DEFAULT_STATUS_CODES.some((code) => code === row.code)
                        ? " · built-in"
                        : ""}
                    </p>
                  </div>
                  {row.color && (
                    <span
                      aria-label={`Color ${row.color}`}
                      className="size-6 rounded-full border border-[#cddfd3]"
                      style={{
                        backgroundColor: /^#[0-9a-f]{6}$/i.test(row.color)
                          ? row.color
                          : undefined,
                      }}
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || needsRefresh}
                    onClick={() => {
                      setError("");
                      setEditor({ kind: "status", row });
                    }}
                    className={actionClass}
                  >
                    Edit {row.name}
                  </button>
                  <button
                    type="button"
                    disabled={pending || needsRefresh}
                    onClick={() =>
                      void mutate("PATCH", `/statuses/${row.id}`, {
                        active: false,
                      })
                    }
                    className={actionClass}
                  >
                    Deactivate {row.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.name} up`}
                    disabled={index === 0 || pending || needsRefresh}
                    onClick={() => moveStatus(index, -1)}
                    className={actionClass}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.name} down`}
                    disabled={
                      index === activeStatuses.length - 1 ||
                      pending ||
                      needsRefresh
                    }
                    onClick={() => moveStatus(index, 1)}
                    className={actionClass}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#567269]">
            Inactive
          </h3>
          {inactiveStatuses.length === 0 ? (
            <p className="mt-2 text-sm text-[#6c8476]">No inactive statuses.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {inactiveStatuses.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-[#dce8e0] p-3"
                >
                  <p className="font-semibold">{row.name}</p>
                  <p className="font-mono text-xs text-[#567269]">{row.code}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() => {
                        setError("");
                        setEditor({ kind: "status", row });
                      }}
                      className={actionClass}
                    >
                      Edit {row.name}
                    </button>
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() =>
                        void mutate("PATCH", `/statuses/${row.id}`, {
                          active: true,
                        })
                      }
                      className={actionClass}
                    >
                      Reactivate {row.name}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="locations-heading"
          className="mt-5 rounded-3xl border border-[#dce8e0] bg-white p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="locations-heading" className="text-xl font-semibold">
              Locations
            </h2>
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditor({ kind: "location" });
              }}
              disabled={pending || needsRefresh}
              className={primaryClass}
            >
              Add location
            </button>
          </div>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#567269]">
            Active
          </h3>
          {activeLocations.length === 0 ? (
            <p className="mt-2 text-sm text-[#6c8476]">
              No active locations. Events can still use a custom location.
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {activeLocations.map((row) => (
                <li key={row.id} className="rounded-2xl bg-[#f4f8f3] p-3">
                  <p className="font-semibold">{row.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() => {
                        setError("");
                        setEditor({ kind: "location", row });
                      }}
                      className={actionClass}
                    >
                      Edit {row.name}
                    </button>
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() =>
                        void mutate("PATCH", `/locations/${row.id}`, {
                          active: false,
                        })
                      }
                      className={actionClass}
                    >
                      Deactivate {row.name}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[#567269]">
            Inactive
          </h3>
          {inactiveLocations.length === 0 ? (
            <p className="mt-2 text-sm text-[#6c8476]">
              No inactive locations.
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {inactiveLocations.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-[#dce8e0] p-3"
                >
                  <p className="font-semibold">{row.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() => {
                        setError("");
                        setEditor({ kind: "location", row });
                      }}
                      className={actionClass}
                    >
                      Edit {row.name}
                    </button>
                    <button
                      type="button"
                      disabled={pending || needsRefresh}
                      onClick={() =>
                        void mutate("PATCH", `/locations/${row.id}`, {
                          active: true,
                        })
                      }
                      className={actionClass}
                    >
                      Reactivate {row.name}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {editor && (
        <MasterEditor
          key={`${editor.kind}:${editor.row?.id ?? "new"}`}
          editor={editor}
          pending={pending}
          error={error}
          onClose={() => setEditor(null)}
          onSave={(payload) =>
            mutate(
              editor.row ? "PATCH" : "POST",
              editor.kind === "status"
                ? `/statuses${editor.row ? `/${editor.row.id}` : ""}`
                : `/locations${editor.row ? `/${editor.row.id}` : ""}`,
              payload,
            )
          }
        />
      )}
    </main>
  );
}
