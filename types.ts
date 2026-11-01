
export enum Category {
  DEUTSCH = 'Deutsch: Sprache & Literatur',
  MATHEMATIK = 'Mathe & Physik: Logik / Natur',
  SACHUNTERRICHT = 'Sachkunde / Geo / Bio / Geschichte',
  ENGLISCH = 'Englisch: Fremdsprache',
  KUNST_MUSIK = 'Kunst & Musik: Kultur',
  SPORT = 'Sport: Gesundheit & Regeln',
  WERKEN = 'Werken & Gestalten / Technik',
  ETHIK = 'Ethik / Religion / Philosophie'
}

export interface Question {
  id: string;
  category: Category;
  minGrade: number;
  question: string;
  answer: string;
  options: string[];
}

export interface Player {
  id: number;
  name: string;
  grade: number;
  position: number; // Index des Feldes (0-72)
  wedges: Category[];
  color: string;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  currentDiceValue: number;
  gameStarted: boolean;
  isMoving: boolean;
  possibleMoves: number[]; // Indizes der Felder, die erreichbar sind
  currentQuestion: Question | null;
  winner: Player | null;
}
