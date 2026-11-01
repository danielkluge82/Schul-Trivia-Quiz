import React, { useState, useEffect } from 'react';
import { LobbyPlayer } from '../types/multiplayer';
import { MultiplayerService } from '../services/multiplayerService';

interface OnlineMultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  multiplayerService: MultiplayerService | null;
  onGameStart: () => void;
  initialRoomCode?: string;
}

export const OnlineMultiplayerModal: React.FC<OnlineMultiplayerModalProps> = ({
  isOpen,
  onClose,
  multiplayerService,
  onGameStart,
  initialRoomCode = '',
}) => {
  const [subMode, setSubMode] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('Spieler 1');
  const [playerGrade, setPlayerGrade] = useState(4);
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode);
      setSubMode('join');
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (!isOpen) {
      // Don't disconnect if starting game, only on close when not started
      return;
    }
  }, [isOpen]);

  if (!isOpen || !multiplayerService) return null;

  const handleCreateRoom = async () => {
    setErrorMessage(null);
    setIsConnecting(true);
    setStatusMessage('Verbinde mit Vermittlungsserver...');
    try {
      const code = await multiplayerService.createRoom(playerName, playerGrade);
      setActiveRoomCode(code);
      setLobbyPlayers(multiplayerService.getLobbyPlayers());
      setInLobby(true);
      setIsConnecting(false);
      setStatusMessage('Raum erfolgreich erstellt! Teile den Code mit deinen Mitspielern.');
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMessage(`Konnte Raum nicht erstellen: ${err.message || err}`);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) {
      setErrorMessage('Bitte gib einen Raumcode ein.');
      return;
    }
    setErrorMessage(null);
    setIsConnecting(true);
    setStatusMessage('Suche Raum und verbinde...');
    try {
      await multiplayerService.joinRoom(roomCodeInput.trim(), playerName, playerGrade);
      setActiveRoomCode(roomCodeInput.toUpperCase().trim());
      setLobbyPlayers(multiplayerService.getLobbyPlayers());
      setInLobby(true);
      setIsConnecting(false);
      setStatusMessage('Erfolgreich beigetreten! Warte auf Spielstart durch den Host...');
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMessage(`Konnte Raum nicht beitreten: ${err.message || 'Prüfe den Code'}`);
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(activeRoomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLinkToClipboard = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleHostStartGame = () => {
    if (lobbyPlayers.length < 2) {
      setErrorMessage('Es werden mindestens 2 Spieler für den Multiplayer benötigt.');
      return;
    }
    onGameStart();
  };

  const handleLeaveLobby = () => {
    multiplayerService.disconnect();
    setInLobby(false);
    setActiveRoomCode('');
    setLobbyPlayers([]);
    setStatusMessage('');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[250] font-lexend">
      <div className="bg-white rounded-[2rem] max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌐</span>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Online-Multiplayer (Internet)
              </h2>
              <p className="text-xs text-slate-500">
                Spielt zusammen über das Internet – ohne Account, direkt per Raumcode!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleLeaveLobby();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex justify-between items-center">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-2 font-bold opacity-60">
              ✕
            </button>
          </div>
        )}

        {/* Status notification */}
        {statusMessage && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-800">
            {statusMessage}
          </div>
        )}

        {/* LOBBY SCREEN (when connected) */}
        {inLobby ? (
          <div className="space-y-6">
            {/* Room Code Showcase */}
            <div className="p-5 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl text-white text-center shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Dein Raum-Code
              </span>
              <div className="text-4xl font-black tracking-widest my-2 text-yellow-300 font-mono">
                {activeRoomCode}
              </div>
              <p className="text-xs text-indigo-200 mb-4">
                Gib diesen Code deinen Mitspielern oder sende ihnen den Einladungslink:
              </p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={copyCodeToClipboard}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all active:scale-95 border border-white/20"
                >
                  {copiedCode ? '✓ Code kopiert!' : '📋 Code kopieren'}
                </button>
                <button
                  type="button"
                  onClick={copyLinkToClipboard}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md"
                >
                  {copiedLink ? '✓ Link kopiert!' : '🔗 Link kopieren'}
                </button>
              </div>
            </div>

            {/* Players in Lobby */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Verbundene Spieler ({lobbyPlayers.length}/4)
                </h4>
                {multiplayerService.getIsHost() && (
                  <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                    Du bist der Host
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {lobbyPlayers.map((p, idx) => (
                  <div
                    key={p.peerId || idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm"
                      style={{ backgroundColor: p.color }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {p.name} {p.isHost && <span className="text-indigo-600">(Host)</span>}
                      </p>
                      <p className="text-[10px] text-slate-500">Klasse {p.grade}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      Bereit ✓
                    </span>
                  </div>
                ))}

                {lobbyPlayers.length === 1 && (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 animate-pulse">
                    Warte auf Mitspieler... (Teile den Code oder Link oben)
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleLeaveLobby}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Raum verlassen
              </button>

              {multiplayerService.getIsHost() ? (
                <button
                  type="button"
                  disabled={lobbyPlayers.length < 2}
                  onClick={handleHostStartGame}
                  className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 ${
                    lobbyPlayers.length >= 2
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {lobbyPlayers.length >= 2
                    ? `Spiel mit ${lobbyPlayers.length} Spielern starten ➜`
                    : 'Mindestens 2 Spieler benötigt'}
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-indigo-700 bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100 animate-pulse">
                  Warte auf Spielstart durch den Host...
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SETUP SCREEN (Create or Join) */
          <div className="space-y-6">
            {/* Tab switch: Host vs Guest */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSubMode('create')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  subMode === 'create'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👑 Raum erstellen (Host)
              </button>
              <button
                type="button"
                onClick={() => setSubMode('join')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  subMode === 'join'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚪 Raum beitreten (Gast)
              </button>
            </div>

            {/* Player details */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Dein Spielername</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Z. B. Lisa"
                  maxLength={18}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Deine Klassenstufe (für angepasste Fragen)
                </label>
                <select
                  value={playerGrade}
                  onChange={(e) => setPlayerGrade(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>
                      {g}. Klasse
                    </option>
                  ))}
                </select>
              </div>

              {subMode === 'join' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Raum-Code des Hosts
                  </label>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Z. B. QUIZ4821"
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 outline-none focus:bg-white focus:border-indigo-500 tracking-wider uppercase"
                  />
                </div>
              )}
            </div>

            {/* Connect Action Button */}
            <div className="pt-2">
              {subMode === 'create' ? (
                <button
                  type="button"
                  disabled={isConnecting || !playerName.trim()}
                  onClick={handleCreateRoom}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isConnecting ? 'Erstelle Raum...' : 'Raum erstellen & Code generieren ➜'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isConnecting || !playerName.trim() || !roomCodeInput.trim()}
                  onClick={handleJoinRoom}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isConnecting ? 'Verbinde...' : 'Dem Raum jetzt beitreten ➜'}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Kostenlos & privat: Die Verbindung erfolgt direkt (Peer-to-Peer) zwischen den Browsern. Es werden keine privaten Daten gespeichert.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineMultiplayerModal;
