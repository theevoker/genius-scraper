import * as cheerio from 'cheerio';
import { Song, ScrapeArtistCandidate } from '../types/song.js';

const ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN || 'tnBhXPdnXnD8Qk4kkgZrR46WnusWq3OVXQfMkK17eU5rdK0oPp4WiGDpSgY0SMo5';
const SEARCH_URL = 'https://genius.com/api/search/multi';
const BASE_URL = 'https://api.genius.com';

const WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://genius.com/'
};

const GENIUS_API_HEADERS = {
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Keep only Hebrew letters (no spaces or punctuation), matching artist_scrape.py hebrew_only()
 */
export function hebrewLettersOnly(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^א-ת]/g, '');
}

/**
 * Clean Hebrew keeping letters and spaces, matching filter.py clean_hebrew()
 */
export function cleanHebrewWithSpaces(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^ א-ת]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Python difflib.SequenceMatcher(None, s1, s2).ratio() implementation
 * SequenceMatcher ratio = 2 * M / (len(s1) + len(s2))
 */
export function sequenceMatcherRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  function findLongestCommonSubstring(
    a: string,
    b: string,
    alo: number,
    ahi: number,
    blo: number,
    bhi: number
  ): [number, number, number] {
    let bestI = alo;
    let bestJ = blo;
    let bestK = 0;

    for (let i = alo; i < ahi; i++) {
      for (let j = blo; j < bhi; j++) {
        let k = 0;
        while (i + k < ahi && j + k < bhi && a[i + k] === b[j + k]) {
          k++;
        }
        if (k > bestK) {
          bestI = i;
          bestJ = j;
          bestK = k;
        }
      }
    }
    return [bestI, bestJ, bestK];
  }

  let totalMatches = 0;
  const queue: Array<[number, number, number, number]> = [[0, s1.length, 0, s2.length]];

  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [bestI, bestJ, bestK] = findLongestCommonSubstring(s1, s2, alo, ahi, blo, bhi);

    if (bestK > 0) {
      totalMatches += bestK;
      if (alo < bestI && blo < bestJ) {
        queue.push([alo, bestI, blo, bestJ]);
      }
      if (bestI + bestK < ahi && bestJ + bestK < bhi) {
        queue.push([bestI + bestK, ahi, bestJ + bestK, bhi]);
      }
    }
  }

  return (2.0 * totalMatches) / (s1.length + s2.length);
}

/**
 * Compare names using Hebrew letters only, matching artist_similarity() in artist_scrape.py
 */
export function artistSimilarity(requestedName: string, candidateName: string): number {
  const requested = hebrewLettersOnly(requestedName);
  const candidate = hebrewLettersOnly(candidateName);

  if (!requested || !candidate) {
    // Fallback if query or name was written in Latin characters
    const reqClean = requestedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candClean = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (reqClean && candClean) {
      return sequenceMatcherRatio(reqClean, candClean);
    }
    return 0.0;
  }

  if (requested === candidate) {
    return 1.0;
  }

  return sequenceMatcherRatio(requested, candidate);
}

/**
 * Search Genius multi endpoint or fallback to API search
 */
