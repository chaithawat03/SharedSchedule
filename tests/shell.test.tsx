import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "../app/page";

describe("foundation shell", () => {
  it("presents a usable landing landmark and names the product", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("<main");
    expect(html).toContain("SharedSchedule");
    expect(html).toContain("<h1");
  });
});
