import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, ChevronLeft, User, Music4, Check, Filter } from 'lucide-react';
import { FilterData } from '../types/song.js';

interface ArtistBarProps {
  artists: string[];
  filterData: FilterData;
  selectedArtist: string | null;
  onSelectArtist: (artist: string) => void;
}

export const ArtistBar: React.FC<ArtistBarProps> = ({
  artists,
  filterData,
  selectedArtist,
  onSelectArtist
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtered artist list based on search term
  const filteredArtists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return artists;
    return artists.filter(artist =>
      artist.toLowerCase().includes(term) ||
      artist.replace(/[^ א-ת]/g, '').includes(term)
    );
  }, [artists, searchTerm]);

  // Handle previous / next artist navigation
  const currentIndex = selectedArtist ? artists.indexOf(selectedArtist) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < artists.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectArtist(artists[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onSelectArtist(artists[currentIndex + 1]);
  };

  return (
    <div className="bg-white border-b border-slate-200/90 shadow-xs py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* The Artist Picker Controls */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {/* 1. Quick Search Field */}
          <div className="relative min-w-[220px] sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חיפוש מהיר של אמן..."
              className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-850 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-3 text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                title="נקה חיפוש"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Dropdown Menu */}
          <div className="relative flex-1 max-w-md">
            <div className="relative">
              <select
                value={selectedArtist || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectArtist(e.target.value);
                  }
                }}
                className="w-full h-11 appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl px-4 pl-10 pr-10 text-sm font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all truncate"
              >
                <option value="" disabled>
                  -- בחר אמן מתוך הרשימה ({filteredArtists.length}) --
                </option>
                {filteredArtists.map((artist) => {
                  const songs = filterData[artist] || [];
                  const enabledCount = songs.filter(s => s.enabled).length;
                  return (
                    <option key={artist} value={artist}>
                      {artist} ({enabledCount}/{songs.length} שירים פעילים)
                    </option>
                  );
                })}
              </select>
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Previous / Next buttons */}
          <div className="hidden sm:flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="האמן הקודם"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="האמן הבא"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Currently Selected Artist Summary Badge */}
        {selectedArtist && filterData[selectedArtist] && (
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div className="text-left text-xs">
              <span className="text-slate-400 block font-normal">אמן נבחר:</span>
              <span className="font-bold text-slate-800 text-sm">{selectedArtist}</span>
            </div>
            <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl text-indigo-700 text-xs font-bold font-mono">
              {filterData[selectedArtist].filter(s => s.enabled).length} / {filterData[selectedArtist].length} ON
            </div>
          </div>
        )}
      </div>

      {/* Quick Artist Chips (if search term is active or to quickly jump) */}
      {searchTerm && filteredArtists.length > 0 && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" /> תוצאות חיפוש:
          </span>
          {filteredArtists.slice(0, 10).map((artist) => {
            const isSelected = artist === selectedArtist;
            const songs = filterData[artist] || [];
            const onCount = songs.filter(s => s.enabled).length;
            return (
              <button
                key={artist}
                onClick={() => onSelectArtist(artist)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{artist}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                  {onCount}/{songs.length}
                </span>
              </button>
            );
          })}
          {filteredArtists.length > 10 && (
            <span className="text-xs text-slate-400">
              +{filteredArtists.length - 10} נוספים...
            </span>
          )}
        </div>
      )}
    </div>
  );
};
