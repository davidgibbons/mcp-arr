import assert from "node:assert/strict";
import test from "node:test";

import { RadarrClient } from "../dist/arr-client.js";

// Every *arr DELETE endpoint answers 200/204 with an empty body. response.json()
// rejects on that, so the shared request path must not call it blindly —
// radarr_delete_queue_item threw on success for exactly this reason.
test("an empty response body does not fail the request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 200 });
  try {
    const client = new RadarrClient({ url: "http://radarr.test", apiKey: "k" });
    assert.equal(await client.getStatus(), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a JSON response body is still parsed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ version: "5.0.0" }), { status: 200 });
  try {
    const client = new RadarrClient({ url: "http://radarr.test", apiKey: "k" });
    assert.deepEqual(await client.getStatus(), { version: "5.0.0" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
