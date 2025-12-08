import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import LevelBuilder from './components/LevelBuilder';
import { Piece, LevelData } from './types';
import { ARENA_LEVELS, GYM_LEVELS, COLORS, START_OFFSET } from './constants';
import { normalizePiece } from './utils/geometry';
import { getGeminiHint } from './services/geminiService';
import { PlayCircle, Plus, Dumbbell, Swords } from 'lucide-react';

type AppMode = 'ARENA' | 'GYM';

interface GameplayState {
  levelIndex: number;
  pieces: Piece[];
  history: Piece[][];
  historyIndex: number;
  cutCount: number;
  drawnEdges: Set<string>;
  hint: string | null;
  hasShownStrugglePrompt: boolean;
}

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('ARENA');
  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [levelIndex, setLevelIndex] = useState(0);
  
  // Levels based on Mode
  const arenaLevels = ARENA_LEVELS;
  const gymLevels = [...GYM_LEVELS, ...customLevels];
  const activeLevels = appMode === 'ARENA' ? arenaLevels : gymLevels;
  const currentLevel = activeLevels[levelIndex] || activeLevels[0];
  
  // Editor mode detection
  const [isEditorMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'editor';
  });

  // Game State
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [drawnEdges, setDrawnEdges] = useState<Set<string>>(new Set());
  
  // History State
  const [history, setHistory] = useState<Piece[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Struggle Detection
  const [cutCount, setCutCount] = useState(0);
  const [hasShownStrugglePrompt, setHasShownStrugglePrompt] = useState(false);
  const [showStruggleModal, setShowStruggleModal] = useState(false);

  const [hint, setHint] = useState<string | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // Persistence Store
  const gameStateStore = useRef<{ [key in AppMode]?: GameplayState }>({});

  // Initialize Game on Mount
  useEffect(() => {
    loadLevel(arenaLevels[0], 0, true);
  }, []);

  const saveCurrentState = () => {
     gameStateStore.current[appMode] = {
        levelIndex,
        pieces,
        history,
        historyIndex,
        cutCount,
        drawnEdges,
        hint,
        hasShownStrugglePrompt,
     };
  };

  const handleSwitchMode = (targetMode: AppMode) => {
    if (targetMode === appMode) return;
    
    // 1. Save current state
    saveCurrentState();
    
    // 2. Switch mode variable
    setAppMode(targetMode);
    
    // 3. Restore or Init new state
    const saved = gameStateStore.current[targetMode];
    if (saved) {
       setLevelIndex(saved.levelIndex);
       setPieces(saved.pieces);
       setHistory(saved.history);
       setHistoryIndex(saved.historyIndex);
       setCutCount(saved.cutCount);
       setDrawnEdges(saved.drawnEdges);
       setHint(saved.hint);
       setHasShownStrugglePrompt(saved.hasShownStrugglePrompt);
       
       setShowStruggleModal(false);
       setShowWinModal(false);
    } else {
       // Init default for this mode
       const levels = targetMode === 'ARENA' ? arenaLevels : gymLevels; // Note: gymLevels needs to capture latest closure
       setLevelIndex(0);
       loadLevel(levels[0], 0, true);
    }
  };

  const loadLevel = (level: LevelData, levelIdx: number, resetStats: boolean = true) => {
    const { normalized } = normalizePiece(level.initialShape);
    
    const startPos = level.startOffset || START_OFFSET;

    const initialPiece: Piece = {
      id: 'root-piece',
      cells: normalized,
      position: startPos,
      rotation: 0,
      isFlipped: false,
      color: COLORS[(levelIdx + (appMode === 'GYM' ? 1 : 0)) % COLORS.length],
    };

    const initialPieces = [initialPiece];
    setPieces(initialPieces);
    setHistory([initialPieces]);
    setHistoryIndex(0);
    setHint(null);
    setShowWinModal(false);
    setDrawnEdges(new Set()); // Clear drawings on level load
    
    if (resetStats) {
      setCutCount(0);
      setHasShownStrugglePrompt(false);
      setShowStruggleModal(false);
    }
  };

  const handleCutAction = () => {
    const newCount = cutCount + 1;
    setCutCount(newCount);

    if (appMode === 'ARENA' && newCount > 5 && !hasShownStrugglePrompt) {
        setShowStruggleModal(true);
        setHasShownStrugglePrompt(true);
    }
  };

  const switchToGym = () => {
    setShowStruggleModal(false);
    handleSwitchMode('GYM');
  };

  const handleSetPieces: React.Dispatch<React.SetStateAction<Piece[]>> = (action) => {
    let newPieces: Piece[];
    if (typeof action === 'function') {
      newPieces = action(pieces);
    } else {
      newPieces = action;
    }

    if (newPieces === pieces) return;

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
    if (levelIndex < activeLevels.length - 1) {
      const newIndex = levelIndex + 1;
      setLevelIndex(newIndex);
      loadLevel(activeLevels[newIndex], newIndex, true);
    } else {
      setIsGameComplete(true);
    }
    setShowWinModal(false);
  };
  
  const handlePrevLevel = () => {
    if (levelIndex > 0) {
      const newIndex = levelIndex - 1;
      setLevelIndex(newIndex);
      loadLevel(activeLevels[newIndex], newIndex, true);
    }
  };

  const handleRestartGame = () => {
    setLevelIndex(0);
    setIsGameComplete(false);
    setShowWinModal(false);
    loadLevel(activeLevels[0], 0, true);
  };

  const handleRequestHint = async () => {
    setHint("Thinking...");
    const hintText = await getGeminiHint(pieces, currentLevel.targetCells);
    setHint(hintText);
    setTimeout(() => setHint(null), 10000);
  };

  const handleSaveCustomLevel = (newLevel: LevelData) => {
    const updatedCustomLevels = [...customLevels, newLevel];
    setCustomLevels(updatedCustomLevels);
    setIsBuilderOpen(false);
    
    // If we are currently in ARENA, save its state
    if (appMode === 'ARENA') {
      saveCurrentState();
    }
    
    // Switch to GYM and load the new level
    setAppMode('GYM');
    // Calculate new index (total gym levels - 1, since we just added one)
    const newIndex = GYM_LEVELS.length + updatedCustomLevels.length - 1;
    setLevelIndex(newIndex);
    
    // Note: We need to use the full list including the new one
    const allGymLevels = [...GYM_LEVELS, ...updatedCustomLevels];
    loadLevel(allGymLevels[newIndex], newIndex, true);
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
                   <Swords className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">
                    {appMode === 'ARENA' ? 'Arena Conquered!' : 'Gym Completed!'}
                </h1>
                <p className="text-slate-300 mb-8">
                    {appMode === 'ARENA' 
                        ? 'You have defeated the main challenge.' 
                        : 'You have mastered all practice techniques.'}
                </p>
                <div className="space-y-3">
                    <button 
                      onClick={handleRestartGame}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95"
                    >
                      Play Again
                    </button>
                    {appMode === 'GYM' && (
                        <button 
                            onClick={() => { 
                              // Reset Game Complete state, then switch
                              setIsGameComplete(false);
                              handleSwitchMode('ARENA');
                            }}
                            className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95"
                        >
                            Return to Arena
                        </button>
                    )}
                </div>
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
        resetLevel={() => loadLevel(currentLevel, levelIndex, false)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onCut={handleCutAction}
        
        // Lifted State
        drawnEdges={drawnEdges}
        setDrawnEdges={setDrawnEdges}
        
        // Navigation Props
        appMode={appMode}
        setAppMode={handleSwitchMode}
        levelIndex={levelIndex}
        totalLevels={activeLevels.length}
        onPrevLevel={handlePrevLevel}
        onNextLevel={handleNextLevel}
        
        // Editor Props
        isEditorMode={isEditorMode}
        onCreateLevel={() => setIsBuilderOpen(true)}
      />

      {/* STRUGGLE MODAL */}
      {showStruggleModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-blue-400 max-w-sm w-full text-center">
             <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
               <Dumbbell size={32} />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2">Tough Challenge?</h3>
             <p className="text-slate-300 mb-6">
               This level is designed to be hard! Would you like to warm up with some simpler practice puzzles in the Gym first?
             </p>
             <div className="flex flex-col gap-3">
               <button 
                 onClick={switchToGym}
                 className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition"
               >
                 Yes, take me to the Gym
               </button>
               <button 
                 onClick={() => setShowStruggleModal(false)}
                 className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition"
               >
                 No, I can do this
               </button>
             </div>
           </div>
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`bg-slate-800 p-8 rounded-2xl shadow-2xl border ${appMode === 'ARENA' ? 'border-rose-500' : 'border-green-500'} max-w-sm w-full text-center transform scale-100 animate-bounce-slight`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${appMode === 'ARENA' ? 'bg-rose-500 shadow-rose-500/50' : 'bg-green-500 shadow-green-500/50'}`}>
               {appMode === 'ARENA' ? <Swords className="text-white" size={32} /> : <Dumbbell className="text-white" size={32} />}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Solved!</h2>
            <p className={`${appMode === 'ARENA' ? 'text-rose-400' : 'text-green-400'} font-bold mb-1 uppercase tracking-widest text-xs`}>{currentLevel.name}</p>
            <p className="text-slate-300 mb-6">
                {appMode === 'ARENA' ? 'You have conquered the arena.' : 'Good practice!'}
            </p>
            
            <button 
              onClick={handleNextLevel}
              className={`w-full py-3 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${appMode === 'ARENA' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {levelIndex < activeLevels.length - 1 ? 'Next Level' : 'Finish'} 
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;