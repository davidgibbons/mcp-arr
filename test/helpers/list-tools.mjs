import { spawn } from "node:child_process";

// Drives a real server over stdio and returns what it advertises from
// tools/list. Shared by the catalogue and annotation tests so both exercise the
// same path a client takes, rather than reaching into the module internals.
export async function listToolObjects(env) {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("../..", import.meta.url),
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
    return listed.result.tools;
  } finally {
    child.kill();
  }
}

export async function listTools(env) {
  return (await listToolObjects(env)).map((t) => t.name);
}

// No network happens here: listing tools only reads configuration.
export const ALL_SERVICES = {
  SONARR_URL: "http://sonarr.invalid", SONARR_API_KEY: "x",
  RADARR_URL: "http://radarr.invalid", RADARR_API_KEY: "x",
  LIDARR_URL: "http://lidarr.invalid", LIDARR_API_KEY: "x",
  PROWLARR_URL: "http://prowlarr.invalid", PROWLARR_API_KEY: "x",
  WHISPARR_URL: "http://whisparr.invalid", WHISPARR_API_KEY: "x",
  CHAPTARR_URL: "http://chaptarr.invalid", CHAPTARR_API_KEY: "x",
};

// ALL_SERVICES plus Jellyseerr and Bazarr, so the whole catalogue is advertised.
// Both of those contribute mutating tools — jellyseerr_approve_request and
// friends — so a classification test that used ALL_SERVICES would never see them.
export const EVERY_SERVICE = {
  ...ALL_SERVICES,
  JELLYSEERR_URL: "http://jellyseerr.invalid", JELLYSEERR_API_KEY: "x",
  BAZARR_URL: "http://bazarr.invalid", BAZARR_API_KEY: "x",
};
