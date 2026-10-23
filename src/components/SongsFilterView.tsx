import React, { useState, useMemo } from 'react';
import { Search, ExternalLink, CheckCheck, XCircle, ArrowLeftRight, Music, Filter, Sparkles } from 'lucide-react';
import { Song } from '../types/song.js';

interface SongsFilterViewProps {
  selectedArtist: string | null;
  songs: Song[];
  onToggleSong: (index: number, newEnabled: boolean) => void;
  onBatchAction: (action: 'all_on' | 'all_off' | 'invert') => void;
  isSaving: boolean;
}

export const SongsFilterView: React.FC<SongsFilterViewProps> = ({
  selectedArtist,
  songs,
  onToggleSong,
  onBatchAction,
  isSaving
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on' | 'off'>('all');

  // Filtered song items with their original indices
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => {
        // Search filter
        if (query && !song.title.toLowerCase().includes(query)) {
          return false;
        }

        // Status tab filter
        if (statusFilter === 'on' && !song.enabled) {
          return false;
        }
        if (statusFilter === 'off' && song.enabled) {
          return false;
        }

        return true;
      });
  }, [songs, searchQuery, statusFilter]);

  const enabledCount = useMemo(() => songs.filter(s => s.enabled).length, [songs]);

  if (!selectedArtist) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200/80 m-4 sm:m-6 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
          <Music className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">בחר אמן כדי לסנן את שיריו</h3>
        <p className="text-sm text-slate-500 max-w-md">
          בחר אמן מהתפריט הנפתח או מהחיפוש בסרגל העליון, או לחץ על "הוסף אמן" בפינה השמאלית העליונה כדי לסרוק אמן חדש מ-Genius.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Controls Card for Selected Artist */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {selectedArtist}
              </h2>
              <span className="text-xs px-2.5 py-1 bg-slate-100 font-bold text-slate-700 rounded-lg">
                {songs.length} שירים סה״כ
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              לחץ על שיר כדי להפעיל או לכבות אותו. השינויים נשמרים אוטומטית לקובץ <code className="text-slate-700 font-mono font-semibold">server_filter.json</code>.
            </p>
          </div>

          {/* Batch operations toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onBatchAction('all_on')}
              disabled={isSaving || songs.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="הפעל את כל השירים של האמן"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>הפעל הכל</span>
            </button>
            <button
              onClick={() => onBatchAction('all_off')}
              disabled={isSaving || songs.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="כבה את כל השירים של האמן"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>כבה הכל</span>
            </button>
            <button
              onClick={() => onBatchAction('invert')}
              disabled={isSaving || songs.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="היפוך בחירה של כל השירים"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>היפוך בחירה</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
          {/* Song Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש שיר לפי שם..."
              className="w-full h-10 pl-4 pr-9 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              הכל ({songs.length})
            </button>
            <button
              onClick={() => setStatusFilter('on')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'on'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              פעילים ({enabledCount})
            </button>
            <button
              onClick={() => setStatusFilter('off')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'off'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              כבויים ({songs.length - enabledCount})
            </button>
          </div>
        </div>
      </div>

      {/* Song List Content */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pb-12">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
            <p className="text-base font-semibold text-slate-700">לא נמצאו שירים</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? `לא נמצאו שירים התואמים לחיפוש "${searchQuery}"` : 'אין שירים בקטגוריה זו'}
            </p>
          </div>
        ) : (
          filteredItems.map(({ song, index }) => {
            const isEnabled = !!song.enabled;

            return (
              <div
                key={`${song.id ?? index}-${song.title}`}
                onClick={() => onToggleSong(index, !isEnabled)}
                className={`group w-full min-h-[52px] px-4 py-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer select-none transition-all duration-150 ${
                  isEnabled
                    ? 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs shadow-2xs'
                    : 'bg-slate-200/85 text-slate-600 border-slate-300/80 hover:bg-slate-200'
                }`}
              >
                {/* Song title and optional index */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${
                    isEnabled ? 'bg-slate-100 text-slate-500' : 'bg-slate-300 text-slate-600'
                  }`}>
                    #{index + 1}
                  </span>
                  <span className={`text-sm sm:text-base font-medium truncate ${
                    isEnabled ? 'text-slate-900 font-semibold' : 'text-slate-600 line-through decoration-slate-400/60'
                  }`}>
                    {song.title}
                  </span>
                </div>

                {/* Right side: External lyrics link + Badge */}
                <div className="flex items-center gap-3 shrink-0">
                  {song.url && (
                    <a
                      href={song.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white/60 transition-colors"
                      title="פתח מילים ב-Genius"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Badge matching Python's .badge element */}
                  <div
                    className={`font-mono text-xs font-extrabold px-3 py-1 rounded-lg tracking-wider transition-colors shadow-2xs ${
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
  );
};
