import React, { useState, useMemo } from 'react';
import { Download, Copy, Check, X, FileJson, CheckCircle2, ShieldCheck, Disc3 } from 'lucide-react';
import { FilterData } from '../types/song.js';
import { downloadJsonFile, copyToClipboard } from '../utils/download.js';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterData: FilterData;
  lastSavedTime: Date | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  filterData,
  lastSavedTime
}) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'active' | 'source'>('filter');
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Active songs only
  const activeSongsData = useMemo(() => {
    const result: FilterData = {};
    for (const [artist, songs] of Object.entries(filterData)) {
      const onSongs = songs.filter(s => s.enabled);
      if (onSongs.length > 0) {
        result[artist] = onSongs;
      }
    }
    return result;
  }, [filterData]);

  // Clean source data (all songs)
  const sourceSongsData = useMemo(() => {
    const result: FilterData = {};
    for (const [artist, songs] of Object.entries(filterData)) {
      result[artist] = songs.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url
      }));
    }
    return result;
  }, [filterData]);

  const currentData = useMemo(() => {
    if (activeTab === 'active') return activeSongsData;
    if (activeTab === 'source') return sourceSongsData;
    return filterData;
  }, [activeTab, filterData, activeSongsData, sourceSongsData]);

  const currentFilename = useMemo(() => {
    if (activeTab === 'active') return 'active_songs.json';
    if (activeTab === 'source') return 'genius_songs.json';
    return 'server_filter.json';
  }, [activeTab]);

  const jsonString = useMemo(() => {
    return JSON.stringify(currentData, null, 2);
  }, [currentData]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const success = downloadJsonFile(currentData, currentFilename);
    if (success) {
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(jsonString);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity" dir="rtl">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ייצוא והורדת קבצי JSON</h3>
              <p className="text-xs text-slate-300">
                הקבצים מתעדכנים מיידית בכל שינוי ומוכנים להורדה
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('filter')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'filter'
                ? 'bg-white border-indigo-600 text-indigo-600 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>server_filter.json (כל השירים + ON/OFF)</span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-white border-emerald-600 text-emerald-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>active_songs.json (רק שירים פעילים)</span>
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'source'
                ? 'bg-white border-slate-700 text-slate-800 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Disc3 className="w-4 h-4" />
            <span>genius_songs.json (מקור Genius)</span>
          </button>
        </div>

        {/* Status bar */}
        <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">נשמר אוטומטית לקובץ בדיסק</span>
          </div>
          {lastSavedTime && (
            <span className="text-emerald-700 font-mono text-[11px]">
              עדכון אחרון: {lastSavedTime.toLocaleTimeString('he-IL')}
            </span>
          )}
        </div>

        {/* Preview JSON body */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="relative">
            <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[320px] select-all leading-relaxed">
              {jsonString.slice(0, 3000)}
              {jsonString.length > 3000 ? '\n\n... (הקובץ המלא מוכן להורדה ולהעתקה)' : ''}
            </pre>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono">
            שם קובץ: <span className="font-bold text-slate-800">{currentFilename}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">הועתק ללוח!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>העתק JSON ללוח</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-indigo-500/20 active:scale-95"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>הקובץ הורד בהצלחה!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>הורד {currentFilename}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
