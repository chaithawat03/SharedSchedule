import { describe, expect, it } from "vitest";
import { defaultStatusRows } from "../lib/rooms/default-statuses";

describe("room defaults", () => {
  it("provides the nine ordered room-scoped statuses used for event creation", () => {
    const roomId = "20000000-0000-4000-8000-000000000001";
    expect(defaultStatusRows(roomId)).toEqual([
      { roomId, code: "WORK", name: "WORK", sortOrder: 0 },
      { roomId, code: "OT", name: "OT", sortOrder: 1 },
      { roomId, code: "OFF", name: "OFF", sortOrder: 2 },
      { roomId, code: "LEAVE", name: "LEAVE", sortOrder: 3 },
      { roomId, code: "WFH", name: "WFH", sortOrder: 4 },
      { roomId, code: "TRAVEL", name: "TRAVEL", sortOrder: 5 },
      { roomId, code: "PERSONAL", name: "PERSONAL", sortOrder: 6 },
      { roomId, code: "ACTIVITY", name: "ACTIVITY", sortOrder: 7 },
      { roomId, code: "OTHER", name: "OTHER", sortOrder: 8 },
    ]);
  });
});
