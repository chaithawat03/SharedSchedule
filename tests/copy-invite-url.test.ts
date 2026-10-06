import { describe, expect, it, vi } from "vitest";
import { copyInviteUrl } from "../components/rooms/copy-invite-url";

function field() {
  return {
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  };
}

describe("copy invite URL", () => {
  it("uses the Clipboard API when available", async () => {
    const input = field();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const legacyCopy = vi.fn();
    expect(
      await copyInviteUrl(
        "https://example.test/invite/abc",
        input,
        { writeText },
        legacyCopy,
      ),
    ).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.test/invite/abc");
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it("selects the readonly field and copies with the legacy API when Clipboard API is unavailable", async () => {
    const input = field();
    const legacyCopy = vi.fn().mockReturnValue(true);
    expect(
      await copyInviteUrl(
        "https://example.test/invite/abc",
        input,
        undefined,
        legacyCopy,
      ),
    ).toBe("copied");
    expect(input.focus).toHaveBeenCalled();
    expect(input.select).toHaveBeenCalled();
    expect(input.setSelectionRange).toHaveBeenCalledWith(0, 31);
    expect(legacyCopy).toHaveBeenCalled();
  });

  it("leaves the field selected for manual copy if both APIs fail", async () => {
    const input = field();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    expect(await copyInviteUrl("url", input, { writeText }, () => false)).toBe(
      "selected",
    );
    expect(input.select).toHaveBeenCalled();
    expect(await copyInviteUrl("url", null, undefined, undefined)).toBe(
      "failed",
    );
  });
});
