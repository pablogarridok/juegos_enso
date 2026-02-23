import React, { useState, useRef, useCallback } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, GameResults } from '../../../types';
import './ReverseSequence.css';



const GAME_CONFIG = {
  initialSequenceLength: 3,
  maxSequenceLength: 9,
  sequencesPerLevel: 3,
  displaySpeed: 600,
  interSequenceDelay: 300,
  totalGameTime: 180, 
  responseTimeLimit: 30000, // 30 segundos para responder
};

type GamePhase = 'instructions' | 'countdown' | 'showing' | 'responding' | 'feedback' | 'finished';

export const ReverseSequence: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [currentSequence, setCurrentSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [currentSequenceLength, setCurrentSequenceLength] = useState(GAME_CONFIG.initialSequenceLength);
  const [countdown, setCountdown] = useState(3);
  const [showingIndex, setShowingIndex] = useState(-1);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [maxLengthAchieved, setMaxLengthAchieved] = useState(GAME_CONFIG.initialSequenceLength);
  const [orderErrors, setOrderErrors] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  
  const sequenceStartTimeRef = useRef<number | null>(null);

  const handleGameTimeout = useCallback((): void => {
    finishGame();
  }, []);

  const timer = useGameTimer(handleGameTimeout);

  const generateSequence = (length: number): number[] => {
    const sequence: number[] = [];
    
    for (let i = 0; i < length; i++) {
      sequence.push(Math.floor(Math.random() * 9)); // 9 posiciones (0-8)
    }
    
    return sequence;
  };

  const startGame = (): void => {
    setGamePhase('countdown');
    gameState.resetGame();
    
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(countdownInterval);
        timer.startTimer(GAME_CONFIG.totalGameTime);
        startNewSequence();
      }
    }, 1000);
  };

  const startNewSequence = (): void => {
    const newSequence = generateSequence(currentSequenceLength);
    setCurrentSequence(newSequence);
    setUserSequence([]);
    setIsCorrect(null);
    setGamePhase('showing');
    setShowingIndex(-1);
    setTotalAttempts(prev => prev + 1);
    
    // pausa antes de mostrar
    setTimeout(() => {
      showSequence(newSequence);
    }, 1000);
  };

  const showSequence = async (sequence: number[]): Promise<void> => {
    sequenceStartTimeRef.current = Date.now();
    
    for (let i = 0; i < sequence.length; i++) {
      setShowingIndex(i);
      setActiveButton(sequence[i]);
      
      
      await new Promise(resolve => setTimeout(resolve, GAME_CONFIG.displaySpeed));
      setActiveButton(null);
      await new Promise(resolve => setTimeout(resolve, GAME_CONFIG.interSequenceDelay));
    }
    
    setShowingIndex(-1);
    setGamePhase('responding');
  };

  const handleButtonClick = (value: number): void => {
    if (gamePhase !== 'responding') return;
    
    
    const newUserSequence = [...userSequence, value];
    setUserSequence(newUserSequence);
    
    setActiveButton(value);
    setTimeout(() => setActiveButton(null), 200);
    
    // Verificar si completó la secuencia
    if (newUserSequence.length === currentSequence.length) {
      checkSequence(newUserSequence);
    }
  };

  const checkSequence = (userSeq: number[]): void => {
    const responseTime = Date.now() - (sequenceStartTimeRef.current || Date.now());
    const reversedOriginal = [...currentSequence].reverse();
    const correct = userSeq.every((val, idx) => val === reversedOriginal[idx]);
    
    setIsCorrect(correct);
    setGamePhase('feedback');
    
    // Registrar resultado
    gameState.addResult({
      trialNumber: totalAttempts,
      stimulus: currentSequence.join(','),
      response: userSeq.join(','),
      correct,
      responseTime,
      type: 'positions',
      round: currentSequenceLength,
      errorType: !correct ? 'order_error' : undefined
    });
    
    if (!correct) {
      setOrderErrors(prev => prev + 1);
    }
    
    setTimeout(() => {
      if (correct) {
        handleCorrectSequence();
      } else {
        handleIncorrectSequence();
      }
    }, 1500);
  };

  const handleCorrectSequence = (): void => {
    const newConsecutive = consecutiveCorrect + 1;
    setConsecutiveCorrect(newConsecutive);
    
    // Avanzar de nivel cada 3 secuencias correctas
    if (newConsecutive >= GAME_CONFIG.sequencesPerLevel) {
      const newLength = currentSequenceLength + 1;
      setCurrentSequenceLength(newLength);
      setConsecutiveCorrect(0);
      
      if (newLength > maxLengthAchieved) {
        setMaxLengthAchieved(newLength);
      }
      
      if (newLength > GAME_CONFIG.maxSequenceLength) {
        finishGame();
        return;
      }
    }
    
    startNewSequence();
  };

  const handleIncorrectSequence = (): void => {
    setConsecutiveCorrect(0);
    
    // Dar 2 intentos más en el mismo nivel
    if (consecutiveCorrect === 0) {
      startNewSequence();
    } else {
      const newLength = Math.max(GAME_CONFIG.initialSequenceLength, currentSequenceLength - 1);
      setCurrentSequenceLength(newLength);
      startNewSequence();
    }
  };

  const finishGame = useCallback((): void => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();
    
    const results = gameState.results;
    const correctResults = results.filter(r => r.correct);
    const responseTimes = results
      .filter(r => r.responseTime !== null)
      .map(r => r.responseTime as number);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const gameResults: GameResults = {
      gameType: 'reverse-sequence-memory',
      summary: {
        totalAnswers: results.length,
        correctAnswers: correctResults.length,
        incorrectAnswers: results.length - correctResults.length,
        accuracy: results.length > 0 ? (correctResults.length / results.length) * 100 : 0,
        averageResponseTime: avgResponseTime,
        fastestResponse: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        slowestResponse: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      },
      detailedResults: results.map(r => ({
        ...r,
        // Datos adicionales específicos del juego
        maxLengthAchieved,
        orderErrors,
        sequenceType: 'positions',
      }))
    };
    
    onGameComplete(gameResults);
  }, [gameState, timer, onGameComplete, maxLengthAchieved, orderErrors]);

  const renderSequenceDisplay = (): React.JSX.Element => {
    return (
      <div className="position-grid">
        {[...Array(9)].map((_, idx) => (
          <button
            key={idx}
            className={`position-button ${activeButton === idx ? 'active' : ''} ${
              gamePhase === 'responding' ? 'clickable' : ''
            }`}
            onClick={() => handleButtonClick(idx)}
            disabled={gamePhase !== 'responding'}
          >
            <div className="position-dot"></div>
          </button>
        ))}
      </div>
    );
  };

  const renderUserProgress = (): React.JSX.Element => {
    if (gamePhase !== 'responding' || userSequence.length === 0) return <></>;
    
    return (
      <div className="user-progress">
        <p className="progress-label">Tu respuesta inversa:</p>
        <div className="sequence-display">
          {userSequence.map((val, idx) => (
            <span key={idx} className="sequence-item">
              Pos {val + 1}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <GameContainer
      title="Reverse Sequence Memory"
      instructions={
        gamePhase === 'instructions'
          ? 'Observa la secuencia y repítela en ORDEN INVERSO. Pon atención y utiliza tu memoria de trabajo.'
          : null
      }
      showInstructions={gamePhase === 'instructions'}
    >
      {gamePhase === 'instructions' && (
        <div className="reverse-sequence-start">
          <div className="game-info-horizontal">
            <div className="info-card">
              <span className="info-icon">🧠</span>
              <div className="info-content">
                <span className="info-label">Memoria de Trabajo</span>
                <span className="info-value">Evaluación</span>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">🔄</span>
              <div className="info-content">
                <span className="info-label">Secuencia inversa</span>
                <span className="info-value">Control ejecutivo</span>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <div className="info-content">
                <span className="info-label">Duración</span>
                <span className="info-value">{GAME_CONFIG.totalGameTime}s</span>
              </div>
            </div>
          </div>

          <div className="example-section">
            <h3>📋 Cómo jugar:</h3>
            <div className="example-box">
              <p>1. Observa atentamente la secuencia de posiciones iluminadas en la cuadrícula</p>
              <p>2. Cuando termine, repite la secuencia en <strong>ORDEN INVERSO</strong></p>
              <p>3. La dificultad aumentará progresivamente</p>
            </div>
          </div>

          <button 
            className="start-game-button" 
            onClick={startGame}
          >
            Comenzar Juego
          </button>
        </div>
      )}

      {gamePhase === 'countdown' && (
        <div className="countdown-screen">
          <div className="countdown-number">{countdown}</div>
          <p className="countdown-text">Prepárate para memorizar...</p>
        </div>
      )}

      {(gamePhase === 'showing' || gamePhase === 'responding' || gamePhase === 'feedback') && (
        <div className="reverse-sequence-game">
          <div className="game-header-bar">
            <div className="level-info">
              <span className="level-label">Nivel:</span>
              <span className="level-value">{currentSequenceLength}</span>
            </div>
            <div className="progress-info">
              <span className="progress-label">Progreso:</span>
              <span className="progress-value">
                {consecutiveCorrect} / {GAME_CONFIG.sequencesPerLevel}
              </span>
            </div>
            <Timer 
              timeLeft={timer.timeLeft} 
              total={timer.totalTime}
              label="Tiempo"
            />
          </div>

          <div className={`game-status ${gamePhase}`}>
            {gamePhase === 'showing' && (
              <p className="status-text">
                👀 Observa la secuencia ({showingIndex + 1}/{currentSequence.length})
              </p>
            )}
            {gamePhase === 'responding' && (
              <p className="status-text">
                🔄 Repite en ORDEN INVERSO ({userSequence.length}/{currentSequence.length})
              </p>
            )}
            {gamePhase === 'feedback' && (
              <p className={`status-text ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto'}
              </p>
            )}
          </div>

          <div className="sequence-area">
            {renderSequenceDisplay()}
          </div>

          {renderUserProgress()}

          <div className="stats-bar">
            <div className="stat">
              <span className="stat-label">Máximo alcanzado:</span>
              <span className="stat-value">{maxLengthAchieved}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Errores de orden:</span>
              <span className="stat-value">{orderErrors}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Intentos:</span>
              <span className="stat-value">{totalAttempts}</span>
            </div>
          </div>
        </div>
      )}

      {gamePhase === 'finished' && (
        <div className="game-finished">
          <div className="finished-message">
            <h2>🎉 ¡Juego completado!</h2>
            <div className="final-stats">
              <div className="final-stat">
                <span className="stat-icon">🏆</span>
                <span className="stat-text">Longitud máxima: {maxLengthAchieved}</span>
              </div>
              <div className="final-stat">
                <span className="stat-icon">✓</span>
                <span className="stat-text">Precisión: {gameState.getAccuracy().toFixed(1)}%</span>
              </div>
              <div className="final-stat">
                <span className="stat-icon">📊</span>
                <span className="stat-text">Total intentos: {totalAttempts}</span>
              </div>
            </div>
            <p className="processing-text">Procesando resultados detallados...</p>
          </div>
        </div>
      )}
    </GameContainer>
  );
};