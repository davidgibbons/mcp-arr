#!/usr/bin/env node
/**
 * MCP Server for *arr Media Management Suite
 *
 * Provides tools for managing Sonarr (TV), Radarr (Movies), Lidarr (Music),
 * Prowlarr (Indexers), Whisparr (Adult) and Chaptarr (Books) through Claude Code.
 *
 * Environment variables:
 * - SONARR_URL, SONARR_API_KEY
 * - RADARR_URL, RADARR_API_KEY
 * - LIDARR_URL, LIDARR_API_KEY
 * - PROWLARR_URL, PROWLARR_API_KEY
 * - WHISPARR_URL, WHISPARR_API_KEY
 * - CHAPTARR_URL, CHAPTARR_API_KEY
 * - JELLYSEERR_URL, JELLYSEERR_API_KEY
 * - BAZARR_URL, BAZARR_API_KEY
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  SonarrClient,
  RadarrClient,
  LidarrClient,
  ProwlarrClient,
  WhisparrClient,
  ChaptarrClient,
  BazarrClient,
  BazarrWantedEpisode,
  BazarrWantedMovie,
  JellyseerrClient,
  JellyseerrRequest,
  parseJellyseerrFilter,
  JELLYSEERR_REQUEST_STATUS,
  JELLYSEERR_MEDIA_STATUS,
  parseChaptarrMediaType,
  ChaptarrMediaType,
  ChaptarrAuthor,
  ChaptarrBook,
  whisparrItemKey,
  whisparrFileCount,
  whisparrSizeOnDisk,
  ArrService,
  ProbeStatus,
} from "./arr-client.js";
import { trashClient, TrashService } from "./trash-client.js";

// Read from package.json rather than hardcoding, so the version reported to
// clients can never drift from the released version. package.json sits at the
// package root in every distribution: npm always ships it, and the Dockerfile
// copies it alongside dist/.
function readServerVersion(): string {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, "utf8")) as { version?: string };
    if (pkg.version) return pkg.version;
    console.error("[mcp-arr] package.json has no version field");
  } catch (error) {
    console.error(
      `[mcp-arr] could not read version from package.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return "0.0.0-unknown";
}

const SERVER_VERSION = readServerVersion();
const TRANSPORT_MODE = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();
const HTTP_HOST = process.env.HOST || "127.0.0.1";
const HTTP_PORT = Number(process.env.PORT || "3000");
const HTTP_PATH = process.env.MCP_PATH || "/mcp";

// Access mode gates the mutating tools (see MUTATING_TOOLS below). Defaults to
// read-write, so this changes nothing for an existing deployment.
type AccessMode = "read-write" | "read-only";

function parseAccessMode(raw: string | undefined): AccessMode {
  // Env vars are commonly written with underscores, so accept read_only too
  // rather than exiting over a separator.
  const value = (raw || "read-write").toLowerCase().replace(/_/g, "-");
  if (value === "read-write" || value === "read-only") {
    return value;
  }
  // Fail loudly. Falling back to read-write because a value was misspelled
  // would hand out the mutating tools to someone who asked for a reader.
  console.error(
    `Invalid MCP_ARR_ACCESS "${raw}" - expected "read-write" or "read-only".`,
  );
  process.exit(1);
}

const ACCESS_MODE: AccessMode = parseAccessMode(process.env.MCP_ARR_ACCESS);

// Configuration from environment
interface ServiceConfig {
  name: ArrService;
  displayName: string;
  url?: string;
  apiKey?: string;
}

const services: ServiceConfig[] = [
  { name: 'sonarr', displayName: 'Sonarr (TV)', url: process.env.SONARR_URL, apiKey: process.env.SONARR_API_KEY },
  { name: 'radarr', displayName: 'Radarr (Movies)', url: process.env.RADARR_URL, apiKey: process.env.RADARR_API_KEY },
  { name: 'lidarr', displayName: 'Lidarr (Music)', url: process.env.LIDARR_URL, apiKey: process.env.LIDARR_API_KEY },
  { name: 'prowlarr', displayName: 'Prowlarr (Indexers)', url: process.env.PROWLARR_URL, apiKey: process.env.PROWLARR_API_KEY },
  { name: 'whisparr', displayName: 'Whisparr (Adult)', url: process.env.WHISPARR_URL, apiKey: process.env.WHISPARR_API_KEY },
  { name: 'chaptarr', displayName: 'Chaptarr (Books)', url: process.env.CHAPTARR_URL, apiKey: process.env.CHAPTARR_API_KEY },
  { name: 'jellyseerr', displayName: 'Jellyseerr (Requests)', url: process.env.JELLYSEERR_URL, apiKey: process.env.JELLYSEERR_API_KEY },
  { name: 'bazarr', displayName: 'Bazarr (Subtitles)', url: process.env.BAZARR_URL, apiKey: process.env.BAZARR_API_KEY },
];

// Check which services are configured
const configuredServices = services.filter(s => s.url && s.apiKey);

// Initialize clients for configured services
const clients: {
  sonarr?: SonarrClient;
  radarr?: RadarrClient;
  lidarr?: LidarrClient;
  prowlarr?: ProwlarrClient;
  whisparr?: WhisparrClient;
  chaptarr?: ChaptarrClient;
  jellyseerr?: JellyseerrClient;
  bazarr?: BazarrClient;
} = {};

for (const service of configuredServices) {
  const config = { url: service.url!, apiKey: service.apiKey! };
  switch (service.name) {
    case 'sonarr':
      clients.sonarr = new SonarrClient(config);
      break;
    case 'radarr':
      clients.radarr = new RadarrClient(config);
      break;
    case 'lidarr':
      clients.lidarr = new LidarrClient(config);
      break;
    case 'prowlarr':
      clients.prowlarr = new ProwlarrClient(config);
      break;
    case 'whisparr':
      clients.whisparr = new WhisparrClient(config);
      break;
    case 'chaptarr':
      clients.chaptarr = new ChaptarrClient(config);
      break;
    case 'jellyseerr':
      clients.jellyseerr = new JellyseerrClient(config);
      break;
    case 'bazarr':
      clients.bazarr = new BazarrClient(config);
      break;
  }
}


// --- Credential health probe -------------------------------------------------
//
// `configuredServices` only says which URL + API key pairs were supplied. It is
// the same whether every key is valid or every key is garbage, so /health used
// to answer `ok` for a completely broken server and any readiness probe pointed
// at it stayed green. Tool discovery is no better: tools register on config
// presence, so a healthy tool list proves nothing about the keys either.
//
// This polls each configured service on a timer and caches the outcome. /health
// then reads the cache, so it stays cheap enough for a probe every few seconds
// and never fans out eight upstream calls per request.

interface ServiceHealth {
  status: ProbeStatus | "pending";
  lastChecked: string | null;
  error?: string;
}

// 0 disables the background probe entirely, for anyone who would rather not
// have the server talking to their *arr apps on a timer.
const HEALTH_INTERVAL_SECONDS = Number(process.env.MCP_ARR_HEALTH_INTERVAL ?? "60");

const serviceHealth = new Map<ArrService, ServiceHealth>(
  configuredServices.map((service) => [
    service.name,
    { status: "pending", lastChecked: null } as ServiceHealth,
  ]),
);

let sweepInFlight = false;

async function runHealthSweep(): Promise<void> {
  // Probes run on a timer, so a slow or hanging service must not stack up
  // overlapping sweeps behind it.
  if (sweepInFlight) return;
  sweepInFlight = true;
  try {
    await Promise.all(configuredServices.map(async (service) => {
      const client = clients[service.name];
      if (!client) return;
      const result = await client.probe();
      serviceHealth.set(service.name, {
        status: result.status,
        lastChecked: new Date().toISOString(),
        ...(result.error ? { error: result.error } : {}),
      });
    }));
  } finally {
    sweepInFlight = false;
  }
}

function startHealthProbe(): void {
  if (!Number.isFinite(HEALTH_INTERVAL_SECONDS) || HEALTH_INTERVAL_SECONDS <= 0) {
    console.error("[mcp-arr] credential health probe disabled (MCP_ARR_HEALTH_INTERVAL <= 0)");
    return;
  }
  // Kick off immediately so /health is answering something real within a second
  // of startup, then repeat. Deliberately not awaited: a slow *arr must not
  // delay the server accepting connections.
  void runHealthSweep();
  setInterval(() => void runHealthSweep(), HEALTH_INTERVAL_SECONDS * 1000).unref();
}

/**
 * true  - every configured service accepted its key
 * false - at least one is rejecting the key or unreachable
 * null  - the first sweep has not finished yet, so we genuinely do not know
 */
function credentialsOk(): boolean | null {
  const results = [...serviceHealth.values()];
  if (results.every((r) => r.status === "ok")) return true;
  if (results.some((r) => r.status === "unauthorized" || r.status === "unreachable")) return false;
  return null;
}

// Build tools based on configured services
const TOOLS: Tool[] = [
  // General tool available for all
  {
    name: "arr_status",
    description: configuredServices.length > 0
      ? `Get status of all configured *arr services. Currently configured: ${configuredServices.map(s => s.displayName).join(', ')}`
      : "Get status of all supported *arr services. No local *arr services are currently configured, but TRaSH reference tools remain available.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search",
    description: "Search across configured *arr libraries plus TRaSH Guides reference profiles. This is the primary discovery tool for remote MCP clients such as ChatGPT.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural-language search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch",
    description: "Fetch a specific item returned by search. Accepts an opaque item id from the search tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "Opaque result id returned by search",
        },
      },
      required: ["id"],
    },
  },
];

// Configuration review tools for each service
// These are added dynamically based on configured services

