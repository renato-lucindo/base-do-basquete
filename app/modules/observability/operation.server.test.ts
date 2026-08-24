import { describe, expect, it, vi } from "vitest";

import {
  classifyRequestOperation,
  logOperationalEvent,
  outcomeFromStatus,
} from "./operation.server";

describe("operational observability", () => {
  it("classifies sensitive routes without logging raw paths or query strings", () => {
    expect(
      classifyRequestOperation(
        new Request("https://example.test/admin/competitions/20/boxscores/import?import=secret"),
      ),
    ).toBe("boxscore");
    expect(
      classifyRequestOperation(
        new Request("https://example.test/admin/competitions/20/scoresheets/new"),
      ),
    ).toBe("scoresheet");
    expect(
      classifyRequestOperation(new Request("https://example.test/admin/competitions/20")),
    ).toBe("admin.competition");
  });

  it("maps HTTP results to success, blocked and failure", () => {
    expect(outcomeFromStatus(302)).toBe("success");
    expect(outcomeFromStatus(403)).toBe("blocked");
    expect(outcomeFromStatus(503)).toBe("failure");
  });

  it("emits only allowlisted operational metadata", () => {
    const sink = vi.fn();
    logOperationalEvent(
      {
        correlationId: "00000000-0000-4000-8000-000000000001",
        durationMs: 12.6,
        method: "post",
        operation: "boxscore.upload",
        outcome: "failure",
        status: 502,
        context: {
          competitionId: 20,
          entityId: -1,
          errorCode: "mensagem livre com dado sensível",
        },
      },
      sink,
    );

    const event = JSON.parse(sink.mock.calls[0]?.[0] as string);
    expect(event).toEqual({
      event: "bdb.operation",
      correlationId: "00000000-0000-4000-8000-000000000001",
      operation: "boxscore.upload",
      outcome: "failure",
      durationMs: 13,
      method: "POST",
      status: 502,
      competitionId: 20,
    });
  });
});
