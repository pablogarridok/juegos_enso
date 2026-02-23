import { useState, useCallback } from 'react';
import type { Trial, GameState } from '../types';

export const useGameState = (): GameState => {
  const [results, setResults] = useState<Trial[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const addResult = useCallback((result: Partial<Trial>): Trial => {
    const resultWithMetadata: Trial = {
      trialNumber: result.trialNumber || 0,
      stimulus: result.stimulus,
      response: result.response || null,
      correct: result.correct || false,
      responseTime: result.responseTime || null,
      timestamp: Date.now(),
      round: currentRound,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...result
    };

    setResults(prev => [...prev, resultWithMetadata]);
    return resultWithMetadata;
  }, [currentRound]);

  const nextRound = useCallback((): void => {
    setCurrentRound(prev => prev + 1);
  }, []);

  const finishGame = useCallback((): void => {
    setIsFinished(true);
  }, []);

  const pauseGame = useCallback((): void => {
    setIsPaused(true);
  }, []);

  const resumeGame = useCallback((): void => {
    setIsPaused(false);
  }, []);

  const resetGame = useCallback((): void => {
    setResults([]);
    setCurrentRound(0);
    setIsFinished(false);
    setIsPaused(false);
  }, []);

  const getCorrectAnswers = useCallback((): number => {
    return results.filter(r => r.correct).length;
  }, [results]);

  const getAccuracy = useCallback((): number => {
    if (results.length === 0) return 0;
    return (getCorrectAnswers() / results.length) * 100;
  }, [results, getCorrectAnswers]);

  return {
    results,
    currentRound,
    isFinished,
    isPaused,
    addResult,
    nextRound,
    finishGame,
    pauseGame,
    resumeGame,
    resetGame,
    getCorrectAnswers,
    getAccuracy
  };
};