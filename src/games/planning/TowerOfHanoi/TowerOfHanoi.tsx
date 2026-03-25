import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import './TowerOfHanoi.css';

const NUM_DISCOS = 4;
const MIN_MOVIMIENTOS = 15;
const TIEMPO_TOTAL = 180;

const COLORES = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export const TowerOfHanoi = ({ onGameComplete }) => {
  const [fase, setFase] = useState('instrucciones');
  const [torres, setTorres] = useState([[], [], []]);
  const [discos, setDiscos] = useState([]);
  const [discoSeleccionado, setDiscoSeleccionado] = useState(null);
  const [historialMovimientos, setHistorialMovimientos] = useState([]);
  const [reintentos, setReintentos] = useState(0);
  const [animando, setAnimando] = useState(false);
  const [tiempo, setTiempo] = useState(TIEMPO_TOTAL);

  const contenedorRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);

  // Refs para evitar closures en el timer
  const torreRef = useRef([[], [], []]);
  const discosRef = useRef([]);
  const historialRef = useRef([]);
  const reintentosRef = useRef(0);
  const discoSeleccionadoRef = useRef(null);

  useEffect(() => { torreRef.current = torres; }, [torres]);
  useEffect(() => { discosRef.current = discos; }, [discos]);
  useEffect(() => { historialRef.current = historialMovimientos; }, [historialMovimientos]);
  useEffect(() => { reintentosRef.current = reintentos; }, [reintentos]);
  useEffect(() => { discoSeleccionadoRef.current = discoSeleccionado; }, [discoSeleccionado]);

  // Timer
  useEffect(() => {
    if (fase !== 'jugando') return;

    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          terminarJuego(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [fase]);

  // Three.js
  useEffect(() => {
    if (!contenedorRef.current || fase !== 'jugando') return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, contenedorRef.current.clientWidth / contenedorRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(contenedorRef.current.clientWidth, contenedorRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    contenedorRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const luz = new THREE.DirectionalLight(0xffffff, 0.8);
    luz.position.set(5, 10, 5);
    luz.castShadow = true;
    scene.add(luz);
    const puntoLuz = new THREE.PointLight(0x6366f1, 0.5);
    puntoLuz.position.set(0, 5, 0);
    scene.add(puntoLuz);

    // Base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.3, 4),
      new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.3, roughness: 0.7 })
    );
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    // Torres (palos)
    [-4, 0, 4].forEach(x => {
      const palo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 5, 16),
        new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.6, roughness: 0.4 })
      );
      palo.position.set(x, 2.5, 0);
      palo.castShadow = true;
      scene.add(palo);
    });

    // Discos
    const discosIniciales = [];
    const torresIniciales = [[], [], []];

    for (let i = 0; i < NUM_DISCOS; i++) {
      const tamaño = (NUM_DISCOS - i) * 0.5 + 0.5;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(tamaño, tamaño, 0.3, 32),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORES[i % COLORES.length]), metalness: 0.3, roughness: 0.5 })
      );
      mesh.position.set(-4, 0.15 + i * 0.3, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      discosIniciales.push({ id: i, tamaño, mesh, torre: 0 });
      torresIniciales[0].push(i);
    }

    setDiscos(discosIniciales);
    setTorres(torresIniciales);

    const animar = () => {
      animFrameRef.current = requestAnimationFrame(animar);
      renderer.render(scene, camera);
    };
    animar();

    const handleResize = () => {
      if (!contenedorRef.current) return;
      camera.aspect = contenedorRef.current.clientWidth / contenedorRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(contenedorRef.current.clientWidth, contenedorRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (contenedorRef.current && renderer.domElement) contenedorRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [fase]);

  const empezarJuego = () => {
    setFase('jugando');
    setHistorialMovimientos([]);
    setReintentos(0);
    setTiempo(TIEMPO_TOTAL);
  };

  const seleccionarTorre = (indiceTorre) => {
    if (animando) return;

    const torresActuales = torreRef.current;
    const discosActuales = discosRef.current;
    const seleccionado = discoSeleccionadoRef.current;

    if (seleccionado === null) {
      // Seleccionar disco superior de la torre
      if (torresActuales[indiceTorre].length === 0) return;
      const idDiscoSuperior = torresActuales[indiceTorre][torresActuales[indiceTorre].length - 1];
      const disco = discosActuales.find(d => d.id === idDiscoSuperior);
      if (disco) disco.mesh.position.y += 0.5;
      setDiscoSeleccionado(idDiscoSuperior);
    } else {
      const disco = discosActuales.find(d => d.id === seleccionado);
      if (!disco) return;

      const torreOrigen = disco.torre;

      // Clic en la misma torre: deseleccionar
      if (torreOrigen === indiceTorre) {
        disco.mesh.position.y -= 0.5;
        setDiscoSeleccionado(null);
        return;
      }

      // Comprobar si el movimiento es válido
      const torreDestino = torresActuales[indiceTorre];
      if (torreDestino.length > 0) {
        const discoArriba = discosActuales.find(d => d.id === torreDestino[torreDestino.length - 1]);
        if (discoArriba && disco.tamaño > discoArriba.tamaño) {
          // Movimiento inválido
          animarInvalido(disco);
          return;
        }
      }

      moverDisco(seleccionado, torreOrigen, indiceTorre);
    }
  };

  const moverDisco = (idDisco, desde, hasta) => {
    setAnimando(true);

    const disco = discosRef.current.find(d => d.id === idDisco);
    if (!disco) return;

    const posicionesX = [-4, 0, 4];
    const targetX = posicionesX[hasta];
    const targetY = 0.15 + torreRef.current[hasta].length * 0.3;
    const startPos = disco.mesh.position.clone();
    const duracion = 800;
    const inicio = Date.now();

    const animar = () => {
      const progreso = Math.min((Date.now() - inicio) / duracion, 1);

      if (progreso < 0.33) {
        disco.mesh.position.y = startPos.y + (5 - startPos.y) * (progreso / 0.33);
      } else if (progreso < 0.67) {
        const p = (progreso - 0.33) / 0.34;
        disco.mesh.position.x = startPos.x + (targetX - startPos.x) * p;
        disco.mesh.position.y = 5;
      } else {
        const p = (progreso - 0.67) / 0.33;
        disco.mesh.position.x = targetX;
        disco.mesh.position.y = 5 - (5 - targetY) * p;
      }

      if (progreso < 1) {
        requestAnimationFrame(animar);
      } else {
        disco.mesh.position.set(targetX, targetY, 0);
        disco.torre = hasta;

        const nuevasTorres = torreRef.current.map((torre, idx) => {
          if (idx === desde) return torre.filter(id => id !== idDisco);
          if (idx === hasta) return [...torre, idDisco];
          return torre;
        });

        setTorres(nuevasTorres);
        setDiscos(discosRef.current.map(d => d.id === idDisco ? { ...d, torre: hasta } : d));
        setDiscoSeleccionado(null);
        setAnimando(false);

        const nuevoMovimiento = { idDisco, desde, hasta, timestamp: Date.now() };
        setHistorialMovimientos(prev => {
          const nuevo = [...prev, nuevoMovimiento];
          historialRef.current = nuevo;

          if (nuevasTorres[2].length === NUM_DISCOS) {
            setTimeout(() => terminarJuego(true), 500);
          }

          return nuevo;
        });
      }
    };

    animar();
  };

  const animarInvalido = (disco) => {
    const yOriginal = disco.mesh.position.y;
    let sacudidas = 0;

    const sacudir = () => {
      if (sacudidas >= 6) {
        disco.mesh.position.y = yOriginal - 0.5;
        setDiscoSeleccionado(null);
        return;
      }
      disco.mesh.position.y = yOriginal + (sacudidas % 2 === 0 ? 0.1 : -0.1);
      sacudidas++;
      setTimeout(sacudir, 50);
    };

    sacudir();
    setReintentos(prev => prev + 1);
  };

  const reiniciarPuzzle = () => {
    if (animando) return;
    setReintentos(prev => prev + 1);

    discosRef.current.forEach((disco, i) => {
      disco.mesh.position.set(-4, 0.15 + i * 0.3, 0);
      disco.torre = 0;
    });

    const torresReset = [[], [], []];
    for (let i = 0; i < NUM_DISCOS; i++) torresReset[0].push(i);

    setTorres(torresReset);
    setDiscoSeleccionado(null);
    setHistorialMovimientos([]);
  };

  const terminarJuego = (completado) => {
    clearInterval(timerRef.current);
    setFase('fin');

    const totalMovimientos = historialRef.current.length;
    const eficiencia = totalMovimientos > 0 ? MIN_MOVIMIENTOS / totalMovimientos : 0;
    const reintentosFinales = reintentosRef.current;

    let estrategia = 'reactiva';
    if (eficiencia > 0.85) estrategia = 'óptima';
    else if (eficiencia > 0.6) estrategia = 'planificada';
    else if (reintentosFinales > 3) estrategia = 'ensayo y error';

    setTimeout(() => {
      onGameComplete({
        gameType: 'tower-of-hanoi',
        summary: {
          totalAnswers: totalMovimientos,
          correctAnswers: completado ? 1 : 0,
          accuracy: completado ? 100 : 0,
          averageResponseTime: 0,
          extraMoves: Math.max(0, totalMovimientos - MIN_MOVIMIENTOS),
          retries: reintentosFinales,
          minMoves: MIN_MOVIMIENTOS,
          efficiency: Math.round(eficiencia * 100),
          strategy: estrategia,
          completed: completado
        },
        detailedResults: historialRef.current.map((mov, idx) => ({
          trialNumber: idx + 1,
          response: `Disco ${mov.idDisco + 1}: ${mov.desde + 1}→${mov.hasta + 1}`,
          correct: true,
          responseTime: idx > 0 ? mov.timestamp - historialRef.current[idx - 1].timestamp : 0,
          timestamp: mov.timestamp
        }))
      });
    }, 0);
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (fase === 'instrucciones') {
    return (
      <div className="hanoi-start">
        <h2>Torre de Hanoi</h2>
        <p>Mueve todos los discos desde la torre de ORIGEN hasta la torre de DESTINO.</p>

        <div className="game-info">
          <div className="info-card">
            <span className="info-icon">🎯</span>
            <span className="info-label">Número de discos</span>
            <span className="info-value">{NUM_DISCOS}</span>
          </div>
          <div className="info-card">
            <span className="info-icon">📊</span>
            <span className="info-label">Movimientos mínimos</span>
            <span className="info-value">{MIN_MOVIMIENTOS}</span>
          </div>
          <div className="info-card">
            <span className="info-icon">⏱️</span>
            <span className="info-label">Tiempo límite</span>
            <span className="info-value">{TIEMPO_TOTAL / 60} min</span>
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

        <button className="start-game-button" onClick={empezarJuego}>
          Comenzar Juego
        </button>
      </div>
    );
  }

  if (fase === 'fin') {
    return (
      <div className="hanoi-start">
        <h2>¡Juego completado!</h2>
        <p>Procesando resultados...</p>
      </div>
    );
  }

  return (
    <div className="hanoi-game">
      <div className="game-header-bar">
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">Movimientos:</span>
            <span className="stat-value">{historialMovimientos.length}</span>
            <span className="stat-extra">(Mínimo: {MIN_MOVIMIENTOS}, Extra: {Math.max(0, historialMovimientos.length - MIN_MOVIMIENTOS)})</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Reintentos:</span>
            <span className="stat-value">{reintentos}</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tiempo:</span>
          <span className="stat-value">⏱ {tiempo}s</span>
        </div>
      </div>

      <div className="three-container" ref={contenedorRef}></div>

      <div className="tower-buttons">
        {['Origen', 'Auxiliar', 'Destino'].map((nombre, idx) => (
          <button
            key={idx}
            className={`tower-button ${discoSeleccionado !== null && discos.find(d => d.id === discoSeleccionado)?.torre === idx ? 'selected' : ''}`}
            onClick={() => seleccionarTorre(idx)}
            disabled={animando}
          >
            <div className="tower-label">{nombre}</div>
            <div className="tower-count">{torres[idx].length} disco{torres[idx].length !== 1 ? 's' : ''}</div>
          </button>
        ))}
      </div>

      <div className="game-controls">
        <button
          className="reset-button"
          onClick={reiniciarPuzzle}
          disabled={animando || historialMovimientos.length === 0}
        >
          🔄 Reiniciar Puzzle
        </button>
      </div>
    </div>
  );
};