import React, { useState, useEffect } from 'react';
import { 
  Music, Search, AlertCircle, CheckCircle2, Loader2, 
  X, Check, HelpCircle, ExternalLink, Disc, FolderPlus, ChevronLeft
} from 'lucide-react';
import { FilterData, ScrapeSongCandidate, Song } from '../types/song.js';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterData: FilterData;
  onSongAdded: (song: Song, data: FilterData) => void;
}

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  filterData,
  onSongAdded
}) => {
  const [step, setStep] = useState<'input' | 'did_you_mean' | 'adding' | 'success'>('input');
  const [songQuery, setSongQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ScrapeSongCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ScrapeSongCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [addedSongInfo, setAddedSongInfo] = useState<{ title: string; artist: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setSongQuery('');
      setSearching(false);
      setCandidates([]);
      setSelectedCandidate(null);
      setErrorMessage('');
      setAddedSongInfo(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Find song candidates on Genius
  const handleFindSongCandidates = async () => {
    const trimmed = songQuery.trim();
    if (!trimmed) {
      setErrorMessage('אנא הזן שם שיר');
      return;
    }

    setSearching(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/song/search-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'שגיאה בחיפוש שירים ב-Genius');
      }

      const hits: ScrapeSongCandidate[] = res.candidates || [];
      if (hits.length === 0) {
        setErrorMessage(`לא נמצאו שירים ב-Genius עבור "${trimmed}". נסה לכלול גם את שם האמן.`);
        return;
      }

      setCandidates(hits);
      setSelectedCandidate(hits[0]); // top candidate pre-selected
      setStep('did_you_mean');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'שגיאה בחיפוש שירים');
    } finally {
      setSearching(false);
    }
  };

  // Step 2: Confirm selected song and add to "אחרים"
  const handleConfirmAddSong = async () => {
    if (!selectedCandidate) return;

    setStep('adding');
    setErrorMessage('');

    try {
      const response = await fetch('/api/song/add-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: {
            id: selectedCandidate.id,
            title: selectedCandidate.title,
            url: selectedCandidate.url,
            artistName: selectedCandidate.artistName
          }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'שגיאה בהוספת השיר');
      }

      setAddedSongInfo({
        title: selectedCandidate.title,
        artist: selectedCandidate.artistName
      });
      setStep('success');

      if (result.data && result.song) {
        onSongAdded(result.song, result.data);
      }

      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'שגיאה בשמירת השיר');
      setStep('did_you_mean');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all text-right flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">הוספת שיר ישירות</h3>
              <p className="text-xs text-slate-300">יישמר לקטגוריית "אחרים" עם אימות "האם התכוונת ל..."</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* STEP 1: INPUT SONG NAME */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  שם השיר (ואפשר להוסיף גם אמן):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !searching) {
                        handleFindSongCandidates();
                      }
                    }}
                    placeholder="לדוגמה: נשל הנחש, עוף גוזל, ערב כחול עמוק..."
                    className="w-full px-4 py-3 pr-10 text-slate-900 bg-slate-50 border border-slate-300 rounded-xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    autoFocus
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">שגיאה</p>
                    <p className="text-rose-700 text-xs mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
                <span className="font-bold text-slate-700">שים לב:</span> שיר שתבחר יתווסף אוטומטית לקטגוריית <span className="font-bold text-slate-900">"אחרים"</span>, יאוחסן ב-<code>server_filter.json</code> ויתחיל במצב כבוי (OFF) כברירת מחדל לסינון.
              </div>
            </div>
          )}

          {/* STEP 2: "DID YOU MEAN THIS SONG?" */}
          {step === 'did_you_mean' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    האם התכוונת לשיר הזה?
                  </h4>
                </div>
                <button
                  onClick={() => setStep('input')}
                  className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                  <span>שנה חיפוש</span>
                </button>
              </div>

              <div className="space-y-2">
                {candidates.slice(0, 5).map((cand, idx) => {
                  const isSelected = selectedCandidate?.id === cand.id;

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedCandidate(cand)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Thumbnail or Music icon */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-200 flex items-center justify-center">
                        {cand.thumbnail ? (
                          <img 
                            src={cand.thumbnail} 
                            alt={cand.title} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <Disc className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {cand.title}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              התאמה ראשונה
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 truncate mt-0.5">
                          מבצע: <span className="font-semibold text-slate-800">{cand.artistName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {cand.url && (
                          <a
                            href={cand.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-slate-100"
                            title="פתח מילים ב-Genius"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: ADDING */}
          {step === 'adding' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
              <div>
                <p className="font-bold text-slate-900 text-base">
                  מוסיף את "{selectedCandidate?.title}" לקטגוריית "אחרים"...
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  השיר יישמר ישירות בדיסק ב-server_filter.json
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && addedSongInfo && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-900 text-base">
                השיר נוסף בהצלחה!
              </p>
              <p className="text-xs text-slate-600">
                "{addedSongInfo.title}" ({addedSongInfo.artist}) נוסף לקטגוריית "אחרים".
              </p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            ביטול
          </button>

          {step === 'input' && (
            <button
              type="button"
              onClick={handleFindSongCandidates}
              disabled={searching || !songQuery.trim()}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>מחפש שיר ב-Genius...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>חפש שיר ב-Genius</span>
                </>
              )}
            </button>
          )}

          {step === 'did_you_mean' && (
            <button
              type="button"
              onClick={handleConfirmAddSong}
              disabled={!selectedCandidate}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>כן, הוסף את "{selectedCandidate?.title}" ל"אחרים"</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
