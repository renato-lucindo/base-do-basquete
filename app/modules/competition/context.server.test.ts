import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "./context";
import { contextPreferenceCookie, readContextPreference } from "./context.server";

const context: CompetitionContext = {
  competitionId: 42,
  dataProfile: null,
  displayName: "Liga 2026",
  genderDivision: null,
  statisticsMode: "legacy",
  year: 2026,
  series: { id: 7, name: "Liga", slug: "liga" },
  category: {
    id: 9,
    name: "Sub-15",
    slug: "sub-15",
    hasAdvancedStats: true,
  },
};

describe("context preference cookie", () => {
  it("round-trips only the validated navigation reference", () => {
    const setCookie = contextPreferenceCookie(context);
    const cookie = setCookie.split(";")[0];
    if (!cookie) {
      throw new Error("Context cookie was not generated");
    }
    const request = new Request("https://example.test/", {
      headers: { Cookie: cookie },
    });

    expect(readContextPreference(request)).toEqual({
      version: 2,
      genderDivision: null,
      year: 2026,
      seriesSlug: "liga",
      categorySlug: "sub-15",
    });
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).not.toContain("42");
  });

  it("ignores missing, corrupt and unknown-version cookies", () => {
    expect(readContextPreference(new Request("https://example.test/"))).toBeNull();
    expect(
      readContextPreference(
        new Request("https://example.test/", {
          headers: { Cookie: "__Host-bdb-context=%7Bbroken" },
        }),
      ),
    ).toBeNull();
  });
});
