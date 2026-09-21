import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

// The HTTP transport routes anything reaching MCP_PATH straight into a server
// unless a token is configured. These tests pin both halves: that the default
// is unchanged, and that a configured token is actually enforced.

const FULL = "full-token-aaaaaaaaaaaaaaaaaaaa";
const READONLY = "readonly-token-bbbbbbbbbbbbbbbb";

async function withServer(env, fn) {
  const port = String(35000 + Math.floor(Math.random() * 1000));
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      HOST: "127.0.0.1",
      PORT: port,
      // A configured service, so the mutating tools exist to be gated.
      SONARR_URL: "http://sonarr.invalid",
      SONARR_API_KEY: "x",
      MCP_ARR_HEALTH_INTERVAL: "0",
      ...env,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  try {
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (r.ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error("server did not start");
      await new Promise((r) => setTimeout(r, 100));
    }
    const mcp = (payload, token) =>
      fetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    const health = () => fetch(`http://127.0.0.1:${port}/health`);
    return await fn({ mcp, health, port });
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
}

const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

async function toolNames(response) {
  const text = await response.text();
  const payload = JSON.parse(text.replace(/^event: message\ndata: /, ""));
  return payload.result.tools.map((t) => t.name);
}

test("no token configured leaves the endpoint open, as before", async () => {
  await withServer({}, async ({ mcp, health }) => {
    assert.equal((await mcp(listTools)).status, 200, "default behaviour must not change");
    assert.equal((await health()).status, 200);
    assert.equal((await (await health()).json()).authRequired, false);
  });
});

test("with a token configured, an unauthenticated request is refused", async () => {
  await withServer({ MCP_ARR_AUTH_TOKEN: FULL }, async ({ mcp }) => {
    const response = await mcp(listTools);
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get("www-authenticate") ?? "",
      /^Bearer/,
      "a 401 has to tell the client how to authenticate",
    );
  });
});

test("a wrong token is refused", async () => {
  await withServer({ MCP_ARR_AUTH_TOKEN: FULL }, async ({ mcp }) => {
    assert.equal((await mcp(listTools, "not-the-token")).status, 401);
    // A near-miss must not be treated as a match.
    assert.equal((await mcp(listTools, FULL.slice(0, -1))).status, 401);
    assert.equal((await mcp(listTools, `${FULL}x`)).status, 401);
  });
});

test("the right token is accepted", async () => {
  await withServer({ MCP_ARR_AUTH_TOKEN: FULL }, async ({ mcp }) => {
    const response = await mcp(listTools, FULL);
    assert.equal(response.status, 200);
    assert.ok((await toolNames(response)).includes("sonarr_add_series"));
  });
});

// /health has to stay reachable or container probes fail the moment auth is on.
test("health stays unauthenticated and reports that auth is on", async () => {
  await withServer({ MCP_ARR_AUTH_TOKEN: FULL }, async ({ health }) => {
    const response = await health();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.authRequired, true);
    assert.equal(
      JSON.stringify(body).includes(FULL),
      false,
      "health must never echo the token back",
    );
  });
});

// The point of the second token: a reader and a writer against one server.
test("the read-only token gets the reads and not the writes", async () => {
  await withServer(
    { MCP_ARR_AUTH_TOKEN: FULL, MCP_ARR_AUTH_TOKEN_READONLY: READONLY },
    async ({ mcp }) => {
      const readerTools = await toolNames(await mcp(listTools, READONLY));
      assert.ok(readerTools.includes("sonarr_get_series"), "reads stay available");
      assert.ok(!readerTools.includes("sonarr_add_series"), "writes are gone");

      const writerTools = await toolNames(await mcp(listTools, FULL));
      assert.ok(writerTools.includes("sonarr_add_series"), "the full token still writes");

      // Enforcement, not just filtering: the reader must not be able to call a
      // write tool by name even though it was never listed for them.
      const call = await mcp(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "sonarr_add_series", arguments: {} } },
        READONLY,
      );
      const text = await call.text();
      assert.match(text, /this credential has read-only access/, "the refusal must name the credential, not a server setting");
    },
  );
});

// MCP_ARR_ACCESS is a ceiling, not a starting point: a server running read-only
// must not hand out writes to whoever holds the full token.
test("the full token cannot escalate past a read-only server", async () => {
  await withServer(
    { MCP_ARR_AUTH_TOKEN: FULL, MCP_ARR_ACCESS: "read-only" },
    async ({ mcp }) => {
      const names = await toolNames(await mcp(listTools, FULL));
      assert.ok(!names.includes("sonarr_add_series"), "read-only must cap every credential");
    },
  );
});

test("configuring only a read-only token still requires it", async () => {
  await withServer({ MCP_ARR_AUTH_TOKEN_READONLY: READONLY }, async ({ mcp }) => {
    assert.equal((await mcp(listTools)).status, 401, "auth is on once either token is set");
    assert.equal((await mcp(listTools, READONLY)).status, 200);
  });
});
