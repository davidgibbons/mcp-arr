# AGENTS.md - mcp-arr

MCP server for the *arr media management suite (Sonarr, Radarr, Lidarr, Prowlarr,
Whisparr, Chaptarr, Jellyseerr, Bazarr).

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js (ES modules)
- **Protocol:** Model Context Protocol (MCP)
- **Build:** TypeScript compiler (tsc)

## Architecture

Three source files. There is no `src/tools/` directory and no `src/types.ts`
— tool definitions, handlers and types all live in the files below.

```
src/
├── index.ts          # Entry point: bearer auth, health probe, tool definitions,
│                     #   handlers, mutation classification, stdio + HTTP transports
├── arr-client.ts     # ArrClient base + per-service subclasses and their types:
│                     #   Sonarr, Radarr, Lidarr, Prowlarr, Whisparr, Chaptarr,
│                     #   Jellyseerr, Bazarr
└── trash-client.ts   # TRaSH Guides fetch + cache
test/                 # node:test .mjs suites, driven through an in-process MCP client
tools.json            # Checked-in snapshot of the tool catalogue; nothing reads it at runtime
```

## Development Commands

```bash
# Build
npm run build

# Watch mode
npm run watch

# Build + run the test suite
npm test

# Test locally (requires env vars)
node dist/index.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SONARR_URL | For Sonarr | Base URL (e.g., http://localhost:8989) |
| SONARR_API_KEY | For Sonarr | API key from Sonarr settings |
| RADARR_URL | For Radarr | Base URL |
| RADARR_API_KEY | For Radarr | API key |
| LIDARR_URL | For Lidarr | Base URL |
| LIDARR_API_KEY | For Lidarr | API key |
| PROWLARR_URL | For Prowlarr | Base URL |
| PROWLARR_API_KEY | For Prowlarr | API key |
| WHISPARR_URL | For Whisparr | Base URL (e.g. http://localhost:6969) |
| WHISPARR_API_KEY | For Whisparr | API key |
| CHAPTARR_URL | For Chaptarr | Base URL (e.g. http://localhost:8789) |
| CHAPTARR_API_KEY | For Chaptarr | API key |
| JELLYSEERR_URL | For Jellyseerr | Base URL (e.g. http://localhost:5055) |
| JELLYSEERR_API_KEY | For Jellyseerr | API key |
| BAZARR_URL | For Bazarr | Base URL (e.g. http://localhost:6767) |
| BAZARR_API_KEY | For Bazarr | API key |

## Constraints

```yaml
rules:
  - id: no-hardcoded-urls
    description: Never hardcode service URLs or API keys
    check: All service access via environment variables

  - id: consistent-tool-naming
    description: Tool names follow pattern {service}_{action}
    examples:
      - sonarr_get_series
      - radarr_search
      - lidarr_get_albums

  - id: error-handling
    description: All API calls must handle errors gracefully
    requirements:
      - Check for missing env vars before API call
      - Return meaningful error messages
      - Don't expose raw API errors to users

  - id: whisparr-variant-detection
    description: Whisparr V2 (Sonarr fork) and V3 "Eros" (Radarr fork) both answer on /api/v3
    check: Never add a WHISPARR_VERSION env var - WhisparrClient.getVariant() resolves it from /system/status and caches it

  - id: chaptarr-media-type
    description: Chaptarr holds audiobooks and eBooks in one instance; media type is identity, not a filter
    check: Library tools take mediaType (all|audiobook|ebook) validated by parseChaptarrMediaType before the call
    note: 'all' means an ABSENT query parameter, never mediaType=all on the wire

  - id: bazarr-is-not-servarr
    description: Bazarr's API is unversioned and inconsistently enveloped
    check: BazarrClient sets apiVersion to '' so the base builds /api/... ; /api/v1/... returns the web UI's HTML with a 200, not a 404
    note: Responses are bare, {data} or {data,total} depending on endpoint - always go through unwrap()/page()

  - id: bazarr-pagination-mandatory
    description: Bazarr listing endpoints have no server-side default page size
    check: Every listing call sends start and length; measured unpaginated cost is 60-90s and megabytes
    note: Never add a tool that lists Bazarr rows without pagination

  - id: jellyseerr-status-enums
    description: Jellyseerr sends status as an integer and the enums are wider than older docs
    check: MediaRequestStatus is 1-5 including COMPLETED=5; MediaStatus is 1-7 including BLOCKLISTED and DELETED
    note: Read from the running build, not documentation. COMPLETED=5 is the most common value on a real instance.

  - id: jellyseerr-requests-have-no-title
    description: A Jellyseerr request carries only a tmdbId, never a title
    check: Titles cost one extra lookup per row, exposed as includeTitles rather than done invisibly
    note: A failed title lookup must return undefined, never fail the listing

  - id: chaptarr-provider-ids
    description: Chaptarr local row ids change when metadata is repaired or merged
    check: Every Chaptarr tool response reports foreign*Id (provider id) alongside the local id
    note: Chaptarr is beta 0.9.x and its contract doc runs ahead of the build - follow what the API returns, not the doc

  - id: trash-guides-integration
    description: TRaSH Guides tools use embedded guide data
    note: Guide data fetched from trash-guides.info at runtime
