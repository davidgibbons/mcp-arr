import assert from "node:assert/strict";
import test from "node:test";

import {
  WhisparrClient,
  whisparrFileCount,
  whisparrItemKey,
  whisparrSizeOnDisk,
} from "../dist/arr-client.js";

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

// Whisparr's two variants key their items differently, and the triage runbook
// for RemovedSeriesCheck/RemovedMovieCheck turns on matching a library row
// against a lookup result by that key and on spotting rows holding no files.

test("item keys come from the field each variant actually populates", () => {
  // V2 carries the TPDB site id in Sonarr's tvdbId field.
  assert.equal(whisparrItemKey({ tvdbId: 4123 }), "4123");
  // Eros keys scenes by a string foreignId and leaves tmdbId unset.
  assert.equal(whisparrItemKey({ foreignId: "abc-123" }), "abc-123");
  assert.equal(whisparrItemKey({ stashId: "stash-9" }), "stash-9");
  // An unset id must not read as the real id 0, or every dead row collides.
  assert.equal(whisparrItemKey({ tvdbId: 0, tmdbId: 0 }), undefined);
  assert.equal(whisparrItemKey({}), undefined);
});

test("file counts and sizes read from either variant's shape", () => {
  const v2Row = { statistics: { episodeFileCount: 12, sizeOnDisk: 2048 } };
  const v3Row = { hasFile: true, sizeOnDisk: 1024, statistics: { movieFileCount: 1, sizeOnDisk: 1024 } };
  const deadRow = { statistics: { episodeFileCount: 0, totalEpisodeCount: 31, sizeOnDisk: 0 } };

  assert.equal(whisparrFileCount(v2Row), 12);
  assert.equal(whisparrFileCount(v3Row), 1);
  // The row this whole runbook is about: tracks nothing, may still hold media.
  assert.equal(whisparrFileCount(deadRow), 0);
  assert.equal(whisparrSizeOnDisk(v2Row), 2048);
  assert.equal(whisparrSizeOnDisk(v3Row), 1024);
  assert.equal(whisparrSizeOnDisk({}), 0);
});

test("an empty response body does not fail the request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 200 });
  try {
    // DELETE endpoints across every *arr app answer with no body; response.json()
    // rejects on that, so the shared request path must not call it blindly.
    const client = new WhisparrClient(config);
    assert.equal(await client.getStatus(), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Step 4 of the RemovedSeriesCheck runbook: delete the dead row without its
// files, re-add the live id pointed at the existing folder, rescan. The
// parameter names differ between variants and getting them wrong here either
// deletes media or silently no-ops, so pin the exact wire calls.

test("V2 remediation keeps files and never excludes", async () => {
  const fetchStub = stubFetch("2.0.0.548");
  try {
    const client = new WhisparrClient(config);
    await client.deleteItem(42);
    await client.addItem({ key: "4123", qualityProfileId: 1, title: "A Site", path: "/media/adult/A Site" });
    await client.rescanItem(43);

    const del = fetchStub.calls.find((c) => c.method === "DELETE");
    assert.equal(del.url, "http://whisparr.test:6969/api/v3/series/42?deleteFiles=false&addImportListExclusion=false");

    const add = fetchStub.calls.find((c) => c.url.endsWith("/api/v3/series") && c.method === "POST");
    assert.equal(add.body.tvdbId, 4123);
    assert.equal(add.body.path, "/media/adult/A Site");
    // Re-attaching existing files must not kick off downloads.
    assert.equal(add.body.addOptions.searchForMissingEpisodes, false);

    const rescan = fetchStub.calls.find((c) => c.url.endsWith("/command"));
    assert.deepEqual(rescan.body, { name: "RescanSeries", seriesId: 43 });
  } finally {
    fetchStub.restore();
  }
});

test("V3 remediation uses Eros parameter names", async () => {
  const fetchStub = stubFetch("3.0.0.1034");
  try {
    const client = new WhisparrClient(config);
    await client.deleteItem(42);
    await client.addItem({ key: "stash-abc", qualityProfileId: 1, path: "/media/adult/A Scene" });
    await client.rescanItem(43);

    const del = fetchStub.calls.find((c) => c.method === "DELETE");
    assert.equal(del.url, "http://whisparr.test:6969/api/v3/movie/42?deleteFiles=false&addImportExclusion=false");

    const add = fetchStub.calls.find((c) => c.url.endsWith("/api/v3/movie") && c.method === "POST");
    // Eros keys on the string foreignId; sending tvdbId would add nothing.
    assert.equal(add.body.foreignId, "stash-abc");
    assert.equal(add.body.tvdbId, undefined);
    assert.equal(add.body.addOptions.searchForMovie, false);

    const rescan = fetchStub.calls.find((c) => c.url.endsWith("/command"));
    // RescanMovie takes a singular movieId, unlike MoviesSearch's movieIds.
    assert.deepEqual(rescan.body, { name: "RescanMovie", movieId: 43 });
  } finally {
    fetchStub.restore();
  }
});

test("folder inspection asks Whisparr what is actually on disk", async () => {
  const fetchStub = stubFetch("3.0.0.1034");
  try {
    await new WhisparrClient(config).getFolderMediaFiles("/media/adult/A Scene");
    const call = fetchStub.calls.find((c) => c.url.includes("/filesystem/mediafiles"));
    assert.equal(call.url, "http://whisparr.test:6969/api/v3/filesystem/mediafiles?path=%2Fmedia%2Fadult%2FA%20Scene");
  } finally {
    fetchStub.restore();
  }
});
