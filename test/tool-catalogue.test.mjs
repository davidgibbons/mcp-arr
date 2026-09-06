import assert from "node:assert/strict";
import test from "node:test";

import { ALL_SERVICES, listTools } from "./helpers/mcp-client.mjs";

// MCP tool names are the identity a client dispatches on, so the catalogue must
// not advertise the same name twice. lidarr_get_quality_profiles and
// lidarr_get_root_folders were pushed both by addConfigTools() and by the
// Lidarr-specific block, so any server with Lidarr configured returned each of
// them twice from tools/list.

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

test("every configured service gets the shared config set exactly once", async () => {
  const names = await listTools(ALL_SERVICES);
  for (const service of ["sonarr", "radarr", "lidarr", "whisparr", "chaptarr"]) {
    for (const suffix of ["get_health", "get_tags", "review_setup", "get_remote_path_mappings"]) {
      assert.equal(
        names.filter((n) => n === `${service}_${suffix}`).length,
        1,
        `${service}_${suffix} should be advertised exactly once`,
      );
    }
  }
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
