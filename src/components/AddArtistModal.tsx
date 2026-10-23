import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, CheckCircle2, Loader2, Music2, Sparkles, X } from 'lucide-react';
import { FilterData } from '../types/song.js';

interface AddArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingArtists: string[];
  filterData: FilterData;
  onArtistAdded: (newArtist: string, data: FilterData) => void;
}

export const AddArtistModal: React.FC<AddArtistModalProps> = ({
  isOpen,
  onClose,
  existingArtists,
  filterData,
  onArtistAdded
}) => {
  const [artistInput, setArtistInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState<{ exists: boolean; count: number; name: string } | null>(null);
  const [scraping, setScraping] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setArtistInput('');
      setAlreadyExists(null);
      setScraping(false);
      setStatusMessage('');
      setErrorMessage('');
      setSuccessInfo(null);
    }
  }, [isOpen]);

  // Check if artist already exists in local state
  useEffect(() => {
    const trimmed = artistInput.trim();
    if (!trimmed) {
      setAlreadyExists(null);
      setErrorMessage('');
      return;
    }

    const cleanInput = trimmed.replace(/[^ א-ת]/g, '').trim().toLowerCase();
    const foundArtist = existingArtists.find(a => {
      const cleanExisting = a.replace(/[^ א-ת]/g, '').trim().toLowerCase();
      return cleanExisting === cleanInput || a.toLowerCase() === trimmed.toLowerCase();
    });

    if (foundArtist) {
      const count = filterData[foundArtist]?.length || 0;
      setAlreadyExists({
        exists: true,
        count,
        name: foundArtist
      });
    } else {
      setAlreadyExists(null);
    }
  }, [artistInput, existingArtists, filterData]);

  if (!isOpen) return null;

  const handleStartScrape = async (force: boolean = false) => {
    const trimmed = artistInput.trim();
    if (!trimmed) {
      setErrorMessage('אנא הזן שם אמן');
      return;
    }

    setScraping(true);
    setErrorMessage('');
    setSuccessInfo(null);
    setStatusMessage(`מחפש את "${trimmed}" ב-Genius...`);

    try {
      // Step feedback timer
      const timer1 = setTimeout(() => {
        setStatusMessage('מאתר את שירי האמן ומוריד נתונים מ-Genius API...');
      }, 1500);

      const response = await fetch('/api/artist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistName: trimmed, force })
      });

      clearTimeout(timer1);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'שגיאה בסריקת האמן מ-Genius');
      }

      if (result.alreadyExisted && !force) {
        setAlreadyExists({
          exists: true,
          count: result.songCount,
          name: result.artistName
        });
        setStatusMessage('');
        setScraping(false);
        return;
      }

      setSuccessInfo({
        name: result.artistName,
        count: result.songCount
      });
      setStatusMessage('');

      // Notify parent to update data and select newly added artist
      if (result.data) {
        onArtistAdded(result.artistName, result.data);
      }

      // Auto close after brief celebration
      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'אירעה שגיאה בסריקה');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all text-right"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">הוספת אמן חדש לסריקה</h3>
              <p className="text-xs text-slate-300">סריקה מ-Genius ושמירה אוטומטית לקובץ הסינון</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={scraping}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              שם האמן בעברית או באנגלית:
            </label>
            <div className="relative">
              <input
                type="text"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !scraping) {
                    handleStartScrape(false);
                  }
                }}
                disabled={scraping}
                placeholder="לדוגמה: שלמה ארצי, אביתר בנאי, כוורת..."
                className="w-full px-4 py-3 pr-10 text-slate-900 bg-slate-50 border border-slate-300 rounded-xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                autoFocus
              />
              <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
            </div>
          </div>

          {/* If already exists */}
          {alreadyExists && !scraping && !successInfo && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">האמן "{alreadyExists.name}" כבר קיים במערכת!</p>
                <p className="text-amber-700 text-xs mt-1">
                  האמן כולל כרגע {alreadyExists.count} שירים בקובץ הסינון. סריקה נוספת תעדכן שירים חדשים ותשמור על מצב הסינון הקיים.
                </p>
                <button
                  type="button"
                  onClick={() => handleStartScrape(true)}
                  className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  עדכן / סרוק מחדש בכל זאת
                </button>
              </div>
            </div>
          )}

          {/* Scraping progress message */}
          {scraping && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <div className="text-sm font-medium text-indigo-900">
                {statusMessage || 'מתחבר ל-Genius...'}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">שגיאה בסריקה</p>
                <p className="text-rose-700 text-xs mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successInfo && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">הסריקה הושלמה בהצלחה!</p>
                <p className="text-emerald-700 text-xs">
                  נוספו {successInfo.count} שירים עבור "{successInfo.name}".
                </p>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
            <span className="font-bold text-slate-700">שים לב:</span> כל אמן שנוסף נשמר ישירות בקובץ <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">genius_songs.json</code> וממוזג לתוך <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">server_filter.json</code> מבלי לאפס שירים קיימים!
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={scraping}
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            ביטול
          </button>

          {!alreadyExists && (
            <button
              type="button"
              onClick={() => handleStartScrape(false)}
              disabled={scraping || !artistInput.trim()}
              className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {scraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>סורק מ-Genius...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>התחל סריקה והוספה</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
