import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import LevelBuilder from './components/LevelBuilder';
import { Piece, LevelData } from './types';
import { LEVELS, COLORS, START_OFFSET } from './constants';
import { normalizePiece } from './utils/geometry';
import { getGeminiHint } from './services/geminiService';
import { X, PlayCircle, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [levelIndex, setLevelIndex] = useState(0);
  
  // Combine builtin and custom levels
  const allLevels = [...LEVELS, ...customLevels];
  const currentLevel = allLevels[levelIndex];

  // Game State
  const [pieces, setPieces] = useState<Piece[]>([]);
  
  // History State
  const [history, setHistory] = useState<Piece[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [hint, setHint] = useState<string | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [isLevelMenuOpen, setIsLevelMenuOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // Initialize Level
  useEffect(() => {
    if (currentLevel) {
      loadLevel(currentLevel);
    }
  }, [currentLevel]);

  const loadLevel = (level: LevelData) => {
    const { normalized } = normalizePiece(level.initialShape);
    
    // Use the level's defined start offset if it exists (for custom levels), otherwise use default
    const startPos = level.startOffset || START_OFFSET;

    // Create initial piece
    const initialPiece: Piece = {
      id: 'root-piece',
      cells: normalized,
      position: startPos,
      rotation: 0,
      isFlipped: false,
      color: COLORS[levelIndex % COLORS.length],
    };

    const initialPieces = [initialPiece];
    setPieces(initialPieces);
    setHistory([initialPieces]);
    setHistoryIndex(0);
    setHint(null);
    setShowWinModal(false);
  };

  // Custom setter to manage history
  const handleSetPieces: React.Dispatch<React.SetStateAction<Piece[]>> = (action) => {
    let newPieces: Piece[];
    
    // Resolve the new state
    if (typeof action === 'function') {
      newPieces = action(pieces);
    } else {
      newPieces = action;
    }

    // If nothing changed effectively (reference check), do nothing
    if (newPieces === pieces) return;

    // Slice history to current point (removes future if we are in past)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPieces);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setPieces(newPieces);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPieces(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPieces(history[newIndex]);
    }
  };

  const handleWin = () => {
    if (!showWinModal) {
      setShowWinModal(true);
    }
  };

  const handleNextLevel = () => {
    if (levelIndex < allLevels.length - 1) {
      setLevelIndex(prev => prev + 1);
    } else {
      setIsGameComplete(true);
    }
    setShowWinModal(false);
  };

  const handleLevelSelect = (index: number) => {
    setLevelIndex(index);
    setIsLevelMenuOpen(false);
    setIsGameComplete(false);
    setShowWinModal(false);
  };

  const handleRestartGame = () => {
    setLevelIndex(0);
    setIsGameComplete(false);
    setShowWinModal(false);
  };

  const handleRequestHint = async () => {
    setHint("Thinking...");
    const hintText = await getGeminiHint(pieces, currentLevel.targetCells);
    setHint(hintText);
    
    setTimeout(() => setHint(null), 10000);
  };

  const handleSaveCustomLevel = (newLevel: LevelData) => {
    setCustomLevels(prev => [...prev, newLevel]);
    setIsBuilderOpen(false);
    // Switch to the new level immediately
    setLevelIndex(LEVELS.length + customLevels.length); 
    setIsLevelMenuOpen(false);
  };

  if (isBuilderOpen) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-white font-sans relative">
        <LevelBuilder 
          onSave={handleSaveCustomLevel} 
          onCancel={() => setIsBuilderOpen(false)} 
        />
      </div>
    );
  }

  if (isGameComplete) {
     return (
        <div className="h-screen w-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
             <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-yellow-500 max-w-sm w-full text-center">
                <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/50">
                   <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Grandmaster!</h1>
                <p className="text-slate-300 mb-8">You have sliced and solved every puzzle.</p>
                <button 
                  onClick={handleRestartGame}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95"
                >
                  Play Again
                </button>
             </div>
        </div>
     );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-white font-sans relative">
      <GameCanvas 
        pieces={pieces}
        setPieces={handleSetPieces}
        targetCells={currentLevel.targetCells}
        targetOffset={currentLevel.targetOffset}
        onWin={handleWin}
        onRequestHint={handleRequestHint}
        hint={hint}
        resetLevel={() => loadLevel(currentLevel)}
        onOpenLevelSelect={() => setIsLevelMenuOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* LEVEL LADDER MENU */}
      {isLevelMenuOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">Level Ladder</h2>
            <button 
              onClick={() => setIsLevelMenuOpen(false)} 
              className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-8">
            <button 
              onClick={() => { setIsBuilderOpen(true); setIsLevelMenuOpen(false); }}
              className="w-full p-4 rounded-xl flex items-center justify-center gap-3 border-2 border-dashed border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-900 transition-all group"
            >
              <Plus size={24} />
              <span className="font-bold">Create New Level</span>
            </button>

            {allLevels.map((level, idx) => {
              const isActive = idx === levelIndex;
              const isCustom = idx >= LEVELS.length;
              return (
                <button
                  key={level.id}
                  onClick={() => handleLevelSelect(idx)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between border-2 transition-all group ${
                    isActive 
                      ? 'bg-blue-600/20 border-blue-500 shadow-blue-500/20 shadow-lg' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <span className={`block text-xs font-bold uppercase tracking-wider ${isActive ? 'text-blue-300' : 'text-slate-500'}`}>
                          {isCustom ? 'Custom Level' : `Level ${idx + 1}`}
                        </span>
                        <span className={`text-lg font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{level.name}</span>
                      </div>
                   </div>
                   {isActive && <PlayCircle className="text-blue-400" size={24} fill="currentColor" color="white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-green-500 max-w-sm w-full text-center transform scale-100 animate-bounce-slight">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/50">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Solved!</h2>
            <p className="text-green-400 font-bold mb-1 uppercase tracking-widest text-xs">{currentLevel.name}</p>
            <p className="text-slate-300 mb-6">Excellent spatial reasoning.</p>
            
            <button 
              onClick={handleNextLevel}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              {levelIndex < allLevels.length - 1 ? 'Next Level' : 'Finish'} 
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;