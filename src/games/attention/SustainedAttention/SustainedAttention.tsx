import React, { useState, useEffect, useRef } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import './SustainedAttention.css';

const DURACION = 180;
const TIEMPO_ESTIMULO = 800;
const ENTRE_ESTIMULOS = 1200;
const LETRA_OBJETIVO = 'X';
const PROB_OBJETIVO = 0.15;
const BLOQUE = 20;

const LETRAS = 'ABCDEFGHJKLMNOPQRSTUVWYZ'.split('');

function letraAleatoria() {
  return LETRAS[Math.floor(Math.random() * LETRAS.length)];
}

export const SustainedAttention = ({ onGameComplete }) => {
  const gameState = useGameState();
  const [fase, setFase] = useState('instructions');
  const [cuenta, setCuenta] = useState(3);
  const [letraActual, setLetraActual] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const ensayosRef = useRef([]);
  const ensayoActualRef = useRef(null);
  const respondioRef = useRef(false);
  const t1 = useRef(null);
  const t2 = useRef(null);
  const tCuenta = useRef(null);

  const timer = useGameTimer(() => terminar());

  const progreso = DURACION > 0 ? ((DURACION - timer.timeLeft) / DURACION) * 100 : 0;

  function mostrarFeedback(tipo) {
    setFeedback(tipo);
    setTimeout(() => setFeedback(null), 350);
  }

  function terminar() {
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    setFase('finished');
    setLetraActual(null);

    const ensayos = ensayosRef.current;
    const objetivos = ensayos.filter(e => e.isTarget);
    const aciertos = objetivos.filter(e => e.correct).length;
    const omisiones = objetivos.filter(e => e.errorType === 'omission').length;
    const comisiones = ensayos.filter(e => e.errorType === 'commission').length;
    const rts = ensayos.filter(e => e.responseTime).map(e => e.responseTime);
    const media = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
    const std = rts.length > 1
      ? Math.sqrt(rts.reduce((s, r) => s + Math.pow(r - media, 2), 0) / rts.length)
      : 0;

    // Estadísticas por bloques
    const numBloques = Math.ceil(ensayos.length / BLOQUE);
    const blockStats = Array.from({ length: numBloques }, (_, b) => {
      const slice = ensayos.slice(b * BLOQUE, (b + 1) * BLOQUE);
      const bRts = slice.filter(e => e.responseTime).map(e => e.responseTime);
      return {
        block: b + 1,
        hits: slice.filter(e => e.isTarget && e.correct).length,
        omissions: slice.filter(e => e.errorType === 'omission').length,
        commissions: slice.filter(e => e.errorType === 'commission').length,
        avgRT: bRts.length ? bRts.reduce((a, b) => a + b, 0) / bRts.length : null
      };
    });

    onGameComplete({
      gameType: 'sustained-attention',
      summary: {
        totalAnswers: ensayos.length,
        correctAnswers: aciertos,
        incorrectAnswers: omisiones + comisiones,
        accuracy: objetivos.length ? (aciertos / objetivos.length) * 100 : 0,
        averageResponseTime: media,
        fastestResponse: rts.length ? Math.min(...rts) : 0,
        slowestResponse: rts.length ? Math.max(...rts) : 0,
        omissionErrors: omisiones,
        commissionErrors: comisiones,
        omissionRate: objetivos.length ? (omisiones / objetivos.length) * 100 : 0,
        commissionRate: (ensayos.length - objetivos.length) > 0
          ? (comisiones / (ensayos.length - objetivos.length)) * 100 : 0,
        responseVariability: std,
        blockStats
      },
      detailedResults: ensayos.map(e => ({
        trialNumber: e.trialNumber,
        stimulus: e.letter,
        response: e.responded ? 'press' : null,
        correct: e.correct,
        responseTime: e.responseTime,
        timestamp: e.timestamp,
        stimulusType: e.isTarget ? 'TARGET' : 'DISTRACTOR',
        errorType: e.errorType ?? undefined,
        type: e.errorType ?? (e.correct ? (e.isTarget ? 'hit' : 'correct_rejection') : 'unknown'),
        round: e.block
      }))
    });
  }

  function siguienteEstimulo() {
    const esObjetivo = Math.random() < PROB_OBJETIVO;
    const letra = esObjetivo ? LETRA_OBJETIVO : letraAleatoria();
    const inicio = Date.now();
    const numero = ensayosRef.current.length + 1;
    const bloque = Math.floor(ensayosRef.current.length / BLOQUE) + 1;

    respondioRef.current = false;
    ensayoActualRef.current = { letra, esObjetivo, inicio };

    setLetraActual(letra);

    t1.current = setTimeout(() => {
      setLetraActual(null);

      // Si no respondió, registrar resultado
      if (!respondioRef.current && ensayoActualRef.current) {
        const esObj = ensayoActualRef.current.esObjetivo;
        const ensayo = {
          trialNumber: numero,
          letter: ensayoActualRef.current.letra,
          isTarget: esObj,
          responded: false,
          responseTime: null,
          correct: !esObj,
          errorType: esObj ? 'omission' : null,
          timestamp: inicio,
          block: bloque
        };
        ensayosRef.current.push(ensayo);
        gameState.addResult({ ...ensayo, stimulus: ensayo.letter, response: null });
        if (esObj) mostrarFeedback('miss');
      }

      ensayoActualRef.current = null;
      t2.current = setTimeout(siguienteEstimulo, ENTRE_ESTIMULOS);
    }, TIEMPO_ESTIMULO);
  }

  function responder() {
    if (respondioRef.current || !ensayoActualRef.current) return;
    respondioRef.current = true;

    const rt = Date.now() - ensayoActualRef.current.inicio;
    const { letra, esObjetivo, inicio } = ensayoActualRef.current;
    const numero = ensayosRef.current.length + 1;
    const bloque = Math.floor(ensayosRef.current.length / BLOQUE) + 1;

    const ensayo = {
      trialNumber: numero,
      letter: letra,
      isTarget: esObjetivo,
      responded: true,
      responseTime: rt,
      correct: esObjetivo,
      errorType: esObjetivo ? null : 'commission',
      timestamp: inicio,
      block: bloque
    };

    ensayosRef.current.push(ensayo);
    gameState.addResult({ ...ensayo, stimulus: letra, response: 'press' });
    mostrarFeedback(esObjetivo ? 'hit' : 'false-alarm');
  }

  function iniciar() {
    ensayosRef.current = [];
    gameState.resetGame();
    setFase('countdown');

    let c = 3;
    tCuenta.current = setInterval(() => {
      c--;
      setCuenta(c);
      if (c === 0) {
        clearInterval(tCuenta.current);
        setFase('playing');
        timer.startTimer(DURACION);
        setTimeout(siguienteEstimulo, 500);
      }
    }, 1000);
  }

  useEffect(() => {
    const onKey = (e) => { if (fase === 'playing' && e.code === 'Space') { e.preventDefault(); responder(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fase]);

  useEffect(() => () => {
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    clearInterval(tCuenta.current);
  }, []);

  return (
    <GameContainer title="Atención Sostenida" instructions={null} showInstructions={false}>

      {fase === 'instructions' && (
        <div className="sa-instructions">
          <div className="sa-inst-header">
            <span className="sa-inst-icon">🔍</span>
            <h2>¿Cómo se juega?</h2>
          </div>
          <p className="sa-inst-desc">
            Aparecerán letras una a una en la pantalla.<br />
            <strong>Solo debes pulsar cuando veas la letra&nbsp;
              <span className="sa-target-preview">{LETRA_OBJETIVO}</span>.
            </strong>
          </p>
          <div className="sa-inst-examples">
            <div className="sa-inst-ex target">
              <div className="sa-letter-demo target">{LETRA_OBJETIVO}</div>
              <span>← PULSA <kbd>Espacio</kbd> o haz clic</span>
            </div>
            <div className="sa-inst-ex distractor">
              <div className="sa-letter-demo distractor">M</div>
              <span>← No hagas nada</span>
            </div>
          </div>
          <div className="sa-inst-meta">
            <div className="sa-meta-item"><span>⏱️</span><span>{DURACION / 60} minutos</span></div>
            <div className="sa-meta-item"><span>📊</span><span>Sin puntuación visible — ¡mantén la concentración!</span></div>
          </div>
          <button className="sa-start-btn" onClick={iniciar}>Comenzar</button>
        </div>
      )}

      {fase === 'countdown' && (
        <div className="sa-countdown">
          <div className="sa-countdown-number">{cuenta || '¡Ya!'}</div>
          <p>Prepárate…</p>
        </div>
      )}

      {fase === 'playing' && (
        <div className="sa-game">
          <div className="sa-progress-bar">
            <div className="sa-progress-fill" style={{ width: `${progreso}%` }} />
          </div>
          <div className="sa-timer-label">
            {Math.floor(timer.timeLeft / 60)}:{String(timer.timeLeft % 60).padStart(2, '0')} restantes
          </div>
          <div className={`sa-stimulus-area ${feedback ? 'feedback-' + feedback : ''}`} onClick={responder}>
            {letraActual
              ? <div className={`sa-letter ${letraActual === LETRA_OBJETIVO ? 'is-target' : ''}`}>{letraActual}</div>
              : <div className="sa-fixation">+</div>
            }
          </div>
          <p className="sa-hint">
            Pulsa <kbd>Espacio</kbd> o haz <strong>clic</strong> solo con la&nbsp;
            <strong className="sa-target-inline">{LETRA_OBJETIVO}</strong>
          </p>
        </div>
      )}

      {fase === 'finished' && (
        <div className="sa-finished">
          <h2>¡Prueba completada!</h2>
          <p>Procesando resultados…</p>
        </div>
      )}

    </GameContainer>
  );
};