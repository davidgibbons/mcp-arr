import assert from "node:assert/strict";
import test from "node:test";

import { ChaptarrClient, parseChaptarrMediaType } from "../dist/arr-client.js";

// Chaptarr keeps separate rows for the audiobook and eBook of the same title,
// so `mediaType` scopes almost every call. These tests pin how that parameter
// reaches the wire, and how an author is created on one side of the library.

const config = { url: "http://chaptarr.test", apiKey: "k" };

function stubFetch(response = []) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method ?? "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("mediaType accepts only the values Chaptarr documents", () => {
  assert.equal(parseChaptarrMediaType("audiobook"), "audiobook");
  assert.equal(parseChaptarrMediaType("EBOOK"), "ebook");
  assert.equal(parseChaptarrMediaType(" all "), "all");
  // Absent stays absent rather than defaulting to a side of the library.
  assert.equal(parseChaptarrMediaType(undefined), undefined);
  assert.equal(parseChaptarrMediaType(""), undefined);
  assert.throws(() => parseChaptarrMediaType("audio"),
    /mediaType must be 'all', 'audiobook' or 'ebook' - got 'audio'/);
});

test("'all' is rejected where Chaptarr requires one specific side", () => {
  assert.throws(() => parseChaptarrMediaType("all", false), /audiobook.*ebook/);
  assert.equal(parseChaptarrMediaType("ebook", false), "ebook");
});

test("'all' means an absent parameter, not mediaType=all on the wire", async () => {
  const f = stubFetch([]);
  try {
    const client = new ChaptarrClient(config);
    await client.getAuthors("all");
    assert.equal(f.calls[0].url, "http://chaptarr.test/api/v1/author");
    await client.getAuthors("audiobook");
    assert.equal(f.calls[1].url, "http://chaptarr.test/api/v1/author?mediaType=audiobook");
  } finally { f.restore(); }
});

test("book listing combines authorId and mediaType into one query string", async () => {
  const f = stubFetch([]);
  try {
    const client = new ChaptarrClient(config);
    await client.getBooks(7, "ebook");
    assert.equal(f.calls[0].url, "http://chaptarr.test/api/v1/book?authorId=7&mediaType=ebook");
    await client.getBooks(7);
    assert.equal(f.calls[1].url, "http://chaptarr.test/api/v1/book?authorId=7");
    await client.getBooks();
    assert.equal(f.calls[2].url, "http://chaptarr.test/api/v1/book");
  } finally { f.restore(); }
});

test("Chaptarr answers on /api/v1, not the v3 the other *arr apps use", async () => {
  const f = stubFetch({ version: "0.9.958.0" });
  try {
    await new ChaptarrClient(config).getStatus();
    assert.match(f.calls[0].url, /\/api\/v1\/system\/status$/);
  } finally { f.restore(); }
});

test("adding an author writes the media-scoped fields for the chosen side", async () => {
  const f = stubFetch({ id: 1 });
  try {
    const client = new ChaptarrClient(config);
    await client.addAuthor({
      foreignAuthorId: "hc:880167",
      rootFolderPath: "/audiobooks",
      qualityProfileId: 2,
      metadataProfileId: 1,
      mediaType: "audiobook",
    });
    const body = f.calls[0].body;
    // The scoped fields are what Chaptarr actually reads for a new author;
    // the flat ones remain for older clients.
    assert.equal(body.audiobookMonitored, true);
    assert.equal(body.audiobookQualityProfileId, 2);
    assert.equal(body.audiobookMetadataProfileId, 1);
    assert.equal(body.audiobookRootFolderPath, "/audiobooks");
    // The eBook side must not be initialised by an audiobook request.
    assert.equal(body.ebookMonitored, undefined);
    assert.equal(body.ebookQualityProfileId, undefined);
  } finally { f.restore(); }
});

test("an ebook add touches only the ebook side", async () => {
  const f = stubFetch({ id: 1 });
  try {
    await new ChaptarrClient(config).addAuthor({
      foreignAuthorId: "hc:1",
      rootFolderPath: "/ebooks",
      qualityProfileId: 3,
      metadataProfileId: 1,
      mediaType: "ebook",
      monitored: false,
    });
    const body = f.calls[0].body;
    assert.equal(body.ebookMonitored, false);
    assert.equal(body.ebookRootFolderPath, "/ebooks");
    assert.equal(body.audiobookMonitored, undefined);
  } finally { f.restore(); }
});

test("search commands use the names and payload fields Chaptarr defines", async () => {
  const f = stubFetch({ id: 99 });
  try {
    const client = new ChaptarrClient(config);
    await client.triggerBookSearch([4, 5]);
    assert.deepEqual(f.calls[0].body, { name: "BookSearch", bookIds: [4, 5] });

    await client.searchMissing(12, "ebook");
    assert.deepEqual(f.calls[1].body, { name: "MissingBookSearch", authorId: 12, mediaType: "ebook" });

    // 'all' must not be sent as a literal - the command takes one side or none.
    await client.searchMissing(12, "all");
    assert.deepEqual(f.calls[2].body, { name: "MissingBookSearch", authorId: 12 });

    await client.searchMissing();
    assert.deepEqual(f.calls[3].body, { name: "MissingBookSearch" });

    await client.refreshAuthor(3);
    assert.deepEqual(f.calls[4].body, { name: "RefreshAuthor", authorId: 3 });
  } finally { f.restore(); }
});

test("lookup terms are URL-encoded", async () => {
  const f = stubFetch([]);
  try {
    const client = new ChaptarrClient(config);
    await client.searchAuthors("Brandon Sanderson & co");
    assert.match(f.calls[0].url, /\/author\/lookup\?term=Brandon%20Sanderson%20%26%20co$/);
    await client.searchBooks("Mistborn #1");
    assert.match(f.calls[1].url, /\/book\/lookup\?term=Mistborn%20%231$/);
  } finally { f.restore(); }
});
