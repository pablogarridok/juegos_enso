import React, { useState, useEffect, useRef } from 'react';
import './WordsBox.css';

const TOTAL_ROUNDS = 10;
const TIME_PER_ROUND = 30;

const PALABRAS = {
  animales: ['perro', 'gato', 'león', 'tigre', 'oso', 'lobo', 'zorro', 'águila', 'mono', 'elefante'],
  colores: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco', 'rosa', 'morado', 'marrón', 'gris'],
  comida: ['manzana', 'pan', 'queso', 'leche', 'patata', 'arroz', 'pasta', 'carne', 'hamburguesa', 'huevo'],
  objetos: ['mesa', 'silla', 'libro', 'lápiz', 'papel', 'ordenador', 'teléfono', 'reloj', 'espejo', 'lámpara']
};

export const WordsBox = ({ onGameComplete }) => {
  const [fase, setFase] = useState('instrucciones');
  const [ronda, setRonda] = useState(0);
  const [palabrasMostradas, setPalabrasMostradas] = useState([]);
  const [categoriaActual, setCategoriaActual] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [tiempo, setTiempo] = useState(TIME_PER_ROUND);
  const [resultados, setResultados] = useState([]);

  // Refs para que guardarResultado siempre lea valores actuales
  const timerRef = useRef(null);
  const rondaRef = useRef(0);
  const palabrasRef = useRef([]);
  const categoriaRef = useRef('');
  const seleccionadasRef = useRef([]);

  // Sincronizamos los refs con el estado
  useEffect(() => { rondaRef.current = ronda; }, [ronda]);
  useEffect(() => { palabrasRef.current = palabrasMostradas; }, [palabrasMostradas]);
  useEffect(() => { categoriaRef.current = categoriaActual; }, [categoriaActual]);
  useEffect(() => { seleccionadasRef.current = seleccionadas; }, [seleccionadas]);

  useEffect(() => {
    if (fase !== 'jugando') return;

    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          guardarResultado(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [ronda, fase]);

  const nuevaRonda = () => {
    const categorias = Object.keys(PALABRAS);
    const categoria = categorias[Math.floor(Math.random() * categorias.length)];

    const correctas = [...PALABRAS[categoria]]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const distractores = [];
    const otrasCategorias = categorias.filter(c => c !== categoria);
    while (distractores.length < 3) {
      const cat = otrasCategorias[Math.floor(Math.random() * otrasCategorias.length)];
      const palabra = PALABRAS[cat][Math.floor(Math.random() * PALABRAS[cat].length)];
      if (!distractores.includes(palabra)) distractores.push(palabra);
    }

    const todas = [...correctas, ...distractores].sort(() => Math.random() - 0.5);

    setCategoriaActual(categoria);
    setPalabrasMostradas(todas);
    setSeleccionadas([]);
    setTiempo(TIME_PER_ROUND);
  };

  const empezarJuego = () => {
    setRonda(0);
    setResultados([]);
    setFase('jugando');
    nuevaRonda();
  };

  const togglePalabra = (palabra) => {
    if (seleccionadas.includes(palabra)) {
      setSeleccionadas(seleccionadas.filter(p => p !== palabra));
    } else {
      setSeleccionadas([...seleccionadas, palabra]);
    }
  };

  const guardarResultado = (timeout = false) => {
    clearInterval(timerRef.current);

    const rondaActual = rondaRef.current;
    const palabras = palabrasRef.current;
    const categoria = categoriaRef.current;
    const selecs = seleccionadasRef.current;

    const correctas = palabras.filter(p => PALABRAS[categoria]?.includes(p));
    const aciertos = selecs.filter(p => correctas.includes(p)).length;
    const fallos = selecs.filter(p => !correctas.includes(p)).length;
    const esCorrecta = aciertos === 3 && fallos === 0 && !timeout;

    const nuevoResultado = {
      ronda: rondaActual + 1,
      categoria,
      seleccionadas: selecs,
      correctas,
      correcto: esCorrecta,
      timeout
    };

    setResultados(prev => {
      const nuevosResultados = [...prev, nuevoResultado];

      if (rondaActual + 1 >= TOTAL_ROUNDS) {
        setFase('fin');

        setTimeout(() => {
          onGameComplete({
            gameType: 'wordsbox',
            summary: {
              totalAnswers: nuevosResultados.length,
              correctAnswers: nuevosResultados.filter(r => r.correcto).length,
              accuracy: Math.round((nuevosResultados.filter(r => r.correcto).length / nuevosResultados.length) * 100),
              averageResponseTime: 0
            },
            detailedResults: nuevosResultados
          });
        }, 0);

      } else {
        setRonda(r => r + 1);
        setTimeout(() => nuevaRonda(), 500);
      }

      return nuevosResultados;
    });
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (fase === 'instrucciones') {
    return (
      <div className="wordsbox-start">
        <h2>WordsBox</h2>
        <p>Selecciona las palabras que pertenezcan a la categoría indicada.</p>
        <div className="game-info">
          <div className="info-card">
            <span className="info-icon">🎯</span>
            <span className="info-label">Total de rondas</span>
            <span className="info-value">{TOTAL_ROUNDS}</span>
          </div>
          <div className="info-card">
            <span className="info-icon">⏱️</span>
            <span className="info-label">Tiempo por ronda</span>
            <span className="info-value">{TIME_PER_ROUND}s</span>
          </div>
        </div>
        <button className="start-game-button" onClick={empezarJuego}>
          Comenzar Juego
        </button>
      </div>
    );
  }

  if (fase === 'fin') {
    return (
      <div className="wordsbox-finished">
        <h2>¡Juego completado!</h2>
        <p>Procesando resultados...</p>
      </div>
    );
  }

  return (
    <div className="wordsbox-game">
      <div className="game-header-bar">
        <div className="round-indicator">
          Ronda {ronda + 1} / {TOTAL_ROUNDS}
        </div>
        <div className="round-indicator">
          ⏱ {tiempo}s
        </div>
      </div>

      <div className="rule-display">
        <span className="rule-label">Selecciona:</span>
        <span className="rule-category">{categoriaActual}</span>
      </div>

      <div className="words-grid">
        {palabrasMostradas.map((palabra, i) => (
          <button
            key={i}
            className={`word-card ${seleccionadas.includes(palabra) ? 'selected' : ''}`}
            onClick={() => togglePalabra(palabra)}
          >
            <span>{palabra}</span>
          </button>
        ))}
      </div>

      <div className="game-controls">
        <button
          className="submit-button"
          onClick={() => guardarResultado()}
          disabled={seleccionadas.length === 0}
        >
          Enviar ({seleccionadas.length} seleccionadas)
        </button>
      </div>
    </div>
  );
};