"use client";

import Link from "next/link";
import { useState } from "react";
import { AppNavigation } from "../navigation/AppNavigation";

export type DisplayNotification = {
  id: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  eventId: string | null;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  roomName: string;
  actorDisplayName: string | null;
};

export type DisplayFeed = {
  notifications: DisplayNotification[];
  unreadCount: number;
  nextCursor: string | null;
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationsView({
  initialFeed,
}: {
  initialFeed: DisplayFeed;
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [busy, setBusy] = useState<"refresh" | "more" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null) {
    setBusy(cursor ? "more" : "refresh");
    setError(null);
    try {
      const query = new URLSearchParams({ limit: "20" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/me/notifications?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load notifications");
      const result = (await response.json()) as DisplayFeed;
      setFeed((current) =>
        cursor
          ? {
              notifications: [
                ...current.notifications,
                ...result.notifications,
              ],
              unreadCount: result.unreadCount,
              nextCursor: result.nextCursor,
            }
          : result,
      );
    } catch {
      setError(
        cursor
          ? "Unable to load more notifications. Try again."
          : "Unable to refresh notifications. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function markRead(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/me/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Unable to mark notification read");
      const result = (await response.json()) as {
        notification: { id: string; readAt: string };
      };
      setFeed((current) => {
        const wasUnread = current.notifications.some(
          (item) => item.id === id && item.readAt === null,
        );
        return {
          ...current,
          notifications: current.notifications.map((item) =>
            item.id === id
              ? { ...item, readAt: result.notification.readAt }
              : item,
          ),
          unreadCount: Math.max(0, current.unreadCount - (wasUnread ? 1 : 0)),
        };
      });
    } catch {
      setError("Unable to mark the notification as read. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f6f8f5] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#18332f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <Link
            href="/rooms"
            className="flex min-h-11 items-center text-sm font-semibold text-[#397c61]"
          >
            ← My Rooms
          </Link>
          <button
            type="button"
            onClick={() => load(null)}
            disabled={busy !== null}
            className="min-h-11 rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545] disabled:opacity-60"
          >
            {busy === "refresh" ? "Refreshing…" : "Refresh"}
          </button>
        </header>
        <AppNavigation current="notifications" />
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.05em]">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-[#56716a]" aria-live="polite">
          {feed.unreadCount} unread
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#e7c5bc] bg-[#fff5f1] p-4 text-sm text-[#8b3d2d]"
          >
            {error}
          </p>
        )}
        <section
          className="mt-7"
          aria-label="Notifications"
          aria-busy={busy === "refresh" || busy === "more"}
        >
          {feed.notifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#cbded2] bg-white p-6">
              <h2 className="text-lg font-semibold">No notifications yet</h2>
              <p className="mt-2 text-sm leading-6 text-[#6c8476]">
                Room activity will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {feed.notifications.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-[#dce8e0] bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="break-words font-semibold">
                      {item.roomName}
                    </span>
                    <time
                      className="text-xs text-[#6c8476]"
                      dateTime={item.createdAt}
                    >
                      {timeLabel(item.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#56716a]">
                    {item.actorDisplayName ?? "A room member"}
                  </p>
                  <p className="mt-2 text-sm leading-6">{item.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/room/${item.roomId}`}
                      className="flex min-h-11 items-center font-semibold text-[#397c61]"
                    >
                      Open room
                    </Link>
                    {item.readAt === null ? (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        disabled={busy !== null}
                        className="min-h-11 rounded-xl border border-[#bfd4c6] px-4 text-sm font-semibold text-[#205545] disabled:opacity-60"
                      >
                        {busy === item.id ? "Saving…" : "Mark as read"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#6c8476]">Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {feed.nextCursor && (
            <button
              type="button"
              onClick={() => load(feed.nextCursor)}
              disabled={busy !== null}
              className="mt-5 min-h-11 w-full rounded-xl border border-[#bfd4c6] bg-white px-4 font-semibold text-[#205545] disabled:opacity-60"
            >
              {busy === "more" ? "Loading…" : "Load more"}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
