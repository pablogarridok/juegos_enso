import React, { useState, useCallback, useRef, useEffect } from 'react';

import { GameContainer } from '../../../shared/GameContainer';

import { Timer } from '../../../shared/Timer';

import { useGameState } from '../../../hooks/useGameState';

import { useGameTimer } from '../../../hooks/useGameTimer';

import type { GameProps, GameResults } from '../../../types';

import './KnownWords.css';

import { KnownWordsResultSchema } from '../../../schemas/gameSchemas';



// ===================================================

// CONFIG

// ===================================================



const GAME_CONFIG = {

  totalRounds: 5,          

  timePerRound: 20,        

  wordsPerRound: 8        

};



// ===================================================

// WORD POOLS

// ===================================================

const REAL_WORDS: Record<'high' | 'mid' | 'low', string[]> = {

  high: [

    'casa', 'perro', 'agua', 'libro', 'mesa', 'árbol', 'niño', 'sol',

    'luna', 'pan', 'mano', 'pie', 'ojo', 'voz', 'mar', 'luz',

    'tiempo', 'mundo', 'vida', 'gente', 'ciudad', 'calle', 'día', 'noche'

  ],

  mid: [

    'ventana', 'camino', 'espejo', 'puente', 'jardín', 'bosque', 'lluvia',

    'piedra', 'hierba', 'nube', 'pájaro', 'flor', 'tierra', 'fuego',

    'sombra', 'silencio', 'abrigo', 'zapato', 'collar', 'bolsillo'

  ],

  low: [

    'crepúsculo', 'murmullo', 'ceniza', 'umbrío', 'quimera', 'vástago',

    'añoranza', 'parsimonia', 'efímero', 'laberinto', 'pálpito', 'enigma',

    'cónclave', 'eslabón', 'alquimia', 'crisálida', 'páramo', 'cénit'

  ]

};



const PSEUDO_WORDS: Record<'easy' | 'medium' | 'hard', string[]> = {

  easy: [

    'breno', 'timal', 'freso', 'plino', 'zarte', 'dreno', 'molto', 'trinco',

    'cuvel', 'bliso', 'fremi', 'torbe', 'disvo', 'creno', 'flime', 'porna'

  ],

  medium: [

    'ventala', 'camiso', 'arbolo', 'liembro', 'espilo', 'camido', 'puento',

    'jardino', 'bosquea', 'lluvio', 'piedro', 'hierbo', 'nubel', 'pájilo',

    'floral', 'tierro', 'fuegal', 'sombriz', 'silenzo', 'abrigoz'

  ],

  hard: [

    'crepúsulo', 'murmulio', 'cenesal', 'umbrino', 'quimaro', 'vástero',

    'añoranco', 'parsimeo', 'efimeroz', 'laberenso', 'palpido', 'enigral',

    'conclavez', 'eslabero', 'alquimero', 'crisaleno', 'paramio', 'ceniro'

  ]

};



const HARD_PSEUDO_CLEAN = [

  'crepúsulo', 'murmulio', 'cenesal', 'umbrino', 'quimaro', 'vástero',

  'añoranco', 'parsimeo', 'efimeroz', 'laberenso', 'palpido', 'enigral',

  'conclavez', 'eslabero', 'alquimero', 'crisaleno', 'paramio', 'ceniro'

];



// ===================================================

// TYPES

// ===================================================



interface WordItem {

  id: string;

  text: string;

  isReal: boolean;

  difficulty: 'easy' | 'medium' | 'hard';

  shownAt: number;        

}



interface WordDecision {

  wordId: string;

  text: string;

  isReal: boolean;

  userAccepted: boolean;  

  correct: boolean;

  reactionTime: number;    

  difficulty: 'easy' | 'medium' | 'hard';

}



// ===================================================

// WORD BATCH GENERATOR

// ===================================================



