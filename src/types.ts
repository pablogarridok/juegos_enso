// ==================== TIPOS GLOBALES ====================

export interface GameResults {
  gameType: string;
  summary: GameSummary;
  detailedResults?: Trial[];
}

export interface GameSummary {
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers?: number;
  accuracy: number;
  averageResponseTime: number;
  fastestResponse?: number;
  slowestResponse?: number;
  timeouts?: number;
  // Específicos de Go/No-Go
  commissionErrors?: number;
  omissionErrors?: number;
  commissionRate?: number;
  omissionRate?: number;
  goAccuracy?: number;
  nogoAccuracy?: number;
  responseVariability?: number;
  impulsivityIndex?: 'high' | 'normal';
  // Específicos de Atención Sostenida
  blockStats?: {
    block: number;
    hits: number;
    omissions: number;
    commissions: number;
    avgRT: number | null;
  }[];
  // Torre de Hanoi
  extraMoves?: number;
  retries?: number;
  timeTotal?: number;
  minMoves?: number;
  efficiency?: number;
  strategy?: string;
  completed?: boolean;
}

export interface Trial {
  trialNumber: number;
  stimulus?: string;
  response: string | null;
  correct: boolean;
  responseTime: number | null;
  timestamp: number;
  type?: string;
  stimulusType?: string;
  errorType?: string;
  timeout?: boolean;
  id?: string;
  round?: number;
  selectedWords?: string[];
  correctWords?: string[];
  rule?: string;
  correctSelections?: number;
  totalTargets?: number;
  incorrectSelections?: number;
}

export interface GameConfig {
  id: string;
  name: string;
  component: React.ComponentType<GameProps>;
  description: string;
  icon: string;
}

export interface GameProps {
  onGameComplete: (results: GameResults) => void;
}

export type ViewType = 'selection' | 'playing' | 'results';

export interface GamesCatalog {
  [key: string]: GameConfig[];
}

// ==================== TIPOS PARA HOOKS ====================

export interface GameState {
  results: Trial[];
  currentRound: number;
  isFinished: boolean;
  isPaused: boolean;
  addResult: (result: Partial<Trial>) => Trial;
  nextRound: () => void;
  finishGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  getCorrectAnswers: () => number;
  getAccuracy: () => number;
}

export interface GameTimer {
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  startTimer: (seconds: number) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  getElapsedTime: () => number;
}

// ==================== TIPOS ESPECÍFICOS DE JUEGOS ====================

// Go/No-Go
export type StimulusType = 'GO' | 'NOGO';
export type GamePhase = 'instructions' | 'countdown' | 'playing' | 'finished';
export type FeedbackType = 'correct' | 'commission' | 'omission' | null;

export interface StimulusConfig {
  shape: string;
  color: string;
  instruction: string;
}

// WordsBox
export interface Word {
  id: string;
  text: string;
  isTarget: boolean;
}

export interface WordRule {
  category: string;
  targetWords: string[];
}

export interface WordPool {
  [key: string]: string[];
}