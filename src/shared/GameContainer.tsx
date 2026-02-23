import React from 'react';
import './GameContainer.css';

interface GameContainerProps {
  title?: string;
  instructions?: string | null;
  children: React.ReactNode;
  showInstructions?: boolean;
}

export const GameContainer: React.FC<GameContainerProps> = ({ 
  title, 
  instructions, 
  children,
  showInstructions = true 
}) => {
  return (
    <div className="game-container">
      {title && (
        <div className="game-header">
          <h1 className="game-title">{title}</h1>
        </div>
      )}
      
      {showInstructions && instructions && (
        <div className="game-instructions">
          <p>{instructions}</p>
        </div>
      )}
      
      <div className="game-content">
        {children}
      </div>
    </div>
  );
};