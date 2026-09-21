import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { connect } from "node:net";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// OAuth 2.1 resource-server mode. These tests drive the real thing: a local
// issuer serving real OIDC discovery and a real JWKS, and tokens signed with a
// real key. Nothing about JWT validation is stubbed, because the parts worth
// pinning here - the signature, the issuer, the audience, the expiry - are
// exactly the parts a stub would paper over.

const AUDIENCE = "mcp-arr";

/**
 * A minimal OpenID provider: discovery document, JWKS, and a signer.
 *
 * It listens on port 0 so the issuer URL is only known after listen(), which is
 * why `issuer` is assigned late - the request handler closes over it and is not
 * called until a request arrives.
 */
async function startIdp() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

  // A second key the server has never seen, for the "signed by a stranger" case.
  const stranger = await generateKeyPair("RS256", { extractable: true });

  let issuer;
  const server = createServer((req, res) => {
    const routes = {
      "/.well-known/openid-configuration": { issuer, jwks_uri: `${issuer}/jwks` },
      "/jwks": { keys: [jwk] },
    };
    const body = routes[req.url];
    if (!body) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${server.address().port}`;

  const sign = ({
    scope = "mcp-arr:read",
    claims = {},
    key = privateKey,
    kid = "test-key",
    iss = issuer,
    aud = AUDIENCE,
    exp = "5m",
  } = {}) => {
    const jwt = new SignJWT({ ...(scope === null ? {} : { scope }), ...claims })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuedAt()
      .setIssuer(iss)
      .setAudience(aud);
    // exp: null mints a token with no expiry at all, which is a thing IdPs do.
    if (exp !== null) jwt.setExpirationTime(exp);
    return jwt.sign(key);
  };

  return {
    issuer,
    sign,
    strangerKey: stranger.privateKey,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function withServer(env, fn) {
  const port = String(36000 + Math.floor(Math.random() * 1000));
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      HOST: "127.0.0.1",
      PORT: port,
      SONARR_URL: "http://sonarr.invalid",
      SONARR_API_KEY: "x",
      MCP_ARR_HEALTH_INTERVAL: "0",
      ...env,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  try {
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error("server did not start");
      await new Promise((r) => setTimeout(r, 100));
    }
    const base = `http://127.0.0.1:${port}`;
    const mcp = (payload, token) =>
      fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    // fetch() will not send a malformed Host header, so the hostile cases need
    // to go out over a raw socket.
    const rawRequest = (hostHeader, path = "/health") =>
      new Promise((resolve) => {
        const sock = connect(Number(port), "127.0.0.1", () => {
          sock.write(`GET ${path} HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`);
        });
        let data = "";
        sock.on("data", (d) => { data += d; });
        sock.on("close", () => resolve(data.split("\r\n")[0] || ""));
        sock.on("error", () => resolve(""));
        setTimeout(() => { sock.destroy(); resolve(""); }, 2000);
      });
    return await fn({ mcp, base, rawRequest, get: (path, init) => fetch(`${base}${path}`, init) });
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
}

/** Start the server expecting it to refuse to start, and return what it said. */
async function startupFailure(env) {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      HOST: "127.0.0.1",
      PORT: "36999",
      MCP_ARR_HEALTH_INTERVAL: "0",
      ...env,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  // A server that wrongly starts would otherwise run forever and hang the suite
  // instead of failing it. Time it out and report the "still running" as itself.
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    const [code, signal] = await once(child, "exit");
    return { code: signal === "SIGKILL" ? "still running" : code, stderr };
  } finally {
    clearTimeout(timer);
  }
}

const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

async function toolNames(response) {
  const text = await response.text();
  return JSON.parse(text.replace(/^event: message\ndata: /, "")).result.tools.map((t) => t.name);
}

const oauthEnv = (idp, extra = {}) => ({
  MCP_ARR_AUTH_MODE: "oauth",
  MCP_ARR_OAUTH_ISSUER: idp.issuer,
  MCP_ARR_OAUTH_AUDIENCE: AUDIENCE,
  ...extra,
});

