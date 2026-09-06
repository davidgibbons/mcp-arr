/**
 * *arr Suite API Client
 *
 * All *arr applications (Sonarr, Radarr, Lidarr, Prowlarr, Whisparr) use
 * the same REST API pattern with X-Api-Key header authentication.
 */

export type ArrService = 'sonarr' | 'radarr' | 'lidarr' | 'prowlarr' | 'whisparr' | 'chaptarr' | 'jellyseerr' | 'bazarr';

export interface ArrConfig {
  url: string;
  apiKey: string;
}

export interface SystemStatus {
  appName: string;
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  isDocker: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
}

export interface QueueItem {
  id: number;
  title: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  statusMessages: Array<{ title: string; messages: string[] }>;
  downloadId: string;
  protocol: string;
  downloadClient: string;
  outputPath: string;
  sizeleft: number;
  size: number;
  timeleft: string;
  estimatedCompletionTime: string;
}

export interface Series {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  network: string;
  airTime: string;
  images: Array<{ coverType: string; url: string }>;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  year: number;
  path: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId: number;
  tvMazeId: number;
  firstAired: string;
  seriesType: string;
  cleanTitle: string;
  imdbId: string;
  titleSlug: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface Episode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  absoluteEpisodeNumber: number;
  unverifiedSceneNumbering: boolean;
  episodeFile?: {
    id: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string } };
  };
}

export interface Movie {
  id: number;
  title: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: string;
  overview: string;
  inCinemas: string;
  physicalRelease: string;
  digitalRelease: string;
  images: Array<{ coverType: string; url: string }>;
  website: string;
  year: number;
  hasFile: boolean;
  youTubeTrailerId: string;
  studio: string;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: string;
  isAvailable: boolean;
  folderName: string;
  runtime: number;
  cleanTitle: string;
  imdbId: string;
  tmdbId: number;
  titleSlug: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: Record<string, { votes: number; value: number; type: string }>;
  movieFile?: {
    id: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string; source?: string; resolution?: number } };
    mediaInfo?: {
      audioBitrate: number;
      audioChannels: number;
      audioCodec: string;
      audioLanguages: string;
      audioStreamCount: number;
      videoBitDepth: number;
      videoBitrate: number;
      videoCodec: string;
      videoDynamicRange: string;
      videoDynamicRangeType: string;
      videoFps: number;
      resolution: string;
      runTime: string;
      scanType: string;
      subtitles: string;
    };
  };
}

export interface Album {
  id: number;
  title: string;
  disambiguation: string;
  overview: string;
  artistId: number;
  foreignAlbumId: string;
  monitored: boolean;
  anyReleaseOk: boolean;
  profileId: number;
  duration: number;
  albumType: string;
  genres: string[];
  images: Array<{ coverType: string; url: string }>;
  links: Array<{ url: string; name: string }>;
  statistics?: {
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
  releaseDate: string;
  releases: Array<{
    id: number;
    albumId: number;
    foreignReleaseId: string;
    title: string;
    status: string;
    duration: number;
    trackCount: number;
    monitored: boolean;
  }>;
  grabbed: boolean;
}

export interface Artist {
  id: number;
  artistName: string;
  sortName: string;
  status: string;
  overview: string;
  artistType: string;
  disambiguation: string;
  links: Array<{ url: string; name: string }>;
  images: Array<{ coverType: string; url: string }>;
  path: string;
  qualityProfileId: number;
  metadataProfileId: number;
  monitored: boolean;
  monitorNewItems: string;
  genres: string[];
  cleanName: string;
  foreignArtistId: string;
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics: {
    albumCount: number;
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
}

export interface Indexer {
  id: number;
  name: string;
  enableRss: boolean;
  enableAutomaticSearch: boolean;
  enableInteractiveSearch: boolean;
  protocol: string;
  priority: number;
  added: string;
}

// Configuration interfaces
export interface QualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
  items: Array<{
    id?: number;
    name?: string;
    quality?: { id: number; name: string; source: string; resolution: number };
    items?: Array<{ quality: { id: number; name: string } }>;
    allowed: boolean;
  }>;
  minFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{
    format: number;
    name: string;
    score: number;
  }>;
}

export interface QualityDefinition {
  id: number;
  quality: {
    id: number;
    name: string;
    source: string;
    resolution: number;
  };
  title: string;
  weight: number;
  minSize: number;
  maxSize: number;
  preferredSize: number;
}

export interface DownloadClient {
  id: number;
  name: string;
  implementation: string;
  implementationName: string;
  configContract: string;
  enable: boolean;
  protocol: string;
  priority: number;
  removeCompletedDownloads: boolean;
  removeFailedDownloads: boolean;
  fields: Array<{
    name: string;
    value: unknown;
  }>;
  tags: number[];
}

export interface RemotePathMapping {
  id: number;
  host: string;
  remotePath: string;
  localPath: string;
}

export interface NamingConfig {
  renameEpisodes?: boolean;
  replaceIllegalCharacters: boolean;
  colonReplacementFormat?: string;
  standardEpisodeFormat?: string;
  dailyEpisodeFormat?: string;
  animeEpisodeFormat?: string;
  seriesFolderFormat?: string;
  seasonFolderFormat?: string;
  specialsFolderFormat?: string;
  multiEpisodeStyle?: number;
  // Radarr
  renameMovies?: boolean;
  movieFolderFormat?: string;
  standardMovieFormat?: string;
  // Lidarr
  renameTracks?: boolean;
  artistFolderFormat?: string;
  albumFolderFormat?: string;
  trackFormat?: string;
}

export interface MediaManagementConfig {
  autoUnmonitorPreviouslyDownloadedEpisodes?: boolean;
  autoUnmonitorPreviouslyDownloadedMovies?: boolean;
  recycleBin: string;
  recycleBinCleanupDays: number;
  downloadPropersAndRepacks: string;
  createEmptySeriesFolders?: boolean;
  createEmptyMovieFolders?: boolean;
  deleteEmptyFolders: boolean;
  fileDate: string;
  rescanAfterRefresh: string;
  setPermissionsLinux: boolean;
  chmodFolder: string;
  chownGroup: string;
  episodeTitleRequired?: string;
  skipFreeSpaceCheckWhenImporting: boolean;
  minimumFreeSpaceWhenImporting: number;
  copyUsingHardlinks: boolean;
  importExtraFiles: boolean;
  extraFileExtensions: string;
  enableMediaInfo: boolean;
}

export interface HealthCheck {
  source: string;
  type: string;
  message: string;
  wikiUrl: string;
}

export interface Tag {
  id: number;
  label: string;
}

export interface RootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
  unmappedFolders?: Array<{ name: string; path: string }>;
}

