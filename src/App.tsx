import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.js';
import { ArtistBar } from './components/ArtistBar.js';
import { SongsFilterView } from './components/SongsFilterView.js';
import { PortraitView } from './components/PortraitView.js';
import { AddArtistModal } from './components/AddArtistModal.js';
import { AddSongModal } from './components/AddSongModal.js';
import { ExportModal } from './components/ExportModal.js';
import { FilterData, Song } from './types/song.js';

interface AppProps {
  forceView?: 'portrait' | 'landscape';
}

export default function App({ forceView }: AppProps = {}) {
  const [data, setData] = useState<FilterData>({});
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [status, setStatus] = useState<'connected' | 'saving' | 'error'>('connected');
  const [isAddArtistOpen, setIsAddArtistOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(new Date());
  const isInitialLoad = useRef(true);

  // View mode preference
  const [userViewMode, setUserViewMode] = useState<'auto' | 'portrait' | 'landscape'>(() => {
    if (forceView) return forceView;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('view') === 'portrait' || window.location.pathname.includes('portrait')) {
        return 'portrait';
      }
      const saved = localStorage.getItem('preferred_view_mode');
      if (saved === 'portrait' || saved === 'landscape') return saved;
    }
    return 'auto';
  });

  // Device orientation / screen size detection
  const [isDevicePortrait, setIsDevicePortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: portrait)').matches || window.innerWidth <= 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(orientation: portrait)');
    const handleResize = () => {
      setIsDevicePortrait(mql.matches || window.innerWidth <= 768);
    };
    mql.addEventListener('change', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      mql.removeEventListener('change', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const activeView = userViewMode === 'auto'
    ? (isDevicePortrait ? 'portrait' : 'landscape')
    : userViewMode;

  const handleSetViewMode = (mode: 'portrait' | 'landscape') => {
    setUserViewMode(mode);
    localStorage.setItem('preferred_view_mode', mode);
  };

  // Load server filter state with anti-caching timestamp
  const loadData = useCallback(async (isPolling: boolean = false) => {
    try {
      const response = await fetch(`/api/data?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const serverData: FilterData = await response.json();
      setData(serverData);
      setStatus('connected');

      // On initial load, set selected artist from localStorage or first artist
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        const artists = Object.keys(serverData);
        if (artists.length > 0) {
          const savedArtist = localStorage.getItem('last_selected_artist');
          if (savedArtist && serverData[savedArtist]) {
            setSelectedArtist(savedArtist);
          } else {
            setSelectedArtist(artists[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
      if (!isPolling) {
        setStatus('error');
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Sync with server every 3 seconds, matching filter.py multi-client synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll when not actively saving
      if (!isSaving) {
        loadData(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData, isSaving]);

  // Handle artist selection
  const handleSelectArtist = (artist: string) => {
    setSelectedArtist(artist);
    localStorage.setItem('last_selected_artist', artist);
  };

  // Toggle individual song ON/OFF using POST to completely avoid browser caching
  const handleToggleSong = async (index: number, newEnabled: boolean) => {
    if (!selectedArtist || !data[selectedArtist]) return;

    // Optimistic UI update
    const previousSongs = [...data[selectedArtist]];
    const updatedSongs = previousSongs.map((song, i) =>
      i === index ? { ...song, enabled: newEnabled } : song
    );

    setData(prev => ({
      ...prev,
      [selectedArtist]: updatedSongs
    }));
    setStatus('saving');
    setIsSaving(true);

    try {
      const response = await fetch('/api/song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          artist: selectedArtist,
          index,
          enabled: newEnabled
        })
      });

      const serverSong = await response.json();

      if (!response.ok) {
        throw new Error(serverSong.error || 'Failed to update song');
      }

      // Authoritative update from server
      setData(prev => {
        if (!prev[selectedArtist]) return prev;
        const currentList = [...prev[selectedArtist]];
        currentList[index] = serverSong;
        return {
          ...prev,
          [selectedArtist]: currentList
        };
      });

      setLastSavedTime(new Date());
      setStatus('connected');
    } catch (err) {
      console.error('Error updating song state:', err);
      // Rollback on error
      setData(prev => ({
        ...prev,
        [selectedArtist]: previousSongs
      }));
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Batch toggle all songs for artist
  const handleBatchAction = async (action: 'all_on' | 'all_off' | 'invert') => {
    if (!selectedArtist || !data[selectedArtist]) return;

    setStatus('saving');
    setIsSaving(true);

    try {
      const response = await fetch('/api/batch-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ artist: selectedArtist, action })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed batch action');
      }

      setData(prev => ({
        ...prev,
        [selectedArtist]: result.songs
      }));
      setLastSavedTime(new Date());
      setStatus('connected');
    } catch (err) {
      console.error('Batch action error:', err);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // When a new artist is added from Genius scraper modal
  const handleArtistAdded = (newArtist: string, updatedData: FilterData) => {
    setData(updatedData);
    setSelectedArtist(newArtist);
    localStorage.setItem('last_selected_artist', newArtist);
    setLastSavedTime(new Date());
    setStatus('connected');
  };

  // When an individual song is added to 'others' category
  const handleSongAdded = (newSong: Song, updatedData: FilterData) => {
    setData(updatedData);
    setSelectedArtist('אחרים');
    localStorage.setItem('last_selected_artist', 'אחרים');
    setLastSavedTime(new Date());
    setStatus('connected');
  };

  const artists = Object.keys(data);
  const currentSongs = selectedArtist && data[selectedArtist] ? data[selectedArtist] : [];

  // Summary counts
  let totalSongs = 0;
  let enabledSongs = 0;
  for (const songs of Object.values(data)) {
    totalSongs += songs.length;
    enabledSongs += songs.filter(s => s.enabled).length;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans" dir="rtl">
      {/* RENDER VIEW ACCORDING TO VIEW MODE: PORTRAIT OR LANDSCAPE */}
      {activeView === 'portrait' ? (
        <PortraitView
          data={data}
          artists={artists}
          selectedArtist={selectedArtist}
          onSelectArtist={handleSelectArtist}
          onToggleSong={handleToggleSong}
          onBatchAction={handleBatchAction}
          onOpenAddArtist={() => setIsAddArtistOpen(true)}
          onOpenAddSong={() => setIsAddSongOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          status={status}
          isSaving={isSaving}
          onSwitchToLandscape={() => handleSetViewMode('landscape')}
        />
      ) : (
        <>
          {/* 1. Header with Add Artist, Add Song, Export, and View Mode Toggle */}
          <Header
            onOpenAddArtist={() => setIsAddArtistOpen(true)}
            onOpenAddSong={() => setIsAddSongOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
            status={status}
            artistCount={artists.length}
            totalSongs={totalSongs}
            enabledSongs={enabledSongs}
            filterData={data}
            onSwitchToPortrait={() => handleSetViewMode('portrait')}
          />

          {/* 2. Top Artist Bar with search field and dropdown selector */}
          <ArtistBar
            artists={artists}
            filterData={data}
            selectedArtist={selectedArtist}
            onSelectArtist={handleSelectArtist}
          />

          {/* 3. Main Songs Filter View */}
          <main className="flex-1 flex flex-col min-h-0">
            <SongsFilterView
              selectedArtist={selectedArtist}
              songs={currentSongs}
              onToggleSong={handleToggleSong}
              onBatchAction={handleBatchAction}
              isSaving={isSaving}
              onOpenAddArtist={() => setIsAddArtistOpen(true)}
              onOpenAddSong={() => setIsAddSongOpen(true)}
            />
          </main>
        </>
      )}

      {/* 4. Add Artist Scrape Modal with 'Did you mean this' step */}
      <AddArtistModal
        isOpen={isAddArtistOpen}
        onClose={() => setIsAddArtistOpen(false)}
        existingArtists={artists}
        filterData={data}
        onArtistAdded={handleArtistAdded}
      />

      {/* 5. Add Song Directly to 'Others' Modal with 'Did you mean this' step */}
      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
        filterData={data}
        onSongAdded={handleSongAdded}
      />

      {/* 6. Export / Download JSON Modal (Shared across both portrait and landscape) */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        filterData={data}
        lastSavedTime={lastSavedTime}
      />
    </div>
  );
}
