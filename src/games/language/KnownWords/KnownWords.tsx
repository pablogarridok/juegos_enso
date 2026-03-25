import React, { useState, useEffect, useRef } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import './KnownWords.css';

const TOTAL_ROUNDS = 5;
const TIME_PER_ROUND = 20;

const WORDS_POOL = {
  real: ['casa', 'perro', 'agua', 'libro', 'mesa', 'árbol', 'niño', 'sol', 'luna', 'ventana', 'jardín', 'nube', 'flor', 'tierra', 'espejo', 'puente'],
  pseudo: ['breno', 'timal', 'freso', 'plino', 'zarte', 'ventala', 'camiso', 'arbolo', 'liembro', 'espilo', 'fremis', 'torbe', 'disvo', 'creno']
};

export const KnownWords = ({ onGameComplete }) => {
  const gameState = useGameState();
  
  const [fase, setFase] = useState('instrucciones');
  const [ronda, setRonda] = useState(0);
  const [currentBatch, setCurrentBatch] = useState([]);
  const [decisiones, setDecisiones] = useState([]); // Este estado controla la UI
  const [tiempo, setTiempo] = useState(TIME_PER_ROUND);
  const [flashId, setFlashId] = useState(null);

  const timerRef = useRef(null);
  const rondaRef = useRef(0);
  const batchRef = useRef([]);
  const decisionesRef = useRef([]); // Este ref guarda los datos para el final
  const resultadosAcumuladosRef = useRef([]);

  // Sincronizamos las Refs CADA VEZ que cambie el estado
  useEffect(() => { 
    rondaRef.current = ronda; 
    batchRef.current = currentBatch;
    decisionesRef.current = decisiones;
  }, [ronda, currentBatch, decisiones]);

  useEffect(() => {
    if (fase !== 'jugando') return;

    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          finalizarRonda(true); 
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [ronda, fase]);

  const nuevaRonda = () => {
    const reals = [...WORDS_POOL.real].sort(() => Math.random() - 0.5).slice(0, 4);
    const pseudos = [...WORDS_POOL.pseudo].sort(() => Math.random() - 0.5).slice(0, 4);
    
    const batch = [...reals.map(w => ({ id: Math.random().toString(), text: w, isReal: true })),
                   ...pseudos.map(w => ({ id: Math.random().toString(), text: w, isReal: false }))]
                   .sort(() => Math.random() - 0.5);

    setCurrentBatch(batch);
    setDecisiones([]); // Limpiamos visualmente las seleccionadas
    setTiempo(TIME_PER_ROUND);
  };

  const empezarJuego = () => {
    setRonda(0);
    resultadosAcumuladosRef.current = [];
    setFase('jugando');
    nuevaRonda();
  };

  const handleWordClick = (word) => {
    // Comprobamos si ya está en el estado de decisiones
    if (decisiones.find(d => d.id === word.id)) return;

    const nuevaDecision = {
      ...word,
      userAccepted: true,
      correct: word.isReal,
      responseTime: (TIME_PER_ROUND - tiempo) * 1000
    };

    // Actualizamos el estado (para que se vea el check en la pantalla)
    setDecisiones(prev => [...prev, nuevaDecision]);
    
    setFlashId({ id: word.id, correct: word.isReal });
    setTimeout(() => setFlashId(null), 400);
  };

  const finalizarRonda = (isTimeout = false) => {
    clearInterval(timerRef.current);

    // Usamos las refs para asegurarnos de tener la foto actual del juego
    const batchActual = batchRef.current;
    const decsActuales = decisionesRef.current;
    const rondaActual = rondaRef.current;

    const noPulsadas = batchActual
      .filter(w => !decsActuales.find(d => d.id === w.id))
      .map(w => ({
        ...w,
        userAccepted: false,
        correct: !w.isReal
      }));

    const fullRoundResults = [...decsActuales, ...noPulsadas];
    resultadosAcumuladosRef.current = [...resultadosAcumuladosRef.current, ...fullRoundResults];

    if (rondaActual + 1 >= TOTAL_ROUNDS) {
      setFase('fin');
      setTimeout(() => {
        const todosLosDatos = resultadosAcumuladosRef.current;
        const aciertos = todosLosDatos.filter(r => r.correct).length;
        
        onGameComplete({
          gameType: 'knownwords',
          summary: {
            totalAnswers: todosLosDatos.length,
            correctAnswers: aciertos,
            accuracy: Math.round((aciertos / todosLosDatos.length) * 100),
            averageResponseTime: 0
          },
          detailedResults: todosLosDatos
        });
      }, 100);
    } else {
      setRonda(r => r + 1);
      setTimeout(() => nuevaRonda(), 500);
    }
  };

  return (
    <GameContainer title="KnownWords" showInstructions={fase === 'instrucciones'}>
      
      {fase === 'instrucciones' && (
        <div className="kw-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">📖</span>
              <span className="info-label">Rondas</span>
              <span className="info-value">{TOTAL_ROUNDS}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Tiempo</span>
              <span className="info-value">{TIME_PER_ROUND}s</span>
            </div>
          </div>
          <button className="start-game-button" onClick={empezarJuego}>Comenzar</button>
        </div>
      )}

      {fase === 'jugando' && (
        <div className="kw-game">
          <div className="game-header-bar">
            <div className="round-indicator">Ronda {ronda + 1} / {TOTAL_ROUNDS}</div>
            <div className="round-indicator">⏱ {tiempo}s</div>
            <div className="kw-accepted-count">
              <span className="kw-accepted-icon">✓</span>
              <span className="kw-accepted-value">{decisiones.length}</span>
            </div>
          </div>

          <div className="kw-words-grid">
            {currentBatch.map(word => {
              const selected = decisiones.some(d => d.id === word.id);
              return (
                <button
                  key={word.id}
                  className={`kw-word-card ${selected ? 'accepted' : ''} ${flashId?.id === word.id ? (flashId.correct ? 'flash-correct' : 'flash-wrong') : ''}`}
                  onClick={() => handleWordClick(word)}
                  disabled={selected}
                >
                  {word.text}
                  {selected && <span className="kw-check">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="kw-controls">
            <button className="kw-confirm-button" onClick={() => finalizarRonda(false)}>
              Confirmar y continuar →
            </button>
          </div>
        </div>
      )}

      {fase === 'fin' && (
        <div className="kw-finished">
          <h2>¡Prueba completada!</h2>
          <p>Procesando resultados...</p>
        </div>
      )}
    </GameContainer>
  );
};