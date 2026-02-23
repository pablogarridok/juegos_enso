import { useState } from 'react';
import './app.css';
import type { GameConfig, GameResults, ViewType, GamesCatalog } from './types';

interface BlockStat {
  block: number;
  hits: number;
  omissions: number;
  avgRT: number | null;
}

// Imports de los juegos
import { WordsBox } from './games/language/WordsBox/WordsBox';
import { GoNoGo } from './games/attention/GoNoGo/Gonogo';
import { SustainedAttention } from './games/attention/SustainedAttention/SustainedAttention';
import { TowerOfHanoi } from './games/planning/TowerOfHanoi/TowerOfHanoi';
import { ReverseSequence } from './games/memory/ReverseSequence/ReverseSequence';

// Catálogo de juegos organizados por categoría
const GAMES_CATALOG: GamesCatalog = {
  language: [
   
    { 
      id: 'wordsbox', 
      name: 'WordsBox', 
      component: WordsBox,
      description: 'Selecciona palabras según la regla',
      icon: '📚'
    }
  ],
  attention: [
    { 
      id: 'gonogo', 
      name: 'Go/No-Go', 
      component: GoNoGo,
      description: 'Control inhibitorio',
      icon: '🎯'
    },
    {
      id: 'sustained-attention',
      name: 'Atención Sostenida',
      component: SustainedAttention,
      description: 'Detecta la letra objetivo durante 3 minutos',
      icon: '🔍'
    }
  ],
  planning: [
    {
      id: 'tower-of-hanoi',
      name: 'Torre de Hanoi',
      component: TowerOfHanoi,
      description: 'Evalúa planificación y control ejecutivo',
      icon: '🗼'
    }
  ],
  memory: [
    {
      id: 'reverse-sequence',
      name: 'Reverse Sequence Memory',
      component: ReverseSequence,
      description: 'Evalúa memoria de trabajo reproduciendo secuencias en orden inverso',
      icon: '🔄'
    }
  ]
};

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('selection');
  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
  const [gameResults, setGameResults] = useState<GameResults | null>(null);

  const handleGameSelect = (game: GameConfig): void => {
    setSelectedGame(game);
    setCurrentView('playing');
  };

  const handleGameComplete = (results: GameResults): void => {
    console.log('Resultados del juego:', results);
    setGameResults(results);
    setCurrentView('results');
    
    // Aquí iría la llamada al backend para guardar resultados
    // sendResultsToBackend(results);
  };

  const handleBackToSelection = (): void => {
    setCurrentView('selection');
    setSelectedGame(null);
    setGameResults(null);
  };

  return (
    <div className="app">
      {/* VISTA: Selección de juegos */}
      {currentView === 'selection' && (
        <div className="game-selection">
          <header className="app-header">
            <h1>ensō - Juegos Cognitivos</h1>
            <p>Selecciona un juego para comenzar</p>
          </header>

          <div className="categories-container">
            {Object.entries(GAMES_CATALOG).map(([category, games]) => (
              <div key={category} className="category-section">
                <h2 className="category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h2>
                
                <div className="games-grid">
                  {games.map(game => (
                    <button
                      key={game.id}
                      className="game-card"
                      onClick={() => handleGameSelect(game)}
                    >
                      <span className="game-icon">{game.icon}</span>
                      <h3>{game.name}</h3>
                      <p>{game.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA: Jugando */}
      {currentView === 'playing' && selectedGame && (
        <div className="game-playing">
          <button 
            className="back-button"
            onClick={handleBackToSelection}
          >
            ← Volver
          </button>
          
          <selectedGame.component 
            onGameComplete={handleGameComplete}
          />
        </div>
      )}

      {/* VISTA: Resultados */}
      {currentView === 'results' && gameResults && (
        <div className="results-view">
          <h1>¡Juego completado!</h1>
          
          <div className="results-summary">
            <div className="result-card">
              <span className="result-label">Respuestas totales</span>
              <span className="result-value">
                {gameResults.summary.totalAnswers}
              </span>
            </div>
            
            <div className="result-card">
              <span className="result-label">Respuestas correctas</span>
              <span className="result-value success">
                {gameResults.summary.correctAnswers}
              </span>
            </div>
            
            <div className="result-card">
              <span className="result-label">Precisión</span>
              <span className="result-value">
                {gameResults.summary.accuracy.toFixed(1)}%
              </span>
            </div>
            
            <div className="result-card">
              <span className="result-label">Tiempo promedio</span>
              <span className="result-value">
                {gameResults.summary.averageResponseTime.toFixed(0)}ms
              </span>
            </div>

            {gameResults.summary.omissionErrors !== undefined && (
              <div className="result-card">
                <span className="result-label">Omisiones</span>
                <span className="result-value">
                  {gameResults.summary.omissionErrors}
                </span>
              </div>
            )}

            {gameResults.summary.commissionErrors !== undefined && (
              <div className="result-card">
                <span className="result-label">Falsas alarmas</span>
                <span className="result-value">
                  {gameResults.summary.commissionErrors}
                </span>
              </div>
            )}

            {gameResults.summary.responseVariability !== undefined && (
              <div className="result-card">
                <span className="result-label">Variabilidad TR</span>
                <span className="result-value">
                  {gameResults.summary.responseVariability.toFixed(0)}ms
                </span>
              </div>
            )}
          </div>

          {gameResults.summary.blockStats && gameResults.summary.blockStats.length > 0 && (
            <div className="block-stats">
              <h3>Rendimiento por bloques</h3>
              <div className="block-stats-grid">
                {(gameResults.summary.blockStats as BlockStat[]).map((b: BlockStat) => (
                  <div key={b.block} className="block-card">
                    <span className="block-label">Bloque {b.block}</span>
                    <span className="block-hits">✓ {b.hits}</span>
                    <span className="block-omissions">✗ {b.omissions}</span>
                    {b.avgRT !== null && (
                      <span className="block-rt">{b.avgRT.toFixed(0)}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            className="primary-button"
            onClick={handleBackToSelection}
          >
            Volver a juegos
          </button>
        </div>
      )}
    </div>
  );
}

export default App;