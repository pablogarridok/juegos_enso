import React, { useState, useCallback } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, Word, WordRule, WordPool, GameResults } from '../../../types';
import './WordsBox.css';

const GAME_CONFIG = {
  totalRounds: 10,
  timePerRound: 30,
  wordsPerRound: 6
};

const WORD_POOL: WordPool = {
  animales: ['perro', 'gato', 'león', 'tigre', 'oso', 'lobo', 'zorro', 'águila', 'mono', 'elefante', 'jirafa', 'cebra'],
  colores: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco', 'rosa', 'morado', 'naranja', 'gris', 'marrón', 'turquesa'],
  comida: ['manzana', 'pan', 'queso', 'leche', 'patata', 'arroz', 'pasta', 'carne', 'pescado', 'huevo', 'tomate', 'lechuga'],
  objetos: ['mesa', 'silla', 'libro', 'lápiz', 'papel', 'ordenador', 'teléfono', 'reloj', 'espejo', 'lámpara', 'puerta', 'ventana']
};

export const WordsBox: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();
  
  const [currentWords, setCurrentWords] = useState<Word[]>([]);
  const [currentRule, setCurrentRule] = useState<WordRule | null>(null);
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [gamePhase, setGamePhase] = useState<'instructions' | 'playing' | 'finished'>('instructions');
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);

  // Definir handleTimeout antes de usarlo en el hook
  const handleTimeout = useCallback((): void => {
    const responseTime = GAME_CONFIG.timePerRound * 1000;
    
    gameState.addResult({
      correct: false,
      responseTime,
      response: null,
      selectedWords: selectedWords.map(w => w.text),
      correctWords: currentWords.filter(w => w.isTarget).map(w => w.text),
      rule: currentRule?.category,
      timeout: true
    });
    
    if (gameState.currentRound + 1 >= GAME_CONFIG.totalRounds) {
      finishGame();
    } else {
      gameState.nextRound();
      setTimeout(() => startNewRound(), 1000);
    }
  }, [selectedWords, currentWords, currentRule, gameState]);

  const timer = useGameTimer(handleTimeout);

  const startGame = (): void => {
    gameState.resetGame();
    setGamePhase('playing');
    startNewRound();
  };

  const startNewRound = (): void => {
    const categories = Object.keys(WORD_POOL);
    const targetCategory = categories[Math.floor(Math.random() * categories.length)];
    
    const targetWords = [...WORD_POOL[targetCategory]]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const distractorWords: string[] = [];
    const otherCategories = categories.filter(c => c !== targetCategory);
    
    while (distractorWords.length < 3) {
      const randomCat = otherCategories[Math.floor(Math.random() * otherCategories.length)];
      const randomWord = WORD_POOL[randomCat][Math.floor(Math.random() * WORD_POOL[randomCat].length)];
      if (!distractorWords.includes(randomWord) && !targetWords.includes(randomWord)) {
        distractorWords.push(randomWord);
      }
    }
    
    const allWords: Word[] = [...targetWords, ...distractorWords]
      .sort(() => Math.random() - 0.5)
      .map((word, index) => ({
        id: `word-${index}`,
        text: word,
        isTarget: targetWords.includes(word)
      }));
    
    setCurrentWords(allWords);
    setCurrentRule({ category: targetCategory, targetWords });
    setSelectedWords([]);
    setRoundStartTime(Date.now());
    timer.startTimer(GAME_CONFIG.timePerRound);
  };

  const handleWordClick = (word: Word): void => {
    if (selectedWords.find(w => w.id === word.id)) {
      setSelectedWords(selectedWords.filter(w => w.id !== word.id));
    } else {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const submitAnswer = (): void => {
    const responseTime = Date.now() - (roundStartTime || Date.now());
    const correctSelections = selectedWords.filter(w => w.isTarget).length;
    const totalTargets = currentWords.filter(w => w.isTarget).length;
    const incorrectSelections = selectedWords.filter(w => !w.isTarget).length;
    
    const isCorrect = correctSelections === totalTargets && incorrectSelections === 0;
    
    gameState.addResult({
      correct: isCorrect,
      responseTime,
      response: null,
      selectedWords: selectedWords.map(w => w.text),
      correctWords: currentWords.filter(w => w.isTarget).map(w => w.text),
      rule: currentRule?.category,
      correctSelections,
      totalTargets,
      incorrectSelections
    });
    
    timer.stopTimer();
    
    if (gameState.currentRound + 1 >= GAME_CONFIG.totalRounds) {
      finishGame();
    } else {
      gameState.nextRound();
      setTimeout(() => startNewRound(), 1000);
    }
  };

  const finishGame = (): void => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();
    
    const avgResponseTime = gameState.results.reduce((acc, r) => acc + (r.responseTime || 0), 0) / gameState.results.length || 0;
    
    const results: GameResults = {
      gameType: 'wordsbox',
      summary: {
        totalAnswers: gameState.results.length,
        correctAnswers: gameState.getCorrectAnswers(),
        accuracy: gameState.getAccuracy(),
        averageResponseTime: avgResponseTime
      },
      detailedResults: gameState.results
    };
    
    onGameComplete(results);
  };

  return (
    <GameContainer
      title="WordsBox"
      instructions={gamePhase === 'instructions' 
        ? "Selecciona todas las palabras que pertenezcan a la categoría indicada. Tienes 30 segundos por ronda."
        : null}
      showInstructions={gamePhase === 'instructions'}
    >
      {gamePhase === 'instructions' && (
        <div className="wordsbox-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Total de rondas</span>
              <span className="info-value">{GAME_CONFIG.totalRounds}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Tiempo por ronda</span>
              <span className="info-value">{GAME_CONFIG.timePerRound}s</span>
            </div>
          </div>
          <button className="start-game-button" onClick={startGame}>
            Comenzar Juego
          </button>
        </div>
      )}

      {gamePhase === 'playing' && (
        <div className="wordsbox-game">
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

          <div className="rule-display">
            <span className="rule-label">Selecciona:</span>
            <span className="rule-category">{currentRule?.category}</span>
          </div>

          <div className="words-grid">
            {currentWords.map(word => (
              <button
                key={word.id}
                className={`word-card ${selectedWords.find(w => w.id === word.id) ? 'selected' : ''}`}
                onClick={() => handleWordClick(word)}
              >
                {word.text}
              </button>
            ))}
          </div>

          <div className="game-controls">
            <button 
              className="submit-button"
              onClick={submitAnswer}
              disabled={selectedWords.length === 0}
            >
              Enviar ({selectedWords.length} seleccionadas)
            </button>
          </div>
        </div>
      )}

      {gamePhase === 'finished' && (
        <div className="wordsbox-finished">
          <div className="finished-message">
            <h2>¡Juego completado!</h2>
            <p>Procesando resultados...</p>
          </div>
        </div>
      )}
    </GameContainer>
  );
};
