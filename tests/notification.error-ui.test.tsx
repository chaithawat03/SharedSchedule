// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationsError from "../app/notifications/error";

afterEach(cleanup);

describe("Notifications error boundary", () => {
  it("calls the App Router reset callback when Retry is clicked", () => {
    const reset = vi.fn();
    render(<NotificationsError reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