test("oauth mode: a request with no token is refused and told where to look", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const response = await mcp(listTools);
      assert.equal(response.status, 401);
      const challenge = response.headers.get("www-authenticate") ?? "";
      assert.match(challenge, /^Bearer/);
      // This is the part that makes the flow automatic rather than a manual
      // wiring exercise: without resource_metadata the client sees an opaque 401.
      assert.match(
        challenge,
        /resource_metadata="[^"]*\/\.well-known\/oauth-protected-resource\/mcp"/,
        "the challenge must point at the RFC 9728 document",
      );
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: a write-scoped token gets the mutating tools", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const token = await idp.sign({ scope: "mcp-arr:read mcp-arr:write" });
      const response = await mcp(listTools, token);
      assert.equal(response.status, 200);
      assert.ok((await toolNames(response)).includes("sonarr_add_series"));
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: a read-scoped token is held to reads on both list and call", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const token = await idp.sign({ scope: "mcp-arr:read" });
      const names = await toolNames(await mcp(listTools, token));
      assert.ok(names.includes("sonarr_get_series"), "reads stay available");
      assert.ok(!names.includes("sonarr_add_series"), "writes are filtered out");

      // Filtering the list is a convenience; the call gate is the control.
      const call = await mcp(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "sonarr_add_series", arguments: {} } },
        token,
      );
      assert.match(await call.text(), /read-only access/);
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: a token carrying neither scope is refused, not quietly downgraded", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const token = await idp.sign({ scope: "openid profile" });
      const response = await mcp(listTools, token);
      assert.equal(response.status, 403);
      const challenge = response.headers.get("www-authenticate") ?? "";
      assert.match(challenge, /insufficient_scope/);
      assert.match(challenge, /mcp-arr:read/, "the challenge has to name the scope that was missing");
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: the scope names are configurable", async () => {
  const idp = await startIdp();
  try {
    await withServer(
      oauthEnv(idp, { MCP_ARR_OAUTH_SCOPE_READ: "media.read", MCP_ARR_OAUTH_SCOPE_WRITE: "media.write" }),
      async ({ mcp }) => {
        assert.equal((await mcp(listTools, await idp.sign({ scope: "mcp-arr:read" }))).status, 403);
        const names = await toolNames(await mcp(listTools, await idp.sign({ scope: "media.read media.write" })));
        assert.ok(names.includes("sonarr_add_series"));
      },
    );
  } finally {
    await idp.close();
  }
});

// Entra and friends put scopes in `scp`, as a string or an array.
test("oauth mode: the scp claim is honoured as well as scope", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const asString = await idp.sign({ scope: null, claims: { scp: "mcp-arr:read mcp-arr:write" } });
      assert.ok((await toolNames(await mcp(listTools, asString))).includes("sonarr_add_series"));

      const asArray = await idp.sign({ scope: null, claims: { scp: ["mcp-arr:read"] } });
      assert.ok(!(await toolNames(await mcp(listTools, asArray))).includes("sonarr_add_series"));
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: a token that fails validation is refused", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ mcp }) => {
      const cases = {
        "wrong issuer": await idp.sign({ iss: "https://somewhere.else.invalid" }),
        "wrong audience": await idp.sign({ aud: "some-other-api" }),
        "already expired": await idp.sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
        // jose only checks exp when it is present, so a token minted without
        // one would otherwise be a credential that never expires.
        "no exp claim, so it would never expire": await idp.sign({ exp: null }),
        "signed by a stranger": await idp.sign({ key: idp.strangerKey }),
        "not a jwt at all": "not-a-jwt",
      };
      for (const [why, token] of Object.entries(cases)) {
        assert.equal((await mcp(listTools, token)).status, 401, `${why} must be refused`);
      }
    });
  } finally {
    await idp.close();
  }
});

test("oauth mode: MCP_ARR_ACCESS still caps what a scope can buy", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp, { MCP_ARR_ACCESS: "read-only" }), async ({ mcp }) => {
      const token = await idp.sign({ scope: "mcp-arr:read mcp-arr:write" });
      const names = await toolNames(await mcp(listTools, token));
      assert.ok(!names.includes("sonarr_add_series"), "a read-only server cannot be widened by a scope");
    });
  } finally {
    await idp.close();
  }
});

test("the protected-resource document is served, unauthenticated, at both paths", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ get, base }) => {
      // RFC 9728 inserts the resource's path; MCP clients also try the bare root.
      for (const path of [
        "/.well-known/oauth-protected-resource/mcp",
        "/.well-known/oauth-protected-resource",
      ]) {
        const response = await get(path);
        assert.equal(response.status, 200, `${path} must be served`);
        const body = await response.json();
        assert.deepEqual(body.authorization_servers, [idp.issuer]);
        assert.equal(body.resource, `${base}/mcp`, "the resource must be the audience a client asks for");
        assert.deepEqual(body.scopes_supported, ["mcp-arr:read", "mcp-arr:write"]);
        assert.deepEqual(body.bearer_methods_supported, ["header"]);
      }
    });
  } finally {
    await idp.close();
  }
});

test("the resource identifier can be pinned for deployments behind a proxy", async () => {
  const idp = await startIdp();
  try {
    await withServer(
      oauthEnv(idp, { MCP_ARR_OAUTH_RESOURCE: "https://mcp-arr.example.com/mcp" }),
      async ({ get }) => {
        const body = await (await get("/.well-known/oauth-protected-resource/mcp")).json();
        assert.equal(body.resource, "https://mcp-arr.example.com/mcp");
      },
    );
  } finally {
    await idp.close();
  }
});

