import React, { useState, useRef } from 'react';
import { Category, Question } from '../types';
import { exportQuestionsToCsv, parseQuestionsCsv } from '../utils/csvHelper';
import { 
  getActiveQuestions, 
  saveQuestionsToDb, 
  resetQuestionsToDefault 
} from '../data/questionDb';
import { categoryColors } from './Board';

interface QuestionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsUpdated: (totalCount: number) => void;
  currentCount: number;
}

export const QuestionManagerModal: React.FC<QuestionManagerModalProps> = ({
  isOpen,
  onClose,
  onQuestionsUpdated,
  currentCount,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'browse'>('import');
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Import state
  const [importedParsed, setImportedParsed] = useState<Question[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Browse state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentQuestions = getActiveQuestions();

  const handleFileSelected = (file: File) => {
    if (!file) return;
    setStatusMessage(null);
    setImportErrors([]);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseQuestionsCsv(text);
        setImportedParsed(result.questions);
        setImportErrors(result.errors);
        setIsProcessing(false);
        if (result.questions.length > 0) {
          setStatusMessage({
            text: `${result.questions.length.toLocaleString('de-DE')} gültige Fragen in "${file.name}" erkannt.`,
            type: 'info'
          });
        } else {
          setStatusMessage({
            text: 'Keine gültigen Fragen in der Datei gefunden. Bitte das Format prüfen.',
            type: 'error'
          });
        }
      } catch (err: any) {
        setIsProcessing(false);
        setStatusMessage({
          text: `Fehler beim Lesen der CSV: ${err.message || 'Unbekannter Fehler'}`,
          type: 'error'
        });
      }
    };
    reader.onerror = () => {
      setIsProcessing(false);
      setStatusMessage({ text: 'Datei konnte nicht gelesen werden.', type: 'error' });
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const executeImport = async () => {
    if (!importedParsed || importedParsed.length === 0) return;
    setIsProcessing(true);
    try {
      const newTotal = await saveQuestionsToDb(importedParsed, importMode);
      onQuestionsUpdated(newTotal);
      setStatusMessage({
        text: `Erfolgreich ${importedParsed.length.toLocaleString('de-DE')} Fragen importiert! Neuer Gesamtbestand: ${newTotal.toLocaleString('de-DE')} Fragen.`,
        type: 'success'
      });
      setImportedParsed(null);
    } catch (err: any) {
      setStatusMessage({
        text: `Fehler beim Speichern: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportClick = () => {
    const list = getActiveQuestions();
    exportQuestionsToCsv(list, `schul_trivia_quiz_${list.length}_fragen.csv`);
    setStatusMessage({
      text: `${list.length.toLocaleString('de-DE')} Fragen erfolgreich als CSV mit Überschriften exportiert.`,
      type: 'success'
    });
  };

  const handleDownloadSampleCsv = () => {
    const sampleQuestions: Question[] = [
      {
        id: 'beispiel_01',
        category: Category.DEUTSCH,
        minGrade: 3,
        question: 'Wie lautet das Gegenteil von "hell"?',
        answer: 'dunkel',
        options: ['dunkel', 'kalt', 'leise', 'schwer']
      },
      {
        id: 'beispiel_02',
        category: Category.MATHEMATIK,
        minGrade: 4,
        question: 'Was ist das Ergebnis von 25 mal 4?',
        answer: '100',
        options: ['80', '100', '125', '75']
      },
      {
        id: 'beispiel_03',
        category: Category.SACHUNTERRICHT,
        minGrade: 4,
        question: 'Wie heißt die Landeshauptstadt des Freistaates Sachsen?',
        answer: 'Dresden',
        options: ['Dresden', 'Leipzig', 'Chemnitz', 'Zwickau']
      }
    ];
    exportQuestionsToCsv(sampleQuestions, 'muster_fragenkatalog_vorlage.csv');
  };

  const handleReset = async () => {
    if (confirm('Möchtest du den Fragenkatalog wirklich auf die ursprünglichen sächsischen Lehrplan-Fragen zurücksetzen?')) {
      setIsProcessing(true);
      const defCount = await resetQuestionsToDefault();
      onQuestionsUpdated(defCount);
      setIsProcessing(false);
      setStatusMessage({
        text: `Datenbank auf den ursprünglichen Qualitätsbestand zurückgesetzt (${defCount} Fragen).`,
        type: 'info'
      });
    }
  };

  // Filtered list for browse tab
  const filteredQuestions = currentQuestions.filter(q => {
    if (filterCategory !== 'all' && q.category !== filterCategory) return false;
    if (filterGrade !== 'all' && q.minGrade !== filterGrade) return false;
    if (searchQuery.trim().length > 0) {
      const qLower = searchQuery.toLowerCase();
      const inText = q.question.toLowerCase().includes(qLower);
      const inAnswer = q.answer.toLowerCase().includes(qLower);
      if (!inText && !inAnswer) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
      <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Fragen-Katalog: CSV Import & Export</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                100% Ohne KI / Lokal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Aktueller Datenbestand: <strong className="text-slate-800 font-bold tabular-nums">{currentCount.toLocaleString('de-DE')}</strong> hochwertige Lehrplan-Fragen
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors"
            title="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-2 bg-white">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📥 CSV Importieren
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📤 CSV Exportieren
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'browse'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🔍 Fragen durchsuchen ({currentQuestions.length.toLocaleString('de-DE')})
          </button>
        </div>

        {/* Notification Status */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="ml-2 font-bold opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
                <div className="text-3xl mb-2">📄</div>
                <h3 className="font-bold text-slate-800 text-sm">
                  CSV-Fragenkatalog hier ablegen oder zum Auswählen klicken
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Unterstützt Standard-CSV (Semikolon oder Komma getrennt) mit Spalten: id, kategorie, klasse, frage, antwort, option1, option2, option3, option4.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSampleCsv();
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Muster-CSV herunterladen
                  </button>
                </div>
              </div>

              {/* Preview of Parsed Questions */}
              {importedParsed && importedParsed.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        Vorschau: {importedParsed.length.toLocaleString('de-DE')} Fragen bereit zum Import
                      </h4>
                      <p className="text-xs text-slate-500">
                        Wähle, ob die neuen Fragen an den bestehenden Katalog angehängt oder alle ersetzt werden sollen:
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => setImportMode('merge')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          importMode === 'merge'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Anhängen (Merge)
                      </button>
                      <button
                        onClick={() => setImportMode('replace')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          importMode === 'replace'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ersetzen
                      </button>
                    </div>
                  </div>

                  {/* Sample table (first 4 items) */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Fach</th>
                          <th className="p-2.5">Klasse</th>
                          <th className="p-2.5">Frage</th>
                          <th className="p-2.5">Richtige Antwort</th>
                          <th className="p-2.5">Antwortmöglichkeiten</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importedParsed.slice(0, 4).map((q, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold text-slate-800 whitespace-nowrap">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                                style={{ backgroundColor: categoryColors[q.category] || '#6B7280' }}
                              />
                              {q.category.split(':')[0]}
                            </td>
                            <td className="p-2.5 tabular-nums font-bold text-slate-700">Klasse {q.minGrade}</td>
                            <td className="p-2.5 font-medium text-slate-900 max-w-xs truncate">{q.question}</td>
                            <td className="p-2.5 font-bold text-emerald-600">{q.answer}</td>
                            <td className="p-2.5 text-slate-500 max-w-xs truncate">
                              {q.options.join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importErrors.length > 0 && (
                    <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
                      <strong>Hinweis:</strong> {importErrors.length} Zeilen konnten nicht eingelesen werden.
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setImportedParsed(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                    >
                      Abbrechen
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={executeImport}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                    >
                      {isProcessing ? 'Speichern...' : `Jetzt ${importedParsed.length.toLocaleString('de-DE')} Fragen importieren`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-2">Fragenkatalog als CSV exportieren</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  Erzeugt eine saubere, mit Microsoft Excel, LibreOffice und Google Sheets kompatible CSV-Datei (mit UTF-8 BOM für deutsche Umlaute und Semikolon als Trennzeichen).
                  <code className="block mt-2 p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px]">
                    id;kategorie;klasse;frage;antwort;option1;option2;option3;option4
                  </code>
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    onClick={handleExportClick}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>💾</span>
                    <span>Alle {currentCount.toLocaleString('de-DE')} Fragen jetzt als CSV herunterladen</span>
                  </button>

                  <button
                    onClick={handleDownloadSampleCsv}
                    className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors"
                  >
                    Muster-Vorlage herunterladen
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-600">
                  Möchtest du den Fragenkatalog auf den originalen sächsischen Lehrplan zurücksetzen?
                </span>
                <button
                  disabled={isProcessing}
                  onClick={handleReset}
                  className="px-3.5 py-2 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                >
                  Auf Grundstock zurücksetzen
                </button>
              </div>
            </div>
          )}

          {/* TAB: BROWSE */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Frage oder Antwort durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-400"
                />

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="all">Alle Fächer ({currentQuestions.length})</option>
                  {Object.values(Category).map(c => (
                    <option key={c} value={c}>{c.split(':')[0]}</option>
                  ))}
                </select>

                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="all">Alle Klassen</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                    <option key={g} value={g}>Klasse {g}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {filteredQuestions.length.toLocaleString('de-DE')} Fragen entsprechen dem Filter (zeigt bis zu 50 Treffer)
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredQuestions.slice(0, 50).map((q, idx) => (
                  <div key={q.id || idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: categoryColors[q.category] || '#6B7280' }}
                        />
                        <span className="font-bold text-slate-700">{q.category.split(':')[0]}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-medium">Klasse {q.minGrade}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">{q.id}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 mb-2">{q.question}</p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {q.options.map((opt, oIdx) => (
                        <span
                          key={oIdx}
                          className={`px-2 py-0.5 rounded-md font-medium ${
                            opt === q.answer
                              ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Schul-Trivia Quiz · Handverlesene Lehrplan-Fragen · 100% Offline & Privat
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionManagerModal;
