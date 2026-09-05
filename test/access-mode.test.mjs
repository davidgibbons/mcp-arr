import assert from "node:assert/strict";
import test from "node:test";

import { EVERY_SERVICE, callTool, listToolObjects } from "./helpers/mcp-client.mjs";

const READ_ONLY = { ...EVERY_SERVICE, MCP_ARR_ACCESS: "read-only" };

// One mutator from each category, so a gate that only covers e.g. the delete
// tools does not pass on the strength of the destructive ones alone.
const MUTATORS = [
  "sonarr_add_series",
  "radarr_search_movie",
  "chaptarr_refresh_author",
  "radarr_delete_queue_item",
  "jellyseerr_approve_request",
];

test("read-write is the default and advertises the mutating tools", async () => {
  const names = new Set((await listToolObjects(EVERY_SERVICE)).map((t) => t.name));
  for (const name of MUTATORS) {
    assert.ok(names.has(name), `${name} should be advertised by default`);
  }
});

test("read-only advertises no tool marked as a write", async () => {
  const tools = await listToolObjects(READ_ONLY);
  const writes = tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name);
  assert.deepEqual(writes, [], `read-only advertised writes: ${writes.join(", ")}`);
});

test("read-only keeps every read, including the TRaSH reference tools", async () => {
  const readWrite = await listToolObjects(EVERY_SERVICE);
  const readOnly = new Set((await listToolObjects(READ_ONLY)).map((t) => t.name));
  const dropped = readWrite
    .filter((t) => t.annotations.readOnlyHint && !readOnly.has(t.name))
    .map((t) => t.name);
  assert.deepEqual(dropped, [], `read-only wrongly dropped reads: ${dropped.join(", ")}`);
  assert.ok(readOnly.has("trash_list_profiles"), "TRaSH tools touch nothing and should remain");
  assert.ok(readOnly.has("search"), "generic search should remain");
});

// The one that matters. tools/call dispatches on the name the client sends, so
// filtering the catalogue is not enforcement — a client that never called
// tools/list still reaches the handler. These calls deliberately skip listing.
test("read-only rejects a mutating tools/call even though it was never listed", async () => {
  for (const name of MUTATORS) {
    const result = await callTool(READ_ONLY, name, {});
    assert.equal(result.isError, true, `${name} should be refused in read-only mode`);
    assert.match(
      result.content[0].text,
      /read-only mode/,
      `${name} should be refused by the access gate, not by something downstream`,
    );
  }
});

// Proves the rejection above comes from the gate rather than from the call
// failing for some unrelated reason: the same call in read-write gets past the
// gate and fails later, on the unreachable .invalid host.
test("the same call in read-write reaches the *arr client instead", async () => {
  const result = await callTool(EVERY_SERVICE, "radarr_search_movie", { movieId: 1 });
  assert.doesNotMatch(
    result.content[0].text,
    /read-only mode/,
    "read-write must not refuse a write at the access gate",
  );
});

test("a read still works normally in read-only mode", async () => {
  const result = await callTool(READ_ONLY, "trash_list_profiles", { service: "radarr" });
  assert.doesNotMatch(
    result.content[0].text,
    /read-only mode/,
    "reads must not be caught by the access gate",
  );
});

test("MCP_ARR_ACCESS accepts an underscore spelling", async () => {
  const tools = await listToolObjects({ ...EVERY_SERVICE, MCP_ARR_ACCESS: "read_only" });
  const writes = tools.filter((t) => !t.annotations.readOnlyHint);
  assert.equal(writes.length, 0, "read_only should be understood as read-only");
});
