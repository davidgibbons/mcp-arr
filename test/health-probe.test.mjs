import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

// /health used to report which URL + API key pairs were supplied and nothing
// more, so its output was identical whether every key worked or every key was
// garbage. These tests pin the difference.

// A stand-in *arr. `behaviour` decides what the probe meets:
//   "ok"      - 200 with a plausible /system/status body
//   "401"     - rejects the key, the way a real *arr does
//   "silent"  - accepts the connection and never answers, which is the case
//               Node's fetch has no default timeout for
function fakeArr(behaviour) {
  const server = createServer((_req, res) => {
    if (behaviour === "silent") return; // never respond
    if (behaviour === "401") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ version: "4.0.0", appName: "Fake" }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function withHealth(env, fn, { settleMs = 1500 } = {}) {
  const port = String(34000 + Math.floor(Math.random() * 1000));
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, MCP_TRANSPORT: "http", HOST: "127.0.0.1", PORT: port, ...env },
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
    // Let the first sweep land; probes are deliberately not awaited at startup.
    await new Promise((r) => setTimeout(r, settleMs));
    return await fn(async () => (await fetch(`http://127.0.0.1:${port}/health`)).json());
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
}

test("a working credential reports ok", async () => {
  const arr = await fakeArr("ok");
  try {
    await withHealth({ SONARR_URL: arr.url, SONARR_API_KEY: "good" }, async (health) => {
      const body = await health();
      assert.equal(body.services.sonarr.status, "ok");
      assert.equal(body.credentialsOk, true);
      assert.ok(body.services.sonarr.lastChecked, "a checked service records when");
    });
  } finally {
    await arr.close();
  }
});

// The distinction the whole feature exists for: a rejected key is not the same
// problem as a dead host, and reporting both as "down" would hide it.
test("a rejected key reports unauthorized, not unreachable", async () => {
  const arr = await fakeArr("401");
  try {
    await withHealth({ SONARR_URL: arr.url, SONARR_API_KEY: "bad" }, async (health) => {
      const body = await health();
      assert.equal(body.services.sonarr.status, "unauthorized");
      assert.equal(body.credentialsOk, false);
    });
  } finally {
    await arr.close();
  }
});

test("an unreachable host reports unreachable", async () => {
  // TEST-NET-1: reserved and unroutable by definition.
  await withHealth(
    { SONARR_URL: "http://192.0.2.1:9999", SONARR_API_KEY: "x", MCP_ARR_HEALTH_INTERVAL: "5" },
    async (health) => {
      const body = await health();
      assert.notEqual(body.services.sonarr.status, "ok");
      assert.notEqual(body.credentialsOk, true);
    },
  );
});

// The failure that matters most: /health must not go green just because the
// process is fine. A readiness probe pointed at it has to be able to tell.
test("a broken credential does not make the server look healthy", async () => {
  const arr = await fakeArr("401");
  try {
    await withHealth({ SONARR_URL: arr.url, SONARR_API_KEY: "bad" }, async (health) => {
      const body = await health();
      assert.equal(body.credentialsOk, false, "credentialsOk is the signal to alert on");
      // ...while the process itself is genuinely fine, so liveness must not flap.
      assert.equal(body.status, "ok", "top-level status reflects the process, not the *arr apps");
    });
  } finally {
    await arr.close();
  }
});

test("configuredServices still lists what was configured", async () => {
  const arr = await fakeArr("ok");
  try {
    await withHealth({ SONARR_URL: arr.url, SONARR_API_KEY: "good" }, async (health) => {
      const body = await health();
      assert.deepEqual(body.configuredServices, ["sonarr"], "existing field must not change shape");
    });
  } finally {
    await arr.close();
  }
});

// A host that completes the handshake and then goes quiet used to hang the probe
// forever. Because the sweep waits on every probe behind one in-flight guard,
// that froze the health of every other service permanently, not just this one.
test("a silent host times out and does not freeze the other services", async () => {
  const silent = await fakeArr("silent");
  const good = await fakeArr("ok");
  try {
    await withHealth(
      {
        SONARR_URL: good.url, SONARR_API_KEY: "good",
        LIDARR_URL: silent.url, LIDARR_API_KEY: "x",
        MCP_ARR_HEALTH_INTERVAL: "5",
      },
      async (health) => {
        const first = await health();
        assert.equal(first.services.sonarr.status, "ok", "a healthy service reports immediately");

        // Wait past the 10s probe timeout for the silent one to resolve.
        await new Promise((r) => setTimeout(r, 12000));
        const later = await health();
        assert.equal(later.services.lidarr.status, "unreachable");
        assert.match(later.services.lidarr.error, /no response within/);
        assert.equal(later.services.sonarr.status, "ok", "the good service kept reporting");
      },
    );
  } finally {
    await silent.close();
    await good.close();
  }
});

test("the probe can be turned off", async () => {
  const arr = await fakeArr("ok");
  try {
    await withHealth(
      { SONARR_URL: arr.url, SONARR_API_KEY: "good", MCP_ARR_HEALTH_INTERVAL: "0" },
      async (health) => {
        const body = await health();
        assert.equal(body.services.sonarr.status, "pending", "nothing should be probed");
        assert.equal(body.services.sonarr.lastChecked, null);
        assert.equal(body.credentialsOk, null, "never checked is not the same as broken");
      },
    );
  } finally {
    await arr.close();
  }
});