function generateBatch(round: number): WordItem[] {

  let realTier: 'high' | 'mid' | 'low';

  let pseudoTier: 'easy' | 'medium' | 'hard';

  let difficulty: 'easy' | 'medium' | 'hard';



  if (round < 2) {

    realTier = 'high'; pseudoTier = 'easy'; difficulty = 'easy';

  } else if (round < 4) {

    realTier = 'mid'; pseudoTier = 'medium'; difficulty = 'medium';

  } else {

    realTier = 'low'; pseudoTier = 'hard'; difficulty = 'hard';

  }



  const realPool = [...REAL_WORDS[realTier]].sort(() => Math.random() - 0.5).slice(0, 4);

  const pseudoPool = difficulty === 'hard'

    ? [...HARD_PSEUDO_CLEAN].sort(() => Math.random() - 0.5).slice(0, 4)

    : [...PSEUDO_WORDS[pseudoTier]].sort(() => Math.random() - 0.5).slice(0, 4);



  const now = Date.now();

  const items: WordItem[] = [

    ...realPool.map((text, i) => ({

      id: `real-${round}-${i}`,

      text,

      isReal: true,

      difficulty,

      shownAt: now

    })),

    ...pseudoPool.map((text, i) => ({

      id: `pseudo-${round}-${i}`,

      text,

      isReal: false,

      difficulty,

      shownAt: now

    }))

  ].sort(() => Math.random() - 0.5);



  return items;

}



// ===================================================

// COMPONENT

// ===================================================



