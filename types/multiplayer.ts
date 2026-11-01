import { Category, GameState, Player, Question } from '../types';

export interface LobbyPlayer {
  id: number;
  name: string;
  grade: number;
  peerId: string;
  isHost: boolean;
  color: string;
}

export type MultiplayerMessageType =
  | { type: 'JOIN_REQUEST'; name: string; grade: number }
  | { type: 'JOIN_ACCEPTED'; players: LobbyPlayer[]; assignedId: number }
  | { type: 'LOBBY_UPDATE'; players: LobbyPlayer[] }
  | { type: 'GAME_START'; state: GameState; customQuestionsPool?: Question[] }
  | { type: 'DICE_ROLLED'; value: number; possibleMoves: number[] }
  | { type: 'PLAYER_MOVED'; fieldIndex: number; question: Question | null; nextPlayerIndex: number; players: Player[] }
  | { type: 'ANSWER_SUBMITTED'; option: string; isCorrect: boolean }
  | { type: 'PROCEED_TURN'; newGameState: GameState }
  | { type: 'CHAT_MESSAGE'; senderName: string; text: string; senderColor: string }
  | { type: 'PLAYER_LEFT'; playerName: string };
