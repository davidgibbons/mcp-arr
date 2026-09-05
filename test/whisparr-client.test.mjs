import assert from "node:assert/strict";
import test from "node:test";

import { WhisparrClient } from "../dist/arr-client.js";

// Whisparr V2 (Sonarr fork) and V3 "Eros" (Radarr fork) both answer on
// /api/v3 with the same auth header but expose different resources. The
// client picks the shape from /system/status, so these tests pin that
// detection and the endpoint/command names each variant gets.

function stubFetch(version) {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method ?? "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
    });

    const body = String(url).endsWith("/system/status") ? { version } : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

const config = { url: "http://whisparr.test:6969", apiKey: "test-key" };

test("V2 uses the Sonarr-shaped series endpoints", async () => {
  const fetchStub = stubFetch("2.0.0.548");
  try {
    const client = new WhisparrClient(config);

    assert.equal(await client.getVariant(), "v2");

    await client.getLibrary();
    await client.searchLibrary("some site");
    await client.getScenes(7);
    await client.searchItem(7);
    await client.refreshItem(7);

    const urls = fetchStub.calls.map((c) => c.url);
    assert.ok(urls.includes("http://whisparr.test:6969/api/v3/series"));
    assert.ok(urls.includes("http://whisparr.test:6969/api/v3/series/lookup?term=some%20site"));
    assert.ok(urls.includes("http://whisparr.test:6969/api/v3/episode?seriesId=7"));

    const commands = fetchStub.calls.filter((c) => c.url.endsWith("/command"));
    assert.deepEqual(commands.map((c) => c.body), [
      { name: "SeriesSearch", seriesId: 7 },
      { name: "RefreshSeries", seriesId: 7 },
    ]);
  } finally {
    fetchStub.restore();
  }
});

test("V3 Eros uses the Radarr-shaped movie endpoints", async () => {
  const fetchStub = stubFetch("3.0.0.1034");
  try {
    const client = new WhisparrClient(config);

    assert.equal(await client.getVariant(), "v3");

    await client.getLibrary();
    await client.searchLibrary("some scene");
    await client.searchItem(7);
    await client.refreshItem(7);

    const urls = fetchStub.calls.map((c) => c.url);
    assert.ok(urls.includes("http://whisparr.test:6969/api/v3/movie"));
    assert.ok(urls.includes("http://whisparr.test:6969/api/v3/movie/lookup?term=some%20scene"));

    const commands = fetchStub.calls.filter((c) => c.url.endsWith("/command"));
    assert.deepEqual(commands.map((c) => c.body), [
      { name: "MoviesSearch", movieIds: [7] },
      { name: "RefreshMovie", movieIds: [7] },
    ]);

    // Nested scenes are a V2-only concept; Eros must say so rather than 404.
    await assert.rejects(client.getScenes(7), /no per-site scene list/);
  } finally {
    fetchStub.restore();
  }
});

test("the variant is detected once and cached", async () => {
  const fetchStub = stubFetch("2.0.0.548");
  try {
    const client = new WhisparrClient(config);

    await client.getLibrary();
    await client.getLibrary();
    await client.searchLibrary("x");

    const statusCalls = fetchStub.calls.filter((c) => c.url.endsWith("/system/status"));
    assert.equal(statusCalls.length, 1, "detection must not re-probe on every call");
  } finally {
    fetchStub.restore();
  }
});

test("an unrecognised version falls through to the current Eros shape", async () => {
  const fetchStub = stubFetch("4.1.0");
  try {
    assert.equal(await new WhisparrClient(config).getVariant(), "v3");
  } finally {
    fetchStub.restore();
  }
});
