import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, GameResults } from '../../../types';
import './TrailMaking.css';

const GAME_CONFIG = {
  totalRounds: 2, // Round 1 = basic (numbers only), Round 2 = advanced (alternate number-letter)
  timeLimitBasic: 60,
  timeLimitAdvanced: 90,
  nodeCountBasic: 13,    // 1–13
  nodeCountAdvanced: 12  // 1-A-2-B-3-C... (6 numbers + 6 letters)
};

type NodeType = { id: string; label: string; x: number; y: number; order: number };
type LineType = { x1: number; y1: number; x2: number; y2: number; correct: boolean };
type GameMode = 'basic' | 'advanced';

// Coordinates stored as percentages (0–100) of the canvas dimensions
function generateNodes(mode: GameMode): NodeType[] {
  const count = mode === 'basic' ? GAME_CONFIG.nodeCountBasic : GAME_CONFIG.nodeCountAdvanced;
  const nodes: NodeType[] = [];
  // padding in % so nodes don't hug the edges
  const pad = 10;
  const placed: { x: number; y: number }[] = [];
  const minDist = mode === 'basic' ? 14 : 16; // % distance between nodes

  const labels =
    mode === 'basic'
      ? Array.from({ length: count }, (_, i) => String(i + 1))
      : Array.from({ length: count }, (_, i) => {
          const pair = Math.floor(i / 2);
          return i % 2 === 0 ? String(pair + 1) : String.fromCharCode(65 + pair);
        });

  for (let i = 0; i < count; i++) {
    let x: number, y: number, attempts = 0;
    do {
      x = pad + Math.random() * (100 - pad * 2);
      y = pad + Math.random() * (100 - pad * 2);
      attempts++;
    } while (
      attempts < 200 &&
      placed.some(p => Math.hypot(p.x - x, p.y - y) < minDist)
    );
    placed.push({ x, y });
    nodes.push({ id: `node-${i}`, label: labels[i], x, y, order: i });
  }

  return nodes;
}

