import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, GameResults, GamePhase } from '../../../types';
import './SustainedAttention.css';

// ── Configuración del juego ─────────────────────────────────────────────────
const GAME_CONFIG = {
  totalDuration: 180,        // 3 minutos
  stimulusOnDuration: 800,   // ms que aparece cada letra
  interStimulusInterval: 1200, // ms entre estímulos
  targetLetter: 'X',         // letra objetivo
  targetRate: 0.15,          // 15 % de los estímulos son objetivo
  blockSize: 20,             // estímulos por bloque (para analizar caídas)
};

const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWYZ'.split(''); // sin X

function randomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

// ── Tipos locales ───────────────────────────────────────────────────────────
interface SATrial {
  trialNumber: number;
  letter: string;
  isTarget: boolean;
  responded: boolean;
  responseTime: number | null;
  correct: boolean;
  errorType: 'omission' | 'commission' | null;
  timestamp: number;
  block: number;
}

interface BlockStats {
  block: number;
  hits: number;
  omissions: number;
  commissions: number;
  avgRT: number | null;
}

// ── Componente principal ────────────────────────────────────────────────────
export const SustainedAttention: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();

  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [countdown, setCountdown] = useState(3);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [trialCount, setTrialCount] = useState(0);
  const [feedbackType, setFeedbackType] = useState<'hit' | 'miss' | 'false-alarm' | null>(null);

  // Datos detallados acumulados en ref para no perder estado en closures
  const trialsRef = useRef<SATrial[]>([]);
  const currentTrialRef = useRef<{ letter: string; isTarget: boolean; startTime: number } | null>(null);
  const hasRespondedRef = useRef(false);

  const stimulusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextTrialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // ── Calcular estadísticas por bloques ─────────────────────────────────────
  const computeBlockStats = (trials: SATrial[]): BlockStats[] => {
    const blocks: BlockStats[] = [];
    const totalBlocks = Math.ceil(trials.length / GAME_CONFIG.blockSize);

    for (let b = 0; b < totalBlocks; b++) {
      const slice = trials.slice(b * GAME_CONFIG.blockSize, (b + 1) * GAME_CONFIG.blockSize);
      const targets = slice.filter(t => t.isTarget);
      const hits = targets.filter(t => t.correct).length;
      const omissions = targets.filter(t => t.errorType === 'omission').length;
      const commissions = slice.filter(t => t.errorType === 'commission').length;
      const rts = slice.filter(t => t.responseTime !== null).map(t => t.responseTime as number);
      const avgRT = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;

      blocks.push({ block: b + 1, hits, omissions, commissions, avgRT });
    }

    return blocks;
  };

  // ── Finalizar juego ────────────────────────────────────────────────────────
  const finishGame = useCallback(() => {
    if (stimulusTimeoutRef.current) clearTimeout(stimulusTimeoutRef.current);
    if (nextTrialTimeoutRef.current) clearTimeout(nextTrialTimeoutRef.current);

    setGamePhase('finished');
    setCurrentLetter(null);

    const trials = trialsRef.current;
    const targets = trials.filter(t => t.isTarget);
    const hits = targets.filter(t => t.correct).length;
    const omissions = targets.filter(t => t.errorType === 'omission').length;
    const commissions = trials.filter(t => t.errorType === 'commission').length;
    const rts = trials.filter(t => t.responseTime !== null).map(t => t.responseTime as number);
    const avgRT = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
    const rtVariability = rts.length > 1
      ? Math.sqrt(rts.reduce((sum, rt) => sum + Math.pow(rt - avgRT, 2), 0) / rts.length)
      : 0;

    const blockStats = computeBlockStats(trials);

    const gameResults: GameResults = {
      gameType: 'sustained-attention',
      summary: {
        totalAnswers: trials.length,
        correctAnswers: hits,
        incorrectAnswers: omissions + commissions,
        accuracy: targets.length > 0 ? (hits / targets.length) * 100 : 0,
        averageResponseTime: avgRT,
        fastestResponse: rts.length > 0 ? Math.min(...rts) : 0,
        slowestResponse: rts.length > 0 ? Math.max(...rts) : 0,
        omissionErrors: omissions,
        commissionErrors: commissions,
        omissionRate: targets.length > 0 ? (omissions / targets.length) * 100 : 0,
        commissionRate: (trials.length - targets.length) > 0
          ? (commissions / (trials.length - targets.length)) * 100 : 0,
        responseVariability: rtVariability,
        // Bloques para caída de rendimiento
        ...(blockStats as any),
        blockStats,
      },
      detailedResults: trials.map(t => ({
        trialNumber: t.trialNumber,
        stimulus: t.letter,
        response: t.responded ? 'press' : null,
        correct: t.correct,
        responseTime: t.responseTime,
        timestamp: t.timestamp,
        stimulusType: t.isTarget ? 'TARGET' : 'DISTRACTOR',
        errorType: t.errorType ?? undefined,
        type: t.errorType ?? (t.correct ? (t.isTarget ? 'hit' : 'correct_rejection') : 'unknown'),
        round: t.block,
      })),
    };

    onGameComplete(gameResults);
  }, [onGameComplete]);

  const handleGameTimeout = useCallback(() => {
    finishGame();
  }, [finishGame]);

  const timer = useGameTimer(handleGameTimeout);

  // ── Mostrar siguiente estímulo ─────────────────────────────────────────────
  const showNextStimulus = useCallback(() => {
    const isTarget = Math.random() < GAME_CONFIG.targetRate;
    const letter = isTarget ? GAME_CONFIG.targetLetter : randomLetter();
    const startTime = Date.now();
    const trialNumber = trialsRef.current.length + 1;
    const block = Math.floor(trialsRef.current.length / GAME_CONFIG.blockSize) + 1;

    hasRespondedRef.current = false;
    currentTrialRef.current = { letter, isTarget, startTime };

    setCurrentLetter(letter);
    setTrialCount(trialNumber);

    // Ocultar estímulo tras duración
    stimulusTimeoutRef.current = setTimeout(() => {
      setCurrentLetter(null);

      // Si no respondió a un target → omisión
      if (!hasRespondedRef.current && currentTrialRef.current) {
        const trial: SATrial = {
          trialNumber,
          letter: currentTrialRef.current.letter,
          isTarget: currentTrialRef.current.isTarget,
          responded: false,
          responseTime: null,
          correct: !currentTrialRef.current.isTarget, // correcto si era distractor
          errorType: currentTrialRef.current.isTarget ? 'omission' : null,
          timestamp: startTime,
          block,
        };
        trialsRef.current.push(trial);
        gameState.addResult({ ...trial, stimulus: trial.letter, response: null });

        if (trial.errorType === 'omission') {
          showFeedback('miss');
        }
      }

      currentTrialRef.current = null;

      // Esperar ISI y pasar al siguiente
      nextTrialTimeoutRef.current = setTimeout(() => {
        showNextStimulus();
      }, GAME_CONFIG.interStimulusInterval);

    }, GAME_CONFIG.stimulusOnDuration);
  }, [gameState]);

  // ── Manejar respuesta del usuario ──────────────────────────────────────────
  const handleResponse = useCallback(() => {
    if (hasRespondedRef.current || !currentTrialRef.current) return;

    hasRespondedRef.current = true;
    const rt = Date.now() - currentTrialRef.current.startTime;
    const { letter, isTarget } = currentTrialRef.current;
    const trialNumber = trialsRef.current.length + 1;
    const block = Math.floor(trialsRef.current.length / GAME_CONFIG.blockSize) + 1;

    const trial: SATrial = {
      trialNumber,
      letter,
      isTarget,
      responded: true,
      responseTime: rt,
      correct: isTarget,
      errorType: isTarget ? null : 'commission',
      timestamp: currentTrialRef.current.startTime,
      block,
    };

    trialsRef.current.push(trial);
    gameState.addResult({ ...trial, stimulus: letter, response: 'press' });

    showFeedback(isTarget ? 'hit' : 'false-alarm');
  }, [gameState]);

  const showFeedback = (type: 'hit' | 'miss' | 'false-alarm') => {
    setFeedbackType(type);
    setTimeout(() => setFeedbackType(null), 350);
  };

  // ── Arrancar juego ─────────────────────────────────────────────────────────
  const startGame = () => {
    setGamePhase('countdown');
    trialsRef.current = [];
    gameState.resetGame();
    let count = 3;

    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(countdownRef.current!);
        setGamePhase('playing');
        timer.startTimer(GAME_CONFIG.totalDuration);
        setTimeout(() => showNextStimulus(), 500);
      }
    }, 1000);
  };

  // ── Teclado ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gamePhase === 'playing' && e.code === 'Space') {
        e.preventDefault();
        handleResponse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gamePhase, handleResponse]);

  // Limpieza al desmontar
  useEffect(() => () => {
    if (stimulusTimeoutRef.current) clearTimeout(stimulusTimeoutRef.current);
    if (nextTrialTimeoutRef.current) clearTimeout(nextTrialTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // ── Mini progreso visual ───────────────────────────────────────────────────
  const progress = GAME_CONFIG.totalDuration > 0
    ? ((GAME_CONFIG.totalDuration - timer.timeLeft) / GAME_CONFIG.totalDuration) * 100
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <GameContainer
      title="Atención Sostenida"
      instructions={null}
      showInstructions={false}
    >
      {/* ── INSTRUCCIONES ── */}
      {gamePhase === 'instructions' && (
        <div className="sa-instructions">
          <div className="sa-inst-header">
            <span className="sa-inst-icon">🔍</span>
            <h2>¿Cómo se juega?</h2>
          </div>

          <p className="sa-inst-desc">
            Aparecerán letras una a una en la pantalla.<br />
            <strong>Solo debes pulsar cuando veas la letra&nbsp;
              <span className="sa-target-preview">{GAME_CONFIG.targetLetter}</span>.
            </strong>
          </p>

          <div className="sa-inst-examples">
            <div className="sa-inst-ex target">
              <div className="sa-letter-demo target">{GAME_CONFIG.targetLetter}</div>
              <span>← PULSA <kbd>Espacio</kbd> o haz clic</span>
            </div>
            <div className="sa-inst-ex distractor">
              <div className="sa-letter-demo distractor">M</div>
              <span>← No hagas nada</span>
            </div>
          </div>

          <div className="sa-inst-meta">
            <div className="sa-meta-item">
              <span>⏱️</span>
              <span>{GAME_CONFIG.totalDuration / 60} minutos</span>
            </div>
            <div className="sa-meta-item">
              <span>📊</span>
              <span>Sin puntuación visible — ¡mantén la concentración!</span>
            </div>
          </div>

          <button className="sa-start-btn" onClick={startGame}>
            Comenzar
          </button>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {gamePhase === 'countdown' && (
        <div className="sa-countdown">
          <div className="sa-countdown-number">{countdown || '¡Ya!'}</div>
          <p>Prepárate…</p>
        </div>
      )}

      {/* ── JUGANDO ── */}
      {gamePhase === 'playing' && (
        <div className="sa-game">
          {/* Barra de progreso temporal */}
          <div className="sa-progress-bar">
            <div className="sa-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="sa-timer-label">
            {Math.floor(timer.timeLeft / 60)}:{String(timer.timeLeft % 60).padStart(2, '0')} restantes
          </div>

          {/* Área principal del estímulo */}
          <div
            className={`sa-stimulus-area ${feedbackType ? `feedback-${feedbackType}` : ''}`}
            onClick={handleResponse}
          >
            {currentLetter ? (
              <div className={`sa-letter ${currentLetter === GAME_CONFIG.targetLetter ? 'is-target' : ''}`}>
                {currentLetter}
              </div>
            ) : (
              <div className="sa-fixation">+</div>
            )}
          </div>

          <p className="sa-hint">
            Pulsa <kbd>Espacio</kbd> o haz <strong>clic</strong> solo con la&nbsp;
            <strong className="sa-target-inline">{GAME_CONFIG.targetLetter}</strong>
          </p>
        </div>
      )}

      {/* ── FINALIZADO ── */}
      {gamePhase === 'finished' && (
        <div className="sa-finished">
          <h2>¡Prueba completada!</h2>
          <p>Procesando resultados…</p>
        </div>
      )}
    </GameContainer>
  );
};