import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, AlertCircle, CheckCircle2, Loader2, Music2, 
  Sparkles, X, ChevronLeft, Check, HelpCircle, ExternalLink 
} from 'lucide-react';
import { FilterData, ScrapeArtistCandidate } from '../types/song.js';

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
  const [step, setStep] = useState<'input' | 'did_you_mean' | 'scraping' | 'success'>('input');
  const [artistInput, setArtistInput] = useState('');
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<ScrapeArtistCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ScrapeArtistCandidate | null>(null);
  const [alreadyExists, setAlreadyExists] = useState<{ exists: boolean; count: number; name: string } | null>(null);
  
  const [scraping, setScraping] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setArtistInput('');
      setSearchingCandidates(false);
      setCandidates([]);
      setSelectedCandidate(null);
      setAlreadyExists(null);
      setScraping(false);
      setStatusMessage('');
      setErrorMessage('');
      setSuccessInfo(null);
    }
  }, [isOpen]);

  // Real-time pre-check against existing artists in local state
  useEffect(() => {
    const trimmed = artistInput.trim();
    if (!trimmed) {
      setAlreadyExists(null);
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

  // Step 1: Search Genius for artist candidates to show "Did you mean this?"
  const handleFindCandidates = async () => {
    const trimmed = artistInput.trim();
    if (!trimmed) {
      setErrorMessage('אנא הזן שם אמן');
      return;
    }

    setSearchingCandidates(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/artist/search-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'שגיאה באיתור אמן ב-Genius');
      }

      if (res.alreadyExists) {
        setAlreadyExists({
          exists: true,
          count: res.existingCount,
          name: res.query
        });
      }

      const foundCandidates: ScrapeArtistCandidate[] = res.candidates || [];
      if (foundCandidates.length === 0) {
        setErrorMessage(`לא נמצאו אמנים ב-Genius עבור "${trimmed}". נסה כתיב שונה או שם באנגלית/עברית.`);
        return;
      }

      setCandidates(foundCandidates);
      setSelectedCandidate(foundCandidates[0]); // top match pre-selected
      setStep('did_you_mean');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'שגיאה בחיפוש מועמדים');
    } finally {
      setSearchingCandidates(false);
    }
  };

  // Step 2: Confirmed candidate -> fetch and scrape songs
  const handleConfirmAndScrape = async (force: boolean = false) => {
    if (!selectedCandidate) return;

    setStep('scraping');
    setScraping(true);
    setErrorMessage('');
    setStatusMessage(`שולף את שירי "${selectedCandidate.name}" מ-Genius...`);

    try {
      const response = await fetch('/api/artist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedCandidate.name,
          artistId: selectedCandidate.id,
          force
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'שגיאה בסריקת שירי האמן');
      }

      if (result.alreadyExisted && !force) {
        setAlreadyExists({
          exists: true,
          count: result.songCount,
          name: result.artistName
        });
        setStep('input');
        setScraping(false);
        return;
      }

      setSuccessInfo({
        name: result.artistName,
        count: result.songCount
      });
      setStep('success');

      // Update parent data and select newly added artist
      if (result.data) {
        onArtistAdded(result.artistName, result.data);
      }

      // Close after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'אירעה שגיאה בסריקה');
      setStep('did_you_mean');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all text-right flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">הוספת אמן חדש לסריקה</h3>
              <p className="text-xs text-slate-300">חיפוש ב-Genius עם אימות "האם התכוונת ל..."</p>
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
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* STEP 1: INPUT ARTIST NAME */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  הזן את שם האמן לחיפוש:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={artistInput}
                    onChange={(e) => setArtistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !searchingCandidates) {
                        handleFindCandidates();
                      }
                    }}
                    placeholder="לדוגמה: שלמה ארצי, אביתר בנאי, כוורת..."
                    className="w-full px-4 py-3 pr-10 text-slate-900 bg-slate-50 border border-slate-300 rounded-xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    autoFocus
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
                </div>
              </div>

              {alreadyExists && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">האמן "{alreadyExists.name}" כבר קיים במערכת!</p>
                    <p className="text-amber-700 text-xs mt-1">
                      האמן כולל כרגע {alreadyExists.count} שירים בקובץ הסינון. סריקה נוספת תעדכן שירים חדשים ותשמור על מצב הסינון הקיים.
                    </p>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">שגיאה</p>
                    <p className="text-rose-700 text-xs mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                לפני סריקת כל השירים, תוצג בפניך חלונית <span className="font-bold text-slate-800">"האם התכוונת ל..."</span> לאישור ההתאמה המדויקת של האמן מ-Genius.
              </div>
            </div>
          )}

          {/* STEP 2: "DID YOU MEAN THIS?" CONFIRMATION SCREEN */}
          {step === 'did_you_mean' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    האם התכוונת לאמן הבא?
                  </h4>
                </div>
                <button
                  onClick={() => setStep('input')}
                  className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                  <span>שנה חיפוש</span>
                </button>
              </div>

              <div className="space-y-2">
                {candidates.slice(0, 4).map((cand, idx) => {
                  const isSelected = selectedCandidate?.id === cand.id;
                  const scorePercent = Math.round((cand.similarityScore || 0) * 100);

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedCandidate(cand)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {cand.name}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              התאמה מיטבית
                            </span>
                          )}
                        </div>

                        {cand.alternate_names && cand.alternate_names.length > 0 && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            כינויים: {cand.alternate_names.slice(0, 2).join(', ')}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                          <span>Genius ID: {cand.id}</span>
                          {scorePercent > 0 && (
                            <span className="font-mono text-indigo-600 font-semibold">
                              התאמה: {scorePercent}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {cand.url && (
                          <a
                            href={cand.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                            title="צפה בפרופיל האמן ב-Genius"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
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

          {/* STEP 3: SCRAPING IN PROGRESS */}
          {step === 'scraping' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div>
                <p className="font-bold text-slate-900 text-base">
                  סורק את כל השירים של "{selectedCandidate?.name}"...
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  השירים יתווספו לקובץ הסינון עם מצב כבוי (OFF) כברירת מחדל
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && successInfo && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-900 text-base">
                האמן נוסף בהצלחה!
              </p>
              <p className="text-xs text-slate-600">
                נוספו {successInfo.count} שירים עבור "{successInfo.name}".
              </p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={scraping}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            ביטול
          </button>

          {step === 'input' && (
            <button
              type="button"
              onClick={handleFindCandidates}
              disabled={searchingCandidates || !artistInput.trim()}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {searchingCandidates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>בודק התאמה ב-Genius...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>חפש אמן ב-Genius</span>
                </>
              )}
            </button>
          )}

          {step === 'did_you_mean' && (
            <button
              type="button"
              onClick={() => handleConfirmAndScrape(false)}
              disabled={!selectedCandidate || scraping}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>כן, סרוק את שירי "{selectedCandidate?.name}"</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
