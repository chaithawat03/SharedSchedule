import Link from "next/link";

export function AppNavigation({
  current,
  roomId,
  isOwner = false,
}: {
  current: "rooms" | "room" | "settings" | "work" | "notifications";
  roomId?: string;
  isOwner?: boolean;
}) {
  const links = [
    { href: "/rooms", label: "Rooms", key: "rooms" },
    { href: "/work-calendar", label: "Work Calendar", key: "work" },
    { href: "/notifications", label: "Notifications", key: "notifications" },
    ...(roomId
      ? [{ href: `/room/${roomId}`, label: "Room", key: "room" }]
      : []),
    ...(roomId && isOwner
      ? [
          {
            href: `/room/${roomId}/settings`,
            label: "Settings",
            key: "settings",
          },
        ]
      : []),
  ];
  return (
    <nav aria-label="App navigation" className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={current === link.key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287466] ${current === link.key ? "bg-[#205545] text-white" : "border border-[#bfd4c6] bg-white text-[#205545]"}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
