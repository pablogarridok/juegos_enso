import React from 'react';
import './Timer.css';

interface TimerProps {
  timeLeft: number;
  total: number;
  label?: string;
}

export const Timer: React.FC<TimerProps> = ({ 
  timeLeft, 
  total, 
  label = "Tiempo restante" 
}) => {
  const percentage = total > 0 ? (timeLeft / total) * 100 : 100;
  
  const getColor = (): string => {
    if (percentage > 50) return 'var(--success)';
    if (percentage > 20) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="timer-container">
      <div className="timer-label">{label}</div>
      <div className="timer-display" style={{ color: getColor() }}>
        <span className="timer-icon">⏱️</span>
        <span className="timer-value">{timeLeft}s</span>
      </div>
      <div className="timer-progress-bar">
        <div 
          className="timer-progress-fill"
          style={{ 
            width: `${percentage}%`,
            background: getColor()
          }}
        />
      </div>
    </div>
  );
};