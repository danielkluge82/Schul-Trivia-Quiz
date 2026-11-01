import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Category, Player, GameState, Question } from './types';
import Board, { generateBoard, categoryColors } from './components/Board';
import Dice from './components/Dice';
import QuestionManagerModal from './components/QuestionManagerModal';
import OnlineMultiplayerModal from './components/OnlineMultiplayerModal';
import { MultiplayerService } from './services/multiplayerService';
import { LobbyPlayer, MultiplayerMessageType } from './types/multiplayer';
import { 
  initQuestionDatabase, 
  getGameQuestion, 
  getActiveQuestions,
  saveQuestionsToDb
} from './data/questionDb';
import { exportQuestionsToCsv, parseQuestionsCsv } from './utils/csvHelper';

const INITIAL_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
const { adj, fields } = generateBoard();
const TIMER_SECONDS = 30;

const RulesContent = () => (
  <div className="space-y-3 text-[11px] text-slate-600 leading-tight">
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">1</div>
      <p><strong className="text-slate-900 font-bold">Würfeln:</strong> Zeigt dir erreichbare Zielfelder auf dem Spielbrett an.</p>
    </div>
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">2</div>
      <p><strong className="text-slate-900 font-bold">Richtige Antwort:</strong> Du bleibst am Zug und darfst <span className="text-indigo-600 font-bold">sofort nochmals würfeln!</span></p>
    </div>
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">3</div>
      <p><strong className="text-slate-900 font-bold">Ecken sammeln:</strong> Auf den 8 <span className="text-indigo-600 font-bold">Stern-Feldern (★)</span> gewinnst du eine Wissensecke deiner Kategorie.</p>
    </div>
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">⏱</div>
      <p><strong className="text-slate-900 font-bold">Zeitlimit:</strong> 30 Sekunden Bedenkzeit pro Frage!</p>
    </div>
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">🏆</div>
      <p><strong className="text-slate-900 font-bold">Sieg:</strong> Wer alle 8 Ecken besitzt und im Zentrum die Meisterfrage richtig beantwortet, gewinnt!</p>
    </div>
  </div>
);

const Legend = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">8 Schulfächer</h3>
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(categoryColors).map(([cat, color]) => (
        <div key={cat} className="flex items-center gap-2 overflow-hidden">
          <div className="w-3 h-3 rounded shadow-sm shrink-0" style={{ backgroundColor: color }}></div>
          <span className="text-[10px] font-semibold text-slate-700 truncate">{cat.split(':')[0]}</span>
        </div>
      ))}
    </div>
  </div>
);