export interface MetadataProfile {
  id: number;
  name: string;
  minPopularity?: number;
  skipMissingDate: boolean;
  skipMissingIsbn: boolean;
  skipPartsAndSets: boolean;
  skipSeriesSecondary: boolean;
  allowedLanguages?: string;
  minPages?: number;
}

export interface SearchResult {
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  year: number;
  images: Array<{ coverType: string; url: string }>;
  remotePoster?: string;
  // Sonarr specific
  tvdbId?: number;
  // Radarr specific
  tmdbId?: number;
  imdbId?: string;
  // Lidarr specific
  foreignArtistId?: string;
  artistName?: string;
  disambiguation?: string;
}

/**
 * An HTTP error from an *arr API, carrying the status code. Callers that need
 * to distinguish a rejected key (401/403) from any other failure should check
 * `httpStatus` rather than parsing the message.
 */
export class ArrApiError extends Error {
  constructor(message: string, readonly httpStatus: number) {
    super(message);
    this.name = "ArrApiError";
  }
}

/**
 * How long a credential probe may take before it is called unreachable. Node's
 * fetch has no default response timeout: without this, a host that completes the
 * TCP handshake and then goes silent leaves the probe pending forever.
 */
const PROBE_TIMEOUT_MS = 10_000;

export type ProbeStatus = "ok" | "unauthorized" | "unreachable";

export interface ProbeResult {
  status: ProbeStatus;
  error?: string;
}

/**
 * Turn a thrown probe failure into a status. 401 and 403 mean the service
 * answered and rejected the credential; anything else (DNS, refused, timeout,
 * an unexpected 404) means we cannot say the credential is wrong, only that we
 * could not check it.
 */
export function classifyProbeError(error: unknown): ProbeResult {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ArrApiError && (error.httpStatus === 401 || error.httpStatus === 403)) {
    return { status: "unauthorized", error: message };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { status: "unreachable", error: `no response within ${PROBE_TIMEOUT_MS / 1000}s` };
  }
  return { status: "unreachable", error: message };
}

export class ArrClient {
  private config: ArrConfig;
  private serviceName: ArrService;
  protected apiVersion: string = 'v3';

  constructor(serviceName: ArrService, config: ArrConfig) {
    this.serviceName = serviceName;
    this.config = {
      url: config.url.replace(/\/$/, ''),
      apiKey: config.apiKey
    };
  }

  /**
   * Make an API request
   */
  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Most *arr apps namespace by version (/api/v3/...). Bazarr does not
    // version its API at all - /api/system/status is the real endpoint and
    // /api/v1/... quietly serves the web UI's index.html instead - so an
    // empty apiVersion has to produce /api/... rather than /api//... .
    const base = this.apiVersion ? `/api/${this.apiVersion}` : '/api';
    const url = `${this.config.url}${base}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.config.apiKey,
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ArrApiError(
        `${this.serviceName} API error: ${response.status} ${response.statusText} - ${text}`,
        response.status,
      );
    }

    // DELETE endpoints answer 200 or 204 with an empty body, which
    // response.json() rejects. Parse only when there is something to parse.
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/system/status');
  }

  /**
   * Get download queue
   */
  async getQueue(page = 1, pageSize = 100): Promise<{ records: QueueItem[]; totalRecords: number }> {
    const params = new URLSearchParams({
      includeUnknownSeriesItems: "true",
      includeUnknownMovieItems: "true",
      page: String(page),
      pageSize: String(pageSize),
    });
    return this.request<{ records: QueueItem[]; totalRecords: number }>(`/queue?${params.toString()}`);
  }

  /**
   * Get calendar items (upcoming releases)
   */
  async getCalendar(start?: string, end?: string): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<unknown[]>(`/calendar${query}`);
  }

  /**
   * Get all root folders
   */
  async getRootFolders(): Promise<Array<{ id: number; path: string; freeSpace: number }>> {
    return this.request<Array<{ id: number; path: string; freeSpace: number }>>('/rootfolder');
  }

  /**
   * Check that this service is reachable AND that the configured API key is
   * accepted. Unlike testConnection() this keeps the distinction, which is the
   * whole point: a rejected key and a dead host need different fixes.
   */
  async probe(): Promise<ProbeResult> {
    try {
      await this.request<SystemStatus>('/system/status', {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return { status: "ok" };
    } catch (error) {
      return classifyProbeError(error);
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get quality profiles
   */
  async getQualityProfiles(): Promise<QualityProfile[]> {
    return this.request<QualityProfile[]>('/qualityprofile');
  }

  /**
   * Get quality definitions (size limits)
   */
  async getQualityDefinitions(): Promise<QualityDefinition[]> {
    return this.request<QualityDefinition[]>('/qualitydefinition');
  }

  /**
   * Get download clients
   */
  async getDownloadClients(): Promise<DownloadClient[]> {
    return this.request<DownloadClient[]>('/downloadclient');
  }

  /**
   * Get naming configuration
   */
  async getNamingConfig(): Promise<NamingConfig> {
    return this.request<NamingConfig>('/config/naming');
  }

  /**
   * Get media management configuration
   */
  async getMediaManagement(): Promise<MediaManagementConfig> {
    return this.request<MediaManagementConfig>('/config/mediamanagement');
  }

  /**
   * Get health check issues
   */
  async getHealth(): Promise<HealthCheck[]> {
    return this.request<HealthCheck[]>('/health');
  }

  /**
   * Get all tags
   */
  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>('/tag');
  }

  /**
   * Get detailed root folders
   */
  async getRootFoldersDetailed(): Promise<RootFolder[]> {
    return this.request<RootFolder[]>('/rootfolder');
  }

  /**
   * Get indexers (per-app configuration, not Prowlarr)
   */
  async getIndexers(): Promise<Indexer[]> {
    return this.request<Indexer[]>('/indexer');
  }

  /**
   * Get remote path mappings.
   *
   * Mappings key on the download client's *host setting*, not on the client
   * itself, so renaming or moving a client silently orphans every mapping it
   * had while the app still looks healthy elsewhere.
   */
  async getRemotePathMappings(): Promise<RemotePathMapping[]> {
    return this.request<RemotePathMapping[]>('/remotepathmapping');
  }
}

// Service-specific clients

export class SonarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('sonarr', config);
  }

  /**
   * Get all series
   */
  async getSeries(): Promise<Series[]> {
    return this['request']<Series[]>('/series');
  }

  /**
   * Get a specific series
   */
  async getSeriesById(id: number): Promise<Series> {
    return this['request']<Series>(`/series/${id}`);
  }

  /**
   * Search for series
   */
  async searchSeries(term: string): Promise<SearchResult[]> {
    return this['request']<SearchResult[]>(`/series/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Add a series
   */
  async addSeries(series: Partial<Series> & { tvdbId: number; rootFolderPath: string; qualityProfileId: number }): Promise<Series> {
    return this['request']<Series>('/series', {
      method: 'POST',
      body: JSON.stringify({
        ...series,
        monitored: series.monitored ?? true,
        seasonFolder: series.seasonFolder ?? true,
        addOptions: {
          searchForMissingEpisodes: true,
        },
      }),
    });
  }

