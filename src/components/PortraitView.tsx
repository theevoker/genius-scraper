import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  UserPlus, Download, FileJson, Music, Search, CheckCheck, 
  XCircle, ArrowLeftRight, ExternalLink, ChevronDown, Check,
  Smartphone, Monitor, Filter, PlusCircle
} from 'lucide-react';
import { FilterData, Song } from '../types/song.js';

interface PortraitViewProps {
  data: FilterData;
  artists: string[];
  selectedArtist: string | null;
  onSelectArtist: (artist: string) => void;
  onToggleSong: (index: number, newEnabled: boolean) => void;
  onBatchAction: (action: 'all_on' | 'all_off' | 'invert') => void;
  onOpenAddArtist: () => void;
  onOpenAddSong: () => void;
  onOpenExport: () => void;
  status: 'connected' | 'saving' | 'error';
  isSaving: boolean;
  onSwitchToLandscape?: () => void;
}

export const PortraitView: React.FC<PortraitViewProps> = ({
  data,
  artists,
  selectedArtist,
  onSelectArtist,
  onToggleSong,
  onBatchAction,
  onOpenAddArtist,
  onOpenAddSong,
  onOpenExport,
  status,
  isSaving,
  onSwitchToLandscape
}) => {
  const [artistSearch, setArtistSearch] = useState('');
  const [songSearch, setSongSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on' | 'off'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const artistScrollRef = useRef<HTMLDivElement>(null);

  // Filtered artists based on query
  const filteredArtists = useMemo(() => {
    const q = artistSearch.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(a => 
      a.toLowerCase().includes(q) || 
      a.replace(/[^ א-ת]/g, '').includes(q)
    );
  }, [artists, artistSearch]);

  const currentSongs = selectedArtist && data[selectedArtist] ? data[selectedArtist] : [];

  // Filtered songs
  const filteredSongs = useMemo(() => {
    const q = songSearch.trim().toLowerCase();
    return currentSongs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => {
        if (q && !song.title.toLowerCase().includes(q)) {
          return false;
        }
        if (statusFilter === 'on' && !song.enabled) {
          return false;
        }
        if (statusFilter === 'off' && song.enabled) {
          return false;
        }
        return true;
      });
  }, [currentSongs, songSearch, statusFilter]);

  const enabledCount = useMemo(() => {
    return currentSongs.filter(s => s.enabled).length;
  }, [currentSongs]);

  // Auto-scroll selected artist into view inside horizontal list
  useEffect(() => {
    if (selectedArtist && artistScrollRef.current) {
      const activeEl = artistScrollRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedArtist]);

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-slate-100 text-slate-900 select-none" dir="rtl">
      
      {/* 1. PORTRAIT HEADER (52px height matching filter.py portrait header) */}
      <header className="h-[52px] min-h-[52px] bg-slate-900 text-white px-3 flex items-center justify-between border-b border-slate-800 shadow-xs z-20">
        
        {/* Right side: App Title & live status */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight flex items-center gap-1.5 leading-none">
              <span>מסנן שירים</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-mono">
                נייד
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              {status === 'connected' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-emerald-400 font-medium">מסונכרן</span>
                </>
              )}
              {status === 'saving' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span className="text-amber-400 font-medium">שומר...</span>
                </>
              )}
              {status === 'error' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span className="text-rose-400 font-medium">שגיאה</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Left side: Add Artist, Export, and View Mode Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Add Artist Button */}
          <button
            onClick={onOpenAddArtist}
            className="px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
            title="הוסף אמן חדש לסריקה מ-Genius"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ אמן</span>
          </button>

          {/* Add Song directly button */}
          <button
            onClick={onOpenAddSong}
            className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
            title="הוסף שיר בודד ישירות לקטגוריית 'אחרים'"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ שיר</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={onOpenExport}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer active:scale-95"
            title="ייצוא והורדת JSON"
          >
            <FileJson className="w-4 h-4" />
          </button>

          {/* Switch to Landscape/Desktop view toggle */}
          {onSwitchToLandscape && (
            <button
              onClick={onSwitchToLandscape}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer active:scale-95"
              title="עבור לתצוגה שולחנית (Desktop / Landscape)"
            >
              <Monitor className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. ARTISTS PANEL - PORTRAIT HORIZONTAL SCROLLER */}
      <div className="bg-white border-b border-slate-200 p-2 shrink-0 shadow-2xs">
        
        {/* Artist Search Bar & Dropdown Button */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={artistSearch}
              onChange={(e) => setArtistSearch(e.target.value)}
              placeholder="חיפוש אמן..."
              className="w-full h-8.5 pr-8 pl-3 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            {artistSearch && (
              <button
                onClick={() => setArtistSearch('')}
                className="absolute left-2.5 top-2 text-[10px] bg-slate-200 text-slate-600 rounded-full w-4 h-4 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Dropdown select */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="h-8.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1 shrink-0"
              title="תפריט נפתח לבחירת אמן"
            >
              <span>רשימה</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showDropdown && (
              <div className="absolute left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1">
                {artists.map((artist) => {
                  const s = data[artist] || [];
                  const onC = s.filter(x => x.enabled).length;
                  const isCur = artist === selectedArtist;
                  return (
                    <button
                      key={artist}
                      onClick={() => {
                        onSelectArtist(artist);
                        setShowDropdown(false);
                      }}
                      className={`w-full text-right px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                        isCur ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="truncate">{artist}</span>
                      <span className="text-[10px] font-mono text-slate-500 mr-2">
                        {onC}/{s.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Scrollable Artist Carousel (Matching filter.py .artists-list in portrait) */}
        <div 
          ref={artistScrollRef}
          className="flex flex-row overflow-x-auto gap-2 pb-1 scroll-smooth no-scrollbar"
        >
          {filteredArtists.length === 0 ? (
            <div className="text-xs text-slate-400 py-1.5 px-2">לא נמצא אמן התואם לחיפוש</div>
          ) : (
            filteredArtists.map((artist) => {
              const isSelected = artist === selectedArtist;
              const songs = data[artist] || [];
              const onCount = songs.filter(s => s.enabled).length;

              return (
                <div
                  key={artist}
                  data-selected={isSelected}
                  onClick={() => onSelectArtist(artist)}
                  className={`min-w-[125px] max-w-[150px] shrink-0 p-2 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {artist}
                  </div>
                  <div className={`text-[10px] font-mono mt-1 flex items-center justify-between ${
                    isSelected ? 'text-indigo-300' : 'text-slate-500'
                  }`}>
                    <span>{onCount} / {songs.length} פעילים</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. SONGS PANEL (Fills remaining screen height) */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 overflow-hidden">
        
        {/* Selected Artist Bar & Batch Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 p-2.5 mb-2 shrink-0 shadow-2xs">
          
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">
                {selectedArtist || 'בחר אמן'}
              </h2>
              {selectedArtist && (
                <div className="text-[11px] text-slate-500 font-mono">
                  {enabledCount} מתוך {currentSongs.length} שירים ב-ON
                </div>
              )}
            </div>

            {/* Quick Batch Buttons */}
            {selectedArtist && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onBatchAction('all_on')}
                  disabled={isSaving || currentSongs.length === 0}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95"
                  title="הפעל הכל"
                >
                  הפעל הכל
                </button>
                <button
                  onClick={() => onBatchAction('all_off')}
                  disabled={isSaving || currentSongs.length === 0}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95"
                  title="כבה הכל"
                >
                  כבה הכל
                </button>
                <button
                  onClick={() => onBatchAction('invert')}
                  disabled={isSaving || currentSongs.length === 0}
                  className="p-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95"
                  title="היפוך בחירה"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Song Search & Filter Tabs */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder="חיפוש שיר..."
                className="w-full h-8 pr-7 pl-3 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              {songSearch && (
                <button
                  onClick={() => setSongSearch('')}
                  className="absolute left-2 top-1.5 text-[10px] text-slate-400"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded text-[11px] font-bold ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                הכל
              </button>
              <button
                onClick={() => setStatusFilter('on')}
                className={`px-2 py-1 rounded text-[11px] font-bold ${
                  statusFilter === 'on' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                ON ({enabledCount})
              </button>
              <button
                onClick={() => setStatusFilter('off')}
                className={`px-2 py-1 rounded text-[11px] font-bold ${
                  statusFilter === 'off' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                OFF
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Song List for Portrait */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 pb-2">
          {!selectedArtist ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <Music className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">בחר אמן מהרשימה העליונה</p>
              <p className="text-xs text-slate-400 mt-1">גלול למעלה כדי לבחור או לחפש אמן</p>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-600">לא נמצאו שירים</p>
              {songSearch && (
                <p className="text-[11px] text-slate-400 mt-1">אין תוצאה עבור "{songSearch}"</p>
              )}
            </div>
          ) : (
            filteredSongs.map(({ song, index }) => {
              const isEnabled = !!song.enabled;

              return (
                <div
                  key={`${song.id ?? index}-${song.title}`}
                  onClick={() => onToggleSong(index, !isEnabled)}
                  className={`w-full min-h-[46px] px-3 py-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer select-none transition-all duration-100 ${
                    isEnabled
                      ? 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                      : 'bg-slate-200/90 border-slate-300 text-slate-500'
                  }`}
                >
                  {/* Song Title and Index */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      isEnabled ? 'bg-slate-100 text-slate-600' : 'bg-slate-300 text-slate-700'
                    }`}>
                      #{index + 1}
                    </span>
                    <span className={`text-xs font-semibold truncate ${
                      isEnabled ? 'text-slate-900' : 'text-slate-600 line-through decoration-slate-400'
                    }`}>
                      {song.title}
                    </span>
                  </div>

                  {/* Right side: Lyrics link & Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {song.url && (
                      <a
                        href={song.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-slate-400 hover:text-indigo-600"
                        title="פתח מילים ב-Genius"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Badge */}
                    <div
                      className={`font-mono text-[10px] font-extrabold px-2.5 py-0.5 rounded-md tracking-wider ${
                        isEnabled
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-500 text-slate-100'
                      }`}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
