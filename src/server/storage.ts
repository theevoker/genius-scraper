import fs from 'fs';
import path from 'path';
import { Song, FilterData } from '../types/song.js';
import { cleanHebrewWithSpaces } from './geniusScraper.js';

const WORKSPACE_DIR = process.cwd();
export const SOURCE_FILE = path.join(WORKSPACE_DIR, 'genius_songs.json');
export const SERVER_FILTER_FILE = path.join(WORKSPACE_DIR, 'server_filter.json');

// Mutex lock for thread-safe sequential writes
let writeQueue = Promise.resolve();

function runWithLock<T>(task: () => Promise<T> | T): Promise<T> {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => {}).then(() => {});
  return result;
}

export function loadJsonSafe<T>(filepath: string, fallback: T): T {
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error loading JSON from ${filepath}:`, err);
  }
  return fallback;
}

/**
 * Atomic file writer using temp file, fsync, and replace (matching filter.py save_json)
 */
export function saveJsonAtomic(filepath: string, data: any): void {
  const tempPath = `${filepath}.tmp.${Date.now()}`;
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open with write flag, write buffer, flush to disk with fsync, then atomic rename
  const content = JSON.stringify(data, null, 2);
  const fd = fs.openSync(tempPath, 'w');
  try {
    const buffer = Buffer.from(content, 'utf-8');
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tempPath, filepath);
}

/**
 * Creates a stable key for matching songs between genius_songs.json and server_filter.json
 * Exactly matches song_key in filter.py
 */
export function songKey(artist: string, song: Partial<Song>): string {
  const artistKey = cleanHebrewWithSpaces(artist);
  if (song.id !== undefined && song.id !== null) {
    return `${artistKey}:id:${song.id}`;
  }
  const title = cleanHebrewWithSpaces(song.title || '');
  return `${artistKey}:title:${title}`;
}

/**
 * Cleans genius_songs.json without modifying original file, matching clean_source_data in filter.py
 */
export function cleanSourceData(data: Record<string, Song[]>): FilterData {
  const result: FilterData = {};
  if (!data || typeof data !== 'object') return result;

  for (const [artist, songs] of Object.entries(data)) {
    const cleanArtist = cleanHebrewWithSpaces(artist);
    if (!cleanArtist) continue;
    if (!Array.isArray(songs)) continue;

    if (!result[cleanArtist]) {
      result[cleanArtist] = [];
    }

    const existingIds = new Set<string>();
    const existingTitles = new Set<string>();

    for (const existingSong of result[cleanArtist]) {
      if (existingSong.id !== undefined && existingSong.id !== null) {
        existingIds.add(String(existingSong.id));
      }
      const title = cleanHebrewWithSpaces(existingSong.title || '');
      if (title) {
        existingTitles.add(title);
      }
    }

    for (const song of songs) {
      if (!song || typeof song !== 'object') continue;
      const title = cleanHebrewWithSpaces(song.title || '');
      if (!title) continue;

      const songId = song.id !== undefined && song.id !== null ? String(song.id) : null;
      if (songId && existingIds.has(songId)) continue;
      if (existingTitles.has(title)) continue;

      const newSong: Song = {
        ...song,
        title
      };

      result[cleanArtist].push(newSong);
      if (songId) existingIds.add(songId);
      existingTitles.add(title);
    }
  }

  return result;
}

/**
 * Normalizes server_filter.json against cleaned genius_songs.json, matching normalize_server_filter in filter.py
 * Preserves existing enabled/disabled states.
 */
export function normalizeServerFilter(sourceData: FilterData, existingFilter: FilterData): FilterData {
  const result: FilterData = {};
  const existingLookup = new Map<string, Song>();

  if (existingFilter && typeof existingFilter === 'object') {
    for (const [artist, songs] of Object.entries(existingFilter)) {
      if (!Array.isArray(songs)) continue;
      for (const song of songs) {
        if (!song || typeof song !== 'object') continue;
        const key = songKey(artist, song);
        existingLookup.set(key, song);
      }
    }
  }

  for (const [artist, songs] of Object.entries(sourceData)) {
    result[artist] = [];

    for (const sourceSong of songs) {
      const key = songKey(artist, sourceSong);
      if (existingLookup.has(key)) {
        const existing = existingLookup.get(key)!;
        const merged: Song = {
          ...existing,
          title: sourceSong.title || existing.title
        };
        if (merged.enabled === undefined) {
          merged.enabled = false;
        }
        result[artist].push(merged);
      } else {
        const newSong: Song = {
          ...sourceSong,
          enabled: false
        };
        result[artist].push(newSong);
      }
    }
  }

  return result;
}

/**
 * Seed initial catalog of Israeli artists if no source file exists yet
 */
const INITIAL_SEED_DATA: FilterData = {
  "מאיר אריאל": [
    { "id": 101, "title": "נשל הנחש", "url": "https://genius.com/Meir-ariel-snake-skin-lyrics", "enabled": true },
    { "id": 102, "title": "זרעי קיץ", "url": "https://genius.com/Meir-ariel-summer-seeds-lyrics", "enabled": true },
    { "id": 103, "title": "שיר כאב", "url": "https://genius.com/Meir-ariel-shir-keev-lyrics", "enabled": false },
    { "id": 104, "title": "אגדת דשא", "url": "https://genius.com/Meir-ariel-agadat-deshe-lyrics", "enabled": true },
    { "id": 105, "title": "לילה שקט עבר על כוחותינו בסואץ", "url": "https://genius.com/Meir-ariel-layla-shaket-lyrics", "enabled": false },
    { "id": 106, "title": "טרמינל לומינלט", "url": "https://genius.com/Meir-ariel-terminal-lyrics", "enabled": true },
    { "id": 107, "title": "מודה אני", "url": "https://genius.com/Meir-ariel-mode-ani-lyrics", "enabled": true },
    { "id": 108, "title": "פלוגה בקו", "url": "https://genius.com/Meir-ariel-plugah-lyrics", "enabled": false }
  ],
  "אריק איינשטיין": [
    { "id": 201, "title": "עוף גוזל", "url": "https://genius.com/Arik-einstein-ouf-gozal-lyrics", "enabled": true },
    { "id": 202, "title": "אני ואתה", "url": "https://genius.com/Arik-einstein-ani-veata-lyrics", "enabled": true },
    { "id": 203, "title": "סע לאט", "url": "https://genius.com/Arik-einstein-sa-leat-lyrics", "enabled": false },
    { "id": 204, "title": "יש בי אהבה", "url": "https://genius.com/Arik-einstein-yesh-bi-ahava-lyrics", "enabled": true },
    { "id": 205, "title": "עטור מצחך זהב שחור", "url": "https://genius.com/Arik-einstein-ator-mizhecha-lyrics", "enabled": true },
    { "id": 206, "title": "אוהב להיות בבית", "url": "https://genius.com/Arik-einstein-ohev-lihyot-lyrics", "enabled": false }
  ],
  "שלמה ארצי": [
    { "id": 301, "title": "ירח", "url": "https://genius.com/Shlomo-artzi-yareach-lyrics", "enabled": true },
    { "id": 302, "title": "תתארו לכם", "url": "https://genius.com/Shlomo-artzi-tearo-lachem-lyrics", "enabled": true },
    { "id": 303, "title": "אהבתיה", "url": "https://genius.com/Shlomo-artzi-ahavtiha-lyrics", "enabled": false },
    { "id": 304, "title": "שדות של אירוסים", "url": "https://genius.com/Shlomo-artzi-sadot-shel-irusim-lyrics", "enabled": false },
    { "id": 305, "title": "חום יולי אוגוסט", "url": "https://genius.com/Shlomo-artzi-chom-yuli-august-lyrics", "enabled": true }
  ],
  "כוורת": [
    { "id": 401, "title": "יו יה", "url": "https://genius.com/Kaveret-yo-ya-lyrics", "enabled": true },
    { "id": 402, "title": "נתתי לה חיי", "url": "https://genius.com/Kaveret-natati-la-chayay-lyrics", "enabled": true },
    { "id": 403, "title": "המגפיים של ברוך", "url": "https://genius.com/Kaveret-baruch-boots-lyrics", "enabled": false },
    { "id": 404, "title": "שיר המכולת", "url": "https://genius.com/Kaveret-makolet-lyrics", "enabled": false },
    { "id": 405, "title": "גוליית", "url": "https://genius.com/Kaveret-goliath-lyrics", "enabled": true }
  ]
};

export class StorageService {
  private serverFilter: FilterData = {};
  private sourceSongs: FilterData = {};

  constructor() {
    this.init();
  }

  public init(): void {
    // 1. Check or seed genius_songs.json
    if (!fs.existsSync(SOURCE_FILE)) {
      console.log(`Creating initial ${SOURCE_FILE} with seed artists...`);
      saveJsonAtomic(SOURCE_FILE, INITIAL_SEED_DATA);
      this.sourceSongs = INITIAL_SEED_DATA;
    } else {
      this.sourceSongs = loadJsonSafe<FilterData>(SOURCE_FILE, {});
    }

    const cleanedSource = cleanSourceData(this.sourceSongs);

    // 2. Load or create server_filter.json
    if (fs.existsSync(SERVER_FILTER_FILE)) {
      console.log(`Loading existing ${SERVER_FILTER_FILE}...`);
      const existingFilter = loadJsonSafe<FilterData>(SERVER_FILTER_FILE, {});
      this.serverFilter = normalizeServerFilter(cleanedSource, existingFilter);
    } else {
      console.log(`Creating initial ${SERVER_FILTER_FILE}...`);
      this.serverFilter = normalizeServerFilter(cleanedSource, {});
    }

    // Save normalized structure
    saveJsonAtomic(SERVER_FILTER_FILE, this.serverFilter);
  }

  public getData(): FilterData {
    return this.serverFilter;
  }

  public getSourceData(): FilterData {
    return this.sourceSongs;
  }

  public getActiveSongs(): FilterData {
    const active: FilterData = {};
    for (const [artist, songs] of Object.entries(this.serverFilter)) {
      const onSongs = songs.filter(s => s.enabled);
      if (onSongs.length > 0) {
        active[artist] = onSongs;
      }
    }
    return active;
  }

  /**
   * Resilient artist key lookup that handles Unicode, spaces, and Hebrew normalization
   */
  private resolveArtistKey(artistName: string): string | null {
    if (!artistName) return null;
    if (this.serverFilter[artistName]) {
      return artistName;
    }

    const trimmed = artistName.trim().normalize('NFC');
    for (const key of Object.keys(this.serverFilter)) {
      if (key.trim().normalize('NFC') === trimmed) {
        return key;
      }
    }

    const cleanRequested = cleanHebrewWithSpaces(artistName);
    for (const key of Object.keys(this.serverFilter)) {
      if (cleanHebrewWithSpaces(key) === cleanRequested) {
        return key;
      }
    }

    return null;
  }

  public hasArtist(artistName: string): boolean {
    return this.resolveArtistKey(artistName) !== null;
  }

  /**
   * Update song state and persist to BOTH server_filter.json and genius_songs.json immediately
   */
  public async setSongState(artist: string, index: number, enabled: boolean): Promise<Song> {
    return runWithLock(() => {
      const resolvedKey = this.resolveArtistKey(artist);
      if (!resolvedKey || !this.serverFilter[resolvedKey]) {
        throw new Error(`Artist "${artist}" not found in filter database`);
      }

      const songs = this.serverFilter[resolvedKey];
      if (index < 0 || index >= songs.length) {
        throw new Error(`Song index ${index} out of range (length: ${songs.length})`);
      }

      // Explicitly set requested state
      songs[index].enabled = enabled;

      // 1. Save server_filter.json immediately to disk
      saveJsonAtomic(SERVER_FILTER_FILE, this.serverFilter);

      // 2. Also keep sourceSongs updated in sync if the artist exists there
      if (this.sourceSongs[resolvedKey]) {
        const sourceSongs = this.sourceSongs[resolvedKey];
        if (sourceSongs[index]) {
          sourceSongs[index].enabled = enabled;
          saveJsonAtomic(SOURCE_FILE, this.sourceSongs);
        }
      }

      console.log(`[Storage] Saved change: "${resolvedKey}" song #${index} ("${songs[index].title}") -> enabled=${enabled}`);

      return { ...songs[index] };
    });
  }

  /**
   * Batch update all songs for an artist
   */
  public async setBatchState(artist: string, enabled: boolean): Promise<Song[]> {
    return runWithLock(() => {
      const resolvedKey = this.resolveArtistKey(artist);
      if (!resolvedKey || !this.serverFilter[resolvedKey]) {
        throw new Error(`Artist "${artist}" not found in filter database`);
      }

      for (const song of this.serverFilter[resolvedKey]) {
        song.enabled = enabled;
      }

      saveJsonAtomic(SERVER_FILTER_FILE, this.serverFilter);

      if (this.sourceSongs[resolvedKey]) {
        for (const song of this.sourceSongs[resolvedKey]) {
          song.enabled = enabled;
        }
        saveJsonAtomic(SOURCE_FILE, this.sourceSongs);
      }

      console.log(`[Storage] Saved batch change: "${resolvedKey}" all songs -> enabled=${enabled}`);

      return [...this.serverFilter[resolvedKey]];
    });
  }

  /**
   * Invert selection of all songs for an artist
   */
  public async invertBatchState(artist: string): Promise<Song[]> {
    return runWithLock(() => {
      const resolvedKey = this.resolveArtistKey(artist);
      if (!resolvedKey || !this.serverFilter[resolvedKey]) {
        throw new Error(`Artist "${artist}" not found in filter database`);
      }

      for (const song of this.serverFilter[resolvedKey]) {
        song.enabled = !song.enabled;
      }

      saveJsonAtomic(SERVER_FILTER_FILE, this.serverFilter);

      if (this.sourceSongs[resolvedKey]) {
        for (const song of this.sourceSongs[resolvedKey]) {
          song.enabled = !song.enabled;
        }
        saveJsonAtomic(SOURCE_FILE, this.sourceSongs);
      }

      console.log(`[Storage] Saved inverted batch change for "${resolvedKey}"`);

      return [...this.serverFilter[resolvedKey]];
    });
  }

  /**
   * Add a newly scraped artist without resetting existing artists/songs
   */
  public async addScrapedArtist(artistName: string, scrapedSongs: Song[]): Promise<FilterData> {
    return runWithLock(() => {
      const cleanArtist = cleanHebrewWithSpaces(artistName) || artistName.trim();

      // 1. Update source songs
      this.sourceSongs[cleanArtist] = scrapedSongs;
      saveJsonAtomic(SOURCE_FILE, this.sourceSongs);

      // 2. Clean source data
      const cleanedSource = cleanSourceData(this.sourceSongs);

      // 3. Normalize into server_filter without resetting existing states
      this.serverFilter = normalizeServerFilter(cleanedSource, this.serverFilter);
      saveJsonAtomic(SERVER_FILTER_FILE, this.serverFilter);

      console.log(`[Storage] Added scraped artist "${cleanArtist}" (${scrapedSongs.length} songs) to disk files`);

      return this.serverFilter;
    });
  }

  public getRawFiles(): { sourceFile: string; filterFile: string } {
    return {
      sourceFile: SOURCE_FILE,
      filterFile: SERVER_FILTER_FILE
    };
  }
}

export const storage = new StorageService();
