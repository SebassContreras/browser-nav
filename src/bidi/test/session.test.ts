import assert from "node:assert/strict";
import { test } from "node:test";
import { PwaNavError } from "../../core/errors.js";
import { startFakeBidiServer, type FakeBidiServer } from "../fake-server.js";
import { withSession, withTopLevelContext, type HandledSignal, type SignalSource } from "../session.js";

async function withServer(fn: (server: FakeBidiServer) => Promise<void>): Promise<void> {
  const server = await startFakeBidiServer();
  try {
    await fn(server);
  } finally {
    await server.close();
  }
}

class FakeSignals implements SignalSource {
  readonly listeners = new Map<HandledSignal, Set<() => void>>();
  on(signal: HandledSignal, listener: () => void): void {
    const set = this.listeners.get(signal) ?? new Set();
    set.add(listener);
    this.listeners.set(signal, set);
  }
  off(signal: HandledSignal, listener: () => void): void {
    this.listeners.get(signal)?.delete(listener);
  }
  count(): number {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
  emit(signal: HandledSignal): void {
    for (const l of [...(this.listeners.get(signal) ?? [])]) {
      l();
    }
  }
}

test("session ended on success and result returned; signal handlers removed", async () => {
  await withServer(async (server) => {
    const signals = new FakeSignals();
    const result = await withSession(
      server.url,
      () => {
        assert.equal(server.sessionActive, true);
        assert.equal(signals.count(), 2);
        return Promise.resolve(42);
      },
      { signals },
    );
    assert.equal(result, 42);
    assert.equal(server.sessionActive, false);
    assert.equal(signals.count(), 0);
  });
});

test("session ended when fn throws; original error preserved", async () => {
  await withServer(async (server) => {
    const boom = new Error("boom");
    await assert.rejects(
      withSession(server.url, () => Promise.reject(boom), { signals: new FakeSignals() }),
      (e: unknown) => e === boom,
    );
    assert.equal(server.sessionActive, false);
  });
});

test("fn throws AND session.end fails: socket closed, original error rethrown", async () => {
  await withServer(async (server) => {
    const boom = new Error("original");
    await assert.rejects(
      withSession(
        server.url,
        async () => {
          // Kill the connection so session.end cannot succeed.
          server.dropClients();
          await new Promise((r) => setTimeout(r, 50));
          return Promise.reject(boom);
        },
        { signals: new FakeSignals() },
      ),
      (e: unknown) => e === boom,
    );
  });
});

test("session.end failing on the success path surfaces the error", async () => {
  await withServer(async (server) => {
    await assert.rejects(
      withSession(
        server.url,
        async () => {
          server.dropClients();
          await new Promise((r) => setTimeout(r, 50));
          return 1;
        },
        { signals: new FakeSignals() },
      ),
      (e: unknown) => e instanceof PwaNavError && e.code === "protocol",
    );
  });
});

test("session_busy from session.new propagates unchanged", async () => {
  await withServer(async (server) => {
    await withSession(
      server.url,
      async () => {
        await assert.rejects(
          withSession(server.url, () => Promise.resolve(1), { signals: new FakeSignals() }),
          (e: unknown) => e instanceof PwaNavError && e.code === "session_busy" && e.hint !== undefined,
        );
        // The failed attempt must not have ended the first session.
        assert.equal(server.sessionActive, true);
      },
      { signals: new FakeSignals() },
    );
    assert.equal(server.sessionActive, false);
  });
});

test("20 consecutive sessions all succeed", async () => {
  await withServer(async (server) => {
    for (let i = 0; i < 20; i++) {
      const n = await withSession(server.url, () => Promise.resolve(i), { signals: new FakeSignals() });
      assert.equal(n, i);
      assert.equal(server.sessionActive, false);
    }
    assert.equal(server.commands.filter((c) => c.method === "session.new").length, 20);
    assert.equal(server.commands.filter((c) => c.method === "session.end").length, 20);
  });
});

test("signal: ends session, closes, then calls onSignal with exit code", async () => {
  await withServer(async (server) => {
    const signals = new FakeSignals();
    let fired: { signal: HandledSignal; code: number } | undefined;
    let release: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = withSession(
      server.url,
      async () => {
        signals.emit("SIGTERM");
        await done; // never resolves normally: the signal path closes the transport
      },
      {
        signals,
        onSignal: (signal, code) => {
          fired = { signal, code };
          release();
        },
      },
    );
    await run;
    assert.deepEqual(fired, { signal: "SIGTERM", code: 143 });
    assert.equal(server.sessionActive, false);
    assert.equal(signals.count(), 0);
  });
});

test("SIGINT maps to exit code 130", async () => {
  await withServer(async (server) => {
    const signals = new FakeSignals();
    let code = 0;
    await withSession(
      server.url,
      async () => {
        signals.emit("SIGINT");
        await new Promise((r) => setTimeout(r, 200));
      },
      {
        signals,
        onSignal: (_s, c) => {
          code = c;
        },
      },
    ).catch(() => undefined);
    assert.equal(code, 130);
    assert.equal(server.sessionActive, false);
  });
});

function ctx(id: string, url = "https://a/"): { context: string; url: string; userContext: string } {
  return { context: id, url, userContext: "default" };
}

test("withTopLevelContext: single context is passed to fn", async () => {
  await withServer(async (server) => {
    server.handle("browsingContext.getTree", () => ({ contexts: [ctx("c1")] }));
    const got = await withTopLevelContext(server.url, (_c, id) => Promise.resolve(id), { signals: new FakeSignals() });
    assert.equal(got, "c1");
    assert.equal(server.sessionActive, false);
  });
});

test("withTopLevelContext: zero contexts => no_browser with hint", async () => {
  await withServer(async (server) => {
    server.handle("browsingContext.getTree", () => ({ contexts: [] }));
    await assert.rejects(
      withTopLevelContext(server.url, () => Promise.resolve(1), { signals: new FakeSignals() }),
      (e: unknown) => e instanceof PwaNavError && e.code === "no_browser" && /PWA window open/.test(e.hint ?? ""),
    );
    assert.equal(server.sessionActive, false);
  });
});

test("withTopLevelContext: table-driven context auto-selection partitions (036/T001)", async () => {
  const cases = [
    {
      description: "single context is passed through unconditionally even if internal",
      contexts: [ctx("c-internal", "about:blank")],
      contextId: undefined,
      expectedResult: "c-internal",
    },
    {
      description: "auto-selects single HTTP context when other tab is about:blank",
      contexts: [ctx("c-http", "http://example.com"), ctx("c-blank", "about:blank")],
      contextId: undefined,
      expectedResult: "c-http",
    },
    {
      description: "auto-selects single HTTPS context when other tabs are about:blank, about:home, about:welcome",
      contexts: [
        ctx("c-welcome", "about:welcome"),
        ctx("c-app", "https://app.example.com/feed"),
        ctx("c-home", "about:home"),
      ],
      contextId: undefined,
      expectedResult: "c-app",
    },
    {
      description: "explicit contextId bypasses content auto-selection and targets requested internal tab",
      contexts: [ctx("c-app", "https://app.example.com"), ctx("c-blank", "about:blank")],
      contextId: "c-blank",
      expectedResult: "c-blank",
    },
  ];

  await withServer(async (server) => {
    for (const tc of cases) {
      server.handle("browsingContext.getTree", () => ({ contexts: tc.contexts }));
      const got = await withTopLevelContext(
        server.url,
        (_c, id) => Promise.resolve(id),
        { signals: new FakeSignals(), contextId: tc.contextId },
      );
      assert.equal(got, tc.expectedResult, `Failed case: ${tc.description}`);
    }
  });
});

test("withTopLevelContext: table-driven error partitions and hint formatting (036/T002)", async () => {
  const errorCases = [
    {
      description: "multiple content contexts without contextId throws invalid_args listing IDs and URLs",
      contexts: [ctx("c1", "https://site-a.com"), ctx("c2", "https://site-b.com")],
      contextId: undefined,
      expectHintMatch: /Pass contextId in MCP or --context <id> in CLI\. Available: c1 \(https:\/\/site-a\.com\), c2 \(https:\/\/site-b\.com\)/,
    },
    {
      description: "multiple internal contexts with zero content contexts throws invalid_args",
      contexts: [ctx("c-b1", "about:blank"), ctx("c-b2", "about:home")],
      contextId: undefined,
      expectHintMatch: /Pass contextId in MCP or --context <id> in CLI\. Available: c-b1 \(about:blank\), c-b2 \(about:home\)/,
    },
    {
      description: "unknown explicit contextId throws invalid_args with context IDs and URLs",
      contexts: [ctx("c1", "https://site-a.com"), ctx("c2", "about:blank")],
      contextId: "unknown-id",
      expectHintMatch: /Available: c1 \(https:\/\/site-a\.com\), c2 \(about:blank\)/,
    },
    {
      description: "context with empty URL falls back to 'blank' in hint",
      contexts: [ctx("c1", "https://site-a.com"), ctx("c2", "")],
      contextId: "missing-id",
      expectHintMatch: /c2 \(blank\)/,
    },
  ];

  await withServer(async (server) => {
    for (const tc of errorCases) {
      server.handle("browsingContext.getTree", () => ({ contexts: tc.contexts }));
      await assert.rejects(
        withTopLevelContext(
          server.url,
          () => Promise.resolve(1),
          { signals: new FakeSignals(), contextId: tc.contextId },
        ),
        (e: unknown) => {
          assert(e instanceof PwaNavError, `Expected PwaNavError for ${tc.description}`);
          assert.equal(e.code, "invalid_args", `Expected invalid_args for ${tc.description}`);
          assert(tc.expectHintMatch.test(e.hint ?? ""), `Hint "${e.hint ?? ""}" did not match for ${tc.description}`);
          return true;
        },
      );
    }
  });
});