export const KnownWords: React.FC<GameProps> = ({ onGameComplete }) => {

  const gameState = useGameState();



  const [gamePhase, setGamePhase] = useState<'instructions' | 'playing' | 'finished'>('instructions');

  const [currentBatch, setCurrentBatch] = useState<WordItem[]>([]);

  const [decisions, setDecisions] = useState<WordDecision[]>([]);      

  const [allDecisions, setAllDecisions] = useState<WordDecision[]>([]);

  const [decided, setDecided] = useState<Set<string>>(new Set());      

  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);

  const [flashId, setFlashId] = useState<{ id: string; correct: boolean } | null>(null);



  const currentBatchRef = useRef(currentBatch);

  const decisionsRef = useRef(decisions);

  const allDecisionsRef = useRef(allDecisions);

  const decidedRef = useRef(decided);



  useEffect(() => { currentBatchRef.current = currentBatch; }, [currentBatch]);

  useEffect(() => { decisionsRef.current = decisions; }, [decisions]);

  useEffect(() => { allDecisionsRef.current = allDecisions; }, [allDecisions]);

  useEffect(() => { decidedRef.current = decided; }, [decided]);



 



  const handleTimeout = useCallback(() => {

    const batch = currentBatchRef.current;

    const alreadyDecided = decidedRef.current;

    const existing = decisionsRef.current;



    const implicit: WordDecision[] = batch

      .filter(w => !alreadyDecided.has(w.id))

      .map(w => ({

        wordId: w.id,

        text: w.text,

        isReal: w.isReal,

        userAccepted: false,

        correct: !w.isReal,  

        reactionTime: GAME_CONFIG.timePerRound * 1000,

        difficulty: w.difficulty

      }));



    const roundDecisions = [...existing, ...implicit];

    const allDec = [...allDecisionsRef.current, ...roundDecisions];



    const falsePositives = roundDecisions.filter(d => d.userAccepted && !d.isReal).length;

    const falseNegatives = roundDecisions.filter(d => !d.userAccepted && d.isReal).length;

    const correct = roundDecisions.filter(d => d.correct).length;



    gameState.addResult({

      correct: falsePositives === 0 && falseNegatives === 0,

      responseTime: GAME_CONFIG.timePerRound * 1000,

      response: null,

      falsePositives,

      falseNegatives,

      correctDecisions: correct,

      totalWords: batch.length,

      timeout: true,

      decisions: roundDecisions

    });



    setAllDecisions(allDec);



    if (gameState.currentRound + 1 >= GAME_CONFIG.totalRounds) {

      finishGame(allDec);

    } else {

      gameState.nextRound();

      setTimeout(() => startNewRound(), 600);

    }

  }, []);



  const timer = useGameTimer(handleTimeout);



  // ===================================================

  // FLOW

  // ===================================================



  const startGame = () => {

    gameState.resetGame();

    setAllDecisions([]);

    setGamePhase('playing');

    startNewRound();

  };



  const startNewRound = () => {

    const batch = generateBatch(gameState.currentRound);

    setCurrentBatch(batch);

    setDecisions([]);

    setDecided(new Set());

    setRoundStartTime(Date.now());

    timer.startTimer(GAME_CONFIG.timePerRound);

  };



  const handleWordClick = (word: WordItem) => {

    if (decidedRef.current.has(word.id)) return;



    const reactionTime = Date.now() - word.shownAt;

    const userAccepted = true; // clicking = marking as real word

    const correct = word.isReal; // correct if it's actually real



    const decision: WordDecision = {

      wordId: word.id,

      text: word.text,

      isReal: word.isReal,

      userAccepted,

      correct,

      reactionTime,

      difficulty: word.difficulty

    };



    const newDecided = new Set(decidedRef.current);

    newDecided.add(word.id);

    setDecided(newDecided);



    const newDecisions = [...decisionsRef.current, decision];

    setDecisions(newDecisions);



    setFlashId({ id: word.id, correct });

    setTimeout(() => setFlashId(null), 400);



    // If all words have been decided, close round early

    if (newDecided.size === currentBatchRef.current.length) {

      timer.stopTimer();

      closeRound(newDecisions);

    }

  };



  const handleConfirm = () => {

    timer.stopTimer();

    closeRound(decisionsRef.current);

  };



  const closeRound = (roundDecisions: WordDecision[]) => {

    const batch = currentBatchRef.current;



    // Add implicit rejections for unclicked words

    const alreadyDecided = new Set(roundDecisions.map(d => d.wordId));

    const implicit: WordDecision[] = batch

      .filter(w => !alreadyDecided.has(w.id))

      .map(w => ({

        wordId: w.id,

        text: w.text,

        isReal: w.isReal,

        userAccepted: false,

        correct: !w.isReal,

        reactionTime: GAME_CONFIG.timePerRound * 1000,

        difficulty: w.difficulty

      }));



    const full = [...roundDecisions, ...implicit];

    const allDec = [...allDecisionsRef.current, ...full];



    const falsePositives = full.filter(d => d.userAccepted && !d.isReal).length;

    const falseNegatives = full.filter(d => !d.userAccepted && d.isReal).length;

    const correct = full.filter(d => d.correct).length;



    gameState.addResult({

      correct: falsePositives === 0 && falseNegatives === 0,

      responseTime: Date.now() - (roundStartTime || Date.now()),

      response: null,

      falsePositives,

      falseNegatives,

      correctDecisions: correct,

      totalWords: batch.length,

      timeout: false,

      decisions: full

    });



    setAllDecisions(allDec);



    if (gameState.currentRound + 1 >= GAME_CONFIG.totalRounds) {

      finishGame(allDec);

    } else {

      gameState.nextRound();

      setTimeout(() => startNewRound(), 600);

    }

  };



  const finishGame = (allDec: WordDecision[]) => {

    gameState.finishGame();

    setGamePhase('finished');

    timer.stopTimer();



    const totalFP = allDec.filter(d => d.userAccepted && !d.isReal).length;

    const totalFN = allDec.filter(d => !d.userAccepted && d.isReal).length;

    const totalCorrect = allDec.filter(d => d.correct).length;



    const reactionTimes = allDec.filter(d => d.userAccepted).map(d => d.reactionTime);

    const avgRT = reactionTimes.length

      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length

      : 0;



    // Variability = standard deviation of reaction times

    const rtVariability = reactionTimes.length > 1

      ? Math.sqrt(

          reactionTimes.reduce((acc, t) => acc + Math.pow(t - avgRT, 2), 0) / reactionTimes.length

        )

      : 0;



    // Impulsivity score: % of fast accepts (<400ms) that were wrong

    const fastAccepts = allDec.filter(d => d.userAccepted && d.reactionTime < 400);

    const impulsivityRate = fastAccepts.length

      ? fastAccepts.filter(d => !d.isReal).length / fastAccepts.length

      : 0;



    const rawResults = {

        gameType: 'knownwords',

        summary: {

          totalAnswers: allDec.length,

          correctAnswers: totalCorrect,

          accuracy: totalCorrect / (allDec.length || 1),

          averageResponseTime: avgRT,

          falsePositives: totalFP,

          falseNegatives: totalFN,

          reactionTimeVariability: rtVariability,

          impulsivityRate

        },

        detailedResults: gameState.results,

        allDecisions: allDec

      };

   

      // 2. VALIDACIÓN CON ZOD

      const validation = KnownWordsResultSchema.safeParse(rawResults);

   

      if (validation.success) {

        // Si los datos son correctos según el esquema

        onGameComplete(validation.data);

      } else {

        // Si hay un error (ej. impulsivityRate es NaN)

        console.error("❌ Error de validación en KnownWords:", validation.error.format());



        // Fallback: puedes enviar los datos crudos o manejar el error

        onGameComplete(rawResults as any);

      }

    };



  // ===================================================

  // RENDER

  // ===================================================



  const acceptedCount = decisions.filter(d => d.userAccepted).length;



  return (

    <GameContainer

      title="KnownWords"

      instructions={

        gamePhase === 'instructions'

          ? 'Pulsa solo las palabras que existen de verdad. Ignora las que no son palabras reales.'

          : null

      }

      showInstructions={gamePhase === 'instructions'}

    >

      {gamePhase === 'instructions' && (

        <div className="kw-start">

          <div className="game-info">

            <div className="info-card">

              <span className="info-icon">📖</span>

              <span className="info-label">Rondas</span>

              <span className="info-value">{GAME_CONFIG.totalRounds}</span>

            </div>

            <div className="info-card">

              <span className="info-icon">⏱️</span>

              <span className="info-label">Tiempo por ronda</span>

              <span className="info-value">{GAME_CONFIG.timePerRound}s</span>

            </div>

            <div className="info-card">

              <span className="info-icon">🔤</span>

              <span className="info-label">Palabras por ronda</span>

              <span className="info-value">{GAME_CONFIG.wordsPerRound}</span>

            </div>

          </div>

          <div className="kw-tip">

            <span>💡</span>

            <span>Pulsa las palabras reales. Las que no pulses se consideran rechazadas.</span>

          </div>

          <button className="start-game-button" onClick={startGame}>

            Comenzar

          </button>

        </div>

      )}



      {gamePhase === 'playing' && (

        <div className="kw-game">

          <div className="game-header-bar">

            <div className="round-indicator">

              Ronda {gameState.currentRound + 1} / {GAME_CONFIG.totalRounds}

            </div>

            <Timer

              timeLeft={timer.timeLeft}

              total={timer.totalTime}

              label="Tiempo restante"

            />

            <div className="kw-accepted-count">

              <span className="kw-accepted-icon">✓</span>

              <span className="kw-accepted-value">{acceptedCount}</span>

            </div>

          </div>



          <div className="kw-instruction-bar">

            Pulsa solo las <strong>palabras reales</strong>

          </div>



          <div className="kw-words-grid">

            {currentBatch.map(word => {

              const isDecided = decided.has(word.id);

              const flash = flashId?.id === word.id ? flashId : null;

              return (

                <button

                  key={word.id}

                  className={[

                    'kw-word-card',

                    isDecided ? 'accepted' : '',

                    flash?.correct === true ? 'flash-correct' : '',

                    flash?.correct === false ? 'flash-wrong' : ''

                  ].filter(Boolean).join(' ')}

                  onClick={() => handleWordClick(word)}

                  disabled={isDecided}

                >

                  {word.text}

                  {isDecided && <span className="kw-check">✓</span>}

                </button>

              );

            })}

          </div>



          <div className="kw-controls">

            <button className="kw-confirm-button" onClick={handleConfirm}>

              Confirmar y continuar →

            </button>

          </div>

        </div>

      )}



      {gamePhase === 'finished' && (

        <div className="kw-finished">

          <h2>¡Prueba completada!</h2>

          <p>Procesando resultados léxicos...</p>

        </div>

      )}

    </GameContainer>

  );

};