```

## Common Tasks

### Adding a New Tool

1. Add the client method to the service's class in `src/arr-client.ts`
2. Add the tool definition and its handler in `src/index.ts`
3. Classify it in the mutation/read-only table in `src/index.ts` (access-mode gating)
4. Update README.md "Available Tools" section

Do not hand-edit CHANGELOG.md — release-please writes it from commit subjects.

### Testing Changes

```bash
# Build first
npm run build

# Test with timeout (needs env vars set)
timeout 10 node dist/index.js
```

### Releasing

This fork distributes a **container image only** — there is no npm package.
`package.json` is `"private": true`, and a `prepublishOnly` script hard-fails any
`npm publish` (npm's own private check does not fire until after auth, so the
script is what actually enforces it).

Releases are driven by **release-please** from conventional commits, so do not
bump the version or write changelog entries by hand.

1. Land work on `main` with conventional commit subjects (`feat:`, `fix:`,
   `ci:`, `docs:`…). The subject line is what appears in the release notes.
2. release-please keeps a **release PR** open, showing the next version and the
   changelog it will write. Merge it when you want to release.
3. Merging it bumps `package.json`, updates `CHANGELOG.md`, tags `vX.Y.Z`, cuts
   the GitHub Release, and then **calls** `release.yml` to build and push
   `ghcr.io/davidgibbons/mcp-arr` (amd64 + arm64, tagged `X.Y.Z`, `X.Y`, `X`,
   `latest`).

Version bumps follow the commits: `fix:` → patch, `feat:` → minor, `feat!:` or a
`BREAKING CHANGE:` footer → major. To force a specific version, put
`Release-As: X.Y.Z` in a commit body.

`release-please.yml` **calls** `release.yml` rather than letting its tag push
trigger it, because a tag created by a workflow using `GITHUB_TOKEN` does not
trigger other workflows. Wiring them together directly keeps the project free of
a stored PAT whose only job would be to defeat that rule. `release.yml` still
accepts a hand-cut tag or a `workflow_dispatch` for a manual rebuild.

## API Patterns

All *arr services follow similar REST patterns:
- GET `/api/v3/{resource}` - List all
- GET `/api/v3/{resource}/{id}` - Get one
- POST `/api/v3/{resource}` - Create
- PUT `/api/v3/{resource}/{id}` - Update
- DELETE `/api/v3/{resource}/{id}` - Delete
- POST `/api/v3/command` - Trigger actions (search, refresh, etc.)

## Fork

This repo is a fork of [aplaceforallmystuff/mcp-arr](https://github.com/aplaceforallmystuff/mcp-arr)
(MIT, © Jim Christian). Upstream is deliberately scoped to Sonarr/Radarr/Lidarr/Prowlarr;
this fork carries the wider *arr stack. `main` here is the primary branch — do not
assume upstream will take changes.

**Do not open PRs or issues against upstream.** Three are already pending there
(#41 empty response bodies, #42 Whisparr, #43 duplicate Lidarr tools) and that is
enough unsolicited work sitting in someone else's queue. Nothing further goes
upstream unless the maintainer asks for it.

Fixes to shared code paths still land here as their own commits, separate from
service-expansion work, so that *if* upstream ever wants one it is easy to lift.
Keep the `upstream` remote for pulling his fixes down.