test("health reports the auth mode and stays unauthenticated", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ get }) => {
      const response = await get("/health");
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.authMode, "oauth");
      assert.equal(body.authRequired, true);
    });
  } finally {
    await idp.close();
  }
});

// The failure this whole design is guarding against: a variable typed wrong
// leaving the endpoint quietly open.
test("a half-configured setup refuses to start rather than falling back to open", async () => {
  const idp = await startIdp();
  try {
    const noAudience = await startupFailure({
      MCP_ARR_AUTH_MODE: "oauth",
      MCP_ARR_OAUTH_ISSUER: idp.issuer,
    });
    assert.notEqual(noAudience.code, 0);
    assert.match(noAudience.stderr, /MCP_ARR_OAUTH_AUDIENCE/);

    const noIssuer = await startupFailure({
      MCP_ARR_AUTH_MODE: "oauth",
      MCP_ARR_OAUTH_AUDIENCE: AUDIENCE,
    });
    assert.notEqual(noIssuer.code, 0);
    assert.match(noIssuer.stderr, /MCP_ARR_OAUTH_ISSUER/);

    // An issuer set without the mode is the misspelling case in reverse: it must
    // not be ignored.
    const noMode = await startupFailure({ MCP_ARR_OAUTH_ISSUER: idp.issuer });
    assert.notEqual(noMode.code, 0);
    assert.match(noMode.stderr, /MCP_ARR_OAUTH_AUDIENCE/);

    const tokenModeNoToken = await startupFailure({ MCP_ARR_AUTH_MODE: "token" });
    assert.notEqual(tokenModeNoToken.code, 0);
    assert.match(tokenModeNoToken.stderr, /MCP_ARR_AUTH_TOKEN/);

    const bogusMode = await startupFailure({ MCP_ARR_AUTH_MODE: "oath" });
    assert.notEqual(bogusMode.code, 0);
    assert.match(bogusMode.stderr, /MCP_ARR_AUTH_MODE/);

    // Two modes' worth of configuration is ambiguous; pick one.
    const both = await startupFailure({
      MCP_ARR_AUTH_TOKEN: "a-token",
      MCP_ARR_OAUTH_ISSUER: idp.issuer,
      MCP_ARR_OAUTH_AUDIENCE: AUDIENCE,
    });
    assert.notEqual(both.code, 0);
    assert.match(both.stderr, /MCP_ARR_AUTH_MODE/);
  } finally {
    await idp.close();
  }
});

// token mode has to stay first-class: some MCP clients can only send a static
// header and cannot refresh anything.
test("token mode still works and is still inferred from a bare token", async () => {
  const token = "static-token-for-clients-that-cannot-refresh";
  await withServer({ MCP_ARR_AUTH_TOKEN: token }, async ({ mcp, get }) => {
    assert.equal((await mcp(listTools)).status, 401);
    assert.equal((await mcp(listTools, token)).status, 200);
    assert.equal((await (await get("/health")).json()).authMode, "token");
  });
});

// A `Host` the URL parser rejects used to throw out of the async request
// handler. http.Server does not await that callback, so the rejection went
// unhandled and Node killed the process: one unauthenticated request, sent
// before any credential check, permanently took the server down.
test("a malformed Host header cannot take the server down", async () => {
  const idp = await startIdp();
  try {
    await withServer(oauthEnv(idp), async ({ rawRequest, get, mcp }) => {
      // Forbidden host code points that are nonetheless legal header bytes, plus
      // a quote, which survives URL parsing and would otherwise close the quoted
      // resource_metadata parameter in the challenge.
      for (const hostile of ["a b", "a|b", "a^b", "[bad", "a b:3000", 'a"b', 'x"; y="']) {
        await rawRequest(hostile, "/health");
        // The 401 path builds a WWW-Authenticate from the Host too, so exercise
        // it as well - it runs before any token is checked.
        await rawRequest(hostile, "/mcp");
      }
      assert.equal((await get("/health")).status, 200, "the server must still be serving");
      const refused = await mcp(listTools);
      assert.equal(refused.status, 401, "and still authenticating");
      // A hostile Host must not have escaped into the challenge: exactly the
      // three quoted parameters, no extras smuggled in by an injected quote.
      const challenge = refused.headers.get("www-authenticate") ?? "";
      assert.equal((challenge.match(/"/g) ?? []).length % 2, 0, "quotes must stay balanced");
    });
  } finally {
    await idp.close();
  }
});

test("with nothing configured the mode is none and the endpoint is open, as before", async () => {
  await withServer({}, async ({ mcp, get }) => {
    assert.equal((await mcp(listTools)).status, 200);
    const body = await (await get("/health")).json();
    assert.equal(body.authMode, "none");
    assert.equal(body.authRequired, false);
    // Nothing to advertise when there is no authorization server.
    assert.equal((await get("/.well-known/oauth-protected-resource")).status, 404);
  });
});
