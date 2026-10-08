// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "../components/ui/RouteError";

afterEach(cleanup);

describe("route recovery", () => {
  it("uses the error boundary reset action without exposing server errors", () => {
    const reset = vi.fn();
    render(<RouteError title="Room unavailable" reset={reset} />);
    expect(screen.getByRole("alert").textContent).toContain("Please try again");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
