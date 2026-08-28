import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "./context";
import {
  contextPreferenceCookie,
  listPublicContexts,
  readContextPreference,
} from "./context.server";

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

describe("public context rollout compatibility", () => {
  it("keeps legacy navigation available when the compatibility columns are absent", async () => {
    function query(result: { data: unknown[]; error: unknown }) {
      const builder = {
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        order: vi.fn(() => builder),
        select: vi.fn(() => builder),
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable.
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    }

    const competitionQueries = [
      query({ data: [], error: { code: "42703" } }),
      query({
        data: [
          {
            id: 42,
            display_name: "Liga 2026",
            year: 2026,
            status: "published",
            series_id: 7,
            category_id: 9,
          },
        ],
        error: null,
      }),
    ];
    const client = {
      from: vi.fn((table: string) => {
        if (table === "competitions") return competitionQueries.shift();
        if (table === "competition_series") {
          return query({
            data: [{ id: 7, name: "Liga", slug: "liga", is_active: true }],
            error: null,
          });
        }
        if (table === "categories") {
          return query({
            data: [
              {
                id: 9,
                name: "Sub-15",
                slug: "sub-15",
                has_advanced_stats: true,
                is_active: true,
              },
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(listPublicContexts(client)).resolves.toEqual([context]);
  });
});