const WedgePie = ({ wedges }: { wedges: Category[] }) => {
  const categories = Object.values(Category);
  return (
    <div className="relative w-12 h-12 bg-slate-200 rounded-full overflow-hidden shadow-inner border-2 border-white shrink-0">
      {categories.map((cat, i) => {
        const hasWedge = wedges.includes(cat);
        const angle = i * 45;
        return (
          <div
            key={i}
            className="absolute top-0 left-0 w-full h-full transition-all duration-700"
            style={{
              clipPath: 'polygon(50% 50%, 100% 0, 100% 50%)',
              transform: `rotate(${angle - 45}deg)`,
              backgroundColor: hasWedge ? categoryColors[cat] : 'transparent',
              opacity: hasWedge ? 1 : 0.12
            }}
          />
        );
      })}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60"></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    currentDiceValue: 0,
    gameStarted: false,
    isMoving: false,
    possibleMoves: [],
    currentQuestion: null,
    winner: null,
  });

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [setupMode, setSetupMode] = useState(true);
  const [gamePlayMode, setGamePlayMode] = useState<'local' | 'online'>('local');

  // Local game player configuration
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerConfig, setPlayerConfig] = useState<{ name: string; grade: number }[]>([
    { name: 'Spieler 1', grade: 4 },
    { name: 'Spieler 2', grade: 4 },
    { name: 'Spieler 3', grade: 5 },
    { name: 'Spieler 4', grade: 6 },
  ]);

  // Online Multiplayer state
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [onlineRoomCode, setOnlineRoomCode] = useState('');
  const [recentReactions, setRecentReactions] = useState<{ id: string; sender: string; text: string }[]>([]);

  // Question database & CSV state
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [directNotification, setDirectNotification] = useState<string | null>(null);
  const directFileInputRef = useRef<HTMLInputElement | null>(null);

  const askedQuestionIds = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const multiplayerServiceRef = useRef<MultiplayerService | null>(null);

  // Initialize offline questions database
  useEffect(() => {
    initQuestionDatabase().then((count) => {
      setQuestionCount(count);
    });

    // Check for room code in URL query (?room=QUIZ1234)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setInitialRoomCode(roomParam.toUpperCase());
        setIsOnlineModalOpen(true);
      }
    }
  }, []);

  // Initialize multiplayer service
  if (!multiplayerServiceRef.current) {
    multiplayerServiceRef.current = new MultiplayerService({
      onLobbyUpdate: (players: LobbyPlayer[]) => {
        // Updated in modal
      },
      onConnectionSuccess: (assignedId: number, isHost: boolean) => {
        setMyPlayerId(assignedId);
      },
      onMessage: (msg: MultiplayerMessageType) => {
        handleRemoteMessage(msg);
      },
      onError: (err: string) => {
        showTemporaryNotification(`Multiplayer-Hinweis: ${err}`);
      },
      onStatusChange: (status: string) => {
        // Can be logged
      }
    });
  }

  // Handle incoming messages from remote players
  const handleRemoteMessage = (msg: MultiplayerMessageType) => {
    if (msg.type === 'GAME_START') {
      setGameState(msg.state);
      setIsOnlineGame(true);
      setSetupMode(false);
      setIsOnlineModalOpen(false);
      setOnlineRoomCode(multiplayerServiceRef.current?.getRoomCode() || '');
      showTemporaryNotification('Das Online-Spiel hat begonnen!');
    } else if (msg.type === 'DICE_ROLLED') {
      setGameState((prev) => ({
        ...prev,
        currentDiceValue: msg.value,
        possibleMoves: msg.possibleMoves,
        isMoving: false,
      }));
    } else if (msg.type === 'PLAYER_MOVED') {
      if (msg.question) {
        askedQuestionIds.current.push(msg.question.id);
      }
      setSelectedOption(null);
      setGameState((prev) => ({
        ...prev,
        players: msg.players,
        possibleMoves: [],
        currentQuestion: msg.question,
        currentPlayerIndex: msg.nextPlayerIndex,
      }));
    } else if (msg.type === 'ANSWER_SUBMITTED') {
      setSelectedOption(msg.option);
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (msg.type === 'PROCEED_TURN') {
      setGameState(msg.newGameState);
      setSelectedOption(null);
      setTimeLeft(TIMER_SECONDS);
    } else if (msg.type === 'CHAT_MESSAGE') {
      const newReaction = {
        id: `${Date.now()}_${Math.random()}`,
        sender: msg.senderName,
        text: msg.text,
      };
      setRecentReactions((prev) => [...prev.slice(-4), newReaction]);
      setTimeout(() => {
        setRecentReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
      }, 3500);
    }
  };

  // Timer loop when question is presented
  useEffect(() => {
    if (gameState.currentQuestion && !selectedOption && !gameState.winner) {
      setTimeLeft(TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Only active player or host broadcasts timeout
            if (!isOnlineGame || gameState.currentPlayerIndex === myPlayerId) {
              handleAnswerClick('ZEIT_ABGELAUFEN');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.currentQuestion, selectedOption, gameState.winner, isOnlineGame, gameState.currentPlayerIndex, myPlayerId]);

  // Start local pass & play game
  const startLocalGame = () => {
    const players: Player[] = playerConfig.slice(0, numPlayers).map((p, i) => ({
      id: i,
      name: p.name.trim() || `Spieler ${i + 1}`,
      grade: p.grade,
      position: 72, // Center
      wedges: [],
      color: INITIAL_COLORS[i],
    }));
    setIsOnlineGame(false);
    setGameState({
      players,
      currentPlayerIndex: 0,
      currentDiceValue: 0,
      gameStarted: true,
      isMoving: false,
      possibleMoves: [],
      currentQuestion: null,
      winner: null,
    });
    setSetupMode(false);
  };

  // Start online multiplayer game (called by Host)
  const startOnlineGameFromHost = () => {
    if (!multiplayerServiceRef.current) return;
    const lobbyPlayers = multiplayerServiceRef.current.getLobbyPlayers();
    const players: Player[] = lobbyPlayers.map((lp, idx) => ({
      id: idx,
      name: lp.name,
      grade: lp.grade,
      position: 72,
      wedges: [],
      color: lp.color,
    }));

    const initialState: GameState = {
      players,
      currentPlayerIndex: 0,
      currentDiceValue: 0,
      gameStarted: true,
      isMoving: false,
      possibleMoves: [],
      currentQuestion: null,
      winner: null,
    };

    setGameState(initialState);
    setIsOnlineGame(true);
    setOnlineRoomCode(multiplayerServiceRef.current.getRoomCode());
    setSetupMode(false);
    setIsOnlineModalOpen(false);

    // Broadcast GAME_START to all connected guests
    multiplayerServiceRef.current.broadcast({
      type: 'GAME_START',
      state: initialState,
    });
  };

  const resetGameToSetup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedOption(null);
    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.disconnect();
    }
    setIsOnlineGame(false);
    setGameState({
      players: [],
      currentPlayerIndex: 0,
      currentDiceValue: 0,
      gameStarted: false,
      isMoving: false,
      possibleMoves: [],
      currentQuestion: null,
      winner: null,
    });
    setSetupMode(true);
  };

  const findPossibleMoves = (startNode: number, steps: number) => {
    let currentNodes = new Set([startNode]);
    for (let i = 0; i < steps; i++) {
      const nextNodes = new Set<number>();
      currentNodes.forEach((node) => {
        adj[node].forEach((neighbor) => {
          nextNodes.add(neighbor);
        });
      });
      currentNodes = nextNodes;
    }
    currentNodes.delete(startNode);
    return Array.from(currentNodes);
  };

  const handleDiceRoll = (val: number) => {
    const moves = findPossibleMoves(gameState.players[gameState.currentPlayerIndex].position, val);
    setGameState((prev) => ({
      ...prev,
      currentDiceValue: val,
      possibleMoves: moves,
      isMoving: false,
    }));

    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.broadcast({
        type: 'DICE_ROLLED',
        value: val,
        possibleMoves: moves,
      });
    }
  };

  const handleMoveSelect = (fieldIndex: number) => {
    // In online mode, only current player can select
    if (isOnlineGame && gameState.currentPlayerIndex !== myPlayerId) return;

    const player = gameState.players[gameState.currentPlayerIndex];
    const field = fields[fieldIndex];
    const newPlayers = [...gameState.players];
    newPlayers[gameState.currentPlayerIndex].position = fieldIndex;

    let question = null;
    if (field.category) {
      question = getGameQuestion(field.category, player.grade, askedQuestionIds.current);
    } else if (field.type === 'center') {
      const randomCat = Object.values(Category)[Math.floor(Math.random() * 8)];
      question = getGameQuestion(randomCat, player.grade, askedQuestionIds.current);
    }

    if (question) {
      askedQuestionIds.current.push(question.id);
    }

    const nextIndex = question ? gameState.currentPlayerIndex : (gameState.currentPlayerIndex + 1) % gameState.players.length;

    setGameState((prev) => ({
      ...prev,
      players: newPlayers,
      possibleMoves: [],
      currentQuestion: question,
      currentPlayerIndex: nextIndex,
    }));

    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.broadcast({
        type: 'PLAYER_MOVED',
        fieldIndex,
        question,
        nextPlayerIndex: nextIndex,
        players: newPlayers,
      });
    }
  };

  const handleAnswerClick = (option: string) => {
    if (selectedOption) return;
    // In online game, only the active player can submit an answer
    if (isOnlineGame && gameState.currentPlayerIndex !== myPlayerId) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedOption(option);

    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.broadcast({
        type: 'ANSWER_SUBMITTED',
        option,
        isCorrect: option === gameState.currentQuestion?.answer,
      });
    }
  };

  const proceedAfterAnswer = () => {
    // In online game, active player or host triggers proceed
    if (isOnlineGame && gameState.currentPlayerIndex !== myPlayerId) return;

    const { currentQuestion, currentPlayerIndex, players } = gameState;
    if (!currentQuestion || !selectedOption) return;

    const isCorrect = selectedOption === currentQuestion.answer;
    const player = players[currentPlayerIndex];
    const field = fields[player.position];

    let newWinner: Player | null = null;
    let nextPlayerIndex = currentPlayerIndex;

    if (isCorrect) {
      if (field.isWedge && !player.wedges.includes(currentQuestion.category)) {
        player.wedges.push(currentQuestion.category);
      }
      if (field.type === 'center' && player.wedges.length === 8) {
        newWinner = player;
      }
      // Correct answer: Player rolls again!
      nextPlayerIndex = currentPlayerIndex;
    } else {
      // Wrong answer: Next player
      nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }

    const updatedState: GameState = {
      ...gameState,
      players: [...players],
      currentQuestion: null,
      currentDiceValue: 0,
      possibleMoves: [],
      winner: newWinner,
      currentPlayerIndex: nextPlayerIndex,
    };

    setGameState(updatedState);
    setSelectedOption(null);
    setTimeLeft(TIMER_SECONDS);

    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.broadcast({
        type: 'PROCEED_TURN',
        newGameState: updatedState,
      });
    }
  };

  // Send reaction emoji
  const sendReaction = (emoji: string) => {
    const me = gameState.players[myPlayerId]?.name || 'Spieler';
    const reaction = {
      id: `${Date.now()}_${Math.random()}`,
      sender: me,
      text: emoji,
    };
    setRecentReactions((prev) => [...prev.slice(-4), reaction]);
    setTimeout(() => {
      setRecentReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 3500);

    if (isOnlineGame && multiplayerServiceRef.current) {
      multiplayerServiceRef.current.broadcast({
        type: 'CHAT_MESSAGE',
        senderName: me,
        text: emoji,
        senderColor: gameState.players[myPlayerId]?.color || '#3B82F6',
      });
    }
  };

  // Direct CSV Export from start screen
  const handleQuickExport = () => {
    const all = getActiveQuestions();
    exportQuestionsToCsv(all, `schul_trivia_quiz_fragen_${all.length}.csv`);
    showTemporaryNotification(`${all.length.toLocaleString('de-DE')} Fragen als CSV mit Überschriften exportiert!`);
  };

  // Direct CSV Import trigger from start screen
  const handleDirectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const result = parseQuestionsCsv(text);
        if (result.questions.length > 0) {
          const newTotal = await saveQuestionsToDb(result.questions, 'merge');
          setQuestionCount(newTotal);
          showTemporaryNotification(
            `Erfolgreich ${result.questions.length.toLocaleString('de-DE')} Fragen aus "${file.name}" importiert! (Gesamt: ${newTotal.toLocaleString('de-DE')})`
          );
        } else {
          showTemporaryNotification('Keine gültigen Fragen in der CSV-Datei gefunden.');
        }
      } catch (err: any) {
        showTemporaryNotification(`Fehler beim Import: ${err.message || 'Unbekannt'}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const showTemporaryNotification = (msg: string) => {
    setDirectNotification(msg);
    setTimeout(() => {
      setDirectNotification((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const isMyTurn = !isOnlineGame || gameState.currentPlayerIndex === myPlayerId;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex] || {
    name: 'Spieler',
    grade: 4,
    color: '#3B82F6',
    wedges: [],
  };

  // -------------------------------------------------------------
  // SETUP SCREEN (STARTBILDSCHIRM)
  // -------------------------------------------------------------
  if (setupMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-8 font-lexend overflow-y-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-10 shadow-2xl max-w-5xl w-full border-t-[10px] border-indigo-600 my-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                  Schul-Trivia Quiz
                </h1>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg">
                  Sachsen Edition
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Klassisches Brettspiel-Quiz · Fragen angepasst an die Klassenstufe · 100% ohne KI
              </p>
            </div>

            {/* Live Database Status */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lokaler Fragenkatalog</p>
                <p className="text-xs font-black text-slate-800 tabular-nums">
                  {questionCount.toLocaleString('de-DE')} <span className="font-semibold text-slate-500">Qualitätsfragen aktiv</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Start Notification */}
          {directNotification && (
            <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
              <span>{directNotification}</span>
              <button onClick={() => setDirectNotification(null)} className="ml-2 font-bold text-emerald-900 opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* MULTIPLAYER / GAME MODE SELECTION BANNER                  */}
          {/* ========================================================= */}
          <div className="mb-6 p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌐</span>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500 text-white">
                  Neu
                </span>
                <h3 className="text-base font-black tracking-tight text-white">
                  Online-Multiplayer via Internet
                </h3>
              </div>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                Erstelle einen Raum, teile den kurzen 6-stelligen Code oder Einladungslink und spiele mit Freunden über das Internet – ohne Registrierung, direkt im Browser!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOnlineModalOpen(true)}
              className="px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2"
            >
              <span>🎮</span>
              <span>Online-Multiplayer starten ➜</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* SPECIAL FEATURE: FRAGEN IMPORT & EXPORT                    */}
          {/* ========================================================= */}
          <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/40 border border-indigo-100 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
                    Fragenkatalog: Export & Import
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                  Exportiere die derzeitigen Fragen als formatierte CSV-Datei mit Kopfzeile oder importiere eigene Fragenkataloge. Das Spiel läuft 100% ohne KI vollständig offline.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <input
                  type="file"
                  ref={directFileInputRef}
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleDirectFileChange}
                />

                <button
                  type="button"
                  onClick={handleQuickExport}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                  title="Alle vorhandenen Fragen als CSV mit Überschriften herunterladen"
                >
                  <span>📤</span>
                  <span>Fragen exportieren (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsManagerOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2"
                  title="Fragenkatalog als CSV hochladen und importieren"
                >
                  <span>📥</span>
                  <span>Fragen importieren (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsManagerOpen(true)}
                  className="px-3 py-2.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                  title="Katalog durchsuchen und verwalten"
                >
                  🔍 Fragen ansehen
                </button>
              </div>
            </div>
          </div>

          {/* Main Setup Grid: Local Players & Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Player Configuration for Local Play */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>🏠</span>
                  <span>Lokales Spiel (Pass & Play)</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">An einem Gerät</span>
              </div>

              <div className="mb-5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">
                  Spieleranzahl wählen
                </label>
                <div className="flex gap-3">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumPlayers(n)}
                      className={`flex-1 py-2.5 rounded-xl border-2 font-black transition-all text-sm ${
                        numPlayers === n
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      {n} Spieler
                    </button>
                  ))}
                </div>
              </div>

              {/* Player names and grade levels */}
              <div className="space-y-3 mb-6">
                {[...Array(numPlayers)].map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black shadow-sm shrink-0 text-sm"
                      style={{ backgroundColor: INITIAL_COLORS[i] }}
                    >
                      {i + 1}
                    </div>
                    <input
                      type="text"
                      className="flex-1 bg-transparent border-none outline-none font-bold text-slate-800 placeholder-slate-400 text-sm"
                      placeholder={`Spieler ${i + 1}`}
                      value={playerConfig[i].name}
                      onChange={(e) => {
                        const newConfig = [...playerConfig];
                        newConfig[i].name = e.target.value;
                        setPlayerConfig(newConfig);
                      }}
                    />
                    <select
                      className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-sm outline-none border border-slate-200"
                      value={playerConfig[i].grade}
                      onChange={(e) => {
                        const newConfig = [...playerConfig];
                        newConfig[i].grade = parseInt(e.target.value, 10);
                        setPlayerConfig(newConfig);
                      }}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                        <option key={g} value={g}>
                          {g}. Klasse
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Start Button */}
              <button
                onClick={startLocalGame}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-xl transform transition active:scale-95 text-lg uppercase tracking-wider"
              >
                Lokales Spiel starten ➜
              </button>
            </div>

            {/* Rules and Legend */}
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex-1 flex flex-col">
                <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2.5 text-base">
                  <span className="bg-indigo-100 text-indigo-700 w-7 h-7 rounded-lg flex items-center justify-center shadow-sm text-xs font-black">
                    ℹ
                  </span>
                  Spielregeln
                </h2>
                <RulesContent />
              </div>
              <Legend />
            </div>
          </div>
        </div>

        {/* Question Manager Modal */}
        <QuestionManagerModal
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          onQuestionsUpdated={(newTotal) => setQuestionCount(newTotal)}
          currentCount={questionCount}
        />

        {/* Online Multiplayer Modal */}
        <OnlineMultiplayerModal
          isOpen={isOnlineModalOpen}
          onClose={() => setIsOnlineModalOpen(false)}
          multiplayerService={multiplayerServiceRef.current}
          onGameStart={startOnlineGameFromHost}
          initialRoomCode={initialRoomCode}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // ACTIVE GAMEPLAY SCREEN
  // -------------------------------------------------------------
  return (
    <div className="h-screen bg-slate-100 flex flex-col md:flex-row p-4 md:p-6 gap-6 items-center justify-center overflow-hidden font-lexend select-none relative">
      {/* Floating Reaction Alerts */}
      <div className="absolute top-16 left-6 z-50 flex flex-col gap-2 pointer-events-none">
        {recentReactions.map((r) => (
          <div
            key={r.id}
            className="animate-in slide-in-from-left fade-in duration-300 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-800"
          >
            <span className="text-slate-500 text-xs">{r.sender}:</span>
            <span className="text-xl">{r.text}</span>
          </div>
        ))}
      </div>

      {/* Center Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center h-full w-full relative">
        {/* Top game status bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between z-10 px-2 py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Schul-Trivia Quiz</span>
            {isOnlineGame ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online · Raum {onlineRoomCode}
              </span>
            ) : (
              <span className="text-slate-400 text-xs">· Lokales Spiel</span>
            )}
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium tabular-nums">{questionCount.toLocaleString('de-DE')} Fragen</span>
          </div>

          <div className="flex items-center gap-2">
            {isOnlineGame && (
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                {['👏', '🔥', '🎲', '🧠', '🏆'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="hover:scale-125 transition-transform text-sm p-0.5"
                    title={`Reaktion senden: ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsManagerOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 shadow-sm transition-colors"
            >
              ⚙️ Fragen
            </button>
            <button
              onClick={() => {
                if (confirm('Möchtest du das Spiel wirklich beenden und zum Hauptmenü zurückkehren?')) {
                  resetGameToSetup();
                }
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors"
            >
              ✕ Beenden
            </button>
          </div>
        </div>

        {/* Board scaling container */}
        <div className="bg-white p-4 md:p-8 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] border border-slate-200 scale-[0.52] sm:scale-[0.7] md:scale-[0.85] lg:scale-[0.95] xl:scale-100 transition-transform duration-500 origin-center">
          <Board
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
            possibleMoves={isMyTurn ? gameState.possibleMoves : []}
            onMoveSelect={handleMoveSelect}
          />
        </div>
      </div>

      {/* Right Sidebar Controls */}
      <div className="w-full md:w-[320px] h-full flex flex-col gap-4 overflow-hidden py-2 shrink-0">
        {/* Current Active Player Card */}
        <div
          className="text-white rounded-2xl p-4 shadow-lg border-b-4 transition-colors"
          style={{
            backgroundColor: currentPlayer.color || '#4F46E5',
            borderColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black text-white shadow-sm">
              {currentPlayer.name[0]?.toUpperCase() || 'P'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/80">Am Zug</p>
                {isOnlineGame && gameState.currentPlayerIndex === myPlayerId && (
                  <span className="bg-yellow-300 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded uppercase">
                    DU!
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black truncate leading-tight text-white">{currentPlayer.name}</h2>
              <p className="text-[10px] font-semibold text-white/80">
                Klasse {currentPlayer.grade} · {currentPlayer.wedges.length}/8 Ecken
              </p>
            </div>
            <WedgePie wedges={currentPlayer.wedges} />
          </div>
        </div>

        {/* Scoreboard */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Spielstand & Ecken</h3>
            <button
              onClick={() => setShowRules(true)}
              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center font-bold text-xs"
              title="Regeln ansehen"
            >
              ?
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 flex-1 scrollbar-hide">
            {gameState.players.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  i === gameState.currentPlayerIndex
                    ? 'bg-indigo-50/80 border border-indigo-200 ring-2 ring-indigo-500/10'
                    : 'bg-slate-50/70 border border-transparent'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black shadow-sm shrink-0 text-xs"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name[0]?.toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate text-slate-800">{p.name}</p>
                    {isOnlineGame && i === myPlayerId && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.2 rounded">
                        Ich
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {Object.values(Category).map((cat, idx) => (
                      <div
                        key={idx}
                        className={`w-2.5 h-2.5 rounded-full border border-white ${
                          p.wedges.includes(cat) ? 'scale-110 shadow-sm' : 'opacity-15 grayscale'
                        }`}
                        style={{ backgroundColor: categoryColors[cat] }}
                        title={cat}
                      />
                    ))}
                  </div>
                </div>
                <div
                  className={`text-xs font-bold px-2 py-1 rounded-lg bg-white shadow-sm border border-slate-100 tabular-nums ${
                    i === gameState.currentPlayerIndex ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                >
                  {p.wedges.length}/8
                </div>
              </div>
            ))}
          </div>
        </div>

        <Legend />

        {/* Dice & Action Button */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col items-center gap-3 shrink-0">
          <div className="scale-75">
            <Dice rolling={gameState.isMoving} onRollComplete={handleDiceRoll} />
          </div>

          {/* Action button with online turn guidance */}
          {isOnlineGame && !isMyTurn ? (
            <div className="w-full py-3.5 rounded-xl bg-slate-100 text-slate-500 font-bold text-center text-xs border border-slate-200 animate-pulse">
              Warte auf {currentPlayer.name}... (am Zug)
            </div>
          ) : (
            <button
              disabled={gameState.isMoving || !!gameState.currentQuestion || gameState.possibleMoves.length > 0}
              onClick={() => setGameState((prev) => ({ ...prev, isMoving: true, possibleMoves: [] }))}
              className={`w-full py-3.5 rounded-xl font-black shadow-lg transition-all text-xs tracking-wider uppercase ${
                gameState.isMoving || !!gameState.currentQuestion || gameState.possibleMoves.length > 0
                  ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
              }`}
            >
              {gameState.possibleMoves.length > 0 ? 'Zielfeld auf Brett wählen' : '🎲 Würfeln'}
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUESTION MODAL                                                */}
      {/* ------------------------------------------------------------- */}
      {gameState.currentQuestion && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 border-b-[8px] border-indigo-600">
            {/* Header: Category & Timer */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <span
                className="px-4 py-1.5 text-white rounded-xl text-[11px] font-bold tracking-wider uppercase shadow-sm"
                style={{ backgroundColor: categoryColors[gameState.currentQuestion.category] || '#4F46E5' }}
              >
                {gameState.currentQuestion.category}
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      timeLeft > 15 ? 'bg-indigo-600' : timeLeft > 5 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                    }`}
                    style={{ width: `${(timeLeft / TIMER_SECONDS) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums w-8 text-center ${timeLeft <= 5 ? 'text-rose-600 animate-bounce' : 'text-slate-500'}`}>
                  {timeLeft}s
                </span>
                <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-lg">
                  Klasse {gameState.currentQuestion.minGrade}
                </span>
              </div>
            </div>

            {/* Turn notice for online guests */}
            {isOnlineGame && !isMyTurn && (
              <div className="mb-4 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-xs font-bold text-center">
                Frage für {currentPlayer.name} · Du kannst zusehen!
              </div>
            )}

            {/* Question Text */}
            <h2 className={`text-2xl md:text-3xl font-black text-slate-900 mb-6 leading-snug ${selectedOption === 'ZEIT_ABGELAUFEN' ? 'opacity-50' : 'opacity-100'}`}>
              {gameState.currentQuestion.question}
            </h2>

            {selectedOption === 'ZEIT_ABGELAUFEN' && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs text-center">
                ⏱ Die 30 Sekunden Bedenkzeit sind abgelaufen!
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 gap-2.5">
              {gameState.currentQuestion.options.map((opt, i) => {
                const isCorrect = opt === gameState.currentQuestion!.answer;
                const isSelected = opt === selectedOption;

                let styles = 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300';
                if (selectedOption) {
                  if (isCorrect) {
                    styles = 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-[1.01]';
                  } else if (isSelected) {
                    styles = 'bg-rose-500 border-rose-500 text-white';
                  } else {
                    styles = 'bg-slate-50 border-transparent text-slate-300 opacity-40';
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={!!selectedOption || (isOnlineGame && !isMyTurn)}
                    onClick={() => handleAnswerClick(opt)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 font-bold text-left flex items-center justify-between text-base ${styles} ${
                      isOnlineGame && !isMyTurn ? 'cursor-default' : ''
                    }`}
                  >
                    <span>{opt}</span>
                    {selectedOption && isCorrect && (
                      <span className="bg-white/30 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Next Step Action Button */}
            {selectedOption && (
              <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300">
                {isOnlineGame && !isMyTurn ? (
                  <div className="text-center text-xs font-bold text-slate-400 p-3 bg-slate-50 rounded-xl">
                    {currentPlayer.name} schließt den Spielzug ab...
                  </div>
                ) : (
                  <button
                    onClick={proceedAfterAnswer}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg transition-all text-sm tracking-wide transform active:scale-95 uppercase"
                  >
                    {selectedOption === 'ZEIT_ABGELAUFEN'
                      ? 'Zeit um · Nächster Spieler ➜'
                      : selectedOption === gameState.currentQuestion.answer
                      ? 'Richtig! Du darfst nochmals würfeln ➜'
                      : 'Leider falsch · Nächster Spieler ➜'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Spielregeln</h2>
            <RulesContent />
            <button
              onClick={() => setShowRules(false)}
              className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md text-xs"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Winner Celebration Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-indigo-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[300]">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl max-w-md w-full border-4 border-indigo-300">
            <div className="text-6xl mb-4 animate-bounce">👑</div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">SIEG!</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">
              {gameState.winner.name} hat alle 8 Wissensecken und das Spiel gewonnen!
            </p>
            <button
              onClick={resetGameToSetup}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black shadow-lg text-base uppercase tracking-wider transition-all active:scale-95"
            >
              Neues Spiel starten
            </button>
          </div>
        </div>
      )}

      {/* In-Game Question Manager Modal */}
      <QuestionManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onQuestionsUpdated={(newTotal) => setQuestionCount(newTotal)}
        currentCount={questionCount}
      />
    </div>
  );
};

export default App;
