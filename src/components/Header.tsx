import React, { useState } from 'react';
import { UserPlus, Download, Check, FileJson, Music, Disc3 } from 'lucide-react';
import { FilterData } from '../types/song.js';
import { downloadJsonFile } from '../utils/download.js';

interface HeaderProps {
  onOpenAddArtist: () => void;
  onOpenExport: () => void;
  status: 'connected' | 'saving' | 'error';
  artistCount: number;
  totalSongs: number;
  enabledSongs: number;
  filterData: FilterData;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddArtist,
  onOpenExport,
  status,
  artistCount,
  totalSongs,
  enabledSongs,
  filterData
}) => {
  const [downloadingFilter, setDownloadingFilter] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);

  const handleQuickDownloadFilter = () => {
    setDownloadingFilter(true);
    downloadJsonFile(filterData, 'server_filter.json');
    setTimeout(() => setDownloadingFilter(false), 1500);
  };

  const handleQuickDownloadSource = () => {
    setDownloadingSource(true);
    // Export raw source format
    const sourceData: FilterData = {};
    for (const [artist, songs] of Object.entries(filterData)) {
      sourceData[artist] = songs.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url
      }));
    }
    downloadJsonFile(sourceData, 'genius_songs.json');
    setTimeout(() => setDownloadingSource(false), 1500);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Right side in RTL: Add Artist and Download JSON buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddArtist}
            className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer active:scale-95"
            title="סרוק והוסף אמן חדש ללא איפוס הסינון הקיים"
          >
            <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>הוסף אמן</span>
            <span className="hidden sm:inline-block bg-white/20 text-[11px] px-1.5 py-0.5 rounded-md font-mono">
              Genius
            </span>
          </button>

          {/* Quick Direct Download Buttons */}
          <div className="flex items-center gap-1.5 border-r border-slate-700/80 pr-3 mr-1">
            <button
              onClick={handleQuickDownloadFilter}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 shadow-2xs cursor-pointer active:scale-95"
              title="הורד מיידית את קובץ הסינון המעודכן server_filter.json"
            >
              {downloadingFilter ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">הורד!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>הורד server_filter.json</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700 cursor-pointer"
              title="פתח אפשרויות ייצוא נוספות והעתקה ללוח"
            >
              <FileJson className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">ייצוא מלא...</span>
            </button>
          </div>
        </div>

        {/* Center: Live Stats */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-slate-300 bg-slate-800/60 border border-slate-700/60 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">אמנים:</span>
            <span className="font-bold text-white font-mono text-sm">{artistCount}</span>
          </div>
          <div className="w-px h-3.5 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">שירים פעילים (ON):</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">{enabledSongs}</span>
            <span className="text-slate-500">/</span>
            <span className="font-medium text-slate-300 font-mono text-sm">{totalSongs}</span>
          </div>
        </div>

        {/* Left side in RTL: Title & Server Sync Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Music className="w-5 h-5" />
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>מסנן שירים</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  Node.js
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {status === 'connected' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-300 font-medium">נשמר בדיסק ומסונכרן</span>
                  </>
                )}
                {status === 'saving' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span className="text-amber-300 font-medium">כותב לקובץ...</span>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span className="text-rose-300 font-medium">שגיאת חיבור</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
