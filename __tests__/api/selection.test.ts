/** @jest-environment node */

var mockFindMany: jest.Mock;

jest.mock("@prisma/client", () => {
  mockFindMany = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      story: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    })),
  };
});

import { GET } from "@/app/api/selection/route";

describe("GET /api/selection", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("returns stories with fitScore set, sorted by fitScore desc", async () => {
    const stories = [
      {
        id: "1",
        headline: "Story A",
        summary: "Summary A",
        fitScore: 92,
        verificationTier: "CONFIRMED",
        editorialReason: "major_global_consequence",
        fitRationale: "High confidence, high impact",
        selectedForPipeline: false,
        selectedAt: null,
      },
    ];
    mockFindMany.mockResolvedValue(stories);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stories).toEqual(stories);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fitScore: { not: null } },
        orderBy: { fitScore: "desc" },
      })
    );
  });

  it("returns an honest error when the DB read fails", async () => {
    mockFindMany.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe(true);
    expect(data.error_type).toBe("db_read_failed");
    expect(data.message).toContain("connection refused");
  });
});