export const TrailMaking: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();

  const [gamePhase, setGamePhase] = useState<'instructions' | 'playing' | 'finished'>('instructions');
  const [mode, setMode] = useState<GameMode>('basic');
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [lines, setLines] = useState<LineType[]>([]);
  const [nextOrder, setNextOrder] = useState(0);
  const [errors, setErrors] = useState(0);
  const [corrections, setCorrections] = useState(0);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [lastCorrectNode, setLastCorrectNode] = useState<NodeType | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);
  const [basicTime, setBasicTime] = useState<number | null>(null);

  // Refs for callback access
  const nextOrderRef = useRef(nextOrder);
  const nodesRef = useRef(nodes);
  const errorsRef = useRef(errors);
  const correctionsRef = useRef(corrections);
  const lastCorrectNodeRef = useRef(lastCorrectNode);
  const completedNodesRef = useRef(completedNodes);

  useEffect(() => { nextOrderRef.current = nextOrder; }, [nextOrder]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { errorsRef.current = errors; }, [errors]);
  useEffect(() => { correctionsRef.current = corrections; }, [corrections]);
  useEffect(() => { lastCorrectNodeRef.current = lastCorrectNode; }, [lastCorrectNode]);
  useEffect(() => { completedNodesRef.current = completedNodes; }, [completedNodes]);

  const handleTimeout = useCallback((): void => {
    const elapsed = roundStartTime ? (Date.now() - roundStartTime) / 1000 : GAME_CONFIG.timeLimitBasic;
    const timeLimit = mode === 'basic' ? GAME_CONFIG.timeLimitBasic : GAME_CONFIG.timeLimitAdvanced;

    gameState.addResult({
      correct: false,
      responseTime: timeLimit * 1000,
      response: null,
      mode,
      errors: errorsRef.current,
      corrections: correctionsRef.current,
      nodesCompleted: nextOrderRef.current,
      totalNodes: nodesRef.current.length,
      timeout: true,
      elapsed
    });

    if (mode === 'basic') {
      setBasicTime(timeLimit);
      startAdvancedRound();
    } else {
      finishGame(timeLimit);
    }
  }, [mode, roundStartTime]);

  const timer = useGameTimer(handleTimeout);

  const startGame = (): void => {
    gameState.resetGame();
    setGamePhase('playing');
    startBasicRound();
  };

  const startBasicRound = (): void => {
    const newNodes = generateNodes('basic');
    setMode('basic');
    setNodes(newNodes);
    setLines([]);
    setNextOrder(0);
    setErrors(0);
    setCorrections(0);
    setLastCorrectNode(null);
    setCompletedNodes(new Set());
    setRoundStartTime(Date.now());
    timer.startTimer(GAME_CONFIG.timeLimitBasic);
  };

  const startAdvancedRound = (): void => {
    const newNodes = generateNodes('advanced');
    setMode('advanced');
    setNodes(newNodes);
    setLines([]);
    setNextOrder(0);
    setErrors(0);
    setCorrections(0);
    setLastCorrectNode(null);
    setCompletedNodes(new Set());
    setRoundStartTime(Date.now());
    gameState.nextRound();
    timer.startTimer(GAME_CONFIG.timeLimitAdvanced);
  };

  const handleNodeClick = (node: NodeType): void => {
    if (completedNodesRef.current.has(node.id)) return;

    if (node.order === nextOrderRef.current) {
      // Correct node
      const newCompleted = new Set(completedNodesRef.current);
      newCompleted.add(node.id);
      setCompletedNodes(newCompleted);

      if (lastCorrectNodeRef.current) {
        setLines(prev => [
          ...prev,
          {
            x1: lastCorrectNodeRef.current!.x,
            y1: lastCorrectNodeRef.current!.y,
            x2: node.x,
            y2: node.y,
            correct: true
          }
        ]);
      }

      setLastCorrectNode(node);
      const newOrder = nextOrderRef.current + 1;
      setNextOrder(newOrder);

      // Check completion
      if (newOrder === nodesRef.current.length) {
        const elapsed = roundStartTime ? (Date.now() - roundStartTime) / 1000 : 0;
        timer.stopTimer();

        gameState.addResult({
          correct: true,
          responseTime: elapsed * 1000,
          response: null,
          mode,
          errors: errorsRef.current,
          corrections: correctionsRef.current,
          nodesCompleted: nodesRef.current.length,
          totalNodes: nodesRef.current.length,
          timeout: false,
          elapsed
        });

        if (mode === 'basic') {
          setBasicTime(elapsed);
          setTimeout(() => startAdvancedRound(), 1200);
        } else {
          setTimeout(() => finishGame(elapsed), 1200);
        }
      }
    } else {
      // Wrong node
      setErrors(prev => prev + 1);
      setErrorNodeId(node.id);
      setTimeout(() => setErrorNodeId(null), 600);

      // Spontaneous correction: if they click a node they already passed, count correction
      if (node.order < nextOrderRef.current) {
        setCorrections(prev => prev + 1);
      }
    }
  };

  const finishGame = (lastElapsed: number): void => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();

    const results = gameState.results;
    const basicResult = results[0];
    const advancedResult = results[1];

    const cognitiveSwitch =
      basicResult && advancedResult
        ? (advancedResult.elapsed || 0) - (basicResult.elapsed || 0)
        : null;

    const gameResults: GameResults = {
      gameType: 'trailmaking',
      summary: {
        totalAnswers: 2,
        correctAnswers: results.filter(r => r.correct).length,
        accuracy: results.filter(r => r.correct).length / 2,
        averageResponseTime:
          results.reduce((acc, r) => acc + (r.responseTime || 0), 0) / results.length || 0
      },
      detailedResults: results,
      cognitiveSwitch
    };

    onGameComplete(gameResults);
  };

  const currentTimeLimit = mode === 'basic' ? GAME_CONFIG.timeLimitBasic : GAME_CONFIG.timeLimitAdvanced;

  return (
    <GameContainer
      title="Trail Making"
      instructions={
        gamePhase === 'instructions'
          ? 'Conecta los elementos en orden lo más rápido posible. Primero solo números, luego alternando número y letra.'
          : null
      }
      showInstructions={gamePhase === 'instructions'}
    >
      {gamePhase === 'instructions' && (
        <div className="trailmaking-start">
          <div className="trail-info-cards">
            <div className="trail-info-card">
              <span className="trail-info-icon">1️⃣</span>
              <span className="trail-info-label">Nivel básico</span>
              <span className="trail-info-desc">Conecta números del 1 al {GAME_CONFIG.nodeCountBasic} en orden</span>
            </div>
            <div className="trail-info-card">
              <span className="trail-info-icon">🔀</span>
              <span className="trail-info-label">Nivel avanzado</span>
              <span className="trail-info-desc">Alterna número y letra: 1 → A → 2 → B → ...</span>
            </div>
          </div>
          <div className="trail-tip">
            <span>💡</span>
            <span>Toca los nodos en el orden correcto. ¡Sin errores y lo más rápido posible!</span>
          </div>
          <button className="trail-start-button" onClick={startGame}>
            Comenzar
          </button>
        </div>
      )}

      {gamePhase === 'playing' && (
        <div className="trailmaking-game">
          <div className="trail-header">
            <div className="trail-mode-badge" data-mode={mode}>
              {mode === 'basic' ? '🔢 Nivel Básico' : '🔀 Nivel Avanzado'}
            </div>
            <Timer
              timeLeft={timer.timeLeft}
              total={currentTimeLimit}
              label="Tiempo"
            />
            <div className="trail-stats">
              <span className="trail-stat">
                <span className="trail-stat-icon">❌</span>
                <span className="trail-stat-value">{errors}</span>
              </span>
              <span className="trail-stat">
                <span className="trail-stat-icon">🔄</span>
                <span className="trail-stat-value">{corrections}</span>
              </span>
            </div>
          </div>

          <div className="trail-canvas-wrapper">
            <svg className="trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              {lines.map((line, i) => (
                <line
                  key={i}
                  x1={line.x1} y1={line.y1}
                  x2={line.x2} y2={line.y2}
                  className="trail-line"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {nodes.map(node => (
              <button
                key={node.id}
                className={[
                  'trail-node',
                  completedNodes.has(node.id) ? 'completed' : '',
                  errorNodeId === node.id ? 'error' : ''
                ].join(' ')}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => handleNodeClick(node)}
              >
                {node.label}
              </button>
            ))}
          </div>

          <div className="trail-progress">
            <div
              className="trail-progress-bar"
              style={{ width: `${(nextOrder / nodes.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {gamePhase === 'finished' && (
        <div className="trailmaking-finished">
          <h2>¡Prueba completada!</h2>
          <p>Procesando resultados...</p>
        </div>
      )}
    </GameContainer>
  );
};