  /**
   * Trigger a search for missing episodes
   */
  async searchMissing(seriesId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'SeriesSearch',
        seriesId,
      }),
    });
  }

  /**
   * Get episodes for a series, optionally filtered by season
   */
  async getEpisodes(seriesId: number, seasonNumber?: number): Promise<Episode[]> {
    let url = `/episode?seriesId=${seriesId}`;
    if (seasonNumber !== undefined) {
      url += `&seasonNumber=${seasonNumber}`;
    }
    return this['request']<Episode[]>(url);
  }

  /**
   * Search for a specific episode
   */
  async searchEpisode(episodeIds: number[]): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'EpisodeSearch',
        episodeIds,
      }),
    });
  }

  /**
   * Trigger a refresh for a specific series
   */
  async refreshSeries(seriesId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'RefreshSeries',
        seriesId,
      }),
    });
  }
}

export class RadarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('radarr', config);
  }

  /**
   * Get all movies
   */
  async getMovies(): Promise<Movie[]> {
    return this['request']<Movie[]>('/movie');
  }

  /**
   * Get a specific movie
   */
  async getMovieById(id: number): Promise<Movie> {
    return this['request']<Movie>(`/movie/${id}`);
  }

  /**
   * Search for movies
   */
  async searchMovies(term: string): Promise<SearchResult[]> {
    return this['request']<SearchResult[]>(`/movie/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Add a movie
   */
  async addMovie(movie: Partial<Movie> & { tmdbId: number; rootFolderPath: string; qualityProfileId: number }): Promise<Movie> {
    return this['request']<Movie>('/movie', {
      method: 'POST',
      body: JSON.stringify({
        ...movie,
        monitored: movie.monitored ?? true,
        addOptions: {
          searchForMovie: true,
        },
      }),
    });
  }

  /**
   * Trigger a search for a movie
   */
  async searchMovie(movieId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'MoviesSearch',
        movieIds: [movieId],
      }),
    });
  }

  /**
   * Trigger a search for multiple movies at once
   */
  async searchMoviesBulk(movieIds: number[]): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'MoviesSearch',
        movieIds,
      }),
    });
  }

  /**
   * Update a movie (PUT). Used to change qualityProfileId, monitored, tags, etc.
   */
  async updateMovie(movie: Movie): Promise<Movie> {
    return this['request']<Movie>(`/movie/${movie.id}`, {
      method: 'PUT',
      body: JSON.stringify(movie),
    });
  }

  /**
   * Delete an item from the download queue
   */
  async deleteQueueItem(queueId: number, options: { removeFromClient?: boolean; blocklist?: boolean } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (options.removeFromClient) params.append('removeFromClient', 'true');
    if (options.blocklist) params.append('blocklist', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    await this['request']<void>(`/queue/${queueId}${query}`, {
      method: 'DELETE',
    });
  }

  /**
   * Trigger a refresh for a specific movie
   */
  async refreshMovie(movieId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'RefreshMovie',
        movieIds: [movieId],
      }),
    });
  }
}

export class LidarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('lidarr', config);
    this.apiVersion = 'v1';
  }

  /**
   * Get all artists
   */
  async getArtists(): Promise<Artist[]> {
    return this['request']<Artist[]>('/artist');
  }

  /**
   * Get a specific artist
   */
  async getArtistById(id: number): Promise<Artist> {
    return this['request']<Artist>(`/artist/${id}`);
  }

  /**
   * Search for artists
   */
  async searchArtists(term: string): Promise<SearchResult[]> {
    return this['request']<SearchResult[]>(`/artist/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Add an artist
   */
  async addArtist(artist: Partial<Artist> & { foreignArtistId: string; rootFolderPath: string; qualityProfileId: number; metadataProfileId: number }): Promise<Artist> {
    return this['request']<Artist>('/artist', {
      method: 'POST',
      body: JSON.stringify({
        ...artist,
        monitored: artist.monitored ?? true,
        addOptions: {
          searchForMissingAlbums: true,
        },
      }),
    });
  }

  /**
   * Get all albums, optionally filtered by artist
   */
  async getAlbums(artistId?: number): Promise<Album[]> {
    const url = artistId ? `/album?artistId=${artistId}` : '/album';
    return this['request']<Album[]>(url);
  }

  /**
   * Get a specific album
   */
  async getAlbumById(id: number): Promise<Album> {
    return this['request']<Album>(`/album/${id}`);
  }

  /**
   * Search for missing albums for an artist
   */
  async searchMissingAlbums(artistId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'ArtistSearch',
        artistId,
      }),
    });
  }

  /**
   * Search for a specific album
   */
  async searchAlbum(albumId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'AlbumSearch',
        albumIds: [albumId],
      }),
    });
  }

  /**
   * Get calendar (upcoming album releases)
   */
  async getCalendar(start?: string, end?: string): Promise<Album[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this['request']<Album[]>(`/calendar${query}`);
  }

  /**
   * Get metadata profiles
   */
  async getMetadataProfiles(): Promise<MetadataProfile[]> {
    return this['request']<MetadataProfile[]>('/metadataprofile');
  }
}

export interface IndexerStats {
  id: number;
  indexerId: number;
  indexerName: string;
  averageResponseTime: number;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfRssQueries: number;
  numberOfAuthQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  numberOfFailedRssQueries: number;
  numberOfFailedAuthQueries: number;
}

export class ProwlarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('prowlarr', config);
    this.apiVersion = 'v1';
  }

  /**
   * Get all indexers
   */
  async getIndexers(): Promise<Indexer[]> {
    return this['request']<Indexer[]>('/indexer');
  }

  /**
   * Test all indexers
   */
  async testAllIndexers(): Promise<Array<{ id: number; isValid: boolean; validationFailures: Array<{ propertyName: string; errorMessage: string }> }>> {
    return this['request']<Array<{ id: number; isValid: boolean; validationFailures: Array<{ propertyName: string; errorMessage: string }> }>>('/indexer/testall', { method: 'POST' });
  }

  /**
   * Test a specific indexer
   */
  async testIndexer(indexerId: number): Promise<{ id: number; isValid: boolean; validationFailures: Array<{ propertyName: string; errorMessage: string }> }> {
    return this['request']<{ id: number; isValid: boolean; validationFailures: Array<{ propertyName: string; errorMessage: string }> }>(`/indexer/${indexerId}/test`, { method: 'POST' });
  }

  /**
   * Get indexer statistics
   */
  async getIndexerStats(): Promise<{ indexers: IndexerStats[] }> {
    return this['request']<{ indexers: IndexerStats[] }>('/indexerstats');
  }

  /**
   * Search across all indexers
   */
  async search(query: string, categories?: number[]): Promise<unknown[]> {
    const params = new URLSearchParams({ query });
    if (categories) {
      categories.forEach(c => params.append('categories', c.toString()));
    }
    return this['request']<unknown[]>(`/search?${params.toString()}`);
  }
}

