import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

// MCP tool names are the identity a client dispatches on, so the catalogue must
// not advertise the same name twice. lidarr_get_quality_profiles and
// lidarr_get_root_folders were pushed both by addConfigTools() and by the
// Lidarr-specific block, so any server with Lidarr configured returned each of
// them twice from tools/list.
async function listTools(env) {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "ignore"],
  });

  const pending = new Map();
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {
        // Not a JSON-RPC line; ignore.
      }
    }
  });

  let id = 0;
  const send = (method, params) =>
    new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
    });

  try {
    await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const listed = await send("tools/list", {});
    return listed.result.tools.map((t) => t.name);
  } finally {
    child.kill();
  }
}

// No network happens here: listing tools only reads configuration.
const ALL_SERVICES = {
  SONARR_URL: "http://sonarr.invalid", SONARR_API_KEY: "x",
  RADARR_URL: "http://radarr.invalid", RADARR_API_KEY: "x",
  LIDARR_URL: "http://lidarr.invalid", LIDARR_API_KEY: "x",
  PROWLARR_URL: "http://prowlarr.invalid", PROWLARR_API_KEY: "x",
};

test("no tool name is advertised twice with every service configured", async () => {
  const names = await listTools(ALL_SERVICES);
  const seen = new Set();
  const duplicates = [];
  for (const n of names) {
    if (seen.has(n)) duplicates.push(n);
    seen.add(n);
  }
  assert.deepEqual(duplicates, [], `duplicate tool names advertised: ${duplicates.join(", ")}`);
});

test("configuring Lidarr does not duplicate its shared config tools", async () => {
  const names = await listTools({
    LIDARR_URL: "http://lidarr.invalid",
    LIDARR_API_KEY: "x",
  });
  for (const tool of ["lidarr_get_quality_profiles", "lidarr_get_root_folders"]) {
    assert.equal(
      names.filter((n) => n === tool).length,
      1,
      `${tool} should be advertised exactly once`,
    );
  }
});