// Helper function to create config tools for a service
function addConfigTools(serviceName: string, displayName: string) {
  TOOLS.push(
    {
      name: `${serviceName}_get_quality_profiles`,
      description: `Get detailed quality profiles from ${displayName}. Shows allowed qualities, upgrade settings, and custom format scores.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_health`,
      description: `Get health check warnings and issues from ${displayName}. Shows any problems detected by the application.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_root_folders`,
      description: `Get root folders and storage info from ${displayName}. Shows paths, free space, and unmapped folders.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_remote_path_mappings`,
      description: `Get remote path mappings from ${displayName}, each flagged with whether its host still matches a configured download client. Mappings key on the client's host setting, so renaming or moving a client orphans its mappings and every import fails while the app looks healthy elsewhere.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_download_clients`,
      description: `Get download client configurations from ${displayName}. Shows configured clients and their settings.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_naming`,
      description: `Get file naming configuration from ${displayName}. Shows naming patterns for files and folders.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_get_tags`,
      description: `Get all tags defined in ${displayName}. Tags can be used to organize and filter content.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: `${serviceName}_review_setup`,
      description: `Get comprehensive configuration review for ${displayName}. Returns all settings for analysis: quality profiles, download clients, naming, storage, indexers, health warnings, and more. Use this to analyze the setup and suggest improvements.`,
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    }
  );
}

// Add config tools for each configured service (except Prowlarr which has different config)
if (clients.sonarr) addConfigTools('sonarr', 'Sonarr (TV)');
if (clients.radarr) addConfigTools('radarr', 'Radarr (Movies)');
if (clients.lidarr) addConfigTools('lidarr', 'Lidarr (Music)');
if (clients.whisparr) addConfigTools('whisparr', 'Whisparr (Adult)');
if (clients.chaptarr) addConfigTools('chaptarr', 'Chaptarr (Books)');

// Sonarr tools
if (clients.sonarr) {
  TOOLS.push(
    {
      name: "sonarr_get_series",
      description: "Get TV series from Sonarr library with optional pagination and title filtering. Defaults to limit=25 to avoid very large responses. Use offset to fetch additional pages.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of series to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of series to skip before returning results (default: 0)",
          },
          search: {
            type: "string",
            description: "Optional case-insensitive title filter",
          },
        },
        required: [],
      },
    },
    {
      name: "sonarr_search",
      description: "Search for TV series by name. Returns results with tvdbId needed for sonarr_add_series.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: {
            type: "string",
            description: "Search term (show name)",
          },
        },
        required: ["term"],
      },
    },
    {
      name: "sonarr_get_queue",
      description: "Get Sonarr download queue. Supports pagination with limit and offset.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of queue items to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of queue items to skip before returning results (default: 0)",
          },
        },
        required: [],
      },
    },
    {
      name: "sonarr_get_calendar",
      description: "Get upcoming TV episodes from Sonarr",
      inputSchema: {
        type: "object" as const,
        properties: {
          days: {
            type: "number",
            description: "Number of days to look ahead (default: 7)",
          },
        },
        required: [],
      },
    },
    {
      name: "sonarr_get_episodes",
      description: "Get episodes for a TV series. Shows which episodes are available and which are missing.",
      inputSchema: {
        type: "object" as const,
        properties: {
          seriesId: {
            type: "number",
            description: "Series ID to get episodes for",
          },
          seasonNumber: {
            type: "number",
            description: "Optional: filter to a specific season",
          },
        },
        required: ["seriesId"],
      },
    },
    {
      name: "sonarr_search_missing",
      description: "Trigger a search for all missing episodes in a series",
      inputSchema: {
        type: "object" as const,
        properties: {
          seriesId: {
            type: "number",
            description: "Series ID to search for missing episodes",
          },
        },
        required: ["seriesId"],
      },
    },
    {
      name: "sonarr_search_episode",
      description: "Trigger a search for specific episode(s)",
      inputSchema: {
        type: "object" as const,
        properties: {
          episodeIds: {
            type: "array",
            items: { type: "number" },
            description: "Episode ID(s) to search for",
          },
        },
        required: ["episodeIds"],
      },
    },
    {
      name: "sonarr_refresh_series",
      description: "Trigger a metadata refresh for a specific series in Sonarr",
      inputSchema: {
        type: "object" as const,
        properties: {
          seriesId: {
            type: "number",
            description: "Series ID to refresh",
          },
        },
        required: ["seriesId"],
      },
    },
    {
      name: "sonarr_add_series",
      description: "Add a TV series to Sonarr. Use sonarr_search first to find the tvdbId, and sonarr_get_root_folders / sonarr_get_quality_profiles to get valid values for rootFolderPath and qualityProfileId. Use sonarr_get_tags to get valid tag IDs.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tvdbId: {
            type: "number",
            description: "TVDB ID from sonarr_search results",
          },
          title: {
            type: "string",
            description: "Series title",
          },
          qualityProfileId: {
            type: "number",
            description: "Quality profile ID from sonarr_get_quality_profiles",
          },
          rootFolderPath: {
            type: "string",
            description: "Root folder path from sonarr_get_root_folders",
          },
          monitored: {
            type: "boolean",
            description: "Whether to monitor the series (default: true)",
          },
          seasonFolder: {
            type: "boolean",
            description: "Whether to use season folders (default: true)",
          },
          tags: {
            type: "array",
            items: { type: "number" },
            description: "Array of tag IDs from sonarr_get_tags (optional)",
          },
        },
        required: ["tvdbId", "title", "qualityProfileId", "rootFolderPath"],
      },
    },
  );
}

// Radarr tools
if (clients.radarr) {
  TOOLS.push(
    {
      name: "radarr_get_movies",
      description: "Get movies from Radarr library with optional pagination and title filtering. Defaults to limit=25 to avoid very large responses. Use offset to fetch additional pages.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of movies to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of movies to skip before returning results (default: 0)",
          },
          search: {
            type: "string",
            description: "Optional case-insensitive title filter",
          },
        },
        required: [],
      },
    },
    {
      name: "radarr_search",
      description: "Search for movies by name. Returns results with tmdbId needed for radarr_add_movie.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: {
            type: "string",
            description: "Search term (movie name)",
          },
        },
        required: ["term"],
      },
    },
    {
      name: "radarr_get_queue",
      description: "Get Radarr download queue. Supports pagination with limit and offset.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of queue items to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of queue items to skip before returning results (default: 0)",
          },
        },
        required: [],
      },
    },
    {
      name: "radarr_get_calendar",
      description: "Get upcoming movie releases from Radarr",
      inputSchema: {
        type: "object" as const,
        properties: {
          days: {
            type: "number",
            description: "Number of days to look ahead (default: 30)",
          },
        },
        required: [],
      },
    },
    {
      name: "radarr_search_movie",
      description: "Trigger a search to download a movie that's already in your library",
      inputSchema: {
        type: "object" as const,
        properties: {
          movieId: {
            type: "number",
            description: "Movie ID to search for",
          },
        },
        required: ["movieId"],
      },
    },
    {
      name: "radarr_refresh_movie",
      description: "Trigger a metadata refresh for a specific movie in Radarr",
      inputSchema: {
        type: "object" as const,
        properties: {
          movieId: {
            type: "number",
            description: "Movie ID to refresh",
          },
        },
        required: ["movieId"],
      },
    },
    {
      name: "radarr_add_movie",
      description: "Add a movie to Radarr. Use radarr_search first to find the tmdbId, and radarr_get_root_folders / radarr_get_quality_profiles to get valid values. Use radarr_get_tags to get valid tag IDs.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tmdbId: {
            type: "number",
            description: "TMDB ID from radarr_search results",
          },
          title: {
            type: "string",
            description: "Movie title",
          },
          qualityProfileId: {
            type: "number",
            description: "Quality profile ID from radarr_get_quality_profiles",
          },
          rootFolderPath: {
            type: "string",
            description: "Root folder path from radarr_get_root_folders",
          },
          monitored: {
            type: "boolean",
            description: "Whether to monitor the movie (default: true)",
          },
          minimumAvailability: {
            type: "string",
            enum: ["announced", "inCinemas", "released", "tba"],
            description: "When to consider the movie available (default: announced)",
          },
          tags: {
            type: "array",
            items: { type: "number" },
            description: "Array of tag IDs from radarr_get_tags (optional)",
          },
        },
        required: ["tmdbId", "title", "qualityProfileId", "rootFolderPath"],
      },
    },
    {
      name: "radarr_update_movie",
      description: "Update a movie in Radarr. Can change qualityProfileId, monitored status, minimumAvailability, tags, and path. Fetches the full movie object, applies your changes, and PUTs it back.",
      inputSchema: {
        type: "object" as const,
        properties: {
          movieId: {
            type: "number",
            description: "Movie ID to update",
          },
          qualityProfileId: {
            type: "number",
            description: "New quality profile ID (from radarr_get_quality_profiles)",
          },
          monitored: {
            type: "boolean",
            description: "Whether to monitor the movie",
          },
          minimumAvailability: {
            type: "string",
            enum: ["announced", "inCinemas", "released", "tba"],
            description: "When to consider the movie available",
          },
          tags: {
            type: "array",
            items: { type: "number" },
            description: "Replace all tags with this list of tag IDs",
          },
          path: {
            type: "string",
            description: "New file path for the movie",
          },
        },
        required: ["movieId"],
      },
    },
    {
      name: "radarr_delete_queue_item",
      description: "Remove an item from the Radarr download queue. Use radarr_get_queue to find queue item IDs. Can optionally blocklist the release to prevent re-grabbing.",
      inputSchema: {
        type: "object" as const,
        properties: {
          queueId: {
            type: "number",
            description: "Queue item ID (from radarr_get_queue)",
          },
          removeFromClient: {
            type: "boolean",
            description: "Also remove from download client (default: true)",
          },
          blocklist: {
            type: "boolean",
            description: "Add release to blocklist to prevent re-grabbing (default: false)",
          },
        },
        required: ["queueId"],
      },
    },
    {
      name: "radarr_search_movies",
      description: "Trigger a search for multiple movies at once. Accepts an array of movie IDs. Use this for bulk upgrade requests instead of calling radarr_search_movie one at a time.",
      inputSchema: {
        type: "object" as const,
        properties: {
          movieIds: {
            type: "array",
            items: { type: "number" },
            description: "Array of movie IDs to search for",
          },
        },
        required: ["movieIds"],
      },
    },
  );
}

// Lidarr tools
if (clients.lidarr) {
  TOOLS.push(
    {
      name: "lidarr_get_artists",
      description: "Get all artists in Lidarr library",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "lidarr_search",
      description: "Search for artists by name. Returns results with foreignArtistId needed for lidarr_add_artist.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: {
            type: "string",
            description: "Search term (artist name)",
          },
        },
        required: ["term"],
      },
    },
    {
      name: "lidarr_get_queue",
      description: "Get Lidarr download queue. Supports pagination with limit and offset.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of queue items to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of queue items to skip before returning results (default: 0)",
          },
        },
        required: [],
      },
    },
    {
      name: "lidarr_get_albums",
      description: "Get albums for an artist in Lidarr. Shows which albums are available and which are missing.",
      inputSchema: {
        type: "object" as const,
        properties: {
          artistId: {
            type: "number",
            description: "Artist ID to get albums for",
          },
        },
        required: ["artistId"],
      },
    },
    {
      name: "lidarr_search_album",
      description: "Trigger a search for a specific album to download",
      inputSchema: {
        type: "object" as const,
        properties: {
          albumId: {
            type: "number",
            description: "Album ID to search for",
          },
        },
        required: ["albumId"],
      },
    },
    {
      name: "lidarr_search_missing",
      description: "Trigger a search for all missing albums for an artist",
      inputSchema: {
        type: "object" as const,
        properties: {
          artistId: {
            type: "number",
            description: "Artist ID to search missing albums for",
          },
        },
        required: ["artistId"],
      },
    },
    {
      name: "lidarr_get_calendar",
      description: "Get upcoming album releases from Lidarr",
      inputSchema: {
        type: "object" as const,
        properties: {
          days: {
            type: "number",
            description: "Number of days to look ahead (default: 30)",
          },
        },
        required: [],
      },
    },
    {
      name: "lidarr_add_artist",
      description: "Add an artist to Lidarr. Use lidarr_search first to find the foreignArtistId, and lidarr_get_root_folders / lidarr_get_quality_profiles / lidarr_get_metadata_profiles to get valid values. Use lidarr_get_tags to get valid tag IDs.",
      inputSchema: {
        type: "object" as const,
        properties: {
          foreignArtistId: {
            type: "string",
            description: "Foreign artist ID (MusicBrainz ID) from lidarr_search results",
          },
          artistName: {
            type: "string",
            description: "Artist name",
          },
          qualityProfileId: {
            type: "number",
            description: "Quality profile ID from lidarr_get_quality_profiles",
          },
          metadataProfileId: {
            type: "number",
            description: "Metadata profile ID from lidarr_get_metadata_profiles",
          },
          rootFolderPath: {
            type: "string",
            description: "Root folder path from lidarr_get_root_folders",
          },
          monitored: {
            type: "boolean",
            description: "Whether to monitor the artist (default: true)",
          },
          tags: {
            type: "array",
            items: { type: "number" },
            description: "Array of tag IDs from lidarr_get_tags (optional)",
          },
        },
        required: ["foreignArtistId", "artistName", "qualityProfileId", "metadataProfileId", "rootFolderPath"],
      },
    },
    {
      name: "lidarr_get_metadata_profiles",
      description: "Get available metadata profiles for Lidarr. Use this to find valid metadataProfileId values when adding an artist.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    }
  );
}

// Prowlarr tools
if (clients.prowlarr) {
  TOOLS.push(
    {
      name: "prowlarr_get_indexers",
      description: "Get all configured indexers in Prowlarr",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "prowlarr_search",
      description: "Search across all Prowlarr indexers",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "prowlarr_test_indexers",
      description: "Test all indexers and return their health status",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "prowlarr_get_stats",
      description: "Get indexer statistics (queries, grabs, failures)",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    }
  );
}

// Whisparr tools
//
// Whisparr's library items are sites under V2 and scenes under V3, so the
// tools are named for the neutral "library item" and each response reports
// which variant answered.
if (clients.whisparr) {
  TOOLS.push(
    {
      name: "whisparr_get_library",
      description: "Get the Whisparr library with optional pagination and title filtering. Items are sites on Whisparr V2 and scenes on V3 (Eros). Defaults to limit=25 to avoid very large responses.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of items to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of items to skip before returning results (default: 0)",
          },
          search: {
            type: "string",
            description: "Optional case-insensitive title filter",
          },
        },
        required: [],
      },
    },
    {
      name: "whisparr_search",
      description: "Search Whisparr's metadata provider for sites (V2) or scenes (V3) by name.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: {
            type: "string",
            description: "Search term",
          },
        },
        required: ["term"],
      },
    },
    {
      name: "whisparr_get_scenes",
      description: "Get the scenes belonging to one site. Whisparr V2 only - on V3 (Eros) scenes are library items in their own right, so use whisparr_get_library instead.",
      inputSchema: {
        type: "object" as const,
        properties: {
          siteId: {
            type: "number",
            description: "Library id of the site",
          },
        },
        required: ["siteId"],
      },
    },
    {
      name: "whisparr_get_queue",
      description: "Get the Whisparr download queue. Supports pagination with limit and offset.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of queue items to return (default: 25, max: 100)",
          },
          offset: {
            type: "number",
            description: "Number of queue items to skip before returning results (default: 0)",
          },
        },
        required: [],
      },
    },
    {
      name: "whisparr_get_calendar",
      description: "Get upcoming Whisparr releases",
      inputSchema: {
        type: "object" as const,
        properties: {
          days: {
            type: "number",
            description: "Number of days to look ahead (default: 7)",
          },
        },
        required: [],
      },
    },
    {
      name: "whisparr_search_item",
      description: "Trigger a download search for one Whisparr library item (a site on V2, a scene on V3).",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemId: {
            type: "number",
            description: "Library id of the item, from whisparr_get_library",
          },
        },
        required: ["itemId"],
      },
    },
    {
      name: "whisparr_check_folder",
      description: "List the media files Whisparr can see in a folder on disk. Use it on a library row reporting zero files: files present there are media the app has stopped tracking (not renamed, not upgraded, not counted, not searched). An empty result means no media was found - the folder may be empty or may not exist.",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Absolute folder path, e.g. the path reported by whisparr_get_library",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "whisparr_delete_item",
      description: "Delete a library row. Files on disk are always kept and no import-list exclusion is added, so this is safe to use on a dead row whose media you intend to re-attach under a live id. It cannot be made to delete files.",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemId: {
            type: "number",
            description: "Library id of the item, from whisparr_get_library",
          },
        },
        required: ["itemId"],
      },
    },
    {
      name: "whisparr_add_item",
      description: "Add a site (V2) or scene (V3) by its provider id, from the key field of whisparr_search. Pass path to point the new row at a folder that already holds media - that is how a re-keyed entry is recovered - then call whisparr_rescan_item so the files are re-detected. Does not start a download search unless search is set.",
      inputSchema: {
        type: "object" as const,
        properties: {
          key: {
            type: "string",
            description: "Provider id from whisparr_search (tvdbId on V2, foreignId on V3)",
          },
          qualityProfileId: {
            type: "number",
            description: "Quality profile id, from whisparr_get_quality_profiles",
          },
          title: {
            type: "string",
            description: "Title from the lookup result",
          },
          path: {
            type: "string",
            description: "Existing folder to attach to. Use this to recover media filed under a dead id.",
          },
          rootFolderPath: {
            type: "string",
            description: "Root folder to create a new folder under, when not attaching to an existing path",
          },
          monitored: {
            type: "boolean",
            description: "Whether to monitor the item (default: true)",
          },
          search: {
            type: "boolean",
            description: "Trigger a download search after adding (default: false)",
          },
        },
        required: ["key", "qualityProfileId"],
      },
    },
    {
      name: "whisparr_rescan_item",
      description: "Rescan a library item's folder so files already on disk are re-detected. This is not whisparr_refresh_item: a refresh re-reads the metadata provider, a rescan re-reads the disk.",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemId: {
            type: "number",
            description: "Library id of the item",
          },
        },
        required: ["itemId"],
      },
    },
    {
      name: "whisparr_refresh_item",
      description: "Trigger a metadata refresh for one Whisparr library item.",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemId: {
            type: "number",
            description: "Library id of the item, from whisparr_get_library",
          },
        },
        required: ["itemId"],
      },
    }
  );
}

// Chaptarr tools
//
// Chaptarr is a Readarr fork holding audiobooks and eBooks in one instance.
// Media type is part of identity rather than a filter - the same title can be
// both an audiobook row and an eBook row - so library tools take a mediaType.
//
// Results report `foreignBookId`/`foreignAuthorId` (provider ids such as
// `hc:2707279`) alongside the local `id`. Provider ids are the durable
// identity; local ids can change when Chaptarr repairs or merges metadata, so
// anything cached across turns should key on the provider id.
if (clients.chaptarr) {
  TOOLS.push(
    {
      name: "chaptarr_get_authors",
      description: "Get authors from the Chaptarr library with optional pagination and name filtering. Defaults to limit=25 to avoid very large responses.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Maximum number of authors to return (default: 25, max: 100)" },
          offset: { type: "number", description: "Number of authors to skip before returning results (default: 0)" },
          search: { type: "string", description: "Optional case-insensitive author name filter" },
          mediaType: {
            type: "string",
            enum: ["all", "audiobook", "ebook"],
            description: "Which side of the library to scope to. Chaptarr keeps separate rows for the audiobook and eBook of the same title. Default: all.",
          },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_get_author",
      description: "Get one Chaptarr author by local id, including per-media-type monitoring, profiles and statistics.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authorId: { type: "number", description: "Local Chaptarr author id" },
        },
        required: ["authorId"],
      },
    },
    {
      name: "chaptarr_get_books",
      description: "Get books from the Chaptarr library, optionally for one author. Each book reports its mediaType, narrators and duration for audiobooks, and provider ids. Defaults to limit=25.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authorId: { type: "number", description: "Optional local author id to scope to" },
          limit: { type: "number", description: "Maximum number of books to return (default: 25, max: 100)" },
          offset: { type: "number", description: "Number of books to skip before returning results (default: 0)" },
          search: { type: "string", description: "Optional case-insensitive title filter" },
          mediaType: {
            type: "string",
            enum: ["all", "audiobook", "ebook"],
            description: "Which side of the library to scope to. Chaptarr keeps separate rows for the audiobook and eBook of the same title. Default: all.",
          },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_search",
      description: "Search Chaptarr's metadata pipeline for authors by name. Returns foreignAuthorId values needed to add an author.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: { type: "string", description: "Author name to look up" },
        },
        required: ["term"],
      },
    },
    {
      name: "chaptarr_search_book",
      description: "Search Chaptarr's metadata pipeline for books by title or ISBN.",
      inputSchema: {
        type: "object" as const,
        properties: {
          term: { type: "string", description: "Book title or ISBN to look up" },
        },
        required: ["term"],
      },
    },
    {
      name: "chaptarr_get_editions",
      description: "Get the editions of one Chaptarr book. Editions are the per-format/per-publisher variants Chaptarr tracks under a single book, and are how the audiobook and eBook of a title differ in practice.",
      inputSchema: {
        type: "object" as const,
        properties: {
          bookId: { type: "number", description: "Local Chaptarr book id" },
        },
        required: ["bookId"],
      },
    },
    {
      name: "chaptarr_get_series",
      description: "Get book series known to Chaptarr, optionally scoped to one author. Series carry the reading order Chaptarr uses to organise a library.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authorId: { type: "number", description: "Optional local author id to scope to" },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_get_queue",
      description: "Get the Chaptarr download queue with pagination.",
      inputSchema: {
        type: "object" as const,
        properties: {
          page: { type: "number", description: "Page number (default: 1)" },
          pageSize: { type: "number", description: "Records per page (default: 25, max: 100)" },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_get_missing",
      description: "Get monitored Chaptarr books that have no file yet, with pagination.",
      inputSchema: {
        type: "object" as const,
        properties: {
          page: { type: "number", description: "Page number (default: 1)" },
          pageSize: { type: "number", description: "Records per page (default: 25, max: 100)" },
          mediaType: {
            type: "string",
            enum: ["all", "audiobook", "ebook"],
            description: "Which side of the library to scope to. Chaptarr keeps separate rows for the audiobook and eBook of the same title. Default: all.",
          },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_get_calendar",
      description: "Get upcoming Chaptarr book releases in a date range.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "string", description: "Start date, ISO 8601 (e.g. 2026-09-01)" },
          end: { type: "string", description: "End date, ISO 8601 (e.g. 2026-09-30)" },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_add_author",
      description: "Add an author to Chaptarr. Requires a foreignAuthorId from chaptarr_search, and the media type decides which side of the library the author is created on - Chaptarr keeps audiobook and eBook settings separately.",
      inputSchema: {
        type: "object" as const,
        properties: {
          foreignAuthorId: { type: "string", description: "Provider id from chaptarr_search, e.g. hc:880167" },
          rootFolderPath: { type: "string", description: "Root folder path from chaptarr_get_root_folders" },
          qualityProfileId: { type: "number", description: "Quality profile id from chaptarr_get_quality_profiles" },
          metadataProfileId: { type: "number", description: "Metadata profile id from chaptarr_get_metadata_profiles" },
          mediaType: {
            type: "string",
            enum: ["audiobook", "ebook"],
            description: "Which side of the library to create the author on. Required - Chaptarr will not guess.",
          },
          monitored: { type: "boolean", description: "Whether to monitor for new books (default: true)" },
        },
        required: ["foreignAuthorId", "rootFolderPath", "qualityProfileId", "metadataProfileId", "mediaType"],
      },
    },
    {
      name: "chaptarr_get_metadata_profiles",
      description: "Get Chaptarr metadata profiles, which control which languages and release kinds are allowed into the library.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "chaptarr_trigger_book_search",
      description: "Trigger a download search for specific Chaptarr books by local book id.",
      inputSchema: {
        type: "object" as const,
        properties: {
          bookIds: {
            type: "array",
            items: { type: "number" },
            description: "Local Chaptarr book ids to search for",
          },
        },
        required: ["bookIds"],
      },
    },
    {
      name: "chaptarr_search_missing",
      description: "Trigger a download search for missing Chaptarr books, optionally scoped to one author and/or one media type.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authorId: { type: "number", description: "Optional local author id to scope the search to" },
          mediaType: {
            type: "string",
            enum: ["all", "audiobook", "ebook"],
            description: "Which side of the library to scope to. Chaptarr keeps separate rows for the audiobook and eBook of the same title. Default: all.",
          },
        },
        required: [],
      },
    },
    {
      name: "chaptarr_refresh_author",
      description: "Refresh one Chaptarr author's metadata and rescan its files.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authorId: { type: "number", description: "Local Chaptarr author id" },
        },
        required: ["authorId"],
      },
    }
  );
}

// Jellyseerr tools
//
// Jellyseerr sits in front of Sonarr and Radarr taking requests from users, so
// it has no quality profiles or root folders of its own and is excluded from
// addConfigTools() like Prowlarr and Bazarr.
//
// Two shapes matter. Status is numeric on the wire and the enums are wider
// than older docs suggest (COMPLETED=5 is the most common value on a real
// instance), so every response reports the decoded name next to the number.
// And a request carries no title, only a tmdbId, so titles cost one extra
// lookup per row - exposed as an explicit, bounded option rather than done
// invisibly.
if (clients.jellyseerr) {
  TOOLS.push(
    {
      name: "jellyseerr_get_summary",
      description: "Get Jellyseerr's request counts by state (pending, approved, processing, available, failed) plus open issue counts. Start here - it says whether anything needs attention before paging through hundreds of requests.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "jellyseerr_get_requests",
      description: "Get media requests, newest first. Use filter='pending' for the ones awaiting a decision. Requests carry only a tmdbId, so set includeTitles to resolve human titles - that costs one extra lookup per row and is bounded by the page size.",
      inputSchema: {
        type: "object" as const,
        properties: {
          filter: {
            type: "string",
            enum: ["all", "pending", "approved", "processing", "available", "unavailable", "failed", "deleted"],
            description: "Which requests to return (default: all)",
          },
          take: { type: "number", description: "Rows to return (default: 20, max: 50)" },
          skip: { type: "number", description: "Rows to skip (default: 0)" },
          sort: { type: "string", enum: ["added", "modified"], description: "Sort order (default: added)" },
          includeTitles: {
            type: "boolean",
            description: "Resolve the human title for each row (default: true). One extra request per row; set false for a fast id-only listing.",
          },
        },
        required: [],
      },
    },
    {
      name: "jellyseerr_get_request",
      description: "Get one request by id, with its decoded status, requester, and the Sonarr/Radarr id fetching it if it has reached one.",
      inputSchema: {
        type: "object" as const,
        properties: { requestId: { type: "number", description: "Jellyseerr request id" } },
        required: ["requestId"],
      },
    },
    {
      name: "jellyseerr_approve_request",
      description: "Approve a pending request. This hands it to Sonarr or Radarr and starts a real download - it is not a dry run. Check the request with jellyseerr_get_request first if you are unsure.",
      inputSchema: {
        type: "object" as const,
        properties: { requestId: { type: "number", description: "Jellyseerr request id to approve" } },
        required: ["requestId"],
      },
    },
    {
      name: "jellyseerr_decline_request",
      description: "Decline a pending request. Closes the request; downloads nothing and removes nothing already fetched.",
      inputSchema: {
        type: "object" as const,
        properties: { requestId: { type: "number", description: "Jellyseerr request id to decline" } },
        required: ["requestId"],
      },
    },
    {
      name: "jellyseerr_get_issues",
      description: "Get issues users have reported against media (wrong subtitles, bad video, missing episodes).",
      inputSchema: {
        type: "object" as const,
        properties: {
          take: { type: "number", description: "Rows to return (default: 20, max: 50)" },
          skip: { type: "number", description: "Rows to skip (default: 0)" },
        },
        required: [],
      },
    },
    {
      name: "jellyseerr_search",
      description: "Search Jellyseerr's metadata provider for movies, TV and people. Returns tmdbIds usable with the request tools.",
      inputSchema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Search term" } },
        required: ["query"],
      },
    },
    {
      name: "jellyseerr_get_users",
      description: "Get Jellyseerr users with their request counts and quotas. Useful for seeing who is asking for what.",
      inputSchema: {
        type: "object" as const,
        properties: { take: { type: "number", description: "Rows to return (default: 50, max: 100)" } },
        required: [],
      },
    },
    {
      name: "jellyseerr_review_setup",
      description: "Get a Jellyseerr configuration review: version, request counts by state, open issues, and user count. Use this to analyse the setup and spot a backlog.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    }
  );
}

// Bazarr tools
//
// Bazarr manages subtitles for an existing Sonarr/Radarr library rather than
// managing media itself, so it gets no quality profiles, root folders or
// naming config and is excluded from addConfigTools() the same way Prowlarr is.
//
// Rows carry sonarrSeriesId/sonarrEpisodeId or radarrId - the same ids the
// Sonarr and Radarr tools here already take - so a missing subtitle can be
// traced back to the episode that owns it without a second lookup.
if (clients.bazarr) {
  TOOLS.push(
    {
      name: "bazarr_get_summary",
      description: "Get Bazarr's headline counts: how many episodes and movies are missing wanted subtitles, how many providers are unhealthy, and whether the Sonarr/Radarr SignalR feeds are connected. Start here - it says whether there is a problem before you page through thousands of rows.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "bazarr_get_wanted_episodes",
      description: "Get episodes missing wanted subtitles, with the languages still missing and the sonarrSeriesId/sonarrEpisodeId that identify them in Sonarr. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_wanted_movies",
      description: "Get movies missing wanted subtitles, with the languages still missing and the radarrId that identifies them in Radarr. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_providers",
      description: "Get subtitle provider health. A provider in an error state (bad credentials, rate limited, banned) silently stops subtitles arriving while the rest of Bazarr looks fine, so check this before investigating individual episodes.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "bazarr_get_episode_history",
      description: "Get recent subtitle activity for episodes - what was downloaded or upgraded, from which provider, with what match score. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_movie_history",
      description: "Get recent subtitle activity for movies. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_series",
      description: "Get the series Bazarr tracks, with their subtitle language profile and how many episodes are still missing subtitles. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_movies",
      description: "Get the movies Bazarr tracks, with their subtitle language profile. Paginated.",
      inputSchema: {
        type: "object" as const,
        properties: {
          start: { type: "number", description: "Row offset to start from (default: 0)" },
          length: { type: "number", description: "Rows to return (default: 25, max: 100). Bazarr has no server-side default and will not answer without one." },
        },
        required: [],
      },
    },
    {
      name: "bazarr_get_episodes",
      description: "Get every episode of one series with the subtitles it already has and the ones still missing. Takes the Sonarr series id, which is what bazarr_get_series and the Sonarr tools both report.",
      inputSchema: {
        type: "object" as const,
        properties: {
          seriesId: { type: "number", description: "Sonarr series id (sonarrSeriesId)" },
        },
        required: ["seriesId"],
      },
    },
    {
      name: "bazarr_search_episode_subtitles",
      description: "Ask every enabled provider what subtitles exist for one episode, without downloading anything. This is Bazarr's manual search: it is slow, and an empty result usually means provider trouble rather than a genuinely unavailable subtitle - check bazarr_get_providers.",
      inputSchema: {
        type: "object" as const,
        properties: {
          episodeId: { type: "number", description: "Sonarr episode id (sonarrEpisodeId), as reported by bazarr_get_wanted_episodes" },
        },
        required: ["episodeId"],
      },
    },
    {
      name: "bazarr_search_movie_subtitles",
      description: "Ask every enabled provider what subtitles exist for one movie, without downloading. Slow, for the same reason as the episode version.",
      inputSchema: {
        type: "object" as const,
        properties: {
          radarrId: { type: "number", description: "Radarr movie id (radarrId), as reported by bazarr_get_wanted_movies" },
        },
        required: ["radarrId"],
      },
    },
    {
      name: "bazarr_get_language_profiles",
      description: "Get the subtitle language profiles - which languages are wanted, and whether forced or hearing-impaired variants count. A profile that wants a language no provider serves is a common cause of a permanently non-empty wanted list.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "bazarr_review_setup",
      description: "Get a comprehensive Bazarr configuration review in one call: version and connected Sonarr/Radarr versions, health warnings, provider health, language profiles, and the wanted counts. Use this to analyse the setup and suggest improvements.",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    }
  );
}

// Cross-service search tool
TOOLS.push({
  name: "arr_search_all",
  description: "Search across all configured *arr services for any media",
  inputSchema: {
    type: "object" as const,
    properties: {
      term: {
        type: "string",
        description: "Search term",
      },
    },
    required: ["term"],
  },
});

// TRaSH Guides tools (always available - no *arr config required)
TOOLS.push(
  {
    name: "trash_list_profiles",
    description: "List available TRaSH Guides quality profiles for Radarr or Sonarr. Shows recommended profiles for different use cases (1080p, 4K, Remux, etc.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service to get profiles for",
        },
      },
      required: ["service"],
    },
  },
  {
    name: "trash_get_profile",
    description: "Get a specific TRaSH Guides quality profile with all custom format scores, quality settings, and implementation details",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        profile: {
          type: "string",
          description: "Profile name (e.g., 'remux-web-1080p', 'uhd-bluray-web', 'hd-bluray-web')",
        },
      },
      required: ["service", "profile"],
    },
  },
  {
    name: "trash_list_custom_formats",
    description: "List available TRaSH Guides custom formats. Can filter by category: hdr, audio, resolution, source, streaming, anime, unwanted, release, language",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        category: {
          type: "string",
          description: "Optional filter by category",
        },
      },
      required: ["service"],
    },
  },
  {
    name: "trash_get_naming",
    description: "Get TRaSH Guides recommended naming conventions for your media server (Plex, Emby, Jellyfin, or standard)",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        mediaServer: {
          type: "string",
          enum: ["plex", "emby", "jellyfin", "standard"],
          description: "Which media server you use",
        },
      },
      required: ["service", "mediaServer"],
    },
  },
  {
    name: "trash_get_quality_sizes",
    description: "Get TRaSH Guides recommended min/max/preferred sizes for each quality level",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        type: {
          type: "string",
          description: "Content type: 'movie', 'anime' for Radarr; 'series', 'anime' for Sonarr",
        },
      },
      required: ["service"],
    },
  },
  {
    name: "trash_compare_profile",
    description: "Compare your quality profile against TRaSH Guides recommendations. Shows missing custom formats, scoring differences, and quality settings. Requires the corresponding *arr service to be configured.",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        profileId: {
          type: "number",
          description: "Your quality profile ID to compare",
        },
        trashProfile: {
          type: "string",
          description: "TRaSH profile name to compare against",
        },
      },
      required: ["service", "profileId", "trashProfile"],
    },
  },
  {
    name: "trash_compare_naming",
    description: "Compare your naming configuration against TRaSH Guides recommendations. Requires the corresponding *arr service to be configured.",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          enum: ["radarr", "sonarr"],
          description: "Which service",
        },
        mediaServer: {
          type: "string",
          enum: ["plex", "emby", "jellyfin", "standard"],
          description: "Which media server you use",
        },
      },
      required: ["service", "mediaServer"],
    },
  }
);

// --- Tool mutation classification -------------------------------------------
//
// One classification, two consumers: the MCP annotations attached just below,
// and the read-only access gate. A second list kept somewhere else is how the
// two drift apart, and a drift here silently hands a write tool to a reader.
//
// A tool absent from MUTATING_TOOLS is a read. That default is deliberate: the
// generated per-service config tools (`<service>_get_*`, `<service>_review_setup`)
// are all reads, so they need no upkeep here. Every mutating tool is named
// explicitly instead, and the catalogue test asserts each of these names really
// exists — so renaming a tool without updating this list fails the build rather
// than quietly demoting a write tool to a read.

// Tools that remove something or irreversibly commit it. A subset of MUTATING_TOOLS.
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "radarr_delete_queue_item",   // removes a queue item, optionally blocklisting the release
  "whisparr_delete_item",       // deletes a library row (files on disk are kept)
  "radarr_update_movie",        // overwrites qualityProfileId / monitored / path
  "jellyseerr_approve_request", // hands the request to Sonarr/Radarr; starts a real download
  "jellyseerr_decline_request", // closes the request
]);

// Every tool that changes state in an *arr service, including the destructive
// ones above. Note the naming trap this makes machine-readable: `<service>_search`
// is a metadata lookup and a read, while `<service>_search_missing`,
// `radarr_search_movie` and friends trigger real downloads.
const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  ...DESTRUCTIVE_TOOLS,
  // Add library rows
  "sonarr_add_series",
  "radarr_add_movie",
  "lidarr_add_artist",
  "whisparr_add_item",
  "chaptarr_add_author",
  // Trigger download searches
  "sonarr_search_missing",
  "sonarr_search_episode",
  "radarr_search_movie",
  "radarr_search_movies",
  "lidarr_search_album",
  "lidarr_search_missing",
  "whisparr_search_item",
  "chaptarr_trigger_book_search",
  "chaptarr_search_missing",
  // Refresh / rescan
  "sonarr_refresh_series",
  "radarr_refresh_movie",
  "whisparr_rescan_item",
  "whisparr_refresh_item",
  "chaptarr_refresh_author",
]);

// Reads that reach outside the user's own *arr stack — metadata providers,
// indexers, subtitle providers, and the TRaSH Guides repo on GitHub. They are
// slow and rate-limited, and what they return is not the local library.
const OPEN_WORLD_TOOLS: ReadonlySet<string> = new Set([
  "search",
  "fetch",
  "arr_search_all",
  "sonarr_search",
  "radarr_search",
  "lidarr_search",
  "whisparr_search",
  "chaptarr_search",
  "chaptarr_search_book",
  "jellyseerr_search",
  "prowlarr_search",
  "prowlarr_test_indexers",
  "bazarr_search_episode_subtitles",
  "bazarr_search_movie_subtitles",
  "trash_list_profiles",
  "trash_get_profile",
  "trash_list_custom_formats",
  "trash_get_naming",
  "trash_get_quality_sizes",
  "trash_compare_profile",
  "trash_compare_naming",
]);

// Attach MCP tool annotations so a client can tell reads from writes without
// parsing 131 descriptions. Both hints are set explicitly on every tool because
// the spec defaults are wrong for this server: `readOnlyHint` defaults to false
// (marking every read as a write) and `openWorldHint` defaults to true (marking
// every local library query as reaching the open internet).
for (const tool of TOOLS) {
  const mutating = MUTATING_TOOLS.has(tool.name);
  tool.annotations = {
    readOnlyHint: !mutating,
    openWorldHint: OPEN_WORLD_TOOLS.has(tool.name),
    ...(mutating ? { destructiveHint: DESTRUCTIVE_TOOLS.has(tool.name) } : {}),
  };
}

// The tools an access level may see. Read-only drops every mutating tool,
// which leaves all 107 reads plus the TRaSH reference tools — those touch
// nothing, so they stay available in both modes.
function toolsFor(access: AccessMode): Tool[] {
  return access === "read-only"
    ? TOOLS.filter((tool) => !MUTATING_TOOLS.has(tool.name))
    : TOOLS;
}

// Whether an access level may invoke a tool. This is the control; filtering the
// catalogue above is only a convenience. tools/call dispatches on the name the
// client sends, so a client that already knows a name — hardcoded, cached from
// an earlier session, or guessed — reaches the handler without ever having read
// the list. Gating one without the other is security theatre.
function isToolAllowed(access: AccessMode, name: string): boolean {
  return access === "read-write" || !MUTATING_TOOLS.has(name);
}

// Build a fresh MCP server instance with all request handlers registered.
// The HTTP transport builds a new instance per request (see startHttpServer)
// so concurrent / long-lived transports never share a single server. A shared
// server can only be connected to one transport at a time, which is why the
// old code funnelled every request through a serialized queue — and that queue
// deadlocked the moment a streamable client opened its long-lived GET (SSE)
// stream, since that request never completes.
function buildServer(access: AccessMode = ACCESS_MODE): Server {
  const server = new Server(
    {
      name: "mcp-arr",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  registerHandlers(server, access);
  return server;
}

// Module-level instance used by the stdio transport (single, long-lived session).
const server = buildServer();

type SearchEntry = {
  id: string;
  title: string;
  url: string;
  type: string;
  service: string;
  summary?: string;
};

function buildResourceUrl(path: string): string {
  return `mcp-arr://${path}`;
}

/**
 * Flatten a Chaptarr author for a tool response.
 *
 * Chaptarr emits both the legacy combined fields (`monitored`, `tags`,
 * `statistics`) and media-scoped pairs. The pairs are the truth for a library
 * that holds both an audiobook and an eBook side, so both are reported and the
 * scoped ones are grouped under `audiobook`/`ebook` rather than left as a flat
 * wall of lookalike keys.
 */
function summarizeChaptarrAuthor(a: ChaptarrAuthor) {
  const side = (monitored?: boolean, qualityProfileId?: number,
                metadataProfileId?: number, rootFolderPath?: string,
                tags?: number[], stats?: { bookCount?: number; bookFileCount?: number; sizeOnDisk?: number }) => ({
    monitored: monitored ?? null,
    qualityProfileId: qualityProfileId ?? null,
    metadataProfileId: metadataProfileId ?? null,
    rootFolderPath: rootFolderPath ?? null,
    tags: tags ?? [],
    bookCount: stats?.bookCount ?? null,
    bookFileCount: stats?.bookFileCount ?? null,
    sizeOnDisk: stats?.sizeOnDisk ?? null,
  });

  return {
    id: a.id ?? null,
    // Durable identity. Prefer this over `id` for anything cached or matched.
    foreignAuthorId: a.foreignAuthorId ?? null,
    authorName: a.authorName,
    sortName: a.sortName,
    status: a.status,
    monitored: a.monitored,
    path: a.path ?? null,
    genres: a.genres ?? [],
    added: a.added ?? null,
    ratings: a.ratings ?? null,
    audiobook: side(a.audiobookMonitored, a.audiobookQualityProfileId,
                    a.audiobookMetadataProfileId, a.audiobookRootFolderPath,
                    a.audiobookTags, a.audiobookStatistics),
    ebook: side(a.ebookMonitored, a.ebookQualityProfileId,
                a.ebookMetadataProfileId, a.ebookRootFolderPath,
                a.ebookTags, a.ebookStatistics),
  };
}

/**
 * Flatten a Chaptarr book for a tool response. Audiobook-only metadata
 * (narrators, duration) is reported when present and null otherwise, so a
 * caller can tell "no narrator recorded" from "this is an eBook".
 */
function summarizeChaptarrBook(b: ChaptarrBook) {
  return {
    id: b.id ?? null,
    // Durable identity; see summarizeChaptarrAuthor.
    foreignBookId: b.foreignBookId ?? null,
    title: b.title,
    authorId: b.authorId,
    authorTitle: b.authorTitle ?? null,
    mediaType: b.mediaType ?? null,
    monitored: b.monitored,
    audiobookMonitored: b.audiobookMonitored ?? null,
    ebookMonitored: b.ebookMonitored ?? null,
    hasFiles: b.hasFiles ?? null,
    releaseDate: b.releaseDate ?? null,
    seriesTitle: b.seriesTitle ?? null,
    pageCount: b.pageCount ?? null,
    isOmnibus: b.isOmnibus ?? null,
    narrators: b.narratorNames ?? null,
    duration: b.duration ?? null,
    durationMinutes: b.durationMinutes ?? null,
    ratings: b.ratings ?? null,
    // Chaptarr resolves a title across providers; any of these resolves back.
    providerIds: {
      hardcover: b.hardcoverBookId ?? null,
      goodreadsWork: b.goodreadsWorkId ?? null,
      asin: b.asin ?? null,
      audibleAsin: b.audibleASIN ?? null,
      edition: b.foreignEditionId ?? null,
    },
  };
}

/**
 * Flatten a Jellyseerr request for a tool response.
 *
 * Status is numeric on the wire, so both the raw number and the decoded name
 * are reported - the number so it can be matched against the API, the name so
 * a reader does not have to memorise an enum whose values are wider than the
 * documented four.
 */
function summarizeJellyseerrRequest(r: JellyseerrRequest, title?: string) {
  const m = r.media ?? ({} as NonNullable<JellyseerrRequest['media']>);
  return {
    id: r.id,
    title: title ?? null,
    type: r.type,
    status: JELLYSEERR_REQUEST_STATUS[r.status] ?? `unknown (${r.status})`,
    statusCode: r.status,
    mediaStatus: m.status ? (JELLYSEERR_MEDIA_STATUS[m.status] ?? `unknown (${m.status})`) : null,
    is4k: r.is4k ?? false,
    seasons: (r.seasons ?? []).map(x => x.seasonNumber),
    requestedBy: r.requestedBy?.displayName ?? r.requestedBy?.username ?? null,
    requestedById: r.requestedBy?.id ?? null,
    createdAt: r.createdAt ?? null,
    tmdbId: m.tmdbId ?? null,
    tvdbId: m.tvdbId ?? null,
    imdbId: m.imdbId ?? null,
    // The Sonarr/Radarr id actually fetching this, once it has reached one.
    externalServiceId: m.externalServiceId ?? null,
  };
}

/** Resolve titles for a page in parallel; a failure just leaves it null. */
async function withJellyseerrTitles(
  client: JellyseerrClient, rows: JellyseerrRequest[],
): Promise<Array<ReturnType<typeof summarizeJellyseerrRequest>>> {
  const titles = await Promise.all(
    rows.map(r => client.getTitle(r.type, r.media?.tmdbId ?? 0)));
  return rows.map((r, i) => summarizeJellyseerrRequest(r, titles[i]));
}

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function textError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

async function runUnifiedSearch(query: string): Promise<SearchEntry[]> {
  const results: SearchEntry[] = [];
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return results;
  }

  const lowerQuery = trimmedQuery.toLowerCase();

  for (const service of ["radarr", "sonarr"] as const) {
    const profiles = await trashClient.listProfiles(service);
    results.push(
      ...profiles
        .filter((profile) =>
          profile.name.toLowerCase().includes(lowerQuery) ||
          profile.description?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 8)
        .map((profile) => ({
          id: `trash-profile:${service}:${profile.name}`,
          title: `${profile.name} (${service})`,
          url: buildResourceUrl(`trash/profile/${service}/${encodeURIComponent(profile.name)}`),
          type: "trash_profile",
          service,
          summary: profile.description?.replace(/<br>/g, " "),
        }))
    );
  }

  if (clients.sonarr) {
    const series = await clients.sonarr.searchSeries(trimmedQuery);
    results.push(
      ...series.slice(0, 5).map((item) => ({
        id: `arr:sonarr:series:${item.tvdbId}`,
        title: `${item.title}${item.year ? ` (${item.year})` : ""}`,
        url: buildResourceUrl(`arr/sonarr/series/${item.tvdbId}`),
        type: "series",
        service: "sonarr",
        summary: item.overview?.slice(0, 220),
      }))
    );
  }

  if (clients.radarr) {
    const movies = await clients.radarr.searchMovies(trimmedQuery);
    results.push(
      ...movies.slice(0, 5).map((item) => ({
        id: `arr:radarr:movie:${item.tmdbId}`,
        title: `${item.title}${item.year ? ` (${item.year})` : ""}`,
        url: buildResourceUrl(`arr/radarr/movie/${item.tmdbId}`),
        type: "movie",
        service: "radarr",
        summary: item.overview?.slice(0, 220),
      }))
    );
  }

  if (clients.lidarr) {
    const artists = await clients.lidarr.searchArtists(trimmedQuery);
    results.push(
      ...artists.slice(0, 5).map((item) => ({
        id: `arr:lidarr:artist:${item.foreignArtistId}`,
        title: item.artistName || item.title,
        url: buildResourceUrl(`arr/lidarr/artist/${item.foreignArtistId}`),
        type: "artist",
        service: "lidarr",
        summary: item.overview?.slice(0, 220),
      }))
    );
  }

  // Whisparr is opt-in: it only appears here when the operator has set
  // WHISPARR_URL, so adult results never surface in an unconfigured server.
  if (clients.whisparr) {
    const variant = await clients.whisparr.getVariant();
    const type = variant === "v2" ? "site" : "scene";
    const items = await clients.whisparr.searchLibrary(trimmedQuery);
    results.push(
      ...items
        .map((item) => ({ item, key: whisparrItemKey(item) }))
        // Without a provider id there is nothing stable for fetch to resolve.
        .filter((entry): entry is { item: typeof entry.item; key: string } => entry.key !== undefined)
        .slice(0, 5)
        .map(({ item, key }) => ({
          id: `arr:whisparr:${type}:${key}`,
          title: `${item.title}${item.year ? ` (${item.year})` : ""}`,
          url: buildResourceUrl(`arr/whisparr/${type}/${encodeURIComponent(key)}`),
          type,
          service: "whisparr",
          summary: item.overview?.slice(0, 220),
        }))
    );
  }

  return results;
}

async function fetchSearchEntry(id: string): Promise<unknown> {
  const [kind, service, subtype, rawId] = id.split(":");

  if (kind === "trash-profile" && (service === "radarr" || service === "sonarr")) {
    const profile = await trashClient.getProfile(service, rawId);
    if (!profile) {
      throw new Error(`TRaSH profile '${rawId}' not found for ${service}`);
    }

    return {
      id,
      title: `${profile.name} (${service})`,
      url: buildResourceUrl(`trash/profile/${service}/${encodeURIComponent(profile.name)}`),
      service,
      type: "trash_profile",
      data: {
        name: profile.name,
        description: profile.trash_description?.replace(/<br>/g, "\n"),
        upgradeAllowed: profile.upgradeAllowed,
        cutoff: profile.cutoff,
        minFormatScore: profile.minFormatScore,
        cutoffFormatScore: profile.cutoffFormatScore,
        language: profile.language,
        qualities: profile.items,
        customFormats: Object.entries(profile.formatItems || {}).map(([name, trashId]) => ({
          name,
          trash_id: trashId,
        })),
      },
    };
  }

  if (kind !== "arr") {
    throw new Error(`Unsupported fetch id '${id}'`);
  }

  if (service === "sonarr" && subtype === "series" && clients.sonarr) {
    const tvdbId = Number(rawId);
    const matches = (await clients.sonarr.searchSeries(rawId)).filter((item) => item.tvdbId === tvdbId);
    return {
      id,
      title: matches[0]?.title || rawId,
      url: buildResourceUrl(`arr/sonarr/series/${rawId}`),
      service,
      type: subtype,
      data: matches.slice(0, 10),
    };
  }

  if (service === "radarr" && subtype === "movie" && clients.radarr) {
    const tmdbId = Number(rawId);
    const matches = (await clients.radarr.searchMovies(rawId)).filter((item) => item.tmdbId === tmdbId);
    return {
      id,
      title: matches[0]?.title || rawId,
      url: buildResourceUrl(`arr/radarr/movie/${rawId}`),
      service,
      type: subtype,
      data: matches.slice(0, 10),
    };
  }

  if (service === "lidarr" && subtype === "artist" && clients.lidarr) {
    const matches = (await clients.lidarr.searchArtists(rawId)).filter((item) => item.foreignArtistId === rawId);
    return {
      id,
      title: matches[0]?.artistName || matches[0]?.title || rawId,
      url: buildResourceUrl(`arr/lidarr/artist/${rawId}`),
      service,
      type: subtype,
      data: matches.slice(0, 10),
    };
  }

  if (service === "whisparr" && (subtype === "site" || subtype === "scene") && clients.whisparr) {
    const matches = (await clients.whisparr.searchLibrary(rawId)).filter(
      (item) => whisparrItemKey(item) === rawId
    );
    return {
      id,
      title: matches[0]?.title || rawId,
      url: buildResourceUrl(`arr/whisparr/${subtype}/${rawId}`),
      service,
      type: subtype,
      data: matches.slice(0, 10),
    };
  }

  throw new Error(`Unsupported or unavailable fetch target '${id}'`);
}

type QueueCapableClient = SonarrClient | RadarrClient | LidarrClient | WhisparrClient;

async function getPaginatedQueue(
  client: QueueCapableClient,
  args: { limit?: number; offset?: number } | undefined
) {
  const limit = Math.min(Math.max(Math.floor(args?.limit ?? 25), 1), 100);
  const offset = Math.max(Math.floor(args?.offset ?? 0), 0);
  const pageSize = 100;
  const records = [];
  let totalRecords = 0;
  let page = 1;

  while (true) {
    const queuePage = await client.getQueue(page, pageSize);
    totalRecords = queuePage.totalRecords;
    records.push(...queuePage.records);

    if (records.length >= totalRecords || queuePage.records.length === 0) {
      break;
    }

    page += 1;
  }

  const items = records.slice(offset, offset + limit).map((q) => ({
    id: q.id,
    title: q.title,
    status: q.status,
    progress: q.size > 0 ? ((1 - q.sizeleft / q.size) * 100).toFixed(1) + "%" : "unknown",
    timeLeft: q.timeleft,
    downloadClient: q.downloadClient,
    protocol: q.protocol,
    trackedDownloadStatus: q.trackedDownloadStatus,
    trackedDownloadState: q.trackedDownloadState,
  }));

  return {
    total: totalRecords,
    returned: items.length,
    offset,
    limit,
    hasMore: offset + items.length < totalRecords,
    nextOffset: offset + items.length < totalRecords ? offset + items.length : null,
    items,
  };
}

// Registers the MCP request handlers on a server instance. Called by
// buildServer() for every server created (one per HTTP request, plus the
// module-level stdio instance).
function registerHandlers(server: Server, access: AccessMode): void {
// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolsFor(access) };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!isToolAllowed(access, name)) {
    return {
      content: [{
        type: "text",
        text: `Error: ${name} changes state and this server is running in read-only mode (MCP_ARR_ACCESS=read-only).`,
      }],
      isError: true,
    };
  }

  try {
    switch (name) {
      case "search": {
        const query = (args as { query: string }).query;
        const results = await runUnifiedSearch(query);
        return jsonText({ results });
      }

      case "fetch": {
        const id = (args as { id: string }).id;
        const result = await fetchSearchEntry(id);
        return jsonText(result);
      }

      case "arr_status": {
        const statuses: Record<string, unknown> = {};
        for (const service of configuredServices) {
          try {
            const client = clients[service.name];
            if (client) {
              const status = await client.getStatus();
              statuses[service.name] = {
                configured: true,
                connected: true,
                version: status.version,
                appName: status.appName,
              };
            }
          } catch (error) {
            statuses[service.name] = {
              configured: true,
              connected: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
        // Add unconfigured services
        for (const service of services) {
          if (!statuses[service.name]) {
            statuses[service.name] = { configured: false };
          }
        }
        return jsonText(statuses);
      }

      // Dynamic config tool handlers
      // Quality Profiles
      case "sonarr_get_quality_profiles":
      case "radarr_get_quality_profiles":
      case "lidarr_get_quality_profiles":
      case "whisparr_get_quality_profiles":
      case "chaptarr_get_quality_profiles": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const profiles = await client.getQualityProfiles();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: profiles.length,
              profiles: profiles.map(p => ({
                id: p.id,
                name: p.name,
                upgradeAllowed: p.upgradeAllowed,
                cutoff: p.cutoff,
                allowedQualities: p.items
                  .filter(i => i.allowed)
                  .map(i => i.quality?.name || i.name || (i.items?.map(q => q.quality.name).join(', ')))
                  .filter(Boolean),
                customFormats: p.formatItems?.filter(f => f.score !== 0).map(f => ({
                  name: f.name,
                  score: f.score,
                })) || [],
                minFormatScore: p.minFormatScore,
                cutoffFormatScore: p.cutoffFormatScore,
              })),
            }, null, 2),
          }],
        };
      }

      // Remote path mappings, checked against the download clients they key on
      case "sonarr_get_remote_path_mappings":
      case "radarr_get_remote_path_mappings":
      case "lidarr_get_remote_path_mappings":
      case "whisparr_get_remote_path_mappings":
      case "chaptarr_get_remote_path_mappings": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const [mappings, downloadClients] = await Promise.all([
          client.getRemotePathMappings(),
          client.getDownloadClients(),
        ]);

        // A mapping is matched by the client's host *setting*, so compare
        // against that rather than the client's name.
        const clientHosts = downloadClients.map(c => ({
          name: c.name,
          enabled: c.enable,
          host: String(c.fields?.find(f => f.name === 'host')?.value ?? ''),
        }));
        const knownHosts = new Set(clientHosts.map(h => h.host).filter(Boolean));

        const checked = mappings.map(m => ({
          id: m.id,
          host: m.host,
          remotePath: m.remotePath,
          localPath: m.localPath,
          matchesDownloadClient: knownHosts.has(m.host),
        }));
        const orphaned = checked.filter(m => !m.matchesDownloadClient);

        return jsonText({
          service: serviceName,
          count: checked.length,
          mappings: checked,
          downloadClientHosts: clientHosts,
          orphanedCount: orphaned.length,
          note: orphaned.length > 0
            ? `${orphaned.length} mapping(s) name a host no configured download client uses. Imports matching those paths will fail while the app otherwise looks healthy.`
            : "Every mapping's host matches a configured download client.",
        });
      }

      // Health checks
      case "sonarr_get_health":
      case "radarr_get_health":
      case "lidarr_get_health":
      case "whisparr_get_health":
      case "chaptarr_get_health": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const health = await client.getHealth();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              issueCount: health.length,
              issues: health.map(h => ({
                source: h.source,
                type: h.type,
                message: h.message,
                wikiUrl: h.wikiUrl,
              })),
              status: health.length === 0 ? 'healthy' : 'issues detected',
            }, null, 2),
          }],
        };
      }

      // Root folders
      case "sonarr_get_root_folders":
      case "radarr_get_root_folders":
      case "lidarr_get_root_folders":
      case "whisparr_get_root_folders":
      case "chaptarr_get_root_folders": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const folders = await client.getRootFoldersDetailed();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: folders.length,
              folders: folders.map(f => ({
                id: f.id,
                path: f.path,
                accessible: f.accessible,
                freeSpace: formatBytes(f.freeSpace),
                freeSpaceBytes: f.freeSpace,
                unmappedFolders: f.unmappedFolders?.length || 0,
              })),
            }, null, 2),
          }],
        };
      }

      // Download clients
      case "sonarr_get_download_clients":
      case "radarr_get_download_clients":
      case "lidarr_get_download_clients":
      case "whisparr_get_download_clients":
      case "chaptarr_get_download_clients": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const downloadClients = await client.getDownloadClients();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: downloadClients.length,
              clients: downloadClients.map(c => ({
                id: c.id,
                name: c.name,
                implementation: c.implementationName,
                protocol: c.protocol,
                enabled: c.enable,
                priority: c.priority,
                removeCompletedDownloads: c.removeCompletedDownloads,
                removeFailedDownloads: c.removeFailedDownloads,
                tags: c.tags,
              })),
            }, null, 2),
          }],
        };
      }

      // Naming config
      case "sonarr_get_naming":
      case "radarr_get_naming":
      case "lidarr_get_naming":
      case "whisparr_get_naming":
      case "chaptarr_get_naming": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const naming = await client.getNamingConfig();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(naming, null, 2),
          }],
        };
      }

      // Tags
      case "sonarr_get_tags":
      case "radarr_get_tags":
      case "lidarr_get_tags":
      case "whisparr_get_tags":
      case "chaptarr_get_tags": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);
        const tags = await client.getTags();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: tags.length,
              tags: tags.map(t => ({ id: t.id, label: t.label })),
            }, null, 2),
          }],
        };
      }

      // Comprehensive setup review
      case "sonarr_review_setup":
      case "radarr_review_setup":
      case "lidarr_review_setup":
      case "whisparr_review_setup":
      case "chaptarr_review_setup": {
        const serviceName = name.split('_')[0] as keyof typeof clients;
        const client = clients[serviceName];
        if (!client) throw new Error(`${serviceName} not configured`);

        // Gather all configuration data
        const [status, health, qualityProfiles, qualityDefinitions, downloadClients, naming, mediaManagement, rootFolders, tags, indexers] = await Promise.all([
          client.getStatus(),
          client.getHealth(),
          client.getQualityProfiles(),
          client.getQualityDefinitions(),
          client.getDownloadClients(),
          client.getNamingConfig(),
          client.getMediaManagement(),
          client.getRootFoldersDetailed(),
          client.getTags(),
          client.getIndexers(),
        ]);

        // Lidarr and Chaptarr both carry metadata profiles; the others do not.
        let metadataProfiles = null;
        if (serviceName === 'lidarr' && clients.lidarr) {
          metadataProfiles = await clients.lidarr.getMetadataProfiles();
        } else if (serviceName === 'chaptarr' && clients.chaptarr) {
          metadataProfiles = await clients.chaptarr.getMetadataProfiles();
        }

        const review = {
          service: serviceName,
          version: status.version,
          appName: status.appName,
          platform: {
            os: status.osName,
            isDocker: status.isDocker,
          },
          health: {
            issueCount: health.length,
            issues: health,
          },
          storage: {
            rootFolders: rootFolders.map(f => ({
              path: f.path,
              accessible: f.accessible,
              freeSpace: formatBytes(f.freeSpace),
              freeSpaceBytes: f.freeSpace,
              unmappedFolderCount: f.unmappedFolders?.length || 0,
            })),
          },
          qualityProfiles: qualityProfiles.map(p => ({
            id: p.id,
            name: p.name,
            upgradeAllowed: p.upgradeAllowed,
            cutoff: p.cutoff,
            allowedQualities: p.items
              .filter(i => i.allowed)
              .map(i => i.quality?.name || i.name || (i.items?.map(q => q.quality.name).join(', ')))
              .filter(Boolean),
            customFormatsWithScores: p.formatItems?.filter(f => f.score !== 0).length || 0,
            minFormatScore: p.minFormatScore,
          })),
          qualityDefinitions: qualityDefinitions.map(d => ({
            quality: d.quality.name,
            minSize: d.minSize + ' MB/min',
            maxSize: d.maxSize === 0 ? 'unlimited' : d.maxSize + ' MB/min',
            preferredSize: d.preferredSize + ' MB/min',
          })),
          downloadClients: downloadClients.map(c => ({
            name: c.name,
            type: c.implementationName,
            protocol: c.protocol,
            enabled: c.enable,
            priority: c.priority,
          })),
          indexers: indexers.map(i => ({
            name: i.name,
            protocol: i.protocol,
            enableRss: i.enableRss,
            enableAutomaticSearch: i.enableAutomaticSearch,
            enableInteractiveSearch: i.enableInteractiveSearch,
            priority: i.priority,
          })),
          naming: naming,
          mediaManagement: {
            recycleBin: mediaManagement.recycleBin || 'not set',
            recycleBinCleanupDays: mediaManagement.recycleBinCleanupDays,
            downloadPropersAndRepacks: mediaManagement.downloadPropersAndRepacks,
            deleteEmptyFolders: mediaManagement.deleteEmptyFolders,
            copyUsingHardlinks: mediaManagement.copyUsingHardlinks,
            importExtraFiles: mediaManagement.importExtraFiles,
            extraFileExtensions: mediaManagement.extraFileExtensions,
          },
          tags: tags.map(t => t.label),
          ...(metadataProfiles && { metadataProfiles }),
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(review, null, 2),
          }],
        };
      }

      // Sonarr handlers
      case "sonarr_get_series": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const { limit = 25, offset = 0, search } = args as {
          limit?: number;
          offset?: number;
          search?: string;
        };
        const normalizedLimit = Math.max(1, Math.min(limit, 100));
        const normalizedOffset = Math.max(0, offset);
        const filter = search?.trim().toLowerCase();

        const allSeries = await clients.sonarr.getSeries();
        const filteredSeries = filter
          ? allSeries.filter(s => s.title.toLowerCase().includes(filter))
          : allSeries;
        const pagedSeries = filteredSeries.slice(normalizedOffset, normalizedOffset + normalizedLimit);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total: allSeries.length,
              filteredCount: filteredSeries.length,
              returned: pagedSeries.length,
              offset: normalizedOffset,
              limit: normalizedLimit,
              hasMore: normalizedOffset + normalizedLimit < filteredSeries.length,
              nextOffset: normalizedOffset + normalizedLimit < filteredSeries.length
                ? normalizedOffset + normalizedLimit
                : null,
              search: search ?? null,
              series: pagedSeries.map(s => ({
                id: s.id,
                title: s.title,
                year: s.year,
                status: s.status,
                network: s.network,
                seasons: s.statistics?.seasonCount,
                episodes: s.statistics?.episodeFileCount + '/' + s.statistics?.totalEpisodeCount,
                sizeOnDisk: formatBytes(s.statistics?.sizeOnDisk || 0),
                monitored: s.monitored,
              })),
            }, null, 2),
          }],
        };
      }

      case "sonarr_search": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const term = (args as { term: string }).term;
        const results = await clients.sonarr.searchSeries(term);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: results.length,
              results: results.slice(0, 10).map(r => ({
                title: r.title,
                year: r.year,
                tvdbId: r.tvdbId,
                overview: r.overview?.substring(0, 200) + (r.overview && r.overview.length > 200 ? '...' : ''),
              })),
            }, null, 2),
          }],
        };
      }

      case "sonarr_get_queue": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        return jsonText(await getPaginatedQueue(clients.sonarr, args as { limit?: number; offset?: number }));
      }

      case "sonarr_get_calendar": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const days = (args as { days?: number })?.days || 7;
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const calendar = await clients.sonarr.getCalendar(start, end);
        return {
          content: [{ type: "text", text: JSON.stringify(calendar, null, 2) }],
        };
      }

      case "sonarr_get_episodes": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const { seriesId, seasonNumber } = args as { seriesId: number; seasonNumber?: number };
        const episodes = await clients.sonarr.getEpisodes(seriesId, seasonNumber);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: episodes.length,
              episodes: episodes.map(e => ({
                id: e.id,
                seasonNumber: e.seasonNumber,
                episodeNumber: e.episodeNumber,
                title: e.title,
                airDate: e.airDate,
                hasFile: e.hasFile,
                monitored: e.monitored,
              })),
            }, null, 2),
          }],
        };
      }

      case "sonarr_search_missing": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const seriesId = (args as { seriesId: number }).seriesId;
        const result = await clients.sonarr.searchMissing(seriesId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for missing episodes`,
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "sonarr_search_episode": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const episodeIds = (args as { episodeIds: number[] }).episodeIds;
        const result = await clients.sonarr.searchEpisode(episodeIds);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for ${episodeIds.length} episode(s)`,
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "sonarr_refresh_series": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const seriesId = (args as { seriesId: number }).seriesId;
        const series = await clients.sonarr.getSeriesById(seriesId);
        const result = await clients.sonarr.refreshSeries(seriesId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Refresh triggered for series`,
              series: {
                id: series.id,
                title: series.title,
                year: series.year,
              },
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "sonarr_add_series": {
        if (!clients.sonarr) throw new Error("Sonarr not configured");
        const { tvdbId, title, qualityProfileId, rootFolderPath, monitored, seasonFolder, tags } = args as {
          tvdbId: number; title: string; qualityProfileId: number; rootFolderPath: string;
          monitored?: boolean; seasonFolder?: boolean; tags?: number[];
        };
        const added = await clients.sonarr.addSeries({
          tvdbId, title, qualityProfileId, rootFolderPath, monitored, seasonFolder, tags: tags ?? [],
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Added "${added.title}" (${added.year}) to Sonarr`,
              id: added.id,
              path: added.path,
              monitored: added.monitored,
            }, null, 2),
          }],
        };
      }

      // Radarr handlers
      case "radarr_get_movies": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const { limit = 25, offset = 0, search } = args as {
          limit?: number;
          offset?: number;
          search?: string;
        };
        const normalizedLimit = Math.max(1, Math.min(limit, 100));
        const normalizedOffset = Math.max(0, offset);
        const filter = search?.trim().toLowerCase();

        const allMovies = await clients.radarr.getMovies();
        const filteredMovies = filter
          ? allMovies.filter(m => m.title.toLowerCase().includes(filter))
          : allMovies;
        const pagedMovies = filteredMovies.slice(normalizedOffset, normalizedOffset + normalizedLimit);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total: allMovies.length,
              filteredCount: filteredMovies.length,
              returned: pagedMovies.length,
              offset: normalizedOffset,
              limit: normalizedLimit,
              hasMore: normalizedOffset + normalizedLimit < filteredMovies.length,
              nextOffset: normalizedOffset + normalizedLimit < filteredMovies.length
                ? normalizedOffset + normalizedLimit
                : null,
              search: search ?? null,
              movies: pagedMovies.map(m => ({
                id: m.id,
                title: m.title,
                year: m.year,
                status: m.status,
                hasFile: m.hasFile,
                sizeOnDisk: formatBytes(m.sizeOnDisk),
                monitored: m.monitored,
                studio: m.studio,
                qualityProfileId: m.qualityProfileId,
                ...(m.movieFile ? {
                  quality: m.movieFile.quality?.quality?.name ?? null,
                  resolution: m.movieFile.mediaInfo?.resolution ?? null,
                  videoCodec: m.movieFile.mediaInfo?.videoCodec ?? null,
                  videoDynamicRange: m.movieFile.mediaInfo?.videoDynamicRange ?? null,
                  audioCodec: m.movieFile.mediaInfo?.audioCodec ?? null,
                  audioChannels: m.movieFile.mediaInfo?.audioChannels ?? null,
                } : {}),
                ratings: Object.fromEntries(
                  Object.entries(m.ratings || {})
                    .filter(([, v]) => v && v.value > 0)
                    .map(([k, v]) => [k, v.value])
                ),
              })),
            }, null, 2),
          }],
        };
      }

      case "radarr_search": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const term = (args as { term: string }).term;
        const results = await clients.radarr.searchMovies(term);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: results.length,
              results: results.slice(0, 10).map(r => ({
                title: r.title,
                year: r.year,
                tmdbId: r.tmdbId,
                imdbId: r.imdbId,
                overview: r.overview?.substring(0, 200) + (r.overview && r.overview.length > 200 ? '...' : ''),
              })),
            }, null, 2),
          }],
        };
      }

      case "radarr_get_queue": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        return jsonText(await getPaginatedQueue(clients.radarr, args as { limit?: number; offset?: number }));
      }

      case "radarr_get_calendar": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const days = (args as { days?: number })?.days || 30;
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const calendar = await clients.radarr.getCalendar(start, end);
        return {
          content: [{ type: "text", text: JSON.stringify(calendar, null, 2) }],
        };
      }

      case "radarr_search_movie": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const movieId = (args as { movieId: number }).movieId;
        const result = await clients.radarr.searchMovie(movieId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for movie`,
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "radarr_refresh_movie": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const movieId = (args as { movieId: number }).movieId;
        const movie = await clients.radarr.getMovieById(movieId);
        const result = await clients.radarr.refreshMovie(movieId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Refresh triggered for movie`,
              movie: {
                id: movie.id,
                title: movie.title,
                year: movie.year,
              },
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "radarr_add_movie": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const { tmdbId, title, qualityProfileId, rootFolderPath, monitored, minimumAvailability, tags } = args as {
          tmdbId: number; title: string; qualityProfileId: number; rootFolderPath: string;
          monitored?: boolean; minimumAvailability?: string; tags?: number[];
        };
        const added = await clients.radarr.addMovie({
          tmdbId, title, qualityProfileId, rootFolderPath, monitored, minimumAvailability, tags: tags ?? [],
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Added "${added.title}" (${added.year}) to Radarr`,
              id: added.id,
              path: added.path,
              monitored: added.monitored,
            }, null, 2),
          }],
        };
      }

      case "radarr_update_movie": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const { movieId, qualityProfileId, monitored, minimumAvailability, tags, path } = args as {
          movieId: number; qualityProfileId?: number; monitored?: boolean;
          minimumAvailability?: string; tags?: number[]; path?: string;
        };
        // Fetch the full movie object first
        const movie = await clients.radarr.getMovieById(movieId);
        // Apply updates
        if (qualityProfileId !== undefined) movie.qualityProfileId = qualityProfileId;
        if (monitored !== undefined) movie.monitored = monitored;
        if (minimumAvailability !== undefined) movie.minimumAvailability = minimumAvailability;
        if (tags !== undefined) movie.tags = tags;
        if (path !== undefined) movie.path = path;
        const updated = await clients.radarr.updateMovie(movie);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Updated "${updated.title}" (${updated.year})`,
              movie: {
                id: updated.id,
                title: updated.title,
                year: updated.year,
                qualityProfileId: updated.qualityProfileId,
                monitored: updated.monitored,
                minimumAvailability: updated.minimumAvailability,
                tags: updated.tags,
                path: updated.path,
              },
            }, null, 2),
          }],
        };
      }

      case "radarr_delete_queue_item": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const { queueId, removeFromClient = true, blocklist = false } = args as {
          queueId: number; removeFromClient?: boolean; blocklist?: boolean;
        };
        await clients.radarr.deleteQueueItem(queueId, { removeFromClient, blocklist });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Removed queue item ${queueId}${blocklist ? ' and added to blocklist' : ''}`,
              queueId,
              removedFromClient: removeFromClient,
              blocklisted: blocklist,
            }, null, 2),
          }],
        };
      }

      case "radarr_search_movies": {
        if (!clients.radarr) throw new Error("Radarr not configured");
        const { movieIds } = args as { movieIds: number[] };
        if (!movieIds || movieIds.length === 0) throw new Error("movieIds array is required and must not be empty");
        const result = await clients.radarr.searchMoviesBulk(movieIds);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for ${movieIds.length} movie(s)`,
              commandId: result.id,
              movieIds,
            }, null, 2),
          }],
        };
      }

      // Lidarr handlers
      case "lidarr_get_artists": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const artists = await clients.lidarr.getArtists();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: artists.length,
              artists: artists.map(a => ({
                id: a.id,
                artistName: a.artistName,
                status: a.status,
                albums: a.statistics?.albumCount,
                tracks: a.statistics?.trackFileCount + '/' + a.statistics?.totalTrackCount,
                sizeOnDisk: formatBytes(a.statistics?.sizeOnDisk || 0),
                monitored: a.monitored,
              })),
            }, null, 2),
          }],
        };
      }

      case "lidarr_search": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const a = args as { term?: string; query?: string; artist?: string; name?: string };
        const term = a.term ?? a.query ?? a.artist ?? a.name;
        if (!term) throw new Error("term required (artist name)");
        const results = await clients.lidarr.searchArtists(term);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: results.length,
              results: results.slice(0, 10).map(r => ({
                artistName: r.artistName ?? r.title,
                disambiguation: r.disambiguation,
                foreignArtistId: r.foreignArtistId,
                overview: r.overview ? (r.overview.substring(0, 200) + (r.overview.length > 200 ? '...' : '')) : undefined,
              })),
            }, null, 2),
          }],
        };
      }

      case "lidarr_get_queue": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        return jsonText(await getPaginatedQueue(clients.lidarr, args as { limit?: number; offset?: number }));
      }

      case "lidarr_get_albums": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const artistId = (args as { artistId: number }).artistId;
        const albums = await clients.lidarr.getAlbums(artistId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: albums.length,
              albums: albums.map(a => ({
                id: a.id,
                title: a.title,
                releaseDate: a.releaseDate,
                albumType: a.albumType,
                monitored: a.monitored,
                tracks: a.statistics ? `${a.statistics.trackFileCount}/${a.statistics.totalTrackCount}` : 'unknown',
                sizeOnDisk: formatBytes(a.statistics?.sizeOnDisk || 0),
                percentComplete: a.statistics?.percentOfTracks || 0,
                grabbed: a.grabbed,
              })),
            }, null, 2),
          }],
        };
      }

      case "lidarr_search_album": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const albumId = (args as { albumId: number }).albumId;
        const result = await clients.lidarr.searchAlbum(albumId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for album`,
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "lidarr_search_missing": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const artistId = (args as { artistId: number }).artistId;
        const result = await clients.lidarr.searchMissingAlbums(artistId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Search triggered for missing albums`,
              commandId: result.id,
            }, null, 2),
          }],
        };
      }

      case "lidarr_get_calendar": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const days = (args as { days?: number })?.days || 30;
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const calendar = await clients.lidarr.getCalendar(start, end);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: calendar.length,
              albums: calendar.map(a => ({
                id: a.id,
                title: a.title,
                artistId: a.artistId,
                releaseDate: a.releaseDate,
                albumType: a.albumType,
                monitored: a.monitored,
              })),
            }, null, 2),
          }],
        };
      }

      case "lidarr_add_artist": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const { foreignArtistId, artistName, qualityProfileId, metadataProfileId, rootFolderPath, monitored, tags } = args as {
          foreignArtistId: string; artistName: string; qualityProfileId: number;
          metadataProfileId: number; rootFolderPath: string; monitored?: boolean; tags?: number[];
        };
        const added = await clients.lidarr.addArtist({
          foreignArtistId, artistName, qualityProfileId, metadataProfileId, rootFolderPath, monitored, tags: tags ?? [],
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Added "${added.artistName}" to Lidarr`,
              id: added.id,
              path: added.path,
              monitored: added.monitored,
            }, null, 2),
          }],
        };
      }

      case "lidarr_get_metadata_profiles": {
        if (!clients.lidarr) throw new Error("Lidarr not configured");
        const profiles = await clients.lidarr.getMetadataProfiles();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(profiles.map(p => ({ id: p.id, name: p.name })), null, 2),
          }],
        };
      }

      // Prowlarr handlers
      case "prowlarr_get_indexers": {
        if (!clients.prowlarr) throw new Error("Prowlarr not configured");
        const indexers = await clients.prowlarr.getIndexers();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: indexers.length,
              indexers: indexers.map(i => ({
                id: i.id,
                name: i.name,
                protocol: i.protocol,
                enableRss: i.enableRss,
                enableAutomaticSearch: i.enableAutomaticSearch,
                enableInteractiveSearch: i.enableInteractiveSearch,
                priority: i.priority,
              })),
            }, null, 2),
          }],
        };
      }

      case "prowlarr_search": {
        if (!clients.prowlarr) throw new Error("Prowlarr not configured");
        const query = (args as { query: string }).query;
        const results = await clients.prowlarr.search(query);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "prowlarr_test_indexers": {
        if (!clients.prowlarr) throw new Error("Prowlarr not configured");
        const results = await clients.prowlarr.testAllIndexers();
        const indexers = await clients.prowlarr.getIndexers();
        const indexerMap = new Map(indexers.map(i => [i.id, i.name]));
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: results.length,
              indexers: results.map(r => ({
                id: r.id,
                name: indexerMap.get(r.id) || 'Unknown',
                isValid: r.isValid,
                errors: r.validationFailures.map(f => f.errorMessage),
              })),
              healthy: results.filter(r => r.isValid).length,
              failed: results.filter(r => !r.isValid).length,
            }, null, 2),
          }],
        };
      }

      case "prowlarr_get_stats": {
        if (!clients.prowlarr) throw new Error("Prowlarr not configured");
        const stats = await clients.prowlarr.getIndexerStats();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: stats.indexers.length,
              indexers: stats.indexers.map(s => ({
                name: s.indexerName,
                queries: s.numberOfQueries,
                grabs: s.numberOfGrabs,
                failedQueries: s.numberOfFailedQueries,
                failedGrabs: s.numberOfFailedGrabs,
                avgResponseTime: s.averageResponseTime + 'ms',
              })),
              totals: {
                queries: stats.indexers.reduce((sum, s) => sum + s.numberOfQueries, 0),
                grabs: stats.indexers.reduce((sum, s) => sum + s.numberOfGrabs, 0),
                failedQueries: stats.indexers.reduce((sum, s) => sum + s.numberOfFailedQueries, 0),
                failedGrabs: stats.indexers.reduce((sum, s) => sum + s.numberOfFailedGrabs, 0),
              },
            }, null, 2),
          }],
        };
      }

      // Cross-service search
      // Whisparr handlers
      case "whisparr_get_library": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const { limit = 25, offset = 0, search } = args as {
          limit?: number;
          offset?: number;
          search?: string;
        };
        const normalizedLimit = Math.max(1, Math.min(limit, 100));
        const normalizedOffset = Math.max(0, offset);
        const filter = search?.trim().toLowerCase();

        const variant = await clients.whisparr.getVariant();
        const allItems = await clients.whisparr.getLibrary();
        const filteredItems = filter
          ? allItems.filter(i => i.title.toLowerCase().includes(filter))
          : allItems;
        const pagedItems = filteredItems.slice(normalizedOffset, normalizedOffset + normalizedLimit);
        return jsonText({
          variant,
          itemType: variant === 'v2' ? 'site' : 'scene',
          total: allItems.length,
          filteredCount: filteredItems.length,
          returned: pagedItems.length,
          offset: normalizedOffset,
          limit: normalizedLimit,
          hasMore: normalizedOffset + normalizedLimit < filteredItems.length,
          nextOffset: normalizedOffset + normalizedLimit < filteredItems.length
            ? normalizedOffset + normalizedLimit
            : null,
          search: search ?? null,
          items: pagedItems.map(item => {
            const fileCount = whisparrFileCount(item);
            return {
              id: item.id,
              title: item.title,
              year: item.year,
              status: item.status,
              monitored: item.monitored,
              path: item.path,
              // The provider id, so a row can be matched against a lookup
              // result. Missing means the row cannot be re-added or matched.
              key: whisparrItemKey(item) ?? null,
              fileCount,
              sizeOnDisk: formatBytes(whisparrSizeOnDisk(item)),
              // A row holding no files may simply be unaired, or may have lost
              // its file mapping to a dead upstream id. whisparr_check_folder
              // tells the two apart.
              holdsNoFiles: fileCount === 0,
            };
          }),
        });
      }

      case "whisparr_search": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const term = (args as { term: string }).term;
        const variant = await clients.whisparr.getVariant();
        const results = await clients.whisparr.searchLibrary(term);
        return jsonText({
          variant,
          itemType: variant === 'v2' ? 'site' : 'scene',
          count: results.length,
          // A live id that is already in the library comes back with that
          // row's id; one that is not carries id 0. An empty result set is
          // the only evidence that upstream metadata is genuinely gone.
          results: results.slice(0, 10).map(r => ({
            title: r.title,
            year: r.year,
            key: whisparrItemKey(r) ?? null,
            inLibrary: r.id > 0,
            libraryId: r.id > 0 ? r.id : null,
            path: r.id > 0 ? r.path : null,
            fileCount: r.id > 0 ? whisparrFileCount(r) : null,
            overview: r.overview?.substring(0, 200) + (r.overview && r.overview.length > 200 ? '...' : ''),
          })),
        });
      }

      case "whisparr_get_scenes": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const siteId = (args as { siteId: number }).siteId;
        const scenes = await clients.whisparr.getScenes(siteId);
        return jsonText({
          count: scenes.length,
          scenes: scenes.map(e => ({
            id: e.id,
            title: e.title,
            airDate: e.airDate,
            hasFile: e.hasFile,
            monitored: e.monitored,
          })),
        });
      }

      case "whisparr_get_queue": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        return jsonText(await getPaginatedQueue(clients.whisparr, args as { limit?: number; offset?: number }));
      }

      case "whisparr_get_calendar": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const days = (args as { days?: number })?.days || 7;
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return jsonText(await clients.whisparr.getCalendar(start, end));
      }

      case "whisparr_search_item": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const itemId = (args as { itemId: number }).itemId;
        const result = await clients.whisparr.searchItem(itemId);
        return jsonText({ triggered: true, commandId: result.id, itemId });
      }

      case "whisparr_check_folder": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const path = (args as { path: string }).path;
        const [mediaFiles, contents] = await Promise.all([
          clients.whisparr.getFolderMediaFiles(path),
          clients.whisparr.getFolderContents(path),
        ]);
        return jsonText({
          path,
          mediaFileCount: mediaFiles.length,
          mediaFiles: mediaFiles.slice(0, 50).map(f => f.name),
          otherFileCount: Math.max(contents.files.length - mediaFiles.length, 0),
          subfolderCount: contents.directories.length,
          // Whisparr reports an empty folder and a missing one identically,
          // so say what was observed rather than asserting the folder exists.
          note: mediaFiles.length === 0
            ? "No media files found here. The folder is empty, holds no video files, or does not exist."
            : "Media present. If the library row for this path reports zero files, these are untracked.",
        });
      }

      case "whisparr_delete_item": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const itemId = (args as { itemId: number }).itemId;
        await clients.whisparr.deleteItem(itemId);
        return jsonText({
          deleted: true,
          itemId,
          filesDeleted: false,
          importExclusionAdded: false,
        });
      }

      case "whisparr_add_item": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const item = args as {
          key: string;
          qualityProfileId: number;
          title?: string;
          path?: string;
          rootFolderPath?: string;
          monitored?: boolean;
          search?: boolean;
        };
        if (!item.path && !item.rootFolderPath) {
          throw new Error("whisparr_add_item needs either path (an existing folder to attach to) or rootFolderPath");
        }
        const added = await clients.whisparr.addItem(item);
        return jsonText({
          added: true,
          id: added.id,
          title: added.title,
          path: added.path,
          key: whisparrItemKey(added) ?? null,
          nextStep: item.path
            ? "Call whisparr_rescan_item with this id so the files already in the folder are detected."
            : null,
        });
      }

      case "whisparr_rescan_item": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const itemId = (args as { itemId: number }).itemId;
        const result = await clients.whisparr.rescanItem(itemId);
        return jsonText({ triggered: true, commandId: result.id, itemId });
      }

      case "whisparr_refresh_item": {
        if (!clients.whisparr) throw new Error("Whisparr not configured");
        const itemId = (args as { itemId: number }).itemId;
        const result = await clients.whisparr.refreshItem(itemId);
        return jsonText({ triggered: true, commandId: result.id, itemId });
      }

      // ---- Chaptarr ------------------------------------------------------
      //
      // Every response carries the provider id next to the local id. Chaptarr's
      // own contract is explicit that local row ids are handles which change
      // when metadata is repaired or merged, so a caller holding an id across
      // turns should hold the provider id.
      case "chaptarr_get_authors": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { limit = 25, offset = 0, search, mediaType } = args as {
          limit?: number; offset?: number; search?: string; mediaType?: string;
        };
        const scope = parseChaptarrMediaType(mediaType);
        const normalizedLimit = Math.max(1, Math.min(limit, 100));
        const normalizedOffset = Math.max(0, offset);
        const filter = search?.trim().toLowerCase();

        const all = await clients.chaptarr.getAuthors(scope);
        const filtered = filter
          ? all.filter(a => a.authorName?.toLowerCase().includes(filter))
          : all;
        const paged = filtered.slice(normalizedOffset, normalizedOffset + normalizedLimit);
        return jsonText({
          mediaType: scope ?? 'all',
          total: all.length,
          filteredCount: filtered.length,
          returned: paged.length,
          offset: normalizedOffset,
          limit: normalizedLimit,
          hasMore: normalizedOffset + normalizedLimit < filtered.length,
          nextOffset: normalizedOffset + normalizedLimit < filtered.length
            ? normalizedOffset + normalizedLimit : null,
          search: search ?? null,
          authors: paged.map(summarizeChaptarrAuthor),
        });
      }

      case "chaptarr_get_author": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { authorId } = args as { authorId: number };
        const author = await clients.chaptarr.getAuthorById(authorId);
        return jsonText(summarizeChaptarrAuthor(author));
      }

      case "chaptarr_get_books": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { authorId, limit = 25, offset = 0, search, mediaType } = args as {
          authorId?: number; limit?: number; offset?: number; search?: string; mediaType?: string;
        };
        const scope = parseChaptarrMediaType(mediaType);
        const normalizedLimit = Math.max(1, Math.min(limit, 100));
        const normalizedOffset = Math.max(0, offset);
        const filter = search?.trim().toLowerCase();

        const all = await clients.chaptarr.getBooks(authorId, scope);
        const filtered = filter
          ? all.filter(b => b.title?.toLowerCase().includes(filter))
          : all;
        const paged = filtered.slice(normalizedOffset, normalizedOffset + normalizedLimit);
        return jsonText({
          mediaType: scope ?? 'all',
          authorId: authorId ?? null,
          total: all.length,
          filteredCount: filtered.length,
          returned: paged.length,
          offset: normalizedOffset,
          limit: normalizedLimit,
          hasMore: normalizedOffset + normalizedLimit < filtered.length,
          nextOffset: normalizedOffset + normalizedLimit < filtered.length
            ? normalizedOffset + normalizedLimit : null,
          search: search ?? null,
          books: paged.map(summarizeChaptarrBook),
        });
      }

      case "chaptarr_search": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { term } = args as { term: string };
        const results = await clients.chaptarr.searchAuthors(term);
        return jsonText({
          term,
          count: results.length,
          // A non-zero id means the author is already in the library.
          authors: results.map(a => ({
            ...summarizeChaptarrAuthor(a),
            inLibrary: Boolean(a.id),
          })),
        });
      }

      case "chaptarr_search_book": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { term } = args as { term: string };
        const results = await clients.chaptarr.searchBooks(term);
        return jsonText({
          term,
          count: results.length,
          books: results.map(b => ({
            ...summarizeChaptarrBook(b),
            inLibrary: Boolean(b.id),
          })),
        });
      }

      case "chaptarr_get_editions": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { bookId } = args as { bookId: number };
        const editions = await clients.chaptarr.getEditions(bookId);
        return jsonText({
          bookId,
          count: editions.length,
          editions: editions.map(e => ({
            id: e.id,
            title: e.title,
            foreignEditionId: e.foreignEditionId ?? null,
            isbn13: e.isbn13 ?? null,
            asin: e.asin ?? null,
            publisher: e.publisher ?? null,
            pageCount: e.pageCount ?? null,
            isEbook: e.isEbook ?? null,
            monitored: e.monitored ?? null,
          })),
        });
      }

      case "chaptarr_get_series": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { authorId } = args as { authorId?: number };
        const series = await clients.chaptarr.getSeries(authorId);
        return jsonText({
          authorId: authorId ?? null,
          count: series.length,
          series: series.map(x => ({
            id: x.id,
            // Durable identity, as everywhere else in the Chaptarr tools.
            foreignSeriesId: x.foreignSeriesId ?? null,
            title: x.title,
            description: x.description || null,
            mediaType: x.mediaType ?? null,
            workCount: x.workCount ?? null,
            primaryWorkCount: x.primaryWorkCount ?? null,
            // Reading order, sorted, so a caller can answer "what's next".
            books: (x.links ?? [])
              .slice()
              .sort((a, b) => (a.seriesPosition ?? 0) - (b.seriesPosition ?? 0))
              .map(l => ({ bookId: l.bookId, position: l.position ?? null })),
          })),
        });
      }

      case "chaptarr_get_queue": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { page = 1, pageSize = 25 } = args as { page?: number; pageSize?: number };
        const queue = await clients.chaptarr.getQueue(
          Math.max(1, page), Math.max(1, Math.min(pageSize, 100)));
        return jsonText({
          totalRecords: queue.totalRecords,
          returned: queue.records.length,
          page: Math.max(1, page),
          items: queue.records,
        });
      }

      case "chaptarr_get_missing": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { page = 1, pageSize = 25, mediaType } = args as {
          page?: number; pageSize?: number; mediaType?: string;
        };
        const scope = parseChaptarrMediaType(mediaType);
        const missing = await clients.chaptarr.getMissing(
          Math.max(1, page), Math.max(1, Math.min(pageSize, 100)), scope);
        return jsonText({
          mediaType: scope ?? 'all',
          totalRecords: missing.totalRecords,
          returned: missing.records?.length ?? 0,
          page: Math.max(1, page),
          books: (missing.records ?? []).map(summarizeChaptarrBook),
        });
      }

      case "chaptarr_get_calendar": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { start, end } = args as { start?: string; end?: string };
        const calendar = await clients.chaptarr.getCalendar(start, end);
        return jsonText({ start: start ?? null, end: end ?? null, count: calendar.length, items: calendar });
      }

      case "chaptarr_get_metadata_profiles": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const profiles = await clients.chaptarr.getMetadataProfiles();
        return jsonText({ count: profiles.length, profiles });
      }

      case "chaptarr_add_author": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const a = args as {
          foreignAuthorId: string; rootFolderPath: string; qualityProfileId: number;
          metadataProfileId: number; mediaType: string; monitored?: boolean;
        };
        // Required here, not optional: Chaptarr creates the author on one side
        // of the library and will not infer which.
        const side = parseChaptarrMediaType(a.mediaType, false) as 'audiobook' | 'ebook';
        const author = await clients.chaptarr.addAuthor({
          foreignAuthorId: a.foreignAuthorId,
          rootFolderPath: a.rootFolderPath,
          qualityProfileId: a.qualityProfileId,
          metadataProfileId: a.metadataProfileId,
          mediaType: side,
          monitored: a.monitored,
        });
        return jsonText({ added: true, mediaType: side, author: summarizeChaptarrAuthor(author) });
      }

      case "chaptarr_trigger_book_search": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { bookIds } = args as { bookIds: number[] };
        if (!Array.isArray(bookIds) || bookIds.length === 0) {
          throw new Error("bookIds must be a non-empty array of local Chaptarr book ids");
        }
        const command = await clients.chaptarr.triggerBookSearch(bookIds);
        return jsonText({ triggered: true, bookIds, commandId: command.id });
      }

      case "chaptarr_search_missing": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { authorId, mediaType } = args as { authorId?: number; mediaType?: string };
        const scope = parseChaptarrMediaType(mediaType);
        const command = await clients.chaptarr.searchMissing(authorId, scope);
        return jsonText({
          triggered: true,
          authorId: authorId ?? null,
          mediaType: scope ?? 'all',
          commandId: command.id,
        });
      }

      case "chaptarr_refresh_author": {
        if (!clients.chaptarr) throw new Error("Chaptarr not configured");
        const { authorId } = args as { authorId: number };
        const command = await clients.chaptarr.refreshAuthor(authorId);
        return jsonText({ triggered: true, authorId, commandId: command.id });
      }

      // ---- Jellyseerr -----------------------------------------------------
      case "jellyseerr_get_summary": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const [counts, issues] = await Promise.all([
          clients.jellyseerr.getRequestCounts(),
          clients.jellyseerr.getIssueCount().catch(() => ({} as Record<string, number>)),
        ]);
        return jsonText({
          requests: {
            total: counts.total,
            // The state worth acting on: nothing else needs a human.
            pending: counts.pending,
            approved: counts.approved,
            processing: counts.processing,
            available: counts.available,
            declined: counts.declined,
            failed: counts.failed ?? null,
            completed: counts.completed ?? null,
            movie: counts.movie,
            tv: counts.tv,
          },
          issues,
        });
      }

      case "jellyseerr_get_requests": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { filter, take = 20, skip = 0, sort = "added", includeTitles = true } = args as {
          filter?: string; take?: number; skip?: number;
          sort?: "added" | "modified"; includeTitles?: boolean;
        };
        const parsed = parseJellyseerrFilter(filter);
        const page = await clients.jellyseerr.getRequests(parsed, take, skip, sort);
        const rows = includeTitles
          ? await withJellyseerrTitles(clients.jellyseerr, page.results)
          : page.results.map(r => summarizeJellyseerrRequest(r));
        return jsonText({
          filter: parsed ?? 'all',
          total: page.pageInfo?.results ?? rows.length,
          returned: rows.length,
          skip,
          hasMore: skip + rows.length < (page.pageInfo?.results ?? rows.length),
          nextSkip: skip + rows.length < (page.pageInfo?.results ?? rows.length) ? skip + rows.length : null,
          titlesResolved: includeTitles,
          requests: rows,
        });
      }

      case "jellyseerr_get_request": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { requestId } = args as { requestId: number };
        const r = await clients.jellyseerr.getRequestById(requestId);
        const title = await clients.jellyseerr.getTitle(r.type, r.media?.tmdbId ?? 0);
        return jsonText(summarizeJellyseerrRequest(r, title));
      }

      case "jellyseerr_approve_request":
      case "jellyseerr_decline_request": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { requestId } = args as { requestId: number };
        const approving = name === "jellyseerr_approve_request";
        const updated = await clients.jellyseerr.setRequestStatus(
          requestId, approving ? 'approve' : 'decline');
        return jsonText({
          requestId,
          action: approving ? 'approved' : 'declined',
          status: JELLYSEERR_REQUEST_STATUS[updated.status] ?? `unknown (${updated.status})`,
          statusCode: updated.status,
          note: approving
            ? 'Handed to Sonarr/Radarr; a download will start if an indexer has it.'
            : undefined,
        });
      }

      case "jellyseerr_get_issues": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { take = 20, skip = 0 } = args as { take?: number; skip?: number };
        const page = await clients.jellyseerr.getIssues(take, skip);
        return jsonText({
          total: page.pageInfo?.results ?? page.results.length,
          returned: page.results.length,
          skip,
          issues: page.results,
        });
      }

      case "jellyseerr_search": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { query } = args as { query: string };
        const page = await clients.jellyseerr.search(query);
        return jsonText({
          query,
          total: page.pageInfo?.results ?? page.results.length,
          results: page.results.slice(0, 20),
        });
      }

      case "jellyseerr_get_users": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const { take = 50 } = args as { take?: number };
        const page = await clients.jellyseerr.getUsers(take);
        return jsonText({
          total: page.pageInfo?.results ?? page.results.length,
          users: page.results.map(u => ({
            id: u.id,
            displayName: u.displayName ?? u.username ?? null,
            email: u.email ?? null,
            requestCount: u.requestCount ?? 0,
            userType: u.userType ?? null,
          })),
        });
      }

      case "jellyseerr_review_setup": {
        if (!clients.jellyseerr) throw new Error("Jellyseerr not configured");
        const [about, counts, issues, users] = await Promise.all([
          clients.jellyseerr.getAbout().catch(() => ({} as Record<string, unknown>)),
          clients.jellyseerr.getRequestCounts(),
          clients.jellyseerr.getIssueCount().catch(() => ({} as Record<string, number>)),
          clients.jellyseerr.getUsers(100).catch(() => ({ results: [], pageInfo: { results: 0 } } as never)),
        ]);
        return jsonText({
          service: 'jellyseerr',
          version: about.version ?? null,
          requests: counts,
          issues,
          userCount: users.pageInfo?.results ?? users.results?.length ?? 0,
          // A non-zero pending count with no recent approvals is the usual
          // sign nobody is minding the queue.
          needsAttention: {
            pendingRequests: counts.pending,
            openIssues: issues.open ?? 0,
          },
        });
      }

      // ---- Bazarr ---------------------------------------------------------
      //
      // Listing endpoints are paginated because Bazarr has no server-side
      // default and returns megabytes over ~70s without one.
      case "bazarr_get_summary": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const badges = await clients.bazarr.getBadges();
        return jsonText({
          episodesMissingSubtitles: badges.episodes ?? 0,
          moviesMissingSubtitles: badges.movies ?? 0,
          // Bazarr counts providers that are in an error state here, not the
          // number configured, so anything above zero is a problem.
          providersUnhealthy: badges.providers ?? 0,
          healthIssues: badges.status ?? 0,
          sonarrConnection: badges.sonarr_signalr ?? null,
          radarrConnection: badges.radarr_signalr ?? null,
        });
      }

      case "bazarr_get_wanted_episodes": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { start = 0, length = 25 } = args as { start?: number; length?: number };
        const page = await clients.bazarr.getWantedEpisodes(start, length);
        return jsonText({
          total: page.total,
          returned: page.data.length,
          start,
          hasMore: start + page.data.length < page.total,
          nextStart: start + page.data.length < page.total ? start + page.data.length : null,
          episodes: page.data.map((e: BazarrWantedEpisode) => ({
            seriesTitle: e.seriesTitle,
            episode: e.episode_number,
            episodeTitle: e.episodeTitle,
            missingLanguages: (e.missing_subtitles ?? []).map(m => m.name),
            // The ids the Sonarr tools in this server take.
            sonarrSeriesId: e.sonarrSeriesId,
            sonarrEpisodeId: e.sonarrEpisodeId,
            sceneName: e.sceneName ?? null,
          })),
        });
      }

      case "bazarr_get_wanted_movies": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { start = 0, length = 25 } = args as { start?: number; length?: number };
        const page = await clients.bazarr.getWantedMovies(start, length);
        return jsonText({
          total: page.total,
          returned: page.data.length,
          start,
          hasMore: start + page.data.length < page.total,
          nextStart: start + page.data.length < page.total ? start + page.data.length : null,
          movies: page.data.map((m: BazarrWantedMovie) => ({
            title: m.title,
            missingLanguages: (m.missing_subtitles ?? []).map(x => x.name),
            radarrId: m.radarrId,
            sceneName: m.sceneName ?? null,
          })),
        });
      }

      case "bazarr_get_providers": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const providers = await clients.bazarr.getProviders();
        const unhealthy = providers.filter(p => p.status && p.status !== 'Good');
        return jsonText({
          count: providers.length,
          unhealthyCount: unhealthy.length,
          // Called out separately: a provider in error stops subtitles
          // arriving while everything else still looks healthy.
          unhealthy: unhealthy.map(p => ({ name: p.name, status: p.status, retry: p.retry })),
          providers,
        });
      }

      case "bazarr_get_episode_history":
      case "bazarr_get_movie_history": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { start = 0, length = 25 } = args as { start?: number; length?: number };
        const forEpisodes = name === "bazarr_get_episode_history";
        const page = forEpisodes
          ? await clients.bazarr.getEpisodeHistory(start, length)
          : await clients.bazarr.getMovieHistory(start, length);
        return jsonText({
          total: page.total,
          returned: page.data.length,
          start,
          hasMore: start + page.data.length < page.total,
          nextStart: start + page.data.length < page.total ? start + page.data.length : null,
          history: page.data.map(h => ({
            title: forEpisodes ? h.seriesTitle : h.title,
            episode: h.episode_number ?? null,
            episodeTitle: h.episodeTitle ?? null,
            language: h.language?.name ?? null,
            provider: h.provider ?? null,
            score: h.score ?? null,
            timestamp: h.timestamp ?? null,
            upgradable: h.upgradable ?? null,
            blacklisted: h.blacklisted ?? null,
            sonarrSeriesId: h.sonarrSeriesId ?? null,
            sonarrEpisodeId: h.sonarrEpisodeId ?? null,
            radarrId: h.radarrId ?? null,
          })),
        });
      }

      case "bazarr_get_series":
      case "bazarr_get_movies": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { start = 0, length = 25 } = args as { start?: number; length?: number };
        const page = name === "bazarr_get_series"
          ? await clients.bazarr.getSeries(start, length)
          : await clients.bazarr.getMovies(start, length);
        return jsonText({
          total: page.total,
          returned: page.data.length,
          start,
          hasMore: start + page.data.length < page.total,
          nextStart: start + page.data.length < page.total ? start + page.data.length : null,
          items: page.data,
        });
      }

      case "bazarr_get_episodes": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { seriesId } = args as { seriesId: number };
        const episodes = await clients.bazarr.getEpisodes(seriesId);
        return jsonText({ sonarrSeriesId: seriesId, count: episodes.length, episodes });
      }

      case "bazarr_search_episode_subtitles": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { episodeId } = args as { episodeId: number };
        const results = await clients.bazarr.searchEpisodeSubtitles(episodeId);
        return jsonText({
          sonarrEpisodeId: episodeId,
          count: results.length,
          // An empty result is ambiguous on its own, so say so rather than
          // letting it read as "no subtitles exist".
          note: results.length === 0
            ? "No provider returned a result. Check bazarr_get_providers - a provider in an error state produces an empty search rather than an error."
            : undefined,
          results,
        });
      }

      case "bazarr_search_movie_subtitles": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const { radarrId } = args as { radarrId: number };
        const results = await clients.bazarr.searchMovieSubtitles(radarrId);
        return jsonText({
          radarrId,
          count: results.length,
          note: results.length === 0
            ? "No provider returned a result. Check bazarr_get_providers - a provider in an error state produces an empty search rather than an error."
            : undefined,
          results,
        });
      }

      case "bazarr_get_language_profiles": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const profiles = await clients.bazarr.getLanguageProfiles();
        return jsonText({ count: profiles.length, profiles });
      }

      case "bazarr_review_setup": {
        if (!clients.bazarr) throw new Error("Bazarr not configured");
        const [status, health, providers, profiles, badges] = await Promise.all([
          clients.bazarr.getBazarrStatus(),
          clients.bazarr.getBazarrHealth(),
          clients.bazarr.getProviders(),
          clients.bazarr.getLanguageProfiles(),
          clients.bazarr.getBadges(),
        ]);
        const unhealthy = providers.filter(p => p.status && p.status !== 'Good');
        return jsonText({
          service: 'bazarr',
          version: status.bazarr_version ?? null,
          // Bazarr reports the versions of the apps it is wired to, which is
          // how you tell it is pointed at the same Sonarr/Radarr as the rest
          // of these tools.
          connectedTo: {
            sonarrVersion: status.sonarr_version ?? null,
            radarrVersion: status.radarr_version ?? null,
            sonarrConnection: badges.sonarr_signalr ?? null,
            radarrConnection: badges.radarr_signalr ?? null,
          },
          wanted: {
            episodesMissingSubtitles: badges.episodes ?? 0,
            moviesMissingSubtitles: badges.movies ?? 0,
          },
          healthIssues: health,
          providers: {
            count: providers.length,
            unhealthy: unhealthy.map(p => ({ name: p.name, status: p.status, retry: p.retry })),
            all: providers,
          },
          languageProfiles: profiles,
        });
      }

      case "arr_search_all": {
        const term = (args as { term: string }).term;
        const results: Record<string, unknown> = {};

        if (clients.sonarr) {
          try {
            const sonarrResults = await clients.sonarr.searchSeries(term);
            results.sonarr = { count: sonarrResults.length, results: sonarrResults.slice(0, 5) };
          } catch (e) {
            results.sonarr = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        if (clients.radarr) {
          try {
            const radarrResults = await clients.radarr.searchMovies(term);
            results.radarr = { count: radarrResults.length, results: radarrResults.slice(0, 5) };
          } catch (e) {
            results.radarr = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        if (clients.lidarr) {
          try {
            const lidarrResults = await clients.lidarr.searchArtists(term);
            results.lidarr = { count: lidarrResults.length, results: lidarrResults.slice(0, 5) };
          } catch (e) {
            results.lidarr = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        if (clients.whisparr) {
          try {
            const whisparrResults = await clients.whisparr.searchLibrary(term);
            results.whisparr = { count: whisparrResults.length, results: whisparrResults.slice(0, 5) };
          } catch (e) {
            results.whisparr = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        if (clients.chaptarr) {
          // Books resolve better by title than by author for a generic term,
          // so this searches books and reports the summarized shape.
          try {
            const chaptarrResults = await clients.chaptarr.searchBooks(term);
            results.chaptarr = {
              count: chaptarrResults.length,
              results: chaptarrResults.slice(0, 5).map(summarizeChaptarrBook),
            };
          } catch (e) {
            results.chaptarr = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      // TRaSH Guides handlers
      case "trash_list_profiles": {
        const service = (args as { service: TrashService }).service;
        const profiles = await trashClient.listProfiles(service);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              service,
              count: profiles.length,
              profiles: profiles.map(p => ({
                name: p.name,
                description: p.description?.replace(/<br>/g, ' ') || 'No description',
              })),
              usage: "Use trash_get_profile to see full details for a specific profile",
            }, null, 2),
          }],
        };
      }

      case "trash_get_profile": {
        const { service, profile: profileName } = args as { service: TrashService; profile: string };
        const profile = await trashClient.getProfile(service, profileName);
        if (!profile) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: `Profile '${profileName}' not found for ${service}`,
                hint: "Use trash_list_profiles to see available profiles",
              }, null, 2),
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: profile.name,
              description: profile.trash_description?.replace(/<br>/g, '\n'),
              trash_id: profile.trash_id,
              upgradeAllowed: profile.upgradeAllowed,
              cutoff: profile.cutoff,
              minFormatScore: profile.minFormatScore,
              cutoffFormatScore: profile.cutoffFormatScore,
              language: profile.language,
              qualities: profile.items.map(i => ({
                name: i.name,
                allowed: i.allowed,
                items: i.items,
              })),
              customFormats: Object.entries(profile.formatItems || {}).map(([name, trashId]) => ({
                name,
                trash_id: trashId,
              })),
            }, null, 2),
          }],
        };
      }

      case "trash_list_custom_formats": {
        const { service, category } = args as { service: TrashService; category?: string };
        const formats = await trashClient.listCustomFormats(service, category);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              service,
              category: category || 'all',
              count: formats.length,
              formats: formats.slice(0, 50).map(f => ({
                name: f.name,
                categories: f.categories,
                defaultScore: f.defaultScore,
              })),
              note: formats.length > 50 ? `Showing first 50 of ${formats.length}. Use category filter to narrow results.` : undefined,
              availableCategories: ['hdr', 'audio', 'resolution', 'source', 'streaming', 'anime', 'unwanted', 'release', 'language'],
            }, null, 2),
          }],
        };
      }

      case "trash_get_naming": {
        const { service, mediaServer } = args as { service: TrashService; mediaServer: string };
        const naming = await trashClient.getNaming(service);
        if (!naming) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `Could not fetch naming conventions for ${service}` }, null, 2),
            }],
            isError: true,
          };
        }

        // Map media server to naming key
        const serverMap: Record<string, { folder: string; file: string }> = {
          plex: { folder: 'plex-imdb', file: 'plex-imdb' },
          emby: { folder: 'emby-imdb', file: 'emby-imdb' },
          jellyfin: { folder: 'jellyfin-imdb', file: 'jellyfin-imdb' },
          standard: { folder: 'default', file: 'standard' },
        };

        const keys = serverMap[mediaServer] || serverMap.standard;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              service,
              mediaServer,
              recommended: {
                folder: naming.folder[keys.folder] || naming.folder.default,
                file: naming.file[keys.file] || naming.file.standard,
                ...(naming.season && { season: naming.season[keys.folder] || naming.season.default }),
                ...(naming.series && { series: naming.series[keys.folder] || naming.series.default }),
              },
              allFolderOptions: Object.keys(naming.folder),
              allFileOptions: Object.keys(naming.file),
            }, null, 2),
          }],
        };
      }

      case "trash_get_quality_sizes": {
        const { service, type } = args as { service: TrashService; type?: string };
        const sizes = await trashClient.getQualitySizes(service, type);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              service,
              type: type || 'all',
              profiles: sizes.map(s => ({
                type: s.type,
                qualities: s.qualities.map(q => ({
                  quality: q.quality,
                  min: q.min + ' MB/min',
                  preferred: q.preferred === 1999 ? 'unlimited' : q.preferred + ' MB/min',
                  max: q.max === 2000 ? 'unlimited' : q.max + ' MB/min',
                })),
              })),
            }, null, 2),
          }],
        };
      }

      case "trash_compare_profile": {
        const { service, profileId, trashProfile } = args as {
          service: TrashService;
          profileId: number;
          trashProfile: string;
        };

        // Get client
        const client = service === 'radarr' ? clients.radarr : clients.sonarr;
        if (!client) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `${service} not configured. Cannot compare profiles.` }, null, 2),
            }],
            isError: true,
          };
        }

        // Fetch both profiles
        const [userProfiles, trashProfileData] = await Promise.all([
          client.getQualityProfiles(),
          trashClient.getProfile(service, trashProfile),
        ]);

        const userProfile = userProfiles.find(p => p.id === profileId);
        if (!userProfile) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: `Profile ID ${profileId} not found`,
                availableProfiles: userProfiles.map(p => ({ id: p.id, name: p.name })),
              }, null, 2),
            }],
            isError: true,
          };
        }

        if (!trashProfileData) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: `TRaSH profile '${trashProfile}' not found`,
                hint: "Use trash_list_profiles to see available profiles",
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Compare qualities
        const userQualities = new Set<string>(
          userProfile.items
            .filter(i => i.allowed)
            .map(i => i.quality?.name || i.name)
            .filter((n): n is string => n !== undefined)
        );
        const trashQualities = new Set<string>(
          trashProfileData.items
            .filter(i => i.allowed)
            .map(i => i.name)
        );

        const qualityComparison = {
          matching: [...userQualities].filter(q => trashQualities.has(q)),
          missingFromYours: [...trashQualities].filter(q => !userQualities.has(q)),
          extraInYours: [...userQualities].filter(q => !trashQualities.has(q)),
        };

        // Compare custom formats
        const userCFNames = new Set(
          (userProfile.formatItems || [])
            .filter(f => f.score !== 0)
            .map(f => f.name)
        );
        const trashCFNames = new Set(Object.keys(trashProfileData.formatItems || {}));

        const cfComparison = {
          matching: [...userCFNames].filter(cf => trashCFNames.has(cf)),
          missingFromYours: [...trashCFNames].filter(cf => !userCFNames.has(cf)),
          extraInYours: [...userCFNames].filter(cf => !trashCFNames.has(cf)),
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              yourProfile: {
                name: userProfile.name,
                id: userProfile.id,
                upgradeAllowed: userProfile.upgradeAllowed,
                cutoff: userProfile.cutoff,
              },
              trashProfile: {
                name: trashProfileData.name,
                upgradeAllowed: trashProfileData.upgradeAllowed,
                cutoff: trashProfileData.cutoff,
              },
              qualityComparison,
              customFormatComparison: cfComparison,
              recommendations: [
                ...(qualityComparison.missingFromYours.length > 0
                  ? [`Enable these qualities: ${qualityComparison.missingFromYours.join(', ')}`]
                  : []),
                ...(cfComparison.missingFromYours.length > 0
                  ? [`Add these custom formats: ${cfComparison.missingFromYours.slice(0, 5).join(', ')}${cfComparison.missingFromYours.length > 5 ? ` and ${cfComparison.missingFromYours.length - 5} more` : ''}`]
                  : []),
                ...(userProfile.upgradeAllowed !== trashProfileData.upgradeAllowed
                  ? [`Set upgradeAllowed to ${trashProfileData.upgradeAllowed}`]
                  : []),
              ],
            }, null, 2),
          }],
        };
      }

      case "trash_compare_naming": {
        const { service, mediaServer } = args as { service: TrashService; mediaServer: string };

        // Get client
        const client = service === 'radarr' ? clients.radarr : clients.sonarr;
        if (!client) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `${service} not configured. Cannot compare naming.` }, null, 2),
            }],
            isError: true,
          };
        }

        // Fetch both
        const [userNaming, trashNaming] = await Promise.all([
          client.getNamingConfig(),
          trashClient.getNaming(service),
        ]);

        if (!trashNaming) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `Could not fetch TRaSH naming for ${service}` }, null, 2),
            }],
            isError: true,
          };
        }

        // Map media server to naming key
        const serverMap: Record<string, { folder: string; file: string }> = {
          plex: { folder: 'plex-imdb', file: 'plex-imdb' },
          emby: { folder: 'emby-imdb', file: 'emby-imdb' },
          jellyfin: { folder: 'jellyfin-imdb', file: 'jellyfin-imdb' },
          standard: { folder: 'default', file: 'standard' },
        };

        const keys = serverMap[mediaServer] || serverMap.standard;
        const recommendedFolder = trashNaming.folder[keys.folder] || trashNaming.folder.default;
        const recommendedFile = trashNaming.file[keys.file] || trashNaming.file.standard;

        // Extract user's current naming (field names vary by service)
        const namingRecord = userNaming as unknown as Record<string, unknown>;
        const userFolder = namingRecord.movieFolderFormat ||
          namingRecord.seriesFolderFormat ||
          namingRecord.standardMovieFormat;
        const userFile = namingRecord.standardMovieFormat ||
          namingRecord.standardEpisodeFormat;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mediaServer,
              yourNaming: {
                folder: userFolder,
                file: userFile,
              },
              trashRecommended: {
                folder: recommendedFolder,
                file: recommendedFile,
              },
              folderMatch: userFolder === recommendedFolder,
              fileMatch: userFile === recommendedFile,
              recommendations: [
                ...(userFolder !== recommendedFolder ? [`Update folder format to: ${recommendedFolder}`] : []),
                ...(userFile !== recommendedFile ? [`Update file format to: ${recommendedFile}`] : []),
              ],
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function startHttpServer() {
  startHealthProbe();

  const httpServer = createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Missing URL");
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HTTP_HOST}:${HTTP_PORT}`}`);

    if (requestUrl.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        version: SERVER_VERSION,
        transport: "http",
        access: ACCESS_MODE,
        toolCount: toolsFor(ACCESS_MODE).length,
        // Kept for compatibility: which services were configured at all.
        configuredServices: configuredServices.map((service) => service.name),
        // Whether those configurations actually work.
        credentialsOk: credentialsOk(),
        services: Object.fromEntries(serviceHealth),
      }));
      return;
    }

    if (requestUrl.pathname !== HTTP_PATH) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    // Stateless HTTP: a fresh server + transport per request, with no session
    // id issued (sessionIdGenerator: undefined). This lets MCP clients that do
    // not echo the Mcp-Session-Id header back — e.g. Claude Code — work. Using a
    // new server per request means requests are no longer serialized through a
    // single shared server, so a long-lived GET (SSE) stream can stay open
    // without blocking other requests. The previous shared-server + serialized
    // queue deadlocked the moment a streamable client (e.g. a gateway/proxy)
    // opened its GET stream — that request never completes, so every later
    // request hung behind it.
    const requestServer = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void requestServer.close();
    });
    try {
      await requestServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(error instanceof Error ? error.message : String(error));
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(HTTP_PORT, HTTP_HOST, () => resolve());
  });

  console.error(
    `*arr MCP server running over HTTP at http://${HTTP_HOST}:${HTTP_PORT}${HTTP_PATH}` +
    ` - access: ${ACCESS_MODE} (${toolsFor(ACCESS_MODE).length} tools)`,
  );
}

// Start the server
async function main() {
  if (TRANSPORT_MODE === "http") {
    await startHttpServer();
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`*arr MCP server running over stdio - access: ${ACCESS_MODE} - configured services: ${configuredServices.map(s => s.name).join(', ') || 'none (TRaSH-only mode)'}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
