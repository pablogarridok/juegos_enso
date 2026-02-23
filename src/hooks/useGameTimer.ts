import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameTimer } from '../types';

export const useGameTimer = (onTimeUp?: () => void): GameTimer => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const startTimeRef = useRef<number | null>(null);
  const totalTimeRef = useRef<number>(0);
  const onTimeUpRef = useRef<(() => void) | undefined>();

  // Mantener el callback estable
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const startTimer = useCallback((seconds: number): void => {
    // Resetear el timer antes de iniciar uno nuevo
    setIsRunning(false);
    setTimeLeft(seconds);
    totalTimeRef.current = seconds;
    startTimeRef.current = Date.now();
    // Usar setTimeout para asegurar que el estado se actualice correctamente
    setTimeout(() => {
      setIsRunning(true);
    }, 0);
  }, []);

  const stopTimer = useCallback((): void => {
    setIsRunning(false);
  }, []);

  const pauseTimer = useCallback((): void => {
    setIsRunning(false);
  }, []);

  const resumeTimer = useCallback((): void => {
    if (timeLeft > 0 && !isRunning) {
      startTimeRef.current = Date.now();
      setIsRunning(true);
    }
  }, [timeLeft, isRunning]);

  const resetTimer = useCallback((): void => {
    setTimeLeft(0);
    setIsRunning(false);
    startTimeRef.current = null;
  }, []);

  const getElapsedTime = useCallback((): number => {
    if (!startTimeRef.current) return 0;
    return Date.now() - startTimeRef.current;
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return {
    timeLeft,
    totalTime: totalTimeRef.current,
    isRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    getElapsedTime
  };
};
