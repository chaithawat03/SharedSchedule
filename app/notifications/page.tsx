import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationsView } from "../../components/notifications/NotificationsView";
import { getNotificationRepository } from "../../lib/notifications/repository";
import { SESSION_COOKIE_NAME } from "../../lib/session/cookie";
import { getSessionRepository } from "../../lib/session/repository";
import { listNotifications } from "../../services/notification.service";
import { resolveSession } from "../../services/session.service";

export default async function NotificationsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const user = await resolveSession(token, getSessionRepository());
  if (!user) redirect("/");
  const feed = await listNotifications(
    user.id,
    null,
    null,
    getNotificationRepository(),
  );
  return (
    <NotificationsView
      initialFeed={{
        ...feed,
        notifications: feed.notifications.map((item) => ({
          ...item,
          readAt: item.readAt?.toISOString() ?? null,
        })),
      }}
    />
  );
}
