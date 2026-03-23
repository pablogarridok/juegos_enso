import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, GameResults } from '../../../types';
import './LogicalSequences.css';

type SequenceType = 'simple' | 'double';
type FeedbackState = 'idle' | 'correct' | 'wrong';

interface Sequence {
  id: string;
  pattern: (number | string)[];
  correctAnswer: number | string;
  type: SequenceType;
  ruleDescription: string;

}

const GAME_CONFIG = {
  totalRounds: 8,
  timePerRound: 40,
  maxAttemptsPerRound: 3  // After this, round is auto-abandoned
};

// ===================================================
// GENERADOR PROGRESIVO DE DIFICULTAD
// ===================================================

const generateSequence = (round: number): Sequence => {

  // Rondas 1-2 → suma simple
  if (round < 2) {
    const start = Math.floor(Math.random() * 10) + 1;
    const increment = Math.floor(Math.random() * 2) + 1;
    return {
      id: crypto.randomUUID(),
      pattern: [start, start + increment, start + increment * 2],
      correctAnswer: start + increment * 3,
      type: 'simple',
      ruleDescription: `Sumar ${increment}`,
    };
  }

  // Rondas 3-4 → suma/resta media
  if (round < 4) {
    const start = Math.floor(Math.random() * 20) + 10;
    const change = Math.floor(Math.random() * 3) + 2;
    const isAddition = Math.random() > 0.5;
    return {
      id: crypto.randomUUID(),
      pattern: [
        start,
        isAddition ? start + change : start - change,
        isAddition ? start + change * 2 : start - change * 2
      ],
      correctAnswer: isAddition ? start + change * 3 : start - change * 3,
      type: 'simple',
      ruleDescription: isAddition ? `Sumar ${change}` : `Restar ${change}`,
    };
  }

  // Rondas 5-6 → multiplicar por 2
  if (round < 6) {
    const start = Math.floor(Math.random() * 5) + 2;
    return {
      id: crypto.randomUUID(),
      pattern: [start, start * 2, start * 4],
      correctAnswer: start * 8,
      type: 'simple',
      ruleDescription: 'Multiplicar por 2',
    };
  }

  // Rondas 7-8 → regla combinada (doble)
  if (round < 7) {
    const start = Math.floor(Math.random() * 5) + 2;
    return {
      id: crypto.randomUUID(),
      pattern: [start, start + 2, (start + 2) * 2],
      correctAnswer: ((start + 2) * 2) + 2,
      type: 'double',
      ruleDescription: 'Suma 2 y multiplica por 2 (alternan)',
    };
  }

  // Ronda 8 → regla combinada más compleja: +3 luego x3
  const start = Math.floor(Math.random() * 3) + 1;
  return {
    id: crypto.randomUUID(),
    pattern: [start, start + 3, (start + 3) * 3, (start + 3) * 3 + 3],
    correctAnswer: ((start + 3) * 3 + 3) * 3,
    type: 'double',
    ruleDescription: '+3 y ×3 (alternan)',
  };
};

// ===================================================
// COMPONENT
// ===================================================