export async function searchGeniusArtists(query: string): Promise<ScrapeArtistCandidate[]> {
  const artists: ScrapeArtistCandidate[] = [];

  // 1. Try web multi search endpoint
  try {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: WEB_HEADERS,
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data = await response.json();
      const sections = data?.response?.sections || [];
      for (const section of sections) {
        if (section?.type === 'artist') {
          for (const hit of section.hits || []) {
            const res = hit.result;
            if (res && res.id && res.name) {
              artists.push({
                id: res.id,
                name: res.name,
                url: res.url || `https://genius.com/artists/${res.id}`,
                alternate_names: res.alternate_names || []
              });
            }
          }
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Genius multi search failed or timed out:', err);
  }

  // 2. If no artists found from multi search, try the authenticated API search endpoint
  if (artists.length === 0) {
    try {
      const apiUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(apiUrl, {
        headers: GENIUS_API_HEADERS,
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        const json = await res.json();
        const hits = json?.response?.hits || [];
        const seenArtistIds = new Set<string | number>();

        for (const hit of hits) {
          const artist = hit?.result?.primary_artist;
          if (artist && artist.id && !seenArtistIds.has(artist.id)) {
            seenArtistIds.add(artist.id);
            artists.push({
              id: artist.id,
              name: artist.name,
              url: artist.url || `https://genius.com/artists/${artist.id}`,
              alternate_names: artist.alternate_names || []
            });
          }
        }
      }
    } catch (err) {
      console.warn('Genius API search fallback failed:', err);
    }
  }

  return artists;
}

/**
 * Ranks all artist candidates by similarity to the user's query
 */
export function scoreArtistCandidates(requestedName: string, candidates: ScrapeArtistCandidate[]): ScrapeArtistCandidate[] {
  if (!candidates || candidates.length === 0) return [];

  const scored = candidates.map(artist => {
    let score = artistSimilarity(requestedName, artist.name);
    for (const alt of artist.alternate_names || []) {
      const altScore = artistSimilarity(requestedName, alt);
      if (altScore > score) {
        score = altScore;
      }
    }
    return {
      ...artist,
      similarityScore: score
    };
  });

  scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  return scored;
}

/**
 * Chooses the best artist candidate according to similarity score
 */
export function chooseBestArtist(requestedName: string, candidates: ScrapeArtistCandidate[]): ScrapeArtistCandidate | null {
  const ranked = scoreArtistCandidates(requestedName, candidates);
  return ranked.length > 0 ? ranked[0] : null;
}

/**
 * Search Genius for individual songs (for the "Add Song to Others" feature)
 */
export async function searchGeniusSongs(query: string): Promise<any[]> {
  const songs: any[] = [];
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: GENIUS_API_HEADERS,
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const json: any = await res.json();
      const hits = json?.response?.hits || [];
      for (const hit of hits) {
        if (hit.type === 'song' && hit.result) {
          const r = hit.result;
          songs.push({
            id: r.id,
            title: cleanHebrewWithSpaces(r.title) || r.title,
            fullTitle: r.full_title || `${r.title} - ${r.primary_artist?.name}`,
            artistName: r.primary_artist?.name || 'אמן לא ידוע',
            url: r.url,
            thumbnail: r.song_art_image_thumbnail_url
          });
        }
      }
    }
  } catch (err) {
    console.error('Error searching Genius songs:', err);
  }
  return songs;
}

/**
 * Fetch all songs for an artist from Genius API
 */
export async function getAllSongsForArtist(
  artistId: number | string,
  onProgress?: (count: number, page: number) => void
): Promise<Song[]> {
  const songs: Song[] = [];
  const seenTitles = new Set<string>();
  let page: number | null = 1;
  const maxPages = 40; // up to 2000 songs safety cap

  while (page !== null && page <= maxPages) {
    const pageUrl: string = `${BASE_URL}/artists/${artistId}/songs?page=${page}&per_page=50&sort=title`;
    
    try {
      const response = await fetch(pageUrl, {
        headers: GENIUS_API_HEADERS,
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.error(`Failed to fetch songs page ${page}: HTTP ${response.status}`);
        break;
      }

      const json: any = await response.json();
      const pageSongs = json?.response?.songs || [];

      for (const song of pageSongs) {
        const rawTitle = song.title || '';
        const cleanTitle = cleanHebrewWithSpaces(rawTitle);
        // Only keep songs that have Hebrew characters in their title, or fallback to clean title
        const titleToUse = cleanTitle || rawTitle.trim();
        if (!titleToUse) continue;

        if (seenTitles.has(titleToUse)) continue;
        seenTitles.add(titleToUse);

        songs.push({
          id: song.id,
          title: titleToUse,
          url: song.url
        });
      }

      if (onProgress) {
        onProgress(songs.length, page);
      }

      const nextPage: number | null = json?.response?.next_page ?? null;
      if (!nextPage || nextPage === page) {
        break;
      }
      page = nextPage;

      // Small delay matching Python script REQUEST_DELAY
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error fetching songs on page ${page}:`, err);
      break;
    }
  }

  return songs;
}
