import React, { useState, useEffect, useRef } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import './GoNoGo.css';

const TOTAL = 40;
const TIEMPO = 90;

const ESTIMULOS = {
  GO:   { color: '#10b981' },
  NOGO: { color: '#ef4444' }
};

function generarSecuencia() {
  const totalGo = Math.floor(TOTAL * 0.75);
  const lista = [
    ...Array(totalGo).fill('GO'),
    ...Array(TOTAL - totalGo).fill('NOGO')
  ];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

export const GoNoGo = ({ onGameComplete }) => {
  const gameState = useGameState();
  const [fase, setFase] = useState('instructions');
  const [estimulo, setEstimulo] = useState(null);
  const [cuenta, setCuenta] = useState(3);
  const [secuencia, setSecuencia] = useState([]);
  const [indice, setIndice] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const t1 = useRef(null);
  const t2 = useRef(null);
  const respondio = useRef(false);
  const tInicio = useRef(null);
  const indiceRef = useRef(0);
  const secuenciaRef = useRef([]);

  const timer = useGameTimer(() => terminar());

  function mostrarFeedback(tipo) {
    setFeedback(tipo);
    setTimeout(() => setFeedback(null), 300);
  }

  function guardarResultado(obj) {
    gameState.addResult({ ...obj, trialNumber: indiceRef.current + 1, timestamp: Date.now() });
  }

  function terminar() {
    gameState.finishGame();
    setFase('finished');
    timer.stopTimer();
    clearTimeout(t1.current);
    clearTimeout(t2.current);

    const res = gameState.results;
    const goTrials = res.filter(r => r.stimulusType === 'GO');
    const nogoTrials = res.filter(r => r.stimulusType === 'NOGO');
    const comision = res.filter(r => r.errorType === 'commission').length;
    const omision = res.filter(r => r.errorType === 'omission').length;
    const rts = res.filter(r => r.responseTime).map(r => r.responseTime);
    const media = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
    const std = rts.length ? Math.sqrt(rts.reduce((s, r) => s + Math.pow(r - media, 2), 0) / rts.length) : 0;

    onGameComplete({
      gameType: 'gonogo',
      summary: {
        totalTrials: res.length,
        totalAnswers: res.length,
        correctAnswers: gameState.getCorrectAnswers(),
        accuracy: gameState.getAccuracy(),
        commissionErrors: comision,
        omissionErrors: omision,
        commissionRate: nogoTrials.length ? (comision / nogoTrials.length) * 100 : 0,
        omissionRate: goTrials.length ? (omision / goTrials.length) * 100 : 0,
        goAccuracy: goTrials.length ? (goTrials.filter(r => r.correct).length / goTrials.length) * 100 : 0,
        nogoAccuracy: nogoTrials.length ? (nogoTrials.filter(r => r.correct).length / nogoTrials.length) * 100 : 0,
        averageResponseTime: media,
        fastestResponse: rts.length ? Math.min(...rts) : 0,
        slowestResponse: rts.length ? Math.max(...rts) : 0,
        responseVariability: std,
        impulsivityIndex: comision > omision ? 'high' : 'normal'
      },
      detailedResults: res
    });
  }

  function siguienteEstimulo(lista, i) {
    if (i >= lista.length) { terminar(); return; }

    respondio.current = false;
    tInicio.current = Date.now();
    indiceRef.current = i;
    setIndice(i);
    setEstimulo(ESTIMULOS[lista[i]]);
    gameState.nextRound();

    t1.current = setTimeout(() => setEstimulo(null), 1000);

    t2.current = setTimeout(() => {
      if (!respondio.current) {
        const tipo = lista[i];
        if (tipo === 'NOGO') {
          guardarResultado({ type: 'correct_rejection', stimulusType: 'NOGO', responseTime: null, correct: true });
          mostrarFeedback('correct');
        } else {
          guardarResultado({ type: 'omission', stimulusType: 'GO', responseTime: null, correct: false, errorType: 'omission' });
          mostrarFeedback('omission');
        }
      }
      setTimeout(() => siguienteEstimulo(lista, i + 1), 500);
    }, 1000);
  }

  function responder() {
    if (respondio.current || !estimulo) return;
    respondio.current = true;
    const rt = Date.now() - tInicio.current;
    const tipo = secuenciaRef.current[indiceRef.current];

    clearTimeout(t1.current);
    clearTimeout(t2.current);

    if (tipo === 'GO') {
      guardarResultado({ type: 'correct', stimulusType: 'GO', responseTime: rt, correct: true });
      mostrarFeedback('correct');
    } else {
      guardarResultado({ type: 'commission', stimulusType: 'NOGO', responseTime: rt, correct: false, errorType: 'commission' });
      mostrarFeedback('commission');
    }

    setEstimulo(null);
    setTimeout(() => siguienteEstimulo(secuenciaRef.current, indiceRef.current + 1), 500);
  }

  function iniciar() {
    const seq = generarSecuencia();
    secuenciaRef.current = seq;
    setSecuencia(seq);
    gameState.resetGame();
    setFase('countdown');

    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCuenta(c);
      if (c === 0) {
        clearInterval(iv);
        setFase('playing');
        timer.startTimer(TIEMPO);
        siguienteEstimulo(seq, 0);
      }
    }, 1000);
  }

  useEffect(() => {
    const onKey = (e) => { if (fase === 'playing' && e.code === 'Space') { e.preventDefault(); responder(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fase, estimulo]);

  useEffect(() => () => { clearTimeout(t1.current); clearTimeout(t2.current); }, []);

  return (
    <GameContainer
      title="Go / No-Go"
      instructions={fase === 'instructions' ? "Pulsa ESPACIO o CLICK en el círculo VERDE. NO hagas nada con el círculo ROJO." : null}
      showInstructions={fase === 'instructions'}
    >
      {fase === 'instructions' && (
        <div className="gonogo-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Total de estímulos</span>
              <span className="info-value">{TOTAL}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Duración</span>
              <span className="info-value">{TIEMPO}s</span>
            </div>
          </div>
          <div className="stimulus-examples">
            <div className="example-card go">
              <div className="example-stimulus" style={{ background: ESTIMULOS.GO.color }} />
              <p className="example-label">CÍRCULO VERDE</p>
              <p className="example-action">→ PULSA ✓</p>
            </div>
            <div className="example-card nogo">
              <div className="example-stimulus" style={{ background: ESTIMULOS.NOGO.color }} />
              <p className="example-label">CÍRCULO ROJO</p>
              <p className="example-action">→ NO PULSES ✗</p>
            </div>
          </div>
          <button className="start-game-button" onClick={iniciar}>Comenzar Juego</button>
        </div>
      )}

      {fase === 'countdown' && (
        <div className="gonogo-countdown">
          <div className="countdown-number">{cuenta}</div>
          <p className="countdown-text">Prepárate...</p>
        </div>
      )}

      {fase === 'playing' && (
        <div className="gonogo-game">
          <div className="game-header-bar">
            <div className="trial-indicator">Estímulo {indice + 1} / {TOTAL}</div>
            <Timer timeLeft={timer.timeLeft} total={timer.totalTime} label="Tiempo restante" />
          </div>
          <div className={`stimulus-area ${feedback ? 'feedback-active ' + feedback : ''}`} onClick={responder}>
            {estimulo
              ? <div className="stimulus" style={{ background: estimulo.color, animation: 'stimulusAppear 0.2s ease-out' }} />
              : <div className="fixation-cross">+</div>
            }
          </div>
          <div className="response-hint">
            <p>Presiona <kbd>ESPACIO</kbd> o haz <strong>CLICK</strong> en verde</p>
          </div>
        </div>
      )}

      {fase === 'finished' && (
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