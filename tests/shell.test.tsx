import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IdentityShell } from "../app/identity-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

describe("phone identity shell", () => {
  it("shows a mobile phone form when no session is present", () => {
    const html = renderToStaticMarkup(<IdentityShell user={null} />);
    expect(html).toContain("<main");
    expect(html).toContain("SharedSchedule");
    expect(html).toContain('type="tel"');
    expect(html).toContain("Continue");
    expect(html).not.toContain("Logout");
  });

  it("shows the authenticated placeholder instead of the phone form", () => {
    const html = renderToStaticMarkup(
      <IdentityShell
        user={{
          id: "user-1",
          displayName: "Smart",
          phoneDisplay: "0812345678",
        }}
      />,
    );
    expect(html).toContain("Signed in as Smart");
    expect(html).toContain("Logout");
    expect(html).not.toContain('type="tel"');
  });
});
