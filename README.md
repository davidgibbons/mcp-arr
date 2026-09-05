# MCP *arr Server

![Architecture](docs/mcp-arr-architecture-diagram.png)

<!-- <p align="center">
  <img src="docs/mcp-arr-logo.png" alt="MCP *arr Server" width="400">
</p> -->

[![Oathe Security](https://img.shields.io/endpoint?url=https%3A%2F%2Faudit-engine.oathe.ai%2Fapi%2Fbadge%2Fdavidgibbons%2Fmcp-arr&style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nd2hpdGUnPjxwYXRoIGQ9J00xMiAyQzkuMjQgMiA3IDQuMjQgNyA3djNINmMtMS4xIDAtMiAuOS0yIDJ2OGMwIDEuMS45IDIgMiAyaDEyYzEuMSAwIDItLjkgMi0ydi04YzAtMS4xLS45LTItMi0yaC0xVjdjMC0yLjc2LTIuMjQtNS01LTV6bTMgMTBIOVY3YzAtMS42NiAxLjM0LTMgMy0zczMgMS4zNCAzIDN2M3onLz48L3N2Zz4=&labelColor=000000&cacheSeconds=3600)](https://oathe.ai/report/davidgibbons/mcp-arr)
[![Container](https://img.shields.io/badge/ghcr.io-davidgibbons%2Fmcp--arr-blue?logo=docker&logoColor=white)](https://github.com/davidgibbons/mcp-arr/pkgs/container/mcp-arr)
[![CI](https://github.com/davidgibbons/mcp-arr/actions/workflows/ci.yml/badge.svg)](https://github.com/davidgibbons/mcp-arr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

MCP server for the [*arr media management suite](https://wiki.servarr.com/) - Sonarr, Radarr, Lidarr, Prowlarr, Whisparr, Chaptarr, Jellyseerr, and Bazarr.

Supports both local `stdio` mode for Claude/Codex-style clients and remote HTTP mode for hosted MCP clients such as ChatGPT connectors.

> **This is a fork.** It continues from [aplaceforallmystuff/mcp-arr](https://github.com/aplaceforallmystuff/mcp-arr) (MIT, © Jim Christian), whose maintainer has deliberately scoped that project to Sonarr/Radarr/Lidarr/Prowlarr. This fork covers the wider *arr stack — Whisparr, Chaptarr (books), Jellyseerr (requests) and Bazarr (subtitles) today, more to come. Fixes that aren't scope-related are still sent upstream.
>
> Distributed as a **container image only**; there is no npm package for this fork.

## Why Use This?

- **Unified media management** - Control all your *arr applications from one interface
- **Natural language queries** - Ask about your library in plain English
- **Cross-service search** - Find content across TV, movies, and music simultaneously
- **Download monitoring** - Check queue status and progress across all services
- **Calendar integration** - See upcoming releases for all media types
- **Configuration review** - Get AI-powered suggestions for optimizing your setup
- **Flexible configuration** - Enable only the services you use

## Features

| Category | Capabilities |
|----------|-------------|
| **Sonarr (TV)** | List series, view episodes, search shows, trigger downloads, check queue, view calendar, review setup |
| **Radarr (Movies)** | List movies, search films, trigger downloads, check queue, view releases, review setup |
| **Lidarr (Music)** | List artists, view albums, search musicians, trigger downloads, check queue, view calendar, review setup |
| **Prowlarr (Indexers)** | List indexers, search across all trackers, test health, view statistics |
| **Whisparr (Adult)** | List library, search sites/scenes, trigger downloads, check queue, view calendar, review setup - works with both V2 and V3 (Eros) |
| **Chaptarr (Books)** | List authors/books/series/editions, search, add authors, trigger downloads, check queue and missing, review setup - audiobooks and eBooks in one instance |
| **Jellyseerr (Requests)** | Triage media requests: list by state, approve or decline, review issues, see who is asking for what |
| **Bazarr (Subtitles)** | Find episodes/movies missing subtitles, check provider health, manual subtitle search, review history and language profiles |
| **Cross-Service** | Status check, unified search across all configured services |
| **Configuration** | Quality profiles, download clients, naming conventions, health checks, storage info |
| **TRaSH Guides** | Reference quality profiles, custom formats, naming conventions, compare against recommendations |

## Prerequisites

- Node.js 24+ (only needed to run from source; the container image bundles its own)
- At least one *arr application running with API access:
  - [Sonarr](https://sonarr.tv/) for TV series
  - [Radarr](https://radarr.video/) for movies
  - [Lidarr](https://lidarr.audio/) for music
  - [Prowlarr](https://prowlarr.com/) for indexer management
  - [Whisparr](https://whisparr.com/) for adult media (V2 or V3 "Eros")
  - [Chaptarr](https://github.com/Chaptarr/chaptarr) for audiobooks and eBooks
  - [Jellyseerr](https://github.com/fallenbagel/jellyseerr) for media requests
  - [Bazarr](https://www.bazarr.media/) for subtitles (works alongside Sonarr and Radarr)

## Installation

This fork ships as a container image only. See [Docker](#docker) below for the
image, its tags, and stdio/HTTP invocations.

```bash
docker pull ghcr.io/davidgibbons/mcp-arr:latest
```

> **Reaching your *arr services from the container.** `http://localhost:8989` inside a
> container points at the *container*, not your host. Use `http://host.docker.internal:8989`
> (Docker Desktop on macOS/Windows), the service's LAN IP or container name (if they share a
> Docker network), or run with `--network host` on Linux.

### From source

```bash
git clone https://github.com/davidgibbons/mcp-arr.git
cd mcp-arr && npm ci && npm run build
node dist/index.js
```

### Remote HTTP Mode

By default the remote server listens on `127.0.0.1:3000` and serves MCP on `/mcp`.

Environment variables for remote mode:

- `MCP_TRANSPORT=http` to enable remote Streamable HTTP transport
- `HOST` to override the bind host (default `127.0.0.1`)
- `PORT` to override the port (default `3000`)
- `MCP_PATH` to override the MCP endpoint path (default `/mcp`)
- `MCP_ARR_HEALTH_INTERVAL` seconds between credential health probes (default `60`; `0` disables them)
- `MCP_ARR_ACCESS` set to `read-only` to drop the 24 mutating tools (default `read-write`; see [Access Mode](#access-mode))

### Health Endpoint

`GET /health` reports whether the configured API keys actually work, not just
whether they were supplied:

```json
{
  "status": "ok",
  "version": "1.8.0",
  "transport": "http",
  "access": "read-write",
  "toolCount": 131,
  "configuredServices": ["sonarr", "radarr"],
  "credentialsOk": false,
  "services": {
    "sonarr": { "status": "ok", "lastChecked": "2026-09-05T23:48:38.096Z" },
    "radarr": {
      "status": "unauthorized",
      "lastChecked": "2026-09-05T23:48:38.098Z",
      "error": "radarr API error: 401 Unauthorized - "
    }
  }
}
```

Each service is probed in the background on a timer and the result is cached, so
`/health` stays cheap enough for a container probe and never makes eight upstream
calls per request. Per-service `status` is one of:

| Status | Meaning |
|---|---|
| `ok` | The service answered and accepted the API key. |
| `unauthorized` | The service answered and **rejected** the key (401/403). |
| `unreachable` | Could not get an answer - DNS, refused, or no response within 10s. |
| `pending` | Not probed yet, or probing is disabled. |

`credentialsOk` is `true` only when every configured service is `ok`, `false`
when any is failing, and `null` while the first sweep is still running - never
checked is not the same as broken.

**Top-level `status` stays `ok` whenever the process itself is healthy**, and
`/health` always answers `200`. That is deliberate: it is wired to container
liveness probes, and failing it because someone else's Sonarr is down would
restart this server for an outage it cannot fix. Alert on `credentialsOk`
instead.

### Access Mode

`MCP_ARR_ACCESS` controls whether the mutating tools are available at all:

| Value | Behaviour |
|---|---|
| `read-write` (default) | All 131 tools. Unchanged from previous versions. |
| `read-only` | The 24 mutating tools are neither advertised nor callable. |

```bash
docker run --rm -p 3000:3000 \
  -e MCP_TRANSPORT=http -e HOST=0.0.0.0 \
  -e MCP_ARR_ACCESS=read-only \
  -e SONARR_URL=http://host.docker.internal:8989 \
  -e SONARR_API_KEY=your-sonarr-api-key \
  ghcr.io/davidgibbons/mcp-arr:latest
```

Use it for anything you would not trust to start a download or delete a queue
item — an assistant answering "why is this import stuck", a shared connector, or
an agent you are still learning to trust. Reads are untouched, including the
TRaSH Guides reference tools.

The mode is enforced on **both** `tools/list` and `tools/call`, so a client that
already knows a tool name — hardcoded, or remembered from an earlier session —
still cannot invoke it. `GET /health` reports the active mode and the resulting
tool count, and an invalid value exits at startup rather than quietly falling
back to read-write.

### Docker

Prebuilt images are published to GitHub Container Registry on every release. You do not need to
build anything:

```bash
docker pull ghcr.io/davidgibbons/mcp-arr:latest
```

Tags follow the release version — `latest`, `1`, `1.7`, and each exact version such as `1.7.3`.
Pin to a major or minor tag if you want updates without surprises.

Run in local stdio mode:

```bash
docker run --rm -i \
  -e SONARR_URL=http://host.docker.internal:8989 \
  -e SONARR_API_KEY=your-sonarr-api-key \
  ghcr.io/davidgibbons/mcp-arr:latest
```

Run in remote HTTP mode:

```bash
docker run --rm -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e SONARR_URL=http://host.docker.internal:8989 \
  -e SONARR_API_KEY=your-sonarr-api-key \
  ghcr.io/davidgibbons/mcp-arr:latest
```

Minimal `docker-compose.yml`:

```yaml
services:
  mcp-arr:
    image: ghcr.io/davidgibbons/mcp-arr:latest
    ports:
      - "3000:3000"
    environment:
      MCP_TRANSPORT: http
      HOST: 0.0.0.0
      PORT: 3000
      SONARR_URL: http://host.docker.internal:8989
      SONARR_API_KEY: your-sonarr-api-key
      RADARR_URL: http://host.docker.internal:7878
      RADARR_API_KEY: your-radarr-api-key
```

#### Building it yourself

Only needed if you are developing against a change that is not released yet:

```bash
docker build -t mcp-arr .
```

### From Source

```bash
git clone https://github.com/davidgibbons/mcp-arr.git
cd mcp-arr
npm install
npm run build
```

## Configuration

### Getting API Keys

Each *arr application has an API key in Settings > General > Security:

1. Open your *arr application's web interface
2. Go to **Settings** > **General**
3. Find the **API Key** under the Security section
4. Copy the API key for use in configuration

### For Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "arr": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SONARR_URL", "-e", "SONARR_API_KEY", "-e", "RADARR_URL", "-e", "RADARR_API_KEY", "-e", "LIDARR_URL", "-e", "LIDARR_API_KEY", "-e", "PROWLARR_URL", "-e", "PROWLARR_API_KEY", "-e", "WHISPARR_URL", "-e", "WHISPARR_API_KEY", "-e", "CHAPTARR_URL", "-e", "CHAPTARR_API_KEY", "-e", "JELLYSEERR_URL", "-e", "JELLYSEERR_API_KEY", "-e", "BAZARR_URL", "-e", "BAZARR_API_KEY", "ghcr.io/davidgibbons/mcp-arr:latest"],
      "env": {
        "SONARR_URL": "http://host.docker.internal:8989",
        "SONARR_API_KEY": "your-sonarr-api-key",
        "RADARR_URL": "http://host.docker.internal:7878",
        "RADARR_API_KEY": "your-radarr-api-key",
        "LIDARR_URL": "http://host.docker.internal:8686",
        "LIDARR_API_KEY": "your-lidarr-api-key",
        "PROWLARR_URL": "http://host.docker.internal:9696",
        "PROWLARR_API_KEY": "your-prowlarr-api-key",
        "WHISPARR_URL": "http://host.docker.internal:6969",
        "WHISPARR_API_KEY": "your-whisparr-api-key",
        "CHAPTARR_URL": "http://host.docker.internal:8789",
        "CHAPTARR_API_KEY": "your-chaptarr-api-key",
        "JELLYSEERR_URL": "http://host.docker.internal:5055",
        "JELLYSEERR_API_KEY": "your-jellyseerr-api-key",
        "BAZARR_URL": "http://host.docker.internal:6767",
        "BAZARR_API_KEY": "your-bazarr-api-key"
      }
    }
  }
}
```

### For Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "arr": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SONARR_URL", "-e", "SONARR_API_KEY", "-e", "RADARR_URL", "-e", "RADARR_API_KEY", "ghcr.io/davidgibbons/mcp-arr:latest"],
      "env": {
        "SONARR_URL": "http://host.docker.internal:8989",
        "SONARR_API_KEY": "your-sonarr-api-key",
        "RADARR_URL": "http://host.docker.internal:7878",
        "RADARR_API_KEY": "your-radarr-api-key"
      }
    }
  }
}
```

**Note**: Only configure the services you have running. The server automatically detects which services are available based on the environment variables you provide.

**TRaSH-only mode**: if you don’t configure any *arr services, the server still starts and exposes the TRaSH Guides reference tools plus generic `search` and `fetch`.

## ChatGPT / Remote MCP

To use `mcp-arr` with ChatGPT, run the server in remote HTTP mode on a reachable host and connect ChatGPT to the `/mcp` endpoint.

The server now exposes the generic `search` and `fetch` tools expected by ChatGPT-style remote MCP integrations:

- `search` discovers matching *arr media and TRaSH profiles
- `fetch` returns structured detail for a selected search result

The existing service-specific tools remain available for richer local or power-user workflows.

## Usage Examples

### Library Management
- "Show me all my TV series"
- "What movies do I have in Radarr?"
- "List all artists in my music library"

### Searching & Adding Content
- "Search for sci-fi shows on Sonarr"
- "Find action movies from the 90s"
- "Add this show to my TV library"
- "Add that movie to Radarr"
- "Search for jazz albums and add this artist"
- "Add this movie with my '4k' tag"
- "What tags do I have in Sonarr?"

### Download Queue
- "What's downloading right now?"
- "Check the Sonarr queue"
- "Show Radarr download progress"

### Upcoming Releases
- "What TV episodes are coming this week?"
- "Show upcoming movie releases"
- "Any new albums coming out this month?"

### Downloading Content
- "What episodes of this show am I missing?"
- "Download the missing episodes for that series"
- "Search for this specific movie"
- "Grab that album I'm missing"

### Indexer Management
- "Are my indexers healthy?"
- "How are my indexers performing?"
- "Test all my Prowlarr indexers"

### Configuration Review
- "Review my Sonarr setup and suggest improvements"
- "Show me my quality profiles in Radarr"
- "Are there any health issues with my Lidarr?"
- "What naming convention am I using for TV shows?"
- "Help me understand my quality profiles - why am I not getting 4K?"
- "Check my download client configuration"
- "How much free space do I have on my root folders?"

### Cross-Service
- "Check status of all my *arr services"
- "Search for 'comedy' across all services"

## Available Tools

Every tool is published with [MCP tool annotations](https://modelcontextprotocol.io/specification/server/tools#tool-annotations),
so a client can tell reads from writes without parsing descriptions:

| Annotation | Meaning here |
|---|---|
| `readOnlyHint: true` | Changes nothing. 107 of the 131 tools. |
| `readOnlyHint: false` | Changes state in an *arr service. 24 tools. |
| `destructiveHint: true` | Removes something or irreversibly commits it: `radarr_delete_queue_item`, `whisparr_delete_item`, `radarr_update_movie`, `jellyseerr_approve_request`, `jellyseerr_decline_request`. |
| `openWorldHint: true` | Reaches a third party — metadata providers, indexers, subtitle providers, the TRaSH Guides repo. Slow and rate-limited. |

The 24 writing tools add library rows (`*_add_*`), trigger real downloads
(`*_search_missing`, `radarr_search_movie`, `chaptarr_trigger_book_search`, …),
refresh or rescan items, and approve or decline Jellyseerr requests.

> **Watch the verb.** `sonarr_search`, `radarr_search`, `lidarr_search`,
> `whisparr_search`, `chaptarr_search` and `jellyseerr_search` are metadata
> **lookups** and change nothing. But `sonarr_search_missing`,
> `sonarr_search_episode`, `radarr_search_movie`, `radarr_search_movies`,
> `lidarr_search_album`, `lidarr_search_missing`, `whisparr_search_item` and
> `chaptarr_search_missing` **trigger real downloads**. Same verb, opposite blast
> radius — which is exactly why the annotations are worth reading instead of the
> names.

### General Tools

| Tool | Description |
|------|-------------|
| `arr_status` | Get connection status for all configured *arr services |
| `arr_search_all` | Search across all configured services simultaneously |
| `search` | Generic discovery tool for remote MCP clients such as ChatGPT |
| `fetch` | Generic detail-fetch tool for items returned by `search` |

### Sonarr Tools (TV)

| Tool | Description |
|------|-------------|
| `sonarr_get_series` | List all TV series in your library |
| `sonarr_search` | Search for TV series by name (returns tvdbId for adding) |
| `sonarr_add_series` | Add a TV series to Sonarr (supports tags) |
| `sonarr_get_root_folders` | Get available root folders for adding series |
| `sonarr_get_quality_profiles` | Get available quality profiles for adding series |
| `sonarr_get_queue` | View current download queue with `limit` and `offset` pagination |
| `sonarr_get_calendar` | See upcoming episodes |
| `sonarr_get_episodes` | List episodes for a series (shows missing vs available) |
| `sonarr_search_missing` | Trigger search for all missing episodes in a series |
| `sonarr_search_episode` | Trigger search for specific episode(s) |
| `sonarr_refresh_series` | Trigger a metadata refresh for a specific series in Sonarr |

### Radarr Tools (Movies)

| Tool | Description |
|------|-------------|
| `radarr_get_movies` | List all movies in your library |
| `radarr_search` | Search for movies by name (returns tmdbId for adding) |
| `radarr_add_movie` | Add a movie to Radarr (supports tags) |
| `radarr_get_root_folders` | Get available root folders for adding movies |
| `radarr_get_quality_profiles` | Get available quality profiles for adding movies |
| `radarr_get_queue` | View current download queue with `limit` and `offset` pagination |
| `radarr_get_calendar` | See upcoming releases |
| `radarr_search_movie` | Trigger search to download a movie in your library |
| `radarr_search_movies` | Bulk-trigger searches for multiple movie IDs at once |
| `radarr_update_movie` | Update a movie's quality profile, monitored status, minimum availability, tags, or path |
| `radarr_delete_queue_item` | Remove an item from the download queue (optionally blocklist the release) |
| `radarr_refresh_movie` | Trigger a metadata refresh for a specific movie in Radarr |

### Lidarr Tools (Music)

| Tool | Description |
|------|-------------|
| `lidarr_get_artists` | List all artists in your library |
| `lidarr_search` | Search for artists by name (returns foreignArtistId for adding) |
| `lidarr_add_artist` | Add an artist to Lidarr (supports tags) |
| `lidarr_get_root_folders` | Get available root folders for adding artists |
| `lidarr_get_quality_profiles` | Get available quality profiles for adding artists |
| `lidarr_get_metadata_profiles` | Get available metadata profiles for adding artists |
| `lidarr_get_queue` | View current download queue with `limit` and `offset` pagination |
| `lidarr_get_albums` | List albums for an artist (shows missing vs available) |
| `lidarr_search_album` | Trigger search for a specific album |
| `lidarr_search_missing` | Trigger search for all missing albums for an artist |
| `lidarr_get_calendar` | See upcoming album releases |

### Prowlarr Tools (Indexers)

| Tool | Description |
|------|-------------|
| `prowlarr_get_indexers` | List all configured indexers |
| `prowlarr_search` | Search across all indexers |
| `prowlarr_test_indexers` | Test all indexers and return health status |
| `prowlarr_get_stats` | Get indexer statistics (queries, grabs, failures) |

### Whisparr Tools (Adult)

Whisparr ships as two incompatible applications and the server detects which one you run from `/system/status`, so the same tools work against either. Library items are **sites** on V2 (a Sonarr fork) and **scenes** on V3 "Eros" (a Radarr fork); every response reports which variant answered.

| Tool | Description |
|------|-------------|
| `whisparr_get_library` | List the library with `limit`, `offset` and `search` filtering |
| `whisparr_search` | Search the metadata provider for sites (V2) or scenes (V3) |
| `whisparr_get_scenes` | List the scenes belonging to one site (**V2 only** - on V3 scenes are library items) |
| `whisparr_get_queue` | View current download queue with `limit` and `offset` pagination |
| `whisparr_get_calendar` | See upcoming releases |
| `whisparr_search_item` | Trigger a download search for one library item |
| `whisparr_refresh_item` | Trigger a metadata refresh for one library item (re-reads the metadata provider) |
| `whisparr_rescan_item` | Rescan a library item's folder so files already on disk are re-detected (re-reads the disk) |
| `whisparr_check_folder` | List the media files Whisparr can see in a folder on disk |
| `whisparr_add_item` | Add a site/scene by provider id, optionally attached to an existing folder |
| `whisparr_delete_item` | Delete a library row, always keeping files and never adding an import-list exclusion |

#### Recovering entries after `RemovedSeriesCheck` / `RemovedMovieCheck`

When an *arr health check reports entries removed upstream, the id the app holds usually got **re-keyed**, not deleted - and a row whose id died reports zero files while its folder still holds the media, which puts those files outside the library entirely. The tools above are shaped for that check:

1. `whisparr_search` the title. A result with `inLibrary: true` is a duplicate already sitting alongside the dead row; `inLibrary: false` with a `key` is a recoverable rematch; no results means the metadata really is gone.
2. `whisparr_get_library` flags rows with `holdsNoFiles: true`. Run `whisparr_check_folder` on each one's `path` - media found there is untracked, and that is the finding worth reporting.
3. To recover: `whisparr_delete_item` the dead row (files are always kept), `whisparr_add_item` the live `key` with `path` set to the existing folder, then `whisparr_rescan_item`.

### Chaptarr Tools (Books)

[Chaptarr](https://github.com/Chaptarr/chaptarr) is a Readarr fork that holds **audiobooks and eBooks in one instance**, so media type is part of identity rather than a filter: the same title can exist as an audiobook row *and* an eBook row, with separate monitoring, quality profiles and root folders. Library tools therefore take a `mediaType` of `all` (default), `audiobook` or `ebook`.

| Tool | Description |
|------|-------------|
| `chaptarr_get_authors` | List library authors with `limit`, `offset`, `search` and `mediaType` |
| `chaptarr_get_author` | Get one author, including per-media-type monitoring, profiles and statistics |
| `chaptarr_get_books` | List books, optionally for one author, with pagination and `mediaType` |
| `chaptarr_search` | Search the metadata pipeline for authors (returns `foreignAuthorId`) |
| `chaptarr_search_book` | Search the metadata pipeline for books by title or ISBN |
| `chaptarr_get_editions` | List the editions of one book - the per-format/publisher variants |
| `chaptarr_get_series` | List book series with reading order, optionally scoped to one author |
| `chaptarr_get_queue` | View the current download queue |
| `chaptarr_get_missing` | List monitored books with no file yet |
| `chaptarr_get_calendar` | See upcoming book releases |
| `chaptarr_get_metadata_profiles` | List metadata profiles (allowed languages and release kinds) |
| `chaptarr_add_author` | Add an author, on a required `mediaType` side of the library |
| `chaptarr_trigger_book_search` | Trigger a download search for specific books |
| `chaptarr_search_missing` | Trigger a search for missing books, optionally per author and media type |
| `chaptarr_refresh_author` | Refresh one author's metadata and rescan its files |

#### Provider ids vs local ids

Chaptarr's own [identity contract](https://github.com/Chaptarr/chaptarr/blob/develop/docs/API_IDENTITY_AND_LIFECYCLE.md) is explicit that **local row ids are handles, not identity** - they change when metadata is repaired, merged or reimported - while provider ids (`hc:`, `gr:`, `az:`, `ol:`, `gb:`) are durable.

Every Chaptarr tool reports both: `id` alongside `foreignAuthorId` / `foreignBookId` / `foreignSeriesId`, with books also carrying their discrete `providerIds` (Hardcover, Goodreads, ASIN, Audible). Anything held across turns or cached should key on the provider id, not `id`.

> **Chaptarr is beta** (0.9.x) and its published contract doc runs ahead of the shipped build - the doc describes `providerId`/`providerIdsAll` fields on books that 0.9.958 does not emit. These tools follow what the build actually returns.

### Jellyseerr Tools (Requests)

[Jellyseerr](https://github.com/fallenbagel/jellyseerr) takes media requests from users and hands approved ones to Sonarr and Radarr. It has no quality profiles or root folders of its own, so it is excluded from the shared configuration tools like Prowlarr.

| Tool | Description |
|------|-------------|
| `jellyseerr_get_summary` | Request counts by state plus open issues. **Start here.** |
| `jellyseerr_get_requests` | Requests newest first, filterable by state |
| `jellyseerr_get_request` | One request with its decoded status and requester |
| `jellyseerr_approve_request` | Approve a request — **starts a real download** |
| `jellyseerr_decline_request` | Decline a request |
| `jellyseerr_get_issues` | Issues users reported against media |
| `jellyseerr_search` | Search for movies/TV, returning tmdbIds |
| `jellyseerr_get_users` | Users with request counts and quotas |
| `jellyseerr_review_setup` | Version, counts, issues and user count in one call |

#### Status is numeric, and wider than the docs suggest

Jellyseerr sends status as an integer. Read from a running 3.3.0 build, `MediaRequestStatus` is `PENDING=1, APPROVED=2, DECLINED=3, FAILED=4, COMPLETED=5` — **`COMPLETED=5` is absent from the commonly-cited four-value set and is the most frequent value on a real instance**, so treating 5 as unknown would mislabel the majority of rows. `MediaStatus` runs 1–7 including `BLOCKLISTED` and `DELETED`.

Every response reports both the raw number and the decoded name, so a reader does not have to memorise the enum and the number can still be matched against the API.

#### Requests carry no title

A request row holds only a `tmdbId` — there is no title anywhere in the payload. `jellyseerr_get_requests` therefore takes `includeTitles` (default `true`), which resolves each row's title in parallel. That is one extra request per row, bounded by the page size; set it to `false` for a fast id-only listing.

#### Approving starts a download

`jellyseerr_approve_request` is not a dry run: it hands the request to Sonarr or Radarr, which begins fetching. Declining only closes the request and removes nothing.

### Bazarr Tools (Subtitles)

[Bazarr](https://www.bazarr.media/) manages subtitles for an existing Sonarr/Radarr library rather than managing media itself, so it has no quality profiles or root folders and is excluded from the shared configuration tools, the same way Prowlarr is.

Rows carry `sonarrSeriesId` / `sonarrEpisodeId` or `radarrId` — the same ids the Sonarr and Radarr tools here take — so a missing subtitle traces straight back to the episode that owns it.

| Tool | Description |
|------|-------------|
| `bazarr_get_summary` | Headline counts: episodes/movies missing subtitles, unhealthy providers, Sonarr/Radarr connection state. **Start here.** |
| `bazarr_get_wanted_episodes` | Episodes missing wanted subtitles, with the languages still missing |
| `bazarr_get_wanted_movies` | Movies missing wanted subtitles |
| `bazarr_get_providers` | Provider health, with unhealthy providers called out separately |
| `bazarr_get_episode_history` | Recent episode subtitle activity - provider, language, match score |
| `bazarr_get_movie_history` | Recent movie subtitle activity |
| `bazarr_get_series` | Series Bazarr tracks, with language profile and missing counts |
| `bazarr_get_movies` | Movies Bazarr tracks |
| `bazarr_get_episodes` | Every episode of one series, with subtitles present and missing |
| `bazarr_search_episode_subtitles` | Ask every provider what exists for one episode (no download) |
| `bazarr_search_movie_subtitles` | Same for a movie |
| `bazarr_get_language_profiles` | Which languages are wanted, and whether forced/HI count |
| `bazarr_review_setup` | Full configuration review in one call |

#### Pagination is mandatory, not optional

Bazarr's listing endpoints have no server-side default page size, and asking for everything is not viable. Measured against a real library: `/series` took **72s for 1.1MB**, `/episodes/wanted` **76s for 2.1MB**, and `/movies` did not finish within 90s. The same calls with `start`/`length` answer in **under a second**.

Every listing tool therefore always sends `start` and `length` (default 25, capped at 100) and reports `total`, `hasMore` and `nextStart` so you can page deliberately.

#### An empty subtitle search is ambiguous

`bazarr_search_episode_subtitles` returning nothing usually means a **provider is broken**, not that no subtitle exists — a provider in an error state produces an empty result rather than an error. The tools say so in a `note` on empty results, and `bazarr_get_providers` separates unhealthy providers from healthy ones for exactly this reason.

### Configuration Review Tools

These tools are available for Sonarr, Radarr, Lidarr, Whisparr, and Chaptarr. Replace `{service}` with the service name (e.g., `sonarr_get_quality_profiles`).

| Tool | Description |
|------|-------------|
| `{service}_get_quality_profiles` | Detailed quality profile information with allowed qualities and custom format scores |
| `{service}_get_health` | Health check warnings and issues detected by the application |
| `{service}_get_root_folders` | Storage paths, free space, and accessibility status |
| `{service}_get_remote_path_mappings` | Remote path mappings, each flagged with whether its host still matches a configured download client |
| `{service}_get_download_clients` | Download client configurations and settings |
| `{service}_get_naming` | File and folder naming conventions |
| `{service}_get_tags` | Tag definitions for content organization |
| `{service}_review_setup` | **Comprehensive configuration dump for AI-assisted setup analysis** |

The `{service}_review_setup` tool returns all configuration in a single call, enabling natural language conversations about optimizing your setup. Claude can analyze your quality profiles, suggest improvements, explain why certain content isn't being grabbed, and help configure complex settings like custom formats.

> **⚠️ Disclaimer**: The configuration review tools provide **read-only** access to your *arr settings. Any changes to your configuration must be made directly in the *arr application interfaces. The AI's suggestions are recommendations only - always back up your configuration before making significant changes. The maintainers are not responsible for any configuration changes, data loss, or other issues that may arise from following AI-generated recommendations.

### TRaSH Guides Tools

Access community-curated quality profiles, custom formats, and naming conventions from [TRaSH Guides](https://trash-guides.info/) directly through Claude or ChatGPT. These tools work without any *arr configuration - they fetch reference data from the TRaSH Guides GitHub repository.

| Tool | Description |
|------|-------------|
| `trash_list_profiles` | List available TRaSH quality profiles for Radarr or Sonarr |
| `trash_get_profile` | Get detailed profile with custom formats, scores, and quality settings |
| `trash_list_custom_formats` | List custom formats with optional category filter (hdr, audio, resolution, etc.) |
| `trash_get_naming` | Get recommended naming conventions for Plex, Emby, Jellyfin, or standard |
| `trash_get_quality_sizes` | Get recommended min/max/preferred sizes for each quality level |
| `trash_compare_profile` | Compare your profile against TRaSH recommendations (requires *arr configured) |
| `trash_compare_naming` | Compare your naming config against TRaSH recommendations (requires *arr configured) |

**Example usage:**
- "What quality profiles does TRaSH recommend for 4K movies?"
- "Show me the remux-web-1080p profile details"
- "Compare my Radarr profile 4 against the TRaSH uhd-bluray-web profile"
- "What naming convention should I use for Plex?"
- "List HDR-related custom formats for Radarr"

Data is cached for 1 hour to minimize GitHub API calls.

## Development

```bash
# Watch mode for development
npm run watch

# Build TypeScript
npm run build

# Run locally
SONARR_URL="http://host.docker.internal:8989" SONARR_API_KEY="your-key" node dist/index.js
```

## Troubleshooting

### "No *arr services configured"
Ensure you have set at least one pair of URL and API_KEY environment variables:
```bash
SONARR_URL="http://host.docker.internal:8989"
SONARR_API_KEY="your-api-key"
```

### "API error: 401 Unauthorized"
The API key is incorrect. Verify it in your *arr application under Settings > General > Security.

### "fetch failed" or "ECONNREFUSED"
The *arr application is not running or the URL is incorrect. Verify:
- The application is running
- The URL and port are correct
- There's no firewall blocking the connection

### "Sonarr/Radarr/etc not configured"
You tried to use a tool for a service that isn't configured. Add the corresponding URL and API_KEY environment variables.

## License

MIT - see [LICENSE](LICENSE) for details.

## Links

- [Servarr Wiki](https://wiki.servarr.com/) - Documentation for all *arr applications
- [TRaSH Guides](https://trash-guides.info/) - Quality profiles, custom formats, and setup guides
- [Sonarr API Docs](https://sonarr.tv/docs/api/)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/davidgibbons/mcp-arr)
