import assert from "node:assert/strict";
import test from "node:test";

import {
  JellyseerrClient,
  parseJellyseerrFilter,
  JELLYSEERR_REQUEST_STATUS,
  JELLYSEERR_MEDIA_STATUS,
} from "../dist/arr-client.js";

// Jellyseerr fits the base client, but its status enums are wider than older
// documentation describes and a request carries no title. Both are pinned here
// because both fail quietly: a wrong enum mislabels rows rather than erroring.

const config = { url: "http://jellyseerr.test", apiKey: "k" };

function stubFetch(body, { fail = false } = {}) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET" });
    if (fail) return new Response("nope", { status: 500 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("request status enum includes COMPLETED=5", () => {
  // Read from the running build. The classic four-value set stops at FAILED=4,
  // but 5 is the most common status on a real instance - omitting it would
  // label the majority of rows "unknown".
  assert.equal(JELLYSEERR_REQUEST_STATUS[1], "pending");
  assert.equal(JELLYSEERR_REQUEST_STATUS[2], "approved");
  assert.equal(JELLYSEERR_REQUEST_STATUS[3], "declined");
  assert.equal(JELLYSEERR_REQUEST_STATUS[4], "failed");
  assert.equal(JELLYSEERR_REQUEST_STATUS[5], "completed");
});

test("media status enum covers the full 1-7 range", () => {
  assert.equal(JELLYSEERR_MEDIA_STATUS[3], "processing");
  assert.equal(JELLYSEERR_MEDIA_STATUS[4], "partially available");
  assert.equal(JELLYSEERR_MEDIA_STATUS[5], "available");
  assert.equal(JELLYSEERR_MEDIA_STATUS[6], "blocklisted");
  assert.equal(JELLYSEERR_MEDIA_STATUS[7], "deleted");
});

test("filters are validated against what Jellyseerr accepts", () => {
  assert.equal(parseJellyseerrFilter("pending"), "pending");
  assert.equal(parseJellyseerrFilter("  FAILED "), "failed");
  assert.equal(parseJellyseerrFilter(undefined), undefined);
  assert.throws(() => parseJellyseerrFilter("approved-ish"), /filter must be one of/);
});

test("'all' is sent as an absent filter, not filter=all", async () => {
  const f = stubFetch({ results: [], pageInfo: {} });
  try {
    const client = new JellyseerrClient(config);
    await client.getRequests("all", 5, 0);
    assert.ok(!f.calls[0].url.includes("filter="), f.calls[0].url);
    await client.getRequests("pending", 5, 0);
    assert.match(f.calls[1].url, /filter=pending/);
  } finally { f.restore(); }
});

test("take is clamped and skip floored", async () => {
  const f = stubFetch({ results: [], pageInfo: {} });
  try {
    const client = new JellyseerrClient(config);
    await client.getRequests(undefined, 9999, -3);
    assert.match(f.calls[0].url, /take=50/);
    assert.match(f.calls[0].url, /skip=0/);
    await client.getRequests(undefined, 0, 10);
    assert.match(f.calls[1].url, /take=1/);
  } finally { f.restore(); }
});

test("Jellyseerr answers on /api/v1", async () => {
  const f = stubFetch({ total: 0 });
  try {
    await new JellyseerrClient(config).getRequestCounts();
    assert.equal(f.calls[0].url, "http://jellyseerr.test/api/v1/request/count");
  } finally { f.restore(); }
});

test("titles come from `title` for movies and `name` for TV", async () => {
  const movie = stubFetch({ title: "Dune" });
  try {
    assert.equal(await new JellyseerrClient(config).getTitle("movie", 438631), "Dune");
    assert.match(movie.calls[0].url, /\/movie\/438631$/);
  } finally { movie.restore(); }

  const tv = stubFetch({ name: "Infomercials" });
  try {
    assert.equal(await new JellyseerrClient(config).getTitle("tv", 115657), "Infomercials");
    assert.match(tv.calls[0].url, /\/tv\/115657$/);
  } finally { tv.restore(); }
});

test("a failed title lookup returns undefined instead of throwing", async () => {
  // A title is a nicety; it must never take down a listing.
  const f = stubFetch(null, { fail: true });
  try {
    assert.equal(await new JellyseerrClient(config).getTitle("movie", 1), undefined);
  } finally { f.restore(); }
});

test("a missing tmdbId skips the lookup entirely", async () => {
  const f = stubFetch({ title: "should not be fetched" });
  try {
    assert.equal(await new JellyseerrClient(config).getTitle("movie", 0), undefined);
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("approve and decline post to the status route", async () => {
  const f = stubFetch({ id: 7, status: 2 });
  try {
    const client = new JellyseerrClient(config);
    await client.setRequestStatus(7, "approve");
    assert.equal(f.calls[0].method, "POST");
    assert.match(f.calls[0].url, /\/request\/7\/approve$/);
    await client.setRequestStatus(7, "decline");
    assert.match(f.calls[1].url, /\/request\/7\/decline$/);
  } finally { f.restore(); }
});
