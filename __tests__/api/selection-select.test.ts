/** @jest-environment node */

var mockUpdate: jest.Mock;

jest.mock("@prisma/client", () => {
  mockUpdate = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      story: {
        update: (...args: unknown[]) => mockUpdate(...args),
      },
    })),
  };
});

import { POST } from "@/app/api/selection/select/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/selection/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/selection/select", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it("marks the story selected and sets selectedAt", async () => {
    const updated = {
      id: "1",
      selectedForPipeline: true,
      selectedAt: "2026-09-26T00:00:00.000Z",
    };
    mockUpdate.mockResolvedValue(updated);

    const res = await POST(makeRequest({ storyId: "1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.story).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "1" },
        data: expect.objectContaining({ selectedForPipeline: true }),
      })
    );
  });

  it("rejects a request with no storyId", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe(true);
    expect(data.error_type).toBe("invalid_request");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns an honest error when the DB write fails", async () => {
    mockUpdate.mockRejectedValue(new Error("row not found"));

    const res = await POST(makeRequest({ storyId: "does-not-exist" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe(true);
    expect(data.error_type).toBe("db_write_failed");
    expect(data.message).toContain("row not found");
  });
});
