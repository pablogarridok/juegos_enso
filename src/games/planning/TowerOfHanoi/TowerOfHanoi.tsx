import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameContainer } from '../../../shared/GameContainer';
import { Timer } from '../../../shared/Timer';
import { useGameState } from '../../../hooks/useGameState';
import { useGameTimer } from '../../../hooks/useGameTimer';
import type { GameProps, GameResults } from '../../../types';
import './TowerOfHanoi.css';

interface Disk {
  id: number;
  size: number;
  mesh: THREE.Mesh;
  tower: number;
}

interface Move {
  diskId: number;
  from: number;
  to: number;
  timestamp: number;
  moveNumber: number;
}

type GamePhase = 'instructions' | 'playing' | 'finished';

const GAME_CONFIG = {
  numberOfDisks: 4,
  minMoves: 15, 
  totalGameTime: 180 // 3 minutos
};

const COLORS = [
  '#ef4444', // rojo
  '#f59e0b', // naranja
  '#10b981', // verde
  '#3b82f6', // azul
  '#8b5cf6'  // morado
];

export const TowerOfHanoi: React.FC<GameProps> = ({ onGameComplete }) => {
  const gameState = useGameState();
  const timer = useGameTimer(() => handleGameTimeout());
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [disks, setDisks] = useState<Disk[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<number | null>(null);
  const [towers, setTowers] = useState<number[][]>([[], [], []]);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [retries, setRetries] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || gamePhase !== 'playing') return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x6366f1, 0.5);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const baseGeometry = new THREE.BoxGeometry(12, 0.3, 4);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2d3748,
      metalness: 0.3,
      roughness: 0.7
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    const towerPositions = [-4, 0, 4];
    towerPositions.forEach(x => {
      const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 5, 16);
      const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a5568,
        metalness: 0.6,
        roughness: 0.4
      });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, 2.5, 0);
      pole.castShadow = true;
      scene.add(pole);
    });

    const initialDisks: Disk[] = [];
    const initialTowers: number[][] = [[], [], []];
    
    for (let i = 0; i < GAME_CONFIG.numberOfDisks; i++) {
      const size = (GAME_CONFIG.numberOfDisks - i) * 0.5 + 0.5;
      const height = 0.3;
      
      const geometry = new THREE.CylinderGeometry(size, size, height, 32);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS[i % COLORS.length]),
        metalness: 0.3,
        roughness: 0.5
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(-4, 0.15 + i * height, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { diskId: i };
      
      scene.add(mesh);
      
      initialDisks.push({
        id: i,
        size: size,
        mesh: mesh,
        tower: 0
      });
      
      initialTowers[0].push(i);
    }
    
    setDisks(initialDisks);
    setTowers(initialTowers);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gamePhase]);

  const startGame = (): void => {
    setGamePhase('playing');
    gameState.resetGame();
    timer.startTimer(GAME_CONFIG.totalGameTime);
    setMoveHistory([]);
    setRetries(0);
  };

  const selectTower = (towerIndex: number): void => {
    if (isAnimating) return;

    // Si no hay disco seleccionado, intentar seleccionar de esta torre
    if (selectedDisk === null) {
      const towerDisks = towers[towerIndex];
      if (towerDisks.length > 0) {
        const topDiskId = towerDisks[towerDisks.length - 1];
        setSelectedDisk(topDiskId);
        
        // Animación visual de selección
        const disk = disks.find(d => d.id === topDiskId);
        if (disk) {
          disk.mesh.position.y += 0.5;
        }
      }
    } else {
      // Hay un disco seleccionado, intentar moverlo
      const disk = disks.find(d => d.id === selectedDisk);
      if (!disk) return;

      const fromTower = disk.tower;
      
      // No puede moverse a la misma torre
      if (fromTower === towerIndex) {
        // Deseleccionar
        disk.mesh.position.y -= 0.5;
        setSelectedDisk(null);
        return;
      }

      // Verificar si el movimiento es válido
      const targetTower = towers[towerIndex];
      if (targetTower.length > 0) {
        const topDiskId = targetTower[targetTower.length - 1];
        const topDisk = disks.find(d => d.id === topDiskId);
        
        if (topDisk && disk.size > topDisk.size) {
          // Movimiento inválido - disco más grande sobre uno más pequeño
          showInvalidMoveAnimation(disk);
          return;
        }
      }

      // Movimiento válido
      moveDisk(selectedDisk, fromTower, towerIndex);
    }
  };

  const moveDisk = (diskId: number, from: number, to: number): void => {
    setIsAnimating(true);
    
    const disk = disks.find(d => d.id === diskId);
    if (!disk) return;

    const towerPositions = [-4, 0, 4];
    const targetX = towerPositions[to];
    const targetY = 0.15 + towers[to].length * 0.3;

    // Animación del movimiento
    const startPos = disk.mesh.position.clone();
    const duration = 800;
    const startTime = Date.now();

    const animateMove = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Curva de animación suave
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (progress < 0.33) {
        // Subir
        disk.mesh.position.y = startPos.y + (5 - startPos.y) * (progress / 0.33);
      } else if (progress < 0.67) {
        // Mover horizontalmente
        const moveProgress = (progress - 0.33) / 0.34;
        disk.mesh.position.x = startPos.x + (targetX - startPos.x) * moveProgress;
        disk.mesh.position.y = 5;
      } else {
        // Bajar
        const descendProgress = (progress - 0.67) / 0.33;
        disk.mesh.position.x = targetX;
        disk.mesh.position.y = 5 - (5 - targetY) * descendProgress;
      }

      if (progress < 1) {
        requestAnimationFrame(animateMove);
      } else {
        // Finalizar movimiento
        disk.mesh.position.set(targetX, targetY, 0);
        disk.tower = to;
        
        // Actualizar estado
        const newTowers = towers.map((tower, idx) => {
          if (idx === from) {
            return tower.filter(id => id !== diskId);
          } else if (idx === to) {
            return [...tower, diskId];
          }
          return tower;
        });
        
        setTowers(newTowers);
        setDisks(disks.map(d => d.id === diskId ? { ...d, tower: to } : d));
        setSelectedDisk(null);
        setIsAnimating(false);

        // Registrar el movimiento
        const move: Move = {
          diskId,
          from,
          to,
          timestamp: Date.now(),
          moveNumber: moveHistory.length + 1
        };
        setMoveHistory([...moveHistory, move]);

        // Registrar en el estado del juego
        gameState.addResult({
          trialNumber: moveHistory.length + 1,
          response: `Disco ${diskId + 1}: Torre ${from + 1} → Torre ${to + 1}`,
          correct: true,
          responseTime: null,
          timestamp: Date.now()
        });

        // Verificar si el juego está completo
        if (newTowers[2].length === GAME_CONFIG.numberOfDisks) {
          setTimeout(() => finishGame(true), 500);
        }
      }
    };

    animateMove();
  };

  const showInvalidMoveAnimation = (disk: Disk): void => {
    // Animación de sacudida para movimiento inválido
    const originalY = disk.mesh.position.y;
    let shakes = 0;
    const maxShakes = 6;
    
    const shake = () => {
      if (shakes >= maxShakes) {
        disk.mesh.position.y = originalY - 0.5;
        setSelectedDisk(null);
        return;
      }
      
      disk.mesh.position.y = originalY + (shakes % 2 === 0 ? 0.1 : -0.1);
      shakes++;
      setTimeout(shake, 50);
    };
    
    shake();
    setRetries(prev => prev + 1);
  };

  const resetPuzzle = (): void => {
    if (isAnimating) return;
    
    setRetries(prev => prev + 1);
    
    // Resetear posiciones de los discos
    disks.forEach((disk, i) => {
      disk.mesh.position.set(-4, 0.15 + i * 0.3, 0);
      disk.tower = 0;
    });
    
    const initialTowers: number[][] = [[], [], []];
    for (let i = 0; i < GAME_CONFIG.numberOfDisks; i++) {
      initialTowers[0].push(i);
    }
    
    setTowers(initialTowers);
    setSelectedDisk(null);
    setMoveHistory([]);
  };

  const handleGameTimeout = (): void => {
    finishGame(false);
  };

  const finishGame = (completed: boolean): void => {
    gameState.finishGame();
    setGamePhase('finished');
    timer.stopTimer();

    const totalMoves = moveHistory.length;
    const extraMoves = Math.max(0, totalMoves - GAME_CONFIG.minMoves);
    const efficiency = GAME_CONFIG.minMoves / totalMoves;
    const timeUsed = timer.getElapsedTime();

    // Determinar estrategia basada en los movimientos
    let strategy = 'reactiva';
    if (efficiency > 0.85) {
      strategy = 'óptima';
    } else if (efficiency > 0.6) {
      strategy = 'planificada';
    } else if (retries > 3) {
      strategy = 'ensayo y error';
    }

    const gameResults: GameResults = {
      gameType: 'tower-of-hanoi',
      summary: {
        totalAnswers: totalMoves,
        correctAnswers: completed ? 1 : 0,
        accuracy: completed ? 100 : 0,
        averageResponseTime: timeUsed / totalMoves,
        extraMoves,
        retries,
        timeTotal: timeUsed,
        minMoves: GAME_CONFIG.minMoves,
        efficiency: Math.round(efficiency * 100),
        strategy,
        completed
      },
      detailedResults: moveHistory.map((move, idx) => ({
        trialNumber: idx + 1,
        response: `Disco ${move.diskId + 1}: ${move.from + 1}→${move.to + 1}`,
        correct: true,
        responseTime: idx > 0 ? move.timestamp - moveHistory[idx - 1].timestamp : 0,
        timestamp: move.timestamp
      }))
    };

    onGameComplete(gameResults);
  };

  const getTowerName = (index: number): string => {
    const names = ['Origen', 'Auxiliar', 'Destino'];
    return names[index];
  };

  return (
    <GameContainer
      title="Torre de Hanoi"
      instructions={gamePhase === 'instructions'
        ? `Mueve todos los discos desde la torre de ORIGEN hasta la torre de DESTINO siguiendo estas reglas:
           1. Solo puedes mover un disco a la vez
           2. Un disco más grande nunca puede estar sobre uno más pequeño
           3. Intenta hacerlo en el menor número de movimientos posible (mínimo: ${GAME_CONFIG.minMoves})`
        : null}
      showInstructions={gamePhase === 'instructions'}
    >
      {gamePhase === 'instructions' && (
        <div className="hanoi-start">
          <div className="game-info">
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Número de discos</span>
              <span className="info-value">{GAME_CONFIG.numberOfDisks}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">📊</span>
              <span className="info-label">Movimientos mínimos</span>
              <span className="info-value">{GAME_CONFIG.minMoves}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Tiempo límite</span>
              <span className="info-value">{GAME_CONFIG.totalGameTime / 60} min</span>
            </div>
          </div>

          <div className="rules-section">
            <h3>Reglas del juego:</h3>
            <ul>
              <li>✓ Haz clic en una torre para seleccionar el disco superior</li>
              <li>✓ Haz clic en otra torre para mover el disco ahí</li>
              <li>✗ No puedes colocar un disco grande sobre uno pequeño</li>
              <li>🎯 El objetivo es mover todos los discos a la torre de la derecha</li>
            </ul>
          </div>

          <button className="start-game-button" onClick={startGame}>
            Comenzar Juego
          </button>
        </div>
      )}

      {gamePhase === 'playing' && (
        <div className="hanoi-game">
          <div className="game-header-bar">
            <div className="game-stats">
              <div className="stat-item">
                <span className="stat-label">Movimientos:</span>
                <span className="stat-value">{moveHistory.length}</span>
                <span className="stat-extra">
                  (Mínimo: {GAME_CONFIG.minMoves}, Extra: {Math.max(0, moveHistory.length - GAME_CONFIG.minMoves)})
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Reintentos:</span>
                <span className="stat-value">{retries}</span>
              </div>
            </div>
            <Timer 
              timeLeft={timer.timeLeft} 
              total={timer.totalTime}
              label="Tiempo"
            />
          </div>

          <div className="three-container" ref={containerRef}></div>

          <div className="tower-buttons">
            {[0, 1, 2].map(idx => (
              <button
                key={idx}
                className={`tower-button ${selectedDisk !== null && disks.find(d => d.id === selectedDisk)?.tower === idx ? 'selected' : ''}`}
                onClick={() => selectTower(idx)}
                disabled={isAnimating}
              >
                <div className="tower-label">{getTowerName(idx)}</div>
                <div className="tower-count">{towers[idx].length} disco{towers[idx].length !== 1 ? 's' : ''}</div>
              </button>
            ))}
          </div>

          <div className="game-controls">
            <button 
              className="reset-button"
              onClick={resetPuzzle}
              disabled={isAnimating || moveHistory.length === 0}
            >
              🔄 Reiniciar Puzzle
            </button>
          </div>
        </div>
      )}
    </GameContainer>
  );
};