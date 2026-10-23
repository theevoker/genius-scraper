import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { storage } from './src/server/storage.js';
import {
  searchGeniusArtists,
  chooseBestArtist,
  getAllSongsForArtist,
  cleanHebrewWithSpaces
} from './src/server/geniusScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  app.use(express.json());

  // Prevent caching for API responses matching Python HTTP server header Cache-Control: no-store
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 1. Get entire filter data
  app.get('/api/data', (req: Request, res: Response) => {
    try {
      const data = storage.getData();
      res.json(data);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 2. Toggle / set individual song state (supports both GET and POST)
  const handleSetSong = async (
    artist: string,
    indexText: string,
    enabledText: string,
    res: Response
  ) => {
    if (!artist) {
      return res.status(400).json({ error: 'Missing artist' });
    }
    if (indexText === undefined || indexText === null || indexText === '') {
      return res.status(400).json({ error: 'Missing index' });
    }
    if (enabledText === undefined || enabledText === null || enabledText === '') {
      return res.status(400).json({ error: 'Missing enabled' });
    }

    const enabledLower = String(enabledText).toLowerCase();
    if (enabledLower !== 'true' && enabledLower !== 'false') {
      return res.status(400).json({ error: 'enabled must be true or false' });
    }

    const index = parseInt(String(indexText), 10);
    if (isNaN(index)) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const enabled = enabledLower === 'true';

    try {
      const updatedSong = await storage.setSongState(artist, index, enabled);
      return res.json(updatedSong);
    } catch (err: any) {
      console.error('Error updating song:', err);
      return res.status(400).json({ error: err.message || 'Failed to update song' });
    }
  };

  // Compatible with filter.py GET /api/song?artist=...&index=...&enabled=...
  app.get('/api/song', async (req: Request, res: Response) => {
    const { artist, index, enabled } = req.query;
    await handleSetSong(artist as string, index as string, enabled as string, res);
  });

  // Also support POST /api/song
  app.post('/api/song', async (req: Request, res: Response) => {
    const { artist, index, enabled } = req.body;
    await handleSetSong(artist, index, String(enabled), res);
  });

  // Batch toggle all songs for an artist
  app.post('/api/batch-song', async (req: Request, res: Response) => {
    const { artist, action } = req.body;
    if (!artist) {
      return res.status(400).json({ error: 'Missing artist' });
    }

    try {
      if (action === 'invert') {
        const songs = await storage.invertBatchState(artist);
        return res.json({ success: true, songs });
      }
      const enabled = action === 'all_on';
      const songs = await storage.setBatchState(artist, enabled);
      return res.json({ success: true, songs });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 3. Check if artist already exists in filter or source
  app.post('/api/artist/check', (req: Request, res: Response) => {
    const { artistName } = req.body;
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ error: 'Missing artistName' });
    }

    const exists = storage.hasArtist(artistName);
    const cleanName = cleanHebrewWithSpaces(artistName);
    const data = storage.getData();
    let count = 0;

    for (const [key, songs] of Object.entries(data)) {
      if (cleanHebrewWithSpaces(key) === cleanName) {
        count = songs.length;
        break;
      }
    }

    return res.json({
      exists,
      count,
      cleanName
    });
  });

  // 4. Scrape and add a new artist from Genius
  app.post('/api/artist/add', async (req: Request, res: Response) => {
    const { artistName, force } = req.body;
    if (!artistName || typeof artistName !== 'string' || !artistName.trim()) {
      return res.status(400).json({ error: 'Please provide a valid artist name' });
    }

    const trimmedName = artistName.trim();
    const cleanName = cleanHebrewWithSpaces(trimmedName) || trimmedName;

    // Check if artist already exists
    if (!force && storage.hasArtist(cleanName)) {
      const data = storage.getData();
      const existingSongs = data[cleanName] || [];
      return res.json({
        success: true,
        alreadyExisted: true,
        artistName: cleanName,
        songCount: existingSongs.length,
        message: `Artist "${cleanName}" already exists with ${existingSongs.length} songs`,
        data
      });
    }

    console.log(`Starting scrape for artist: "${trimmedName}"...`);

    try {
      // 1. Search Genius
      const candidates = await searchGeniusArtists(trimmedName);
      if (candidates.length === 0) {
        return res.status(404).json({
          error: `No artist candidates found on Genius for "${trimmedName}". Check spelling or try Hebrew/English.`
        });
      }

      // 2. Select best candidate
      const bestCandidate = chooseBestArtist(trimmedName, candidates);
      if (!bestCandidate) {
        return res.status(404).json({
          error: `Could not identify an artist match for "${trimmedName}".`
        });
      }

      console.log(`Matched candidate: "${bestCandidate.name}" (ID: ${bestCandidate.id})`);

      // 3. Fetch all songs
      const songs = await getAllSongsForArtist(bestCandidate.id);
      if (songs.length === 0) {
        return res.status(404).json({
          error: `Found artist "${bestCandidate.name}" on Genius, but no songs could be retrieved.`
        });
      }

      const targetArtistName = cleanHebrewWithSpaces(bestCandidate.name) || cleanName;

      // 4. Save into source and normalized filter
      const updatedData = await storage.addScrapedArtist(targetArtistName, songs);

      console.log(`Successfully scraped and saved ${songs.length} songs for "${targetArtistName}".`);

      return res.json({
        success: true,
        alreadyExisted: false,
        artistName: targetArtistName,
        songCount: songs.length,
        message: `Successfully added "${targetArtistName}" with ${songs.length} songs`,
        data: updatedData
      });
    } catch (err: any) {
      console.error(`Error scraping artist "${trimmedName}":`, err);
      return res.status(500).json({
        error: err.message || `Failed to scrape artist "${trimmedName}" from Genius`
      });
    }
  });

  // Export endpoint to download JSON files directly with no-cache headers
  app.get('/api/export/:fileType', (req: Request, res: Response) => {
    const { fileType } = req.params;
    
    // Explicit anti-caching headers so every download is 100% up-to-date
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (fileType === 'filter') {
      res.setHeader('Content-Disposition', 'attachment; filename="server_filter.json"');
      return res.send(JSON.stringify(storage.getData(), null, 2));
    } else if (fileType === 'source') {
      res.setHeader('Content-Disposition', 'attachment; filename="genius_songs.json"');
      return res.send(JSON.stringify(storage.getSourceData(), null, 2));
    } else if (fileType === 'active') {
      res.setHeader('Content-Disposition', 'attachment; filename="active_songs.json"');
      return res.send(JSON.stringify(storage.getActiveSongs(), null, 2));
    } else {
      return res.status(404).json({ error: 'Unknown file type' });
    }
  });

  // Health / Status endpoint
  app.get('/api/status', (req: Request, res: Response) => {
    const data = storage.getData();
    const artistCount = Object.keys(data).length;
    let totalSongs = 0;
    let enabledSongs = 0;

    for (const songs of Object.values(data)) {
      totalSongs += songs.length;
      enabledSongs += songs.filter(s => s.enabled).length;
    }

    res.json({
      status: 'ok',
      artists: artistCount,
      totalSongs,
      enabledSongs
    });
  });

  // Mount Vite or static server
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`Song Filter Server listening on http://0.0.0.0:${PORT}`);
    console.log(`Persisting to genius_songs.json and server_filter.json`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