/**
 * Whisparr ships as two incompatible applications that both answer on
 * /api/v3 with the same auth header:
 *
 *   V2          - a Sonarr fork. The UI calls them sites and scenes but the
 *                 API keeps Sonarr's nouns: /series and /episode.
 *   V3 ("Eros") - a Radarr fork. Scenes are standalone /movie entries.
 *
 * Which one an operator runs is a deployment detail, so resolve it from
 * /system/status on first use and cache it for the life of the client rather
 * than asking for a WHISPARR_VERSION env var that would only go stale.
 */
export type WhisparrVariant = 'v2' | 'v3';

/**
 * A Whisparr library item: a site under V2, a scene under V3.
 *
 * Deliberately not `Series | Movie`. Whisparr's resources diverge from
 * Radarr's and Sonarr's in the fields that matter most here - Eros keys
 * scenes by a string `foreignId` (the stash id) and leaves `tmdbId` unset,
 * while V2 stuffs the TPDB site id into `tvdbId` - so this describes what
 * Whisparr actually returns rather than borrowing another app's shape.
 */
export interface WhisparrItem {
  id: number;
  title: string;
  sortTitle?: string;
  status?: string;
  overview?: string;
  year: number;
  path: string;
  rootFolderPath?: string;
  folder?: string;
  qualityProfileId: number;
  monitored: boolean;
  added?: string;
  tags?: number[];
  titleSlug?: string;
  images?: Array<{ coverType: string; url: string }>;
  /** V2: the TPDB site id, carried in Sonarr's tvdbId field. */
  tvdbId?: number;
  /** V3 (Eros): the canonical stash id. tmdbId is usually absent for scenes. */
  foreignId?: string;
  stashId?: string;
  tpdbId?: string;
  tmdbId?: number;
  imdbId?: string;
  /** V3 only. */
  hasFile?: boolean;
  sizeOnDisk?: number;
  statistics?: {
    /** V2 */
    seasonCount?: number;
    episodeFileCount?: number;
    episodeCount?: number;
    totalEpisodeCount?: number;
    /** V3 */
    movieFileCount?: number;
    sizeOnDisk?: number;
  };
}

/**
 * The id Whisparr's metadata provider keys an item by, as a string.
 *
 * This is what a library row and a lookup result have in common, so it is
 * what identifies "the same site/scene" across the two. Undefined means the
 * item cannot be re-added or matched, which is itself worth reporting.
 */
export function whisparrItemKey(item: WhisparrItem): string | undefined {
  const key = item.foreignId ?? item.stashId ?? item.tpdbId ?? item.tvdbId ?? item.tmdbId;
  return key === undefined || key === 0 || key === '' ? undefined : String(key);
}

/**
 * How many media files the library row believes it holds.
 *
 * A row reporting zero while its folder still holds media is the signature of
 * a dead upstream id: the app has lost the file mapping and the media is no
 * longer tracked, renamed, upgraded or searched.
 */
export function whisparrFileCount(item: WhisparrItem): number {
  return (
    item.statistics?.episodeFileCount ??
    item.statistics?.movieFileCount ??
    (item.hasFile ? 1 : 0)
  );
}

/** Bytes the library row accounts for. V2 nests it, V3 also reports it flat. */
export function whisparrSizeOnDisk(item: WhisparrItem): number {
  return item.statistics?.sizeOnDisk ?? item.sizeOnDisk ?? 0;
}

export class WhisparrClient extends ArrClient {
  private variant?: WhisparrVariant;

  constructor(config: ArrConfig) {
    super('whisparr', config);
  }

  /**
   * Detect which Whisparr this is. Only a 2.x version is treated as the
   * Sonarr-shaped V2; everything else falls through to the movie-shaped
   * endpoints so a future major keeps working without a code change.
   */
  async getVariant(): Promise<WhisparrVariant> {
    if (!this.variant) {
      const status = await this.getStatus();
      this.variant = status.version?.startsWith('2.') ? 'v2' : 'v3';
    }
    return this.variant;
  }

  private async resource(): Promise<'series' | 'movie'> {
    return (await this.getVariant()) === 'v2' ? 'series' : 'movie';
  }

  /**
   * Get the whole library: sites under V2, scenes under V3.
   */
  async getLibrary(): Promise<WhisparrItem[]> {
    return this['request']<WhisparrItem[]>(`/${await this.resource()}`);
  }

  /**
   * Get a single library item
   */
  async getItemById(id: number): Promise<WhisparrItem> {
    return this['request']<WhisparrItem>(`/${await this.resource()}/${id}`);
  }

  /**
   * Look up sites/scenes by name against Whisparr's metadata provider.
   *
   * Results carry a non-zero `id` when the item is already in the library -
   * the lookup maps matches onto the existing row - so this one call answers
   * both "does a live id still exist" and "is it already here".
   */
  async searchLibrary(term: string): Promise<WhisparrItem[]> {
    return this['request']<WhisparrItem[]>(`/${await this.resource()}/lookup?term=${encodeURIComponent(term)}`);
  }

  /**
   * Get the scenes belonging to one site.
   *
   * V2 only: under Eros scenes are library items in their own right, so
   * getLibrary() already returns them and there is nothing to nest.
   * The site id is Sonarr's seriesId on the wire.
   */
  async getScenes(siteId: number): Promise<Episode[]> {
    if ((await this.getVariant()) !== 'v2') {
      throw new Error(
        'Whisparr V3 (Eros) has no per-site scene list - scenes are library items, use whisparr_get_library instead'
      );
    }
    return this['request']<Episode[]>(`/episode?seriesId=${siteId}`);
  }

