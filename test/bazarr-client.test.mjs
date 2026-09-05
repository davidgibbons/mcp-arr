import assert from "node:assert/strict";
import test from "node:test";

import { BazarrClient, RadarrClient } from "../dist/arr-client.js";

// Bazarr is not a Servarr app: its API is unversioned, its responses are
// inconsistently enveloped, and its listing endpoints have no default page
// size. These tests pin all three, since each fails silently rather than loudly.

const config = { url: "http://bazarr.test", apiKey: "k" };

function stubFetch(body) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET" });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("Bazarr is unversioned: /api/... with no version segment", async () => {
  const f = stubFetch({ data: {} });
  try {
    await new BazarrClient(config).getBazarrStatus();
    // Not /api//system/status, and not /api/v1/... which silently serves the
    // web UI's HTML with a 200.
    assert.equal(f.calls[0].url, "http://bazarr.test/api/system/status");
  } finally { f.restore(); }
});

test("versioned services are unaffected by the unversioned path change", async () => {
  const f = stubFetch({ version: "5.0.0" });
  try {
    await new RadarrClient({ url: "http://radarr.test", apiKey: "k" }).getStatus();
    assert.equal(f.calls[0].url, "http://radarr.test/api/v3/system/status");
  } finally { f.restore(); }
});

test("a { data } envelope is unwrapped", async () => {
  const f = stubFetch({ data: [{ name: "opensubtitlescom", status: "Good", retry: "-" }] });
  try {
    const providers = await new BazarrClient(config).getProviders();
    assert.equal(providers.length, 1);
    assert.equal(providers[0].name, "opensubtitlescom");
  } finally { f.restore(); }
});

test("a bare response is passed through unwrapped", async () => {
  // /badges answers with the object directly, no envelope.
  const f = stubFetch({ episodes: 6532, movies: 92, providers: 1, status: 0 });
  try {
    const badges = await new BazarrClient(config).getBadges();
    assert.equal(badges.episodes, 6532);
    assert.equal(badges.providers, 1);
  } finally { f.restore(); }
});

test("a bare array is passed through unwrapped", async () => {
  // /system/languages/profiles answers with a bare array.
  const f = stubFetch([{ profileId: 1, name: "English" }]);
  try {
    const profiles = await new BazarrClient(config).getLanguageProfiles();
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, "English");
  } finally { f.restore(); }
});

test("paged endpoints always send start and length", async () => {
  const f = stubFetch({ data: [], total: 0 });
  try {
    const client = new BazarrClient(config);
    await client.getWantedEpisodes();
    // Defaults must still be on the wire: without them Bazarr returns
    // megabytes over ~70s instead of a page.
    assert.match(f.calls[0].url, /\/episodes\/wanted\?start=0&length=25$/);
    await client.getSeries(50, 10);
    assert.match(f.calls[1].url, /\/series\?start=50&length=10$/);
  } finally { f.restore(); }
});

test("page length is clamped and negative offsets are floored", async () => {
  const f = stubFetch({ data: [], total: 0 });
  try {
    const client = new BazarrClient(config);
    await client.getWantedMovies(-5, 5000);
    assert.match(f.calls[0].url, /start=0&length=100$/);
    await client.getMovies(0, 0);
    assert.match(f.calls[1].url, /start=0&length=1$/);
  } finally { f.restore(); }
});

test("total is reported from the envelope, not the page size", async () => {
  const f = stubFetch({ data: [{}, {}], total: 6532 });
  try {
    const page = await new BazarrClient(config).getWantedEpisodes(0, 2);
    assert.equal(page.total, 6532);
    assert.equal(page.data.length, 2);
  } finally { f.restore(); }
});

test("a missing total falls back to the row count rather than undefined", async () => {
  const f = stubFetch({ data: [{}, {}, {}] });
  try {
    const page = await new BazarrClient(config).getSeries();
    assert.equal(page.total, 3);
  } finally { f.restore(); }
});

test("a malformed page yields an empty list rather than throwing", async () => {
  const f = stubFetch({ data: null });
  try {
    const page = await new BazarrClient(config).getWantedEpisodes();
    assert.deepEqual(page.data, []);
    assert.equal(page.total, 0);
  } finally { f.restore(); }
});

test("manual search passes the id Bazarr expects", async () => {
  const f = stubFetch({ data: [] });
  try {
    const client = new BazarrClient(config);
    await client.searchEpisodeSubtitles(90097);
    assert.match(f.calls[0].url, /\/providers\/episodes\?episodeid=90097$/);
    await client.searchMovieSubtitles(42);
    assert.match(f.calls[1].url, /\/providers\/movies\?radarrid=42$/);
  } finally { f.restore(); }
});