export const LogicalSequences: React.FC<GameProps> = ({ onGameComplete }) => {

  const gameState = useGameState();

  const [currentSequence, setCurrentSequence] = useState<Sequence | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [gamePhase, setGamePhase] = useState<'instructions' | 'playing' | 'finished'>('instructions');
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [wrongAnswers, setWrongAnswers] = useState<(number | string)[]>([]);
  const [abandoned, setAbandoned] = useState(false);

  // Refs so timeout callback has current values
  const currentSequenceRef = useRef(currentSequence);
  const attemptsRef = useRef(attempts);
  const wrongAnswersRef = useRef(wrongAnswers);
  useEffect(() => { currentSequenceRef.current = currentSequence; }, [currentSequence]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { wrongAnswersRef.current = wrongAnswers; }, [wrongAnswers]);

  // ===================================================
  // TIMEOUT
  // ===================================================

  const handleTimeout = useCallback(() => {
    gameState.addResult({
      correct: false,
      responseTime: GAME_CONFIG.timePerRound * 1000,
      response: null,
      correctAnswer: currentSequenceRef.current?.correctAnswer,
      sequenceType: currentSequenceRef.current?.type,
      attemptsBeforeSuccess: attemptsRef.current,
      wrongAnswers: wrongAnswersRef.current,
      timeout: true,
      abandoned: true
    });
    proceedToNextRound();
  }, []);

  const timer = useGameTimer(handleTimeout);

  // ===================================================
  // FLUJO DE JUEGO
  // ===================================================

  const startGame = () => {
    gameState.resetGame();
    setGamePhase('playing');
    startNewRound();
  };

  const startNewRound = () => {
    const round = gameState.currentRound;
    const newSequence = generateSequence(round);
    setCurrentSequence(newSequence);
    setUserAnswer('');
    setAttempts(0);
    setFeedback('idle');
    setWrongAnswers([]);
    setAbandoned(false);
    setRoundStartTime(Date.now());
    timer.startTimer(GAME_CONFIG.timePerRound);
  };

  const submitAnswer = () => {
    if (!currentSequence || !userAnswer) return;

    const responseTime = Date.now() - (roundStartTime || Date.now());
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const isCorrect = Number(userAnswer) === Number(currentSequence.correctAnswer);

    if (isCorrect) {
      setFeedback('correct');
      timer.stopTimer();
      gameState.addResult({
        correct: true,
        responseTime,
        response: Number(userAnswer),
        correctAnswer: currentSequence.correctAnswer,
        sequenceType: currentSequence.type,
        attemptsBeforeSuccess: newAttempts,
        wrongAnswers,
        timeout: false,
        abandoned: false
      });
      setTimeout(() => proceedToNextRound(), 900);
    } else {
      setFeedback('wrong');
      setWrongAnswers(prev => [...prev, Number(userAnswer)]);
      setUserAnswer('');
      setTimeout(() => setFeedback('idle'), 700);

      // Auto-abandon after max attempts
      if (newAttempts >= GAME_CONFIG.maxAttemptsPerRound) {
        setTimeout(() => handleAbandon(responseTime, newAttempts), 800);
      }
    }
  };

  const handleAbandon = (responseTime?: number, currentAttempts?: number) => {
    if (!currentSequence) return;
    timer.stopTimer();
    setAbandoned(true);
    setFeedback('idle');
    const rt = responseTime ?? (Date.now() - (roundStartTime || Date.now()));
    const att = currentAttempts ?? attempts;
    gameState.addResult({
      correct: false,
      responseTime: rt,
      response: null,
      correctAnswer: currentSequence.correctAnswer,
      sequenceType: currentSequence.type,
      attemptsBeforeSuccess: att,
      wrongAnswers,
      timeout: false,
      abandoned: true
    });
    setTimeout(() => proceedToNextRound(), 1000);
  };

  const proceedToNextRound = () => {
    if (gameState.currentRound + 1 >= GAME_CONFIG.totalRounds) {
      finishGame();
    } else {
      gameState.nextRound();
      setTimeout(() => startNewRound(), 500);
    }
  };

  const finishGame = () => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();

    const avgResponseTime =
      gameState.results.reduce((acc, r) => acc + (r.responseTime || 0), 0) /
      (gameState.results.length || 1);

    const simpleErrors = gameState.results.filter(r => !r.correct && r.sequenceType === 'simple').length;
    const doubleErrors = gameState.results.filter(r => !r.correct && r.sequenceType === 'double').length;
    const avgAttempts =
      gameState.results.reduce((acc, r) => acc + (r.attemptsBeforeSuccess || 0), 0) /
      (gameState.results.length || 1);
    const abandonCount = gameState.results.filter(r => r.abandoned).length;

    const results: GameResults = {
      gameType: 'logical_sequences',
      summary: {
        totalAnswers: gameState.results.length,
        correctAnswers: gameState.getCorrectAnswers(),
        accuracy: gameState.getAccuracy(),
        averageResponseTime: avgResponseTime,
        simpleRuleErrors: simpleErrors,
        doubleRuleErrors: doubleErrors,
        averageAttemptsPerRound: avgAttempts,
        abandonCount
      },
      detailedResults: gameState.results
    };

    onGameComplete(results);
  };

  // ===================================================
  // RENDER
  // ===================================================

  const attemptsLeft = GAME_CONFIG.maxAttemptsPerRound - attempts;

  return (
    <GameContainer
      title="Secuencias Lógicas"
      instructions={
        gamePhase === 'instructions'
          ? 'Descubre la regla de cada secuencia y escribe el número que falta. Tienes varios intentos por ronda.'
          : null
      }
      showInstructions={gamePhase === 'instructions'}
    >

      {gamePhase === 'instructions' && (
        <div className="logical-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">🔢</span>
              <span className="info-label">Total de rondas</span>
              <span className="info-value">{GAME_CONFIG.totalRounds}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Tiempo por ronda</span>
              <span className="info-value">{GAME_CONFIG.timePerRound}s</span>
            </div>
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Intentos por ronda</span>
              <span className="info-value">{GAME_CONFIG.maxAttemptsPerRound}</span>
            </div>
          </div>
          <button className="start-game-button" onClick={startGame}>
            Comenzar Juego
          </button>
        </div>
      )}

      {gamePhase === 'playing' && currentSequence && (
        <div className="logical-game">

          <div className="game-header-bar">
            <div className="round-indicator">
              Ronda {gameState.currentRound + 1} / {GAME_CONFIG.totalRounds}
            </div>
            <Timer
              timeLeft={timer.timeLeft}
              total={timer.totalTime}
              label="Tiempo restante"
            />
          </div>

          {/* Sequence display */}
          <div className={`sequence-display ${feedback !== 'idle' ? `feedback-${feedback}` : ''}`}>
            {currentSequence.pattern.map((item, i) => (
              <span key={i} className="sequence-item">{item}</span>
            ))}
            <span className="sequence-item sequence-unknown">?</span>
          </div>

          {/* Wrong attempts trail */}
          {wrongAnswers.length > 0 && (
            <div className="wrong-answers-trail">
              {wrongAnswers.map((ans, i) => (
                <span key={i} className="wrong-chip">{String(ans)}</span>
              ))}
            </div>
          )}

          {/* Attempts indicator */}
          <div className="attempts-indicator">
            {Array.from({ length: GAME_CONFIG.maxAttemptsPerRound }).map((_, i) => (
              <span
                key={i}
                className={`attempt-dot ${i < attempts ? (feedback === 'correct' && i === attempts - 1 ? 'correct' : 'used') : 'available'}`}
              />
            ))}
            <span className="attempts-label">
              {attemptsLeft > 0
                ? `${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}`
                : 'Sin intentos'}
            </span>
          </div>

          {/* Input row */}
          {!abandoned && attemptsLeft > 0 && feedback !== 'correct' && (
            <div className="input-row">
              <input
                type="number"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && userAnswer && submitAnswer()}
                className={`sequence-input ${feedback === 'wrong' ? 'input-wrong' : ''}`}
                placeholder="Tu respuesta"
                autoFocus
              />
              <button
                className="submit-button"
                onClick={submitAnswer}
                disabled={!userAnswer}
              >
                Comprobar
              </button>
            </div>
          )}

          {/* Abandon button */}
          {!abandoned && attemptsLeft > 0 && feedback !== 'correct' && (
            <button className="abandon-button" onClick={() => handleAbandon()}>
              No sé, pasar →
            </button>
          )}

        </div>
      )}

      {gamePhase === 'finished' && (
        <div className="logical-finished">
          <h2>Juego completado</h2>
          <p>Procesando resultados cognitivos...</p>
        </div>
      )}

    </GameContainer>
  );
};