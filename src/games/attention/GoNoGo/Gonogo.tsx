import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, StimulusType, GamePhase, FeedbackType, StimulusConfig, GameResults } from '../../../types';
import './GoNoGo.css';

const GAME_CONFIG = {
  totalTrials: 40,
  goPercentage: 0.75,
  stimulusDuration: 1000,
  interStimulusInterval: 500,
  responseWindow: 1000,
  totalGameTime: 90
};

const STIMULUS_TYPES: Record<StimulusType, StimulusConfig> = {
  GO: {
    shape: 'circle',
    color: '#10b981',
    instruction: 'PULSA'
  },
  NOGO: {
    shape: 'circle',
    color: '#ef4444',
    instruction: 'NO PULSES'
  }
};

export const GoNoGo: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [currentStimulus, setCurrentStimulus] = useState<StimulusConfig | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [trialSequence, setTrialSequence] = useState<StimulusType[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(null);
  
  const trialStartTimeRef = useRef<number | null>(null);
  const stimulusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const responseWindowRef = useRef<NodeJS.Timeout | null>(null);
  const hasRespondedRef = useRef<boolean>(false);

  const handleGameTimeout = useCallback((): void => {
    finishGame();
  }, []);

  const timer = useGameTimer(handleGameTimeout);

  const generateTrialSequence = (): StimulusType[] => {
    const totalGo = Math.floor(GAME_CONFIG.totalTrials * GAME_CONFIG.goPercentage);
    const totalNoGo = GAME_CONFIG.totalTrials - totalGo;
    
    const sequence: StimulusType[] = [
      ...Array(totalGo).fill('GO' as StimulusType),
      ...Array(totalNoGo).fill('NOGO' as StimulusType)
    ];
    
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }
    
    return sequence;
  };

  const finishGame = useCallback((): void => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();
    
    if (stimulusTimeoutRef.current) clearTimeout(stimulusTimeoutRef.current);
    if (responseWindowRef.current) clearTimeout(responseWindowRef.current);
    
    const results = gameState.results;
    const goTrials = results.filter(r => r.stimulusType === 'GO');
    const nogoTrials = results.filter(r => r.stimulusType === 'NOGO');
    
    const commissionErrors = results.filter(r => r.errorType === 'commission').length;
    const omissionErrors = results.filter(r => r.errorType === 'omission').length;
    
    const correctGo = goTrials.filter(r => r.correct).length;
    const correctNoGo = nogoTrials.filter(r => r.correct).length;
    
    const reactionTimes = results
      .filter(r => r.responseTime !== null)
      .map(r => r.responseTime as number);
    
    const avgReactionTime = reactionTimes.length > 0
      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
      : 0;
    
    const variance = reactionTimes.length > 0
      ? reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - avgReactionTime, 2), 0) / reactionTimes.length
      : 0;
    const stdDeviation = Math.sqrt(variance);
    
    const gameResults: GameResults = {
      gameType: 'gonogo',
      summary: {
        totalTrials: results.length,
        totalAnswers: results.length,
        correctAnswers: gameState.getCorrectAnswers(),
        accuracy: gameState.getAccuracy(),
        commissionErrors,
        omissionErrors,
        commissionRate: nogoTrials.length > 0 ? (commissionErrors / nogoTrials.length) * 100 : 0,
        omissionRate: goTrials.length > 0 ? (omissionErrors / goTrials.length) * 100 : 0,
        goAccuracy: goTrials.length > 0 ? (correctGo / goTrials.length) * 100 : 0,
        nogoAccuracy: nogoTrials.length > 0 ? (correctNoGo / nogoTrials.length) * 100 : 0,
        averageResponseTime: avgReactionTime,
        fastestResponse: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
        slowestResponse: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
        responseVariability: stdDeviation,
        impulsivityIndex: commissionErrors > omissionErrors ? 'high' : 'normal'
      },
      detailedResults: results
    };
    
    onGameComplete(gameResults);
  }, [gameState, timer, onGameComplete]);

  const startGame = (): void => {
    setGamePhase('countdown');
    const sequence = generateTrialSequence();
    setTrialSequence(sequence);
    gameState.resetGame();
    
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(countdownInterval);
        setGamePhase('playing');
        timer.startTimer(GAME_CONFIG.totalGameTime);
        showNextStimulus(sequence, 0);
      }
    }, 1000);
  };

  const showNextStimulus = (sequence: StimulusType[], index: number): void => {
    if (index >= sequence.length) {
      finishGame();
      return;
    }

    hasRespondedRef.current = false;
    trialStartTimeRef.current = Date.now();
    
    const stimulusType = sequence[index];
    setCurrentStimulus(STIMULUS_TYPES[stimulusType]);
    setCurrentTrialIndex(index);
    gameState.nextRound();

    stimulusTimeoutRef.current = setTimeout(() => {
      setCurrentStimulus(null);
    }, GAME_CONFIG.stimulusDuration);

    responseWindowRef.current = setTimeout(() => {
      if (!hasRespondedRef.current) {
        handleNoResponse(stimulusType);
      }
      
      setTimeout(() => {
        showNextStimulus(sequence, index + 1);
      }, GAME_CONFIG.interStimulusInterval);
    }, GAME_CONFIG.responseWindow);
  };

  const handleResponse = (): void => {
    if (hasRespondedRef.current || !currentStimulus) return;
    
    hasRespondedRef.current = true;
    const reactionTime = Date.now() - (trialStartTimeRef.current || Date.now());
    const stimulusType = trialSequence[currentTrialIndex];
    
    if (responseWindowRef.current) clearTimeout(responseWindowRef.current);
    if (stimulusTimeoutRef.current) clearTimeout(stimulusTimeoutRef.current);
    
    if (stimulusType === 'GO') {
      recordResult({
        type: 'correct',
        stimulusType: 'GO',
        responseTime: reactionTime,
        correct: true
      });
      showTemporaryFeedback('correct');
    } else {
      recordResult({
        type: 'commission',
        stimulusType: 'NOGO',
        responseTime: reactionTime,
        correct: false,
        errorType: 'commission'
      });
      showTemporaryFeedback('commission');
    }
    
    setCurrentStimulus(null);
    
    setTimeout(() => {
      showNextStimulus(trialSequence, currentTrialIndex + 1);
    }, GAME_CONFIG.interStimulusInterval);
  };

  const handleNoResponse = (stimulusType: StimulusType): void => {
    if (stimulusType === 'NOGO') {
      recordResult({
        type: 'correct_rejection',
        stimulusType: 'NOGO',
        responseTime: null,
        correct: true
      });
      showTemporaryFeedback('correct');
    } else {
      recordResult({
        type: 'omission',
        stimulusType: 'GO',
        responseTime: null,
        correct: false,
        errorType: 'omission'
      });
      showTemporaryFeedback('omission');
    }
  };

  const recordResult = (result: any): void => {
    gameState.addResult({
      ...result,
      trialNumber: currentTrialIndex + 1,
      timestamp: Date.now()
    });
  };

  const showTemporaryFeedback = (type: FeedbackType): void => {
    setFeedbackType(type);
    setShowFeedback(true);
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackType(null);
    }, 300);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      if (gamePhase === 'playing' && e.code === 'Space') {
        e.preventDefault();
        handleResponse();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gamePhase, currentStimulus, currentTrialIndex]);

  useEffect(() => {
    return () => {
      if (stimulusTimeoutRef.current) clearTimeout(stimulusTimeoutRef.current);
      if (responseWindowRef.current) clearTimeout(responseWindowRef.current);
    };
  }, []);

  return (
    <GameContainer
      title="Go / No-Go"
      instructions={gamePhase === 'instructions' 
        ? "Pulsa la BARRA ESPACIADORA o haz CLICK cuando veas el círculo VERDE. NO hagas nada cuando veas el círculo ROJO. Responde lo más rápido posible."
        : null}
      showInstructions={gamePhase === 'instructions'}
    >
      {gamePhase === 'instructions' && (
        <div className="gonogo-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Total de estímulos</span>
              <span className="info-value">{GAME_CONFIG.totalTrials}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Duración</span>
              <span className="info-value">{GAME_CONFIG.totalGameTime}s</span>
            </div>
          </div>

          <div className="stimulus-examples">
            <div className="example-card go">
              <div className="example-stimulus" style={{ background: STIMULUS_TYPES.GO.color }}>
                {STIMULUS_TYPES.GO.icon}
              </div>
              <p className="example-label">CÍRCULO VERDE</p>
              <p className="example-action">→ PULSA ✓</p>
            </div>
            
            <div className="example-card nogo">
              <div className="example-stimulus" style={{ background: STIMULUS_TYPES.NOGO.color }}>
                {STIMULUS_TYPES.NOGO.icon}
              </div>
              <p className="example-label">CÍRCULO ROJO</p>
              <p className="example-action">→ NO PULSES ✗</p>
            </div>
          </div>

          <button className="start-game-button" onClick={startGame}>
            Comenzar Juego
          </button>
        </div>
      )}

      {gamePhase === 'countdown' && (
        <div className="gonogo-countdown">
          <div className="countdown-number">{countdown}</div>
          <p className="countdown-text">Prepárate...</p>
        </div>
      )}

      {gamePhase === 'playing' && (
        <div className="gonogo-game">
          <div className="game-header-bar">
            <div className="trial-indicator">
              Estímulo {currentTrialIndex + 1} / {GAME_CONFIG.totalTrials}
            </div>
            <Timer 
              timeLeft={timer.timeLeft} 
              total={timer.totalTime}
              label="Tiempo restante"
            />
          </div>

          <div 
            className={`stimulus-area ${showFeedback ? 'feedback-active' : ''} ${feedbackType || ''}`}
            onClick={handleResponse}
          >
            {currentStimulus && (
              <div 
                className="stimulus"
                style={{ 
                  background: currentStimulus.color,
                  animation: 'stimulusAppear 0.2s ease-out'
                }}
              >
                {currentStimulus.icon}
              </div>
            )}

            {!currentStimulus && !showFeedback && (
              <div className="fixation-cross">+</div>
            )}
          </div>

          <div className="response-hint">
            <p>Presiona <kbd>ESPACIO</kbd> o haz <strong>CLICK</strong> en verde</p>
          </div>
        </div>
      )}

      {gamePhase === 'finished' && (
        <div className="gonogo-finished">
          <div className="finished-message">
            <h2>¡Juego completado!</h2>
            <p>Procesando resultados...</p>
          </div>
        </div>
      )}
    </GameContainer>
  );
};
