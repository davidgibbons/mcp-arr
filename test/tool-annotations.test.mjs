import assert from "node:assert/strict";
import test from "node:test";

import { EVERY_SERVICE, listToolObjects } from "./helpers/mcp-client.mjs";

// The mutation classification in src/index.ts is the single source of truth for
// both the MCP annotations and the read-only access gate that will consume them.
// These tests exist to stop it drifting from the catalogue it describes.

// Every tool that changes state, mirrored from src/index.ts. Duplicated here on
// purpose: if the two ever disagree, that is exactly the bug worth failing on.
const EXPECTED_MUTATING = [
  // Add library rows
  "sonarr_add_series",
  "radarr_add_movie",
  "lidarr_add_artist",
  "whisparr_add_item",
  "chaptarr_add_author",
  // Trigger download searches
  "sonarr_search_missing",
  "sonarr_search_episode",
  "radarr_search_movie",
  "radarr_search_movies",
  "lidarr_search_album",
  "lidarr_search_missing",
  "whisparr_search_item",
  "chaptarr_trigger_book_search",
  "chaptarr_search_missing",
  // Refresh / rescan
  "sonarr_refresh_series",
  "radarr_refresh_movie",
  "whisparr_rescan_item",
  "whisparr_refresh_item",
  "chaptarr_refresh_author",
  // Destructive
  "radarr_delete_queue_item",
  "whisparr_delete_item",
  "radarr_update_movie",
  "jellyseerr_approve_request",
  "jellyseerr_decline_request",
];

const EXPECTED_DESTRUCTIVE = [
  "radarr_delete_queue_item",
  "whisparr_delete_item",
  "radarr_update_movie",
  "jellyseerr_approve_request",
  "jellyseerr_decline_request",
];

test("every advertised tool carries a readOnlyHint", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  const missing = tools
    .filter((t) => typeof t.annotations?.readOnlyHint !== "boolean")
    .map((t) => t.name);
  assert.deepEqual(missing, [], `tools with no readOnlyHint: ${missing.join(", ")}`);
});

// A name in the mutating list that no tool actually has means a tool was renamed
// and the classification was not. The tool it used to name is then advertised as
// a read — silently, which is the whole failure this guards against.
test("every classified mutating tool exists in the catalogue", async () => {
  const names = new Set((await listToolObjects(EVERY_SERVICE)).map((t) => t.name));
  const unknown = EXPECTED_MUTATING.filter((n) => !names.has(n));
  assert.deepEqual(unknown, [], `classified as mutating but not advertised: ${unknown.join(", ")}`);
});

test("mutating tools are marked as writes, everything else as reads", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  const mutating = new Set(EXPECTED_MUTATING);
  const wrong = tools
    .filter((t) => t.annotations.readOnlyHint === mutating.has(t.name))
    .map((t) => `${t.name} (readOnlyHint=${t.annotations.readOnlyHint})`);
  assert.deepEqual(wrong, [], `misclassified: ${wrong.join(", ")}`);
});

test("destructive tools are flagged, other writes are not", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  const destructive = new Set(EXPECTED_DESTRUCTIVE);
  for (const tool of tools.filter((t) => !t.annotations.readOnlyHint)) {
    assert.equal(
      tool.annotations.destructiveHint,
      destructive.has(tool.name),
      `${tool.name} destructiveHint should be ${destructive.has(tool.name)}`,
    );
  }
});

// openWorldHint defaults to true in the MCP spec, which would mark every local
// library query as reaching the internet. It has to be set explicitly, and false
// for anything that only talks to the user's own *arr services.
test("local library reads are not marked open-world", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  for (const name of ["sonarr_get_series", "radarr_get_queue", "bazarr_get_summary"]) {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, `${name} should be advertised`);
    assert.equal(tool.annotations.openWorldHint, false, `${name} only talks to the local stack`);
  }
});

test("metadata lookups and TRaSH tools are marked open-world", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  for (const name of ["sonarr_search", "prowlarr_search", "trash_list_profiles"]) {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, `${name} should be advertised`);
    assert.equal(tool.annotations.openWorldHint, true, `${name} reaches a third party`);
  }
});

// The trap the annotations exist to make machine-readable: same verb, opposite
// blast radius. If these two ever agree, the classification has broken.
test("_search reads and _search_missing writes are not confused", async () => {
  const tools = await listToolObjects(EVERY_SERVICE);
  const lookup = tools.find((t) => t.name === "sonarr_search");
  const trigger = tools.find((t) => t.name === "sonarr_search_missing");
  assert.equal(lookup.annotations.readOnlyHint, true, "sonarr_search is a metadata lookup");
  assert.equal(trigger.annotations.readOnlyHint, false, "sonarr_search_missing triggers downloads");
});