  /**
   * Trigger a download search for a library item
   */
  async searchItem(itemId: number): Promise<{ id: number }> {
    const body = (await this.getVariant()) === 'v2'
      ? { name: 'SeriesSearch', seriesId: itemId }
      : { name: 'MoviesSearch', movieIds: [itemId] };
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Delete a library row, always keeping its files and never adding an
   * import-list exclusion.
   *
   * Both are deliberate, not defaults waiting to be made configurable. When
   * an upstream id dies the media on disk is fine and only the metadata
   * pointer broke, so deleting files is never the right remediation here. And
   * the exclusion would be keyed on the dead id, so it protects nothing while
   * blocking the replacement if the two ever reconcile upstream.
   */
  async deleteItem(itemId: number): Promise<void> {
    const v2 = (await this.getVariant()) === 'v2';
    // V2 kept Sonarr's parameter name, Eros uses Radarr's.
    const exclusionParam = v2 ? 'addImportListExclusion' : 'addImportExclusion';
    await this['request']<void>(
      `/${v2 ? 'series' : 'movie'}/${itemId}?deleteFiles=false&${exclusionParam}=false`,
      { method: 'DELETE' }
    );
  }

  /**
   * Add a site/scene by its provider id.
   *
   * `path` points the new row at a folder that already holds media, which is
   * how a re-keyed entry is recovered: the files never moved, only the id
   * they were filed under died. `search` therefore defaults to false - the
   * point is to re-detect what is already on disk, not to start downloading.
   */
  async addItem(item: {
    key: string;
    qualityProfileId: number;
    title?: string;
    path?: string;
    rootFolderPath?: string;
    monitored?: boolean;
    search?: boolean;
  }): Promise<WhisparrItem> {
    const v2 = (await this.getVariant()) === 'v2';
    const body = {
      ...(v2 ? { tvdbId: Number(item.key), seasonFolder: true } : { foreignId: item.key }),
      ...(item.title ? { title: item.title } : {}),
      ...(item.path ? { path: item.path } : {}),
      ...(item.rootFolderPath ? { rootFolderPath: item.rootFolderPath } : {}),
      qualityProfileId: item.qualityProfileId,
      monitored: item.monitored ?? true,
      addOptions: v2
        ? { searchForMissingEpisodes: item.search ?? false }
        : { searchForMovie: item.search ?? false },
    };
    return this['request']<WhisparrItem>(`/${v2 ? 'series' : 'movie'}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Rescan a library item's folder so files already on disk are re-detected.
   *
   * A metadata refresh does not do this - refreshItem re-reads the provider,
   * a rescan re-reads the disk. Recovering a re-keyed entry needs the rescan.
   */
  async rescanItem(itemId: number): Promise<{ id: number }> {
    const body = (await this.getVariant()) === 'v2'
      ? { name: 'RescanSeries', seriesId: itemId }
      : { name: 'RescanMovie', movieId: itemId };
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * The video files Whisparr can see in a folder.
   *
   * Whisparr answers with an empty list for a folder that is empty and for
   * one that does not exist, so an empty result means "no media here",
   * not "the folder is gone".
   */
  async getFolderMediaFiles(path: string): Promise<Array<{ path: string; relativePath: string; name: string }>> {
    return this['request']<Array<{ path: string; relativePath: string; name: string }>>(
      `/filesystem/mediafiles?path=${encodeURIComponent(path)}`
    );
  }

  /**
   * Everything in a folder, media or not
   */
  async getFolderContents(path: string): Promise<{
    parent?: string;
    directories: Array<{ name: string; path: string }>;
    files: Array<{ name: string; path: string }>;
  }> {
    return this['request']<{
      parent?: string;
      directories: Array<{ name: string; path: string }>;
      files: Array<{ name: string; path: string }>;
    }>(`/filesystem?path=${encodeURIComponent(path)}&includeFiles=true`);
  }

  /**
   * Trigger a metadata refresh for a library item
   */
  async refreshItem(itemId: number): Promise<{ id: number }> {
    const body = (await this.getVariant()) === 'v2'
      ? { name: 'RefreshSeries', seriesId: itemId }
      : { name: 'RefreshMovie', movieIds: [itemId] };
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

/**
 * Chaptarr - a Readarr fork managing audiobooks and eBooks in one instance.
 *
 * Two things make it unlike the other *arr apps:
 *
 * 1. Media type is part of identity, not a filter. The same book can exist as
 *    an audiobook row AND an eBook row, so most endpoints take a `mediaType`
 *    query parameter and authors carry parallel per-side settings
 *    (`audiobookMonitored`, `ebookQualityProfileId`, and so on).
 * 2. Provider ids (`hc:`, `gr:`, `az:`, `ol:`, `gb:`) are the durable identity;
 *    local row ids are handles that can change when metadata is repaired or
 *    merged. Callers that cache anything should cache the provider id.
 *
 * Chaptarr is beta (0.9.x) and its published contract doc runs ahead of the
 * shipped build - the doc describes `providerId`/`providerIdsAll` on books,
 * which 0.9.958 does not emit. These types follow what the build actually
 * returns.
 */
export type ChaptarrMediaType = 'all' | 'audiobook' | 'ebook';

/**
 * Chaptarr rejects an unknown mediaType with a 400. Validating here turns a
 * typo into a local error naming the legal values instead of a round trip.
 */
export function parseChaptarrMediaType(value: unknown, allowAll = true): ChaptarrMediaType | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  const legal = allowAll ? ['all', 'audiobook', 'ebook'] : ['audiobook', 'ebook'];
  if (!legal.includes(normalized)) {
    const quoted = legal.map(v => `'${v}'`);
    const wanted = quoted.length > 2
      ? `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`
      : quoted.join(' or ');
    throw new Error(`mediaType must be ${wanted} - got '${value}'`);
  }
  return normalized as ChaptarrMediaType;
}

/** `all` means "do not scope", which on the wire is an absent parameter. */
function mediaTypeQuery(mediaType?: ChaptarrMediaType): string {
  return mediaType && mediaType !== 'all' ? `mediaType=${mediaType}` : '';
}

function withQuery(path: string, parts: Array<string | undefined>): string {
  const query = parts.filter((p): p is string => Boolean(p)).join('&');
  return query ? `${path}?${query}` : path;
}

export interface ChaptarrAuthor {
  id: number;
  authorName: string;
  sortName: string;
  /** Provider id, e.g. `hc:880167`. Durable; prefer this over `id`. */
  foreignAuthorId: string;
  status: string;
  overview?: string;
  monitored: boolean;
  path?: string;
  genres?: string[];
  tags?: number[];
  added?: string;
  ratings?: { votes: number; value: number };
  statistics?: ChaptarrStatistics;
  // Media-scoped settings. The unscoped fields above are the legacy combined
  // projection Chaptarr still emits for older clients.
  audiobookMonitored?: boolean;
  ebookMonitored?: boolean;
  audiobookQualityProfileId?: number;
  ebookQualityProfileId?: number;
  audiobookMetadataProfileId?: number;
  ebookMetadataProfileId?: number;
  audiobookRootFolderPath?: string;
  ebookRootFolderPath?: string;
  audiobookTags?: number[];
  ebookTags?: number[];
  audiobookStatistics?: ChaptarrStatistics;
  ebookStatistics?: ChaptarrStatistics;
}

export interface ChaptarrStatistics {
  bookCount?: number;
  bookFileCount?: number;
  totalBookCount?: number;
  sizeOnDisk?: number;
  percentOfBooks?: number;
}

export interface ChaptarrBook {
  id: number;
  title: string;
  authorId: number;
  authorTitle?: string;
  /** Provider id, e.g. `hc:2707279`. Durable; prefer this over `id`. */
  foreignBookId: string;
  foreignEditionId?: string;
  /** Which side of the library this row is. Never null on a library row. */
  mediaType?: 'audiobook' | 'ebook';
  monitored: boolean;
  audiobookMonitored?: boolean;
  ebookMonitored?: boolean;
  overview?: string;
  releaseDate?: string;
  pageCount?: number;
  genres?: string[];
  ratings?: { votes: number; value: number };
  hasFiles?: boolean;
  seriesTitle?: string;
  statistics?: ChaptarrStatistics;
  // Audiobook-native metadata with no analogue in the other *arr apps.
  narratorNames?: string[];
  availableNarrators?: string[];
  duration?: string;
  durationMinutes?: number;
  isOmnibus?: boolean;
  // Discrete provider ids. Chaptarr resolves a book across providers, so a row
  // can carry several; any of them resolves back to this row.
  asin?: string;
  audibleASIN?: string;
  goodreadsWorkId?: string;
  hardcoverBookId?: string;
}

export interface ChaptarrEdition {
  id: number;
  bookId: number;
  title: string;
  foreignEditionId?: string;
  isbn13?: string;
  asin?: string;
  publisher?: string;
  pageCount?: number;
  monitored?: boolean;
  isEbook?: boolean;
}

export interface ChaptarrSeries {
  id: number;
  title: string;
  description?: string;
  /** Provider id, e.g. `gr:398069`. Durable; prefer this over `id`. */
  foreignSeriesId?: string;
  localSeriesId?: string;
  /** Which side of the library this series row belongs to. */
  mediaType?: 'audiobook' | 'ebook';
  workCount?: number;
  primaryWorkCount?: number;
  /** Reading order: one link per book, `seriesPosition` being its place. */
  links?: Array<{
    id: number;
    bookId: number;
    seriesId: number;
    position?: string;
    seriesPosition?: number;
  }>;
}

export class ChaptarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('chaptarr', config);
    this.apiVersion = 'v1';
  }

  /** List library authors, optionally scoped to one side of the library. */
  async getAuthors(mediaType?: ChaptarrMediaType): Promise<ChaptarrAuthor[]> {
    return this['request']<ChaptarrAuthor[]>(withQuery('/author', [mediaTypeQuery(mediaType)]));
  }

  async getAuthorById(id: number): Promise<ChaptarrAuthor> {
    return this['request']<ChaptarrAuthor>(`/author/${id}`);
  }

  /** Look up authors against Chaptarr's metadata pipeline (not in-library). */
  async searchAuthors(term: string): Promise<ChaptarrAuthor[]> {
    return this['request']<ChaptarrAuthor[]>(`/author/lookup?term=${encodeURIComponent(term)}`);
  }

  /** Look up books by title or ISBN against the metadata pipeline. */
  async searchBooks(term: string): Promise<ChaptarrBook[]> {
    return this['request']<ChaptarrBook[]>(`/book/lookup?term=${encodeURIComponent(term)}`);
  }

  async getBooks(authorId?: number, mediaType?: ChaptarrMediaType): Promise<ChaptarrBook[]> {
    return this['request']<ChaptarrBook[]>(withQuery('/book', [
      authorId !== undefined ? `authorId=${authorId}` : undefined,
      mediaTypeQuery(mediaType),
    ]));
  }

  /** Editions of one book - the physical/format variants Chaptarr tracks. */
  async getEditions(bookId: number): Promise<ChaptarrEdition[]> {
    return this['request']<ChaptarrEdition[]>(`/edition?bookId=${bookId}`);
  }

  /** Book series, optionally scoped to one author. */
  async getSeries(authorId?: number): Promise<ChaptarrSeries[]> {
    return this['request']<ChaptarrSeries[]>(
      withQuery('/series', [authorId !== undefined ? `authorId=${authorId}` : undefined]));
  }

  async getMetadataProfiles(): Promise<MetadataProfile[]> {
    return this['request']<MetadataProfile[]>('/metadataprofile');
  }

  async getMissing(page = 1, pageSize = 25, mediaType?: ChaptarrMediaType):
    Promise<{ records: ChaptarrBook[]; totalRecords: number }> {
    return this['request']<{ records: ChaptarrBook[]; totalRecords: number }>(
      withQuery('/wanted/missing', [`page=${page}`, `pageSize=${pageSize}`, mediaTypeQuery(mediaType)]));
  }

  /**
   * Add an author. Chaptarr takes monitoring and profiles per media side; the
   * caller supplies whichever sides it wants created.
   */
  async addAuthor(author: {
    foreignAuthorId: string;
    rootFolderPath: string;
    qualityProfileId: number;
    metadataProfileId: number;
    mediaType: 'audiobook' | 'ebook';
    monitored?: boolean;
  }): Promise<ChaptarrAuthor> {
    const { mediaType, monitored = true, ...rest } = author;
    const side = mediaType === 'ebook' ? 'ebook' : 'audiobook';
    return this['request']<ChaptarrAuthor>('/author', {
      method: 'POST',
      body: JSON.stringify({
        ...rest,
        monitored,
        [`${side}Monitored`]: monitored,
        [`${side}QualityProfileId`]: author.qualityProfileId,
        [`${side}MetadataProfileId`]: author.metadataProfileId,
        [`${side}RootFolderPath`]: author.rootFolderPath,
        addOptions: { searchForNewBook: true },
      }),
    });
  }

  /** Trigger a download search for specific books. */
  async triggerBookSearch(bookIds: number[]): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'BookSearch', bookIds }),
    });
  }

  /** Trigger a download search for everything an author is missing. */
  async searchMissing(authorId?: number, mediaType?: ChaptarrMediaType): Promise<{ id: number }> {
    const scoped = mediaType && mediaType !== 'all' ? { mediaType } : {};
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({
        name: 'MissingBookSearch',
        ...(authorId !== undefined ? { authorId } : {}),
        ...scoped,
      }),
    });
  }

  async refreshAuthor(authorId: number): Promise<{ id: number }> {
    return this['request']<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'RefreshAuthor', authorId }),
    });
  }
}

/**
 * Jellyseerr - request management sitting in front of Sonarr and Radarr.
 *
 * Unlike Bazarr it fits the base client cleanly: /api/v1 with an X-Api-Key
 * header. Two things do need care:
 *
 * 1. Status is numeric on the wire and the enums are NOT the four values older
 *    documentation describes. Read from the running build, MediaRequestStatus
 *    is PENDING/APPROVED/DECLINED/FAILED/COMPLETED (1-5) - COMPLETED=5 is the
 *    most common value in a real instance and is missing from the classic set.
 * 2. A request carries no title, only a tmdbId. Rendering "what did people
 *    ask for" therefore needs a second lookup per row, which is why the
 *    listing exposes that as an explicit, bounded choice rather than doing it
 *    invisibly on every call.
 *
 * media.externalServiceId is the Sonarr/Radarr id, so a request can be traced
 * into the service that is actually fetching it.
 */
export const JELLYSEERR_REQUEST_STATUS: Record<number, string> = {
  1: 'pending',
  2: 'approved',
  3: 'declined',
  4: 'failed',
  5: 'completed',
};

export const JELLYSEERR_MEDIA_STATUS: Record<number, string> = {
  1: 'unknown',
  2: 'pending',
  3: 'processing',
  4: 'partially available',
  5: 'available',
  6: 'blocklisted',
  7: 'deleted',
};

/** The filters Jellyseerr's own request list accepts. */
export const JELLYSEERR_FILTERS = [
  'all', 'pending', 'approved', 'processing', 'available', 'unavailable', 'failed', 'deleted',
] as const;
export type JellyseerrFilter = typeof JELLYSEERR_FILTERS[number];

export function parseJellyseerrFilter(value: unknown): JellyseerrFilter | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const v = String(value).trim().toLowerCase();
  if (!(JELLYSEERR_FILTERS as readonly string[]).includes(v)) {
    throw new Error(`filter must be one of ${JELLYSEERR_FILTERS.join(', ')} - got '${value}'`);
  }
  return v as JellyseerrFilter;
}

export interface JellyseerrRequest {
  id: number;
  status: number;
  type: string;
  createdAt?: string;
  updatedAt?: string;
  is4k?: boolean;
  seasons?: Array<{ seasonNumber: number }>;
  requestedBy?: { id: number; displayName?: string; username?: string; email?: string };
  media?: {
    id: number;
    tmdbId?: number;
    tvdbId?: number;
    imdbId?: string;
    mediaType?: string;
    status?: number;
    /** The Sonarr/Radarr id fetching this, when it has reached one. */
    externalServiceId?: number;
    mediaUrl?: string;
  };
}

export interface JellyseerrPage<T> {
  results: T[];
  pageInfo: { page: number; pages: number; pageSize: number; results: number };
}

export interface JellyseerrRequestCounts {
  total: number; movie: number; tv: number;
  pending: number; approved: number; declined: number;
  processing: number; available: number;
  // Not returned by every build - a live 3.3.0 omits `failed` from the counts
  // even though `filter=failed` returns rows.
  completed?: number; failed?: number;
}

export class JellyseerrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('jellyseerr', config);
    this.apiVersion = 'v1';
  }

  /**
   * Jellyseerr cannot use the inherited probe. Two separate reasons, both
   * verified against Jellyseerr 3.3.0:
   *
   * - `/api/v1/system/status` does not exist here; it answers 404.
   * - `/api/v1/status` does exist, but is UNAUTHENTICATED - it returns 200 with
   *   a garbage API key, so it cannot tell a good credential from a bad one.
   *   Probing it would report `ok` for a completely invalid key, which is the
   *   exact false reassurance this probe exists to remove.
   *
   * `/request/count` requires the key and answers 403 without it.
   */
  async probe(): Promise<ProbeResult> {
    try {
      await this['request']<JellyseerrRequestCounts>('/request/count', {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return { status: "ok" };
    } catch (error) {
      return classifyProbeError(error);
    }
  }

  async getRequestCounts(): Promise<JellyseerrRequestCounts> {
    return this['request']<JellyseerrRequestCounts>('/request/count');
  }

  async getRequests(
    filter?: JellyseerrFilter, take = 20, skip = 0, sort: 'added' | 'modified' = 'added',
  ): Promise<JellyseerrPage<JellyseerrRequest>> {
    const parts = [
      `take=${Math.max(1, Math.min(take, 50))}`,
      `skip=${Math.max(0, skip)}`,
      `sort=${sort}`,
    ];
    if (filter && filter !== 'all') parts.push(`filter=${filter}`);
    return this['request']<JellyseerrPage<JellyseerrRequest>>(`/request?${parts.join('&')}`);
  }

  async getRequestById(id: number): Promise<JellyseerrRequest> {
    return this['request']<JellyseerrRequest>(`/request/${id}`);
  }

  /**
   * Approving a request makes Jellyseerr hand it to Sonarr or Radarr, which
   * starts a real download. Declining only closes it.
   */
  async setRequestStatus(id: number, status: 'approve' | 'decline' | 'pending'): Promise<JellyseerrRequest> {
    return this['request']<JellyseerrRequest>(`/request/${id}/${status}`, { method: 'POST' });
  }

  async getIssueCount(): Promise<Record<string, number>> {
    return this['request']<Record<string, number>>('/issue/count');
  }

  async getIssues(take = 20, skip = 0): Promise<JellyseerrPage<Record<string, unknown>>> {
    return this['request']<JellyseerrPage<Record<string, unknown>>>(
      `/issue?take=${Math.max(1, Math.min(take, 50))}&skip=${Math.max(0, skip)}`);
  }

  async getUsers(take = 50): Promise<JellyseerrPage<Record<string, unknown>>> {
    return this['request']<JellyseerrPage<Record<string, unknown>>>(
      `/user?take=${Math.max(1, Math.min(take, 100))}`);
  }

  async search(query: string): Promise<JellyseerrPage<Record<string, unknown>>> {
    return this['request']<JellyseerrPage<Record<string, unknown>>>(
      `/search?query=${encodeURIComponent(query)}`);
  }

  /**
   * Resolve one title. Requests carry only a tmdbId, so this is the second
   * call needed to render them for a human. Failures return undefined rather
   * than throwing - a title is a nicety and must never fail a listing.
   */
  async getTitle(mediaType: string, tmdbId: number): Promise<string | undefined> {
    if (!tmdbId) return undefined;
    const path = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    try {
      const d = await this['request']<{ title?: string; name?: string }>(path);
      return d.title ?? d.name;
    } catch {
      return undefined;
    }
  }

  async getAbout(): Promise<Record<string, unknown>> {
    return this['request']<Record<string, unknown>>('/settings/about');
  }
}

/**
 * Bazarr - subtitle management for an existing Sonarr/Radarr library.
 *
 * It is not a Servarr application and does not behave like one:
 *
 * 1. The API is unversioned. `/api/system/status` is real; `/api/v1/...`
 *    returns the web UI's HTML with a 200, so a wrong path fails as a JSON
 *    parse error rather than a 404.
 * 2. Responses are inconsistently enveloped. Most return `{ data: ... }`,
 *    paged ones add `{ data, total }`, and a few (`/badges`,
 *    `/system/languages/profiles`) return the bare value. `unwrap()` handles
 *    all three rather than each caller guessing.
 * 3. Listing endpoints have no default page size, and returning everything is
 *    not viable: measured against a real library, `/series` took 72s for 1.1MB
 *    and `/episodes/wanted` 76s for 2.1MB, while `/movies` did not finish
 *    inside 90s. The same calls with `start`/`length` answer in under a second.
 *    Pagination is therefore mandatory here, not a convenience.
 *
 * Rows carry `sonarrSeriesId`/`sonarrEpisodeId` or `radarrId`, which are the
 * ids the Sonarr and Radarr tools in this server already use - so a subtitle
 * gap can be traced straight back to the episode that owns it.
 */
export interface BazarrWantedEpisode {
  seriesTitle: string;
  episode_number: string;
  episodeTitle: string;
  missing_subtitles: Array<{ name: string; code2: string; code3: string; forced: boolean; hi: boolean }>;
  sonarrSeriesId: number;
  sonarrEpisodeId: number;
  sceneName?: string;
  tags?: string[];
  seriesType?: string;
}

export interface BazarrWantedMovie {
  title: string;
  missing_subtitles: Array<{ name: string; code2: string; code3: string; forced: boolean; hi: boolean }>;
  radarrId: number;
  sceneName?: string;
  tags?: string[];
  monitored?: boolean;
}

export interface BazarrProvider {
  name: string;
  status: string;
  retry: string;
}

export interface BazarrBadges {
  episodes: number;
  movies: number;
  providers: number;
  status: number;
  sonarr_signalr?: string;
  radarr_signalr?: string;
  announcements?: number;
}

export interface BazarrHistoryRow {
  seriesTitle?: string;
  episodeTitle?: string;
  episode_number?: string;
  title?: string;
  action: number | string;
  language?: { name: string; code2: string } | null;
  provider?: string | null;
  score?: number | string | null;
  timestamp?: string;
  description?: string;
  upgradable?: boolean;
  blacklisted?: boolean;
  sonarrSeriesId?: number;
  sonarrEpisodeId?: number;
  radarrId?: number;
}

export interface BazarrPage<T> {
  data: T[];
  total: number;
}

export class BazarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('bazarr', config);
    // Unversioned: the base class turns an empty version into /api/... .
    this.apiVersion = '';
  }

  /** Bazarr wraps most payloads in `data`, but not all of them. */
  private static unwrap<T>(body: unknown): T {
    if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
      return (body as { data: T }).data;
    }
    return body as T;
  }

  private static page<T>(body: unknown): BazarrPage<T> {
    const b = (body ?? {}) as { data?: T[]; total?: number };
    const data = Array.isArray(b.data) ? b.data : [];
    return { data, total: typeof b.total === 'number' ? b.total : data.length };
  }

  /**
   * Pagination is required, not optional: without it these endpoints take
   * 60-90s and return megabytes, which no MCP client should be handed.
   * Capped at 100 rows for the same reason.
   */
  private static range(start: number, length: number): string {
    return `start=${Math.max(0, start)}&length=${Math.max(1, Math.min(length, 100))}`;
  }

  /** Bazarr's status shape is its own, not the Servarr SystemStatus. */
  async getBazarrStatus(): Promise<Record<string, unknown>> {
    return BazarrClient.unwrap<Record<string, unknown>>(
      await this['request']<unknown>('/system/status'));
  }

  /**
   * The counts the Bazarr UI shows in its nav badges: how many episodes and
   * movies are missing subtitles, how many providers are unhealthy, and
   * whether the Sonarr/Radarr SignalR feeds are live.
   */
  async getBadges(): Promise<BazarrBadges> {
    return BazarrClient.unwrap<BazarrBadges>(await this['request']<unknown>('/badges'));
  }

  async getBazarrHealth(): Promise<unknown[]> {
    return BazarrClient.unwrap<unknown[]>(await this['request']<unknown>('/system/health')) ?? [];
  }

  /** Provider health. A provider in an error state stops subtitles arriving. */
  async getProviders(): Promise<BazarrProvider[]> {
    return BazarrClient.unwrap<BazarrProvider[]>(await this['request']<unknown>('/providers')) ?? [];
  }

  async getLanguageProfiles(): Promise<unknown[]> {
    return BazarrClient.unwrap<unknown[]>(
      await this['request']<unknown>('/system/languages/profiles')) ?? [];
  }

  async getLanguages(): Promise<unknown[]> {
    return BazarrClient.unwrap<unknown[]>(await this['request']<unknown>('/system/languages')) ?? [];
  }

  async getWantedEpisodes(start = 0, length = 25): Promise<BazarrPage<BazarrWantedEpisode>> {
    return BazarrClient.page<BazarrWantedEpisode>(
      await this['request']<unknown>(`/episodes/wanted?${BazarrClient.range(start, length)}`));
  }

  async getWantedMovies(start = 0, length = 25): Promise<BazarrPage<BazarrWantedMovie>> {
    return BazarrClient.page<BazarrWantedMovie>(
      await this['request']<unknown>(`/movies/wanted?${BazarrClient.range(start, length)}`));
  }

  async getSeries(start = 0, length = 25): Promise<BazarrPage<Record<string, unknown>>> {
    return BazarrClient.page<Record<string, unknown>>(
      await this['request']<unknown>(`/series?${BazarrClient.range(start, length)}`));
  }

  async getMovies(start = 0, length = 25): Promise<BazarrPage<Record<string, unknown>>> {
    return BazarrClient.page<Record<string, unknown>>(
      await this['request']<unknown>(`/movies?${BazarrClient.range(start, length)}`));
  }

  /** Episodes of one series, with their present and missing subtitles. */
  async getEpisodes(seriesId: number): Promise<Record<string, unknown>[]> {
    return BazarrClient.unwrap<Record<string, unknown>[]>(
      await this['request']<unknown>(`/episodes?seriesid[]=${seriesId}`)) ?? [];
  }

  async getEpisodeHistory(start = 0, length = 25): Promise<BazarrPage<BazarrHistoryRow>> {
    return BazarrClient.page<BazarrHistoryRow>(
      await this['request']<unknown>(`/episodes/history?${BazarrClient.range(start, length)}`));
  }

  async getMovieHistory(start = 0, length = 25): Promise<BazarrPage<BazarrHistoryRow>> {
    return BazarrClient.page<BazarrHistoryRow>(
      await this['request']<unknown>(`/movies/history?${BazarrClient.range(start, length)}`));
  }

  /**
   * Ask the providers what subtitles exist for one episode, without
   * downloading. This is the manual-search view: it reaches out to every
   * enabled provider, so it is slow and reflects provider health.
   */
  async searchEpisodeSubtitles(episodeId: number): Promise<unknown[]> {
    return BazarrClient.unwrap<unknown[]>(
      await this['request']<unknown>(`/providers/episodes?episodeid=${episodeId}`)) ?? [];
  }

  async searchMovieSubtitles(radarrId: number): Promise<unknown[]> {
    return BazarrClient.unwrap<unknown[]>(
      await this['request']<unknown>(`/providers/movies?radarrid=${radarrId}`)) ?? [];
  }
}
