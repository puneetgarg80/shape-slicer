import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import LevelBuilder from './components/LevelBuilder';
import NameModal from './components/NameModal';
import { Piece, LevelData, ActionLogEntry, ActionType, UserSessionPayload } from './types';
import { LEVELS, COLORS, START_OFFSET } from './constants';
import { normalizePiece } from './utils/geometry';
import { getGeminiHint } from './services/geminiService';
import { PlayCircle, Plus, Dumbbell, Swords } from 'lucide-react';

interface GameplayState {
  levelIndex: number;
  pieces: Piece[];
  history: Piece[][];
  historyIndex: number;
  cutCount: number;
  drawnEdges: Set<string>;
  hint: string | null;
}

const App: React.FC = () => {
  // User Session State
  const [userName, setUserName] = useState<string | null>(null);
  const sessionId = useRef(`sess-${Date.now()}`);
  const actionLog = useRef<ActionLogEntry[]>([]);

  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [levelIndex, setLevelIndex] = useState(0);

  // Flattened Levels
  const activeLevels = [...LEVELS, ...customLevels];
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

  // Stats
  const [cutCount, setCutCount] = useState(0);

  const [hint, setHint] = useState<string | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // --- LOGGING SYSTEM ---

  const logAction = (type: ActionType, details?: any) => {
    const entry: ActionLogEntry = {
      timestamp: Date.now(),
      type,
      details
    };
    actionLog.current.push(entry);
  };

  // Sync to "Server" Interval
  useEffect(() => {
    if (!userName) return;

    const intervalId = setInterval(() => {
      if (actionLog.current.length > 0) {
        const payload: UserSessionPayload = {
          userName,
          sessionId: sessionId.current,
          actions: [...actionLog.current]
        };

        // MOCK SERVER SEND
        console.info(`[SERVER SYNC] Sending ${payload.actions.length} actions for user ${userName}...`);

        // Clear log after "send"
        actionLog.current = [];
      }
    }, 5000); // Send every 5 seconds

    return () => clearInterval(intervalId);
  }, [userName]);

  // --- GAME LOGIC ---

  // When name is set, start the game
  const handleNameSubmit = (name: string) => {
    setUserName(name);
    logAction('GAME_START', { userName: name });
    loadLevel(activeLevels[0], 0, true);
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
      color: COLORS[levelIdx % COLORS.length],
    };

    logAction('LEVEL_LOAD', { levelId: level.id, levelName: level.name });

    const initialPieces = [initialPiece];
    setPieces(initialPieces);
    setHistory([initialPieces]);
    setHistoryIndex(0);
    setHint(null);
    setShowWinModal(false);
    setDrawnEdges(new Set()); // Clear drawings on level load

    if (resetStats) {
      setCutCount(0);
    }
  };

  const handleCutAction = () => {
    setCutCount(prev => prev + 1);
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
      logAction('UNDO', { fromIndex: historyIndex, toIndex: historyIndex - 1 });
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPieces(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      logAction('REDO', { fromIndex: historyIndex, toIndex: historyIndex + 1 });
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPieces(history[newIndex]);
    }
  };

  const handleWin = () => {
    if (!showWinModal) {
      logAction('WIN', { levelId: currentLevel.id, cuts: cutCount });
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
    logAction('RESET_LEVEL', { type: 'full_game_restart' });
    setLevelIndex(0);
    setIsGameComplete(false);
    setShowWinModal(false);
    loadLevel(activeLevels[0], 0, true);
  };

  const handleRequestHint = async () => {
    logAction('GET_HINT', { levelId: currentLevel.id });
    setHint("Thinking...");
    const hintText = await getGeminiHint(pieces, currentLevel.targetCells);
    setHint(hintText);
    setTimeout(() => setHint(null), 10000);
  };

  const handleSaveCustomLevel = (newLevel: LevelData) => {
    const updatedCustomLevels = [...customLevels, newLevel];
    setCustomLevels(updatedCustomLevels);
    setIsBuilderOpen(false);

    // Jump to the newly created level
    // Recompute active levels with new one included
    const allLevels = [...LEVELS, ...updatedCustomLevels];
    const newIndex = allLevels.length - 1;

    setLevelIndex(newIndex);
    loadLevel(allLevels[newIndex], newIndex, true);
  };

  if (!userName) {
    return <NameModal onSubmit={handleNameSubmit} />;
  }

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
            Congratulations!
          </h1>
          <p className="text-slate-300 mb-8">
            You have mastered all the puzzles.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRestartGame}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95"
            >
              Play Again
            </button>
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
        resetLevel={() => {
          logAction('RESET_LEVEL', { levelId: currentLevel.id });
          loadLevel(currentLevel, levelIndex, false);
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onCut={handleCutAction}
        onLogAction={logAction}

        // Lifted State
        drawnEdges={drawnEdges}
        setDrawnEdges={setDrawnEdges}

        // Navigation Props
        levelIndex={levelIndex}
        totalLevels={activeLevels.length}
        onPrevLevel={handlePrevLevel}
        onNextLevel={handleNextLevel}

        // Editor Props
        isEditorMode={isEditorMode}
        onCreateLevel={() => setIsBuilderOpen(true)}
      />

      {/* WIN MODAL */}
      {showWinModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`bg-slate-800 p-8 rounded-2xl shadow-2xl border border-green-500 max-w-sm w-full text-center transform scale-100 animate-bounce-slight`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg bg-green-500 shadow-green-500/50`}>
              <Dumbbell className="text-white" size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Solved!</h2>
            <p className="text-green-400 font-bold mb-1 uppercase tracking-widest text-xs">{currentLevel.name}</p>
            <p className="text-slate-300 mb-6">
              Well done, {userName}!
            </p>

            <button
              onClick={handleNextLevel}
              className={`w-full py-3 text-white rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500`}
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