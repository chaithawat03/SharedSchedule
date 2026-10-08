import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoomListView } from "../components/rooms/RoomListView";
import { RoomDetailView } from "../components/rooms/RoomDetailView";
import { InviteView } from "../components/rooms/InviteView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => undefined,
    push: () => undefined,
    replace: () => undefined,
  }),
}));

const room = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Together",
  description: null,
  ownerUserId: "owner",
  status: "ACTIVE",
};

describe("room screens", () => {
  it("shows creation and a useful empty state for a user without rooms", () => {
    const html = renderToStaticMarkup(
      <RoomListView rooms={[]} displayName="Smart" />,
    );
    expect(html).toContain("Create a room");
    expect(html).toContain("No rooms yet");
    expect(html).toContain('href="/work-calendar"');
  });

  it("links to notifications with the current unread count", () => {
    const html = renderToStaticMarkup(
      <RoomListView rooms={[]} displayName="Smart" unreadCount={3} />,
    );
    expect(html).toContain('href="/notifications"');
    expect(html).toContain("3 unread");
  });

  it("shows each room with its participant count", () => {
    const html = renderToStaticMarkup(
      <RoomListView
        rooms={[{ ...room, participantCount: 2, isOwner: true }]}
        displayName="Smart"
      />,
    );
    expect(html).toContain("Together");
    expect(html).toContain("2 participants");
    expect(html).toContain(`/room/${room.id}`);
  });

  it("keeps invite creation owner-only in the room screen", () => {
    const detail = {
      ...room,
      participants: [
        {
          userId: "member",
          displayName: "Partner",
          role: "MEMBER",
          status: "ACTIVE",
        },
      ],
    };
    expect(
      renderToStaticMarkup(<RoomDetailView room={detail} isOwner />),
    ).toContain("Create invite");
    const memberHtml = renderToStaticMarkup(
      <RoomDetailView room={detail} isOwner={false} />,
    );
    expect(memberHtml).toContain("Partner");
    expect(memberHtml).not.toContain("Create invite");
    expect(memberHtml).not.toContain("Join as Participant");
    expect(memberHtml).toContain('aria-label="App navigation"');
    expect(memberHtml).toContain('href="/work-calendar"');
    expect(memberHtml).toContain('href="/notifications"');
    expect(memberHtml).not.toContain(`/room/${room.id}/settings`);
  });

  it("offers explicit participation only to an owner who is not yet a participant", () => {
    const detail = { ...room, participants: [] };
    const ownerHtml = renderToStaticMarkup(
      <RoomDetailView room={detail} isOwner />,
    );
    expect(ownerHtml).toContain("Join as Participant");
    expect(ownerHtml).toContain("No participants yet");
    const joinedHtml = renderToStaticMarkup(
      <RoomDetailView
        room={{
          ...detail,
          participants: [
            {
              userId: room.ownerUserId,
              displayName: "Smart",
              role: "MEMBER",
              status: "ACTIVE",
            },
          ],
        }}
        isOwner
      />,
    );
    expect(joinedHtml).not.toContain("Join as Participant");
  });

  it("shows phone identity for a signed-out invite and joins immediately after identity", () => {
    const state = {
      kind: "valid" as const,
      roomId: room.id,
      roomName: room.name,
      expiresAt: null,
      usesRemaining: null,
    };
    const signedOut = renderToStaticMarkup(
      <InviteView token="token" state={state} user={null} />,
    );
    expect(signedOut).toContain("Together");
    expect(signedOut).toContain('type="tel"');
    const signedIn = renderToStaticMarkup(
      <InviteView
        token="token"
        state={state}
        user={{
          id: "member",
          displayName: "Partner",
          phoneDisplay: "0899999999",
        }}
      />,
    );
    expect(signedIn).toContain("Joining Together");
    expect(signedIn).not.toContain('type="tel"');
  });

  it("lets an existing participant sign in through an exhausted link", () => {
    const html = renderToStaticMarkup(
      <InviteView token="token" state={{ kind: "exhausted" }} user={null} />,
    );
    expect(html).toContain("usage limit");
    expect(html).toContain('type="tel"');
  });
});
