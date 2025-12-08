import React, { useRef, useState, useEffect } from 'react';
import { Piece, Cell, Coordinate, GameMode } from '../types';
import { getAbsoluteCells, performCut, pointsToEdges, interpolatePoints, checkSolution, checkShapeMatch, getEdgeAsKey, parseEdgeKey } from '../utils/geometry';
import { CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, DEFAULT_TARGET_OFFSET, COLORS } from '../constants';
import { Scissors, Move, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Sparkles, RefreshCw, Undo, Redo, PenTool, Eraser, Trash2, Info, X, Target, Swords, Dumbbell, ChevronLeft, ChevronRight, Plus, Check, Circle, Footprints } from 'lucide-react';
import UIWalkthrough, { TourStep } from './UIWalkthrough';

interface GameCanvasProps {
  pieces: Piece[];
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>;
  targetCells: Cell[];
  targetOffset?: Coordinate;
  onWin: () => void;
  onRequestHint: () => void;
  hint: string | null;
  resetLevel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCut?: () => void;
  // Lifted state
  drawnEdges: Set<string>;
  setDrawnEdges: React.Dispatch<React.SetStateAction<Set<string>>>;
  // UI Redesign props
  appMode: 'ARENA' | 'GYM';
  setAppMode: (mode: 'ARENA' | 'GYM') => void;
  levelIndex: number;
  totalLevels: number;
  onPrevLevel: () => void;
  onNextLevel: () => void;
  isEditorMode: boolean;
  onCreateLevel: () => void;
}

// Helper to calculate center of piece's bounding box in absolute grid coords
const getPieceCenter = (p: Piece): Coordinate => {
  const cells = getAbsoluteCells(p);
  if (cells.length === 0) return { x: 0, y: 0 };
  const xs = cells.map(c => c.x);
  const ys = cells.map(c => c.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
};

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Shape Slicer",
    content: "Your goal is to cut and rearrange the colored pieces to match the target shape.",
    targetId: undefined // Center
  },
  {
    title: "The Target",
    content: "This dotted outline shows the shape you need to form. You can build it anywhere on the grid!",
    targetId: "tour-target-shape",
    position: "top"
  },
  {
    title: "Track Your Progress",
    content: "Keep an eye on these indicators. They turn green when you meet a requirement (e.g., cutting into exactly 2 pieces).",
    targetId: "tour-objectives",
    position: "bottom"
  },
  {
    title: "Move Mode",
    content: "Select this tool to drag pieces around. Tap a piece to reveal options to Rotate or Flip it.",
    targetId: "tour-mode-move",
    position: "top"
  },
  {
    title: "Pen Mode",
    content: "Draw red lines along the grid to plan your cuts. A Scissors button will appear to confirm and slice the piece.",
    targetId: "tour-mode-pen",
    position: "top"
  },
  {
    title: "Eraser Mode",
    content: "Use this to remove any planned cut lines (red lines) if you change your mind.",
    targetId: "tour-mode-eraser",
    position: "top"
  },
  {
    title: "Need Help?",
    content: "If you get stuck, tap the Sparkles button for an AI-powered hint.",
    targetId: "tour-hint",
    position: "bottom"
  }
];

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  pieces, setPieces, targetCells, targetOffset, onWin, onRequestHint, hint, resetLevel,
  onUndo, onRedo, canUndo, canRedo, onCut,
  drawnEdges, setDrawnEdges,
  appMode, setAppMode, levelIndex, totalLevels, onPrevLevel, onNextLevel, isEditorMode, onCreateLevel
}) => {
  const [mode, setMode] = useState<GameMode>(GameMode.PEN);
  const [showRules, setShowRules] = useState(false);
  const [showTour, setShowTour] = useState(false);
  
  // Selection & Moving
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Coordinate | null>(null); // Pixel offset from top-left of piece
  const [dragPosition, setDragPosition] = useState<Coordinate | null>(null); // Current raw pixel position of top-left of piece

  // Cutting (Drawing) - Local transient state
  const [lastDrawGridPos, setLastDrawGridPos] = useState<Coordinate | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const finalTargetOffset = targetOffset || DEFAULT_TARGET_OFFSET;

  // Objective States
  const hasTwoPieces = pieces.length === 2;
  const hasMinCells = pieces.length > 0 && pieces.every(p => p.cells.length >= 3);
  const matchesTarget = checkShapeMatch(pieces, targetCells);

  // Check for first-time user and auto-start tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenWalkthrough');
    if (!hasSeenTour) {
      // Delay slightly to ensure UI is ready
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCloseTour = () => {
    setShowTour(false);
    localStorage.setItem('hasSeenWalkthrough', 'true');
  };

  // Reset local state on external reset
  const handleResetLevel = () => {
    // drawnEdges cleared by parent via resetLevel -> loadLevel
    setMode(GameMode.PEN);
    resetLevel();
  };

  // Helper: Get raw SVG coordinates and Grid Intersection coordinates
  const getPointerInfo = (e: React.PointerEvent | PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    
    const rawX = (e.clientX - CTM.e) / CTM.a;
    const rawY = (e.clientY - CTM.f) / CTM.d;

    // For grid intersection (nodes), we round to nearest integer
    const gridX = Math.round(rawX / CELL_SIZE);
    const gridY = Math.round(rawY / CELL_SIZE);

    return { rawX, rawY, gridX, gridY };
  };

  // --- INTERACTION HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);

    const { rawX, rawY, gridX, gridY } = getPointerInfo(e);

    if (mode === GameMode.MOVE) {
      // Hit detection
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        const absCells = getAbsoluteCells(p);
        
        const isHit = absCells.some(c => 
          rawX >= c.x * CELL_SIZE && rawX < (c.x + 1) * CELL_SIZE &&
          rawY >= c.y * CELL_SIZE && rawY < (c.y + 1) * CELL_SIZE
        );

        if (isHit) {
          setSelectedPieceId(p.id);
          const piecePixelX = p.position.x * CELL_SIZE;
          const piecePixelY = p.position.y * CELL_SIZE;
          setDragOffset({ x: rawX - piecePixelX, y: rawY - piecePixelY });
          setDragPosition({ x: piecePixelX, y: piecePixelY });

          // Bring to front
          const newPieces = [...pieces];
          newPieces.splice(i, 1);
          newPieces.push(p);
          setPieces(newPieces);
          return;
        }
      }
      setSelectedPieceId(null);
    } 
    else if (mode === GameMode.PEN || mode === GameMode.ERASER) {
      setIsDrawing(true);
      setLastDrawGridPos({ x: gridX, y: gridY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    if (mode === GameMode.MOVE && selectedPieceId && dragOffset) {
      const { rawX, rawY } = getPointerInfo(e);
      setDragPosition({
        x: rawX - dragOffset.x,
        y: rawY - dragOffset.y
      });
    }
    else if ((mode === GameMode.PEN || mode === GameMode.ERASER) && isDrawing && lastDrawGridPos) {
      const { gridX, gridY } = getPointerInfo(e);
      
      // If we moved to a new node
      if (gridX !== lastDrawGridPos.x || gridY !== lastDrawGridPos.y) {
        // Interpolate to catch fast movements
        const path = interpolatePoints(lastDrawGridPos, { x: gridX, y: gridY });
        
        // We need to include the start point to form the first edge
        const fullPath = [lastDrawGridPos, ...path];
        const edges = pointsToEdges(fullPath);

        setDrawnEdges(prev => {
          const next = new Set(prev);
          edges.forEach(edge => {
            const key = getEdgeAsKey(edge);
            if (mode === GameMode.PEN) {
              next.add(key);
            } else {
              next.delete(key);
            }
          });
          return next;
        });

        setLastDrawGridPos({ x: gridX, y: gridY });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).releasePointerCapture(e.pointerId);

    if (mode === GameMode.MOVE && selectedPieceId && dragPosition) {
      const newGridX = Math.round(dragPosition.x / CELL_SIZE);
      const newGridY = Math.round(dragPosition.y / CELL_SIZE);

      setPieces(prev => prev.map(p => {
        if (p.id === selectedPieceId) {
          return { ...p, position: { x: newGridX, y: newGridY } };
        }
        return p;
      }));

      setDragOffset(null);
      setDragPosition(null);

      const updatedPieces = pieces.map(p => p.id === selectedPieceId ? { ...p, position: { x: newGridX, y: newGridY } } : p);
      if (checkSolution(updatedPieces, targetCells)) {
        onWin();
      }

    } else if (mode === GameMode.PEN || mode === GameMode.ERASER) {
      setIsDrawing(false);
      setLastDrawGridPos(null);
    }
  };

  const executeCut = () => {
    if (drawnEdges.size === 0) return;

    const edges = Array.from(drawnEdges).map(parseEdgeKey);
    
    let newPiecesList = [...pieces];
    let cutOccurred = false;
    const piecesToRemove: string[] = [];
    const piecesToAdd: Piece[] = [];

    newPiecesList.forEach(p => {
      const split = performCut(p, edges);
      if (split.length > 1) {
         piecesToRemove.push(p.id);
         split.forEach((sp, idx) => {
            sp.color = COLORS[(COLORS.indexOf(p.color) + idx + 1) % COLORS.length];
         });
         piecesToAdd.push(...split);
         cutOccurred = true;
      }
    });

    if (cutOccurred) {
      newPiecesList = newPiecesList.filter(p => !piecesToRemove.includes(p.id));
      newPiecesList = [...newPiecesList, ...piecesToAdd];
      setPieces(newPiecesList);
      setMode(GameMode.MOVE);
      if (piecesToAdd.length > 0) setSelectedPieceId(piecesToAdd[piecesToAdd.length - 1].id);
      
      // Notify parent about the cut
      if (onCut) onCut();
    }
    
    // Clear drawing after attempt
    setDrawnEdges(new Set());
  };

  const clearDrawing = () => {
    setDrawnEdges(new Set());
  };

  const handleRotate = (dir: 1 | -1) => {
    if (!selectedPieceId) return;
    setPieces(prev => {
      const piece = prev.find(p => p.id === selectedPieceId);
      if (!piece) return prev;

      // Calculate shift to keep center in place
      const oldCenter = getPieceCenter(piece);
      const newRotation = (piece.rotation + (dir * 90) + 360) % 360;
      
      // Temp piece to find where center would move
      const tempPiece = { ...piece, rotation: newRotation };
      const newNaturalCenter = getPieceCenter(tempPiece);

      const dx = oldCenter.x - newNaturalCenter.x;
      const dy = oldCenter.y - newNaturalCenter.y;
      
      const offsetX = Math.round(dx);
      const offsetY = Math.round(dy);

      return prev.map(p => {
        if (p.id === selectedPieceId) {
          return {
            ...p,
            rotation: newRotation,
            position: {
              x: p.position.x + offsetX,
              y: p.position.y + offsetY
            }
          };
        }
        return p;
      });
    });
  };

  const handleFlipHorizontal = () => {
    if (!selectedPieceId) return;
    setPieces(prev => {
      const piece = prev.find(p => p.id === selectedPieceId);
      if (!piece) return prev;

      const oldCenter = getPieceCenter(piece);
      // Toggle flip state
      const tempPiece = { ...piece, isFlipped: !piece.isFlipped };
      const newNaturalCenter = getPieceCenter(tempPiece);

      const offsetX = Math.round(oldCenter.x - newNaturalCenter.x);
      const offsetY = Math.round(oldCenter.y - newNaturalCenter.y);

      return prev.map(p => {
        if (p.id === selectedPieceId) {
          return { 
            ...p, 
            isFlipped: !p.isFlipped, 
            position: { x: p.position.x + offsetX, y: p.position.y + offsetY } 
          };
        }
        return p;
      });
    });
  };

  const handleFlipVertical = () => {
    if (!selectedPieceId) return;
    setPieces(prev => {
      const piece = prev.find(p => p.id === selectedPieceId);
      if (!piece) return prev;

      const oldCenter = getPieceCenter(piece);
      
      // Vertical flip = Horizontal Flip + 180 degree rotation
      const newIsFlipped = !piece.isFlipped;
      const newRotation = (piece.rotation + 180) % 360;

      const tempPiece = { ...piece, isFlipped: newIsFlipped, rotation: newRotation };
      const newNaturalCenter = getPieceCenter(tempPiece);

      const offsetX = Math.round(oldCenter.x - newNaturalCenter.x);
      const offsetY = Math.round(oldCenter.y - newNaturalCenter.y);

      return prev.map(p => {
        if (p.id === selectedPieceId) {
          return { 
            ...p, 
            isFlipped: newIsFlipped, 
            rotation: newRotation,
            position: { x: p.position.x + offsetX, y: p.position.y + offsetY } 
          };
        }
        return p;
      });
    });
  };

  const startTour = () => {
    setShowRules(false);
    setShowTour(true);
  };

  return (
    <>
    <UIWalkthrough 
      isOpen={showTour} 
      onClose={handleCloseTour} 
      steps={TOUR_STEPS} 
    />
    
    <div className="flex flex-col h-full w-full max-w-md mx-auto relative bg-puzzle-bg overflow-hidden touch-none select-none">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col bg-slate-900/80 backdrop-blur border-b border-slate-700 z-10">
        <div className="flex justify-between items-center p-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Shape Slicer</h1>
            <div className="text-xs text-slate-400">Match the target shape</div>
          </div>
          <div className="flex gap-1 items-center">
              
              {/* OBJECTIVES MINI-WIDGET */}
              <div id="tour-objectives" className="flex flex-col items-end mr-2 space-y-[2px]">
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${hasTwoPieces ? 'text-green-400' : 'text-slate-500'}`}>
                      <span>2 Pieces</span>
                      {hasTwoPieces ? <Check size={10} strokeWidth={3} /> : <Circle size={10} strokeWidth={2} />}
                  </div>
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${hasMinCells ? 'text-green-400' : 'text-slate-500'}`}>
                      <span>3+ Cells</span>
                      {hasMinCells ? <Check size={10} strokeWidth={3} /> : <Circle size={10} strokeWidth={2} />}
                  </div>
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${matchesTarget ? 'text-green-400' : 'text-slate-500'}`}>
                      <span>Target</span>
                      {matchesTarget ? <Check size={10} strokeWidth={3} /> : <Circle size={10} strokeWidth={2} />}
                  </div>
              </div>

              <button 
                onClick={() => setShowRules(true)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Rules"
              >
                <Info size={18} />
              </button>
              <button 
                onClick={onUndo} 
                disabled={!canUndo}
                className={`p-2 rounded-full transition ${canUndo ? 'text-slate-200 hover:bg-slate-700 active:scale-95' : 'text-slate-700'}`}
                aria-label="Undo"
              >
                <Undo size={18} />
              </button>
              <button 
                onClick={onRedo} 
                disabled={!canRedo}
                className={`p-2 rounded-full transition ${canRedo ? 'text-slate-200 hover:bg-slate-700 active:scale-95' : 'text-slate-700'}`}
                aria-label="Redo"
              >
                <Redo size={18} />
              </button>
              <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
              <button onClick={handleResetLevel} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95 transition">
                <RefreshCw size={18} />
              </button>
              <button 
                id="tour-hint"
                onClick={onRequestHint} 
                disabled={!!hint}
                className={`p-2 rounded-full transition active:scale-95 ${hint ? 'bg-purple-900 text-purple-300' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
              >
                <Sparkles size={18} />
              </button>
          </div>
        </div>

        {/* --- SUBHEADER (TOGGLE & NAV) --- */}
        <div className="flex items-center justify-between px-3 pb-3">
           <div className="flex bg-slate-800 p-1 rounded-lg">
             <button 
               onClick={() => setAppMode('ARENA')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${appMode === 'ARENA' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <Swords size={14} /> Arena
             </button>
             <button 
               onClick={() => setAppMode('GYM')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${appMode === 'GYM' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <Dumbbell size={14} /> Gym
             </button>
           </div>

           <div className="flex items-center gap-2">
             {/* Gym Navigation */}
             {appMode === 'GYM' && (
               <div className="flex items-center bg-slate-800 rounded-lg p-1">
                 <button onClick={onPrevLevel} disabled={levelIndex === 0} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30">
                    <ChevronLeft size={16} />
                 </button>
                 <span className="text-xs font-bold px-2 text-slate-300 min-w-[3rem] text-center">
                    {levelIndex + 1} / {totalLevels}
                 </span>
                 <button onClick={onNextLevel} disabled={levelIndex === totalLevels - 1} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30">
                    <ChevronRight size={16} />
                 </button>
               </div>
             )}

             {/* Editor Button */}
             {isEditorMode && (
               <button 
                 onClick={onCreateLevel}
                 className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
               >
                 <Plus size={14} /> Create
               </button>
             )}
           </div>
        </div>
      </div>

      {/* --- HINT --- */}
      {hint && (
        <div className="absolute top-32 left-4 right-4 z-20 bg-purple-900/90 text-purple-100 p-3 rounded-lg text-sm border border-purple-500 shadow-xl animate-bounce-slight">
          <strong>AI Hint:</strong> {hint}
        </div>
      )}

      {/* --- FLOATING ACTION BUTTONS --- */}
      <div className="absolute top-32 right-4 z-30 flex flex-col gap-2 pointer-events-none">
        
        {/* Cut Actions */}
        {drawnEdges.size > 0 && (
           <div className="flex flex-col gap-2 animate-fade-in">
             <button 
                onClick={executeCut}
                className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center justify-center animate-bounce-slight pointer-events-auto transition-transform active:scale-95"
                title="Execute Cut"
              >
                <Scissors size={24} />
             </button>
             <button 
                onClick={clearDrawing}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95"
                title="Clear Drawing"
              >
                <Trash2 size={20} />
             </button>
           </div>
        )}

        {/* Move Actions */}
        {mode === GameMode.MOVE && selectedPieceId && (
          <div className="flex flex-col gap-2 animate-fade-in">
             <button onClick={() => handleRotate(-1)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95" title="Rotate Left">
               <RotateCcw size={20} />
             </button>
             <button onClick={() => handleFlipHorizontal()} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95" title="Flip Horizontal">
               <FlipHorizontal size={20} />
             </button>
             <button onClick={() => handleFlipVertical()} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95" title="Flip Vertical">
               <FlipVertical size={20} />
             </button>
             <button onClick={() => handleRotate(1)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95" title="Rotate Right">
               <RotateCw size={20} />
             </button>
          </div>
        )}
      </div>

      {/* --- CANVAS --- */}
      <div id="tour-canvas" className="flex-1 overflow-hidden relative flex items-center justify-center">
        <svg 
          ref={svgRef}
          className={`w-full h-full bg-slate-900 ${mode === GameMode.MOVE ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
          viewBox={`0 0 ${GRID_WIDTH * CELL_SIZE} ${GRID_HEIGHT * CELL_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Grid Pattern */}
          <defs>
            <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#1e293b" strokeWidth="1"/>
            </pattern>
             <pattern id="dots" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
               <circle cx="0" cy="0" r="1.5" fill="#334155" />
             </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#dots)" />

          {/* Target Ghost */}
          <g id="tour-target-shape" transform={`translate(${finalTargetOffset.x * CELL_SIZE}, ${finalTargetOffset.y * CELL_SIZE})`}>
             {targetCells.map((c, i) => (
               <rect 
                 key={`t-${i}`} 
                 x={c.x * CELL_SIZE} 
                 y={c.y * CELL_SIZE} 
                 width={CELL_SIZE} 
                 height={CELL_SIZE} 
                 fill="none" 
                 stroke="#475569" 
                 strokeWidth="2" 
                 strokeDasharray="4 2"
               />
             ))}
             <text x={0} y={-10} fill="#64748b" fontSize="12" fontWeight="bold" className="uppercase tracking-widest">Target</text>
          </g>

          {/* Pieces */}
          {pieces.map(piece => {
            const isSelected = piece.id === selectedPieceId;
            const isDragging = mode === GameMode.MOVE && isSelected && dragPosition;
            const absCells = getAbsoluteCells(piece);
            
            const currentGridPixelX = piece.position.x * CELL_SIZE;
            const currentGridPixelY = piece.position.y * CELL_SIZE;
            
            const renderX = isDragging ? dragPosition.x : currentGridPixelX;
            const renderY = isDragging ? dragPosition.y : currentGridPixelY;
            
            const deltaX = renderX - currentGridPixelX;
            const deltaY = renderY - currentGridPixelY;

            return (
              <g key={piece.id} transform={`translate(${deltaX}, ${deltaY})`} style={{ filter: isDragging ? 'drop-shadow(0px 10px 10px rgba(0,0,0,0.5))' : 'none' }}>
                 {absCells.map((c, i) => (
                    <rect
                      key={i}
                      x={c.x * CELL_SIZE}
                      y={c.y * CELL_SIZE}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      fill={piece.color}
                      stroke="white"
                      strokeWidth={isSelected ? 2 : 1}
                      className="transition-colors duration-200"
                    />
                 ))}
                 {isSelected && mode === GameMode.MOVE && !isDragging && (
                    <rect
                        x={Math.min(...absCells.map(c => c.x)) * CELL_SIZE}
                        y={Math.min(...absCells.map(c => c.y)) * CELL_SIZE}
                        width={(Math.max(...absCells.map(c => c.x)) - Math.min(...absCells.map(c => c.x)) + 1) * CELL_SIZE}
                        height={(Math.max(...absCells.map(c => c.y)) - Math.min(...absCells.map(c => c.y)) + 1) * CELL_SIZE}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        pointerEvents="none"
                        strokeDasharray="4"
                    />
                 )}
              </g>
            )
          })}

          {/* Drawn Cut Path */}
          {drawnEdges.size > 0 && Array.from(drawnEdges).map((key: string) => {
            const e = parseEdgeKey(key);
            // Render edge
            const x1 = e.vertical ? e.x + 1 : e.x;
            const y1 = e.vertical ? e.y : e.y + 1;
            const x2 = e.vertical ? e.x + 1 : e.x + 1;
            const y2 = e.vertical ? e.y + 1 : e.y + 1;

            return (
              <line 
                key={key}
                x1={x1 * CELL_SIZE}
                y1={y1 * CELL_SIZE}
                x2={x2 * CELL_SIZE}
                y2={y2 * CELL_SIZE}
                stroke="#f43f5e"
                strokeWidth="4"
                strokeLinecap="round"
              />
            );
          })}
          
        </svg>
      </div>

      {/* --- FOOTER --- */}
      <div className="bg-slate-900 border-t border-slate-700 p-4 pb-8 safe-pb z-20">
        <div className="flex flex-col gap-4">
          
          {/* Mode Selector */}
          <div id="tour-modes" className="flex bg-slate-800 p-1 rounded-xl self-center shadow-lg w-full max-w-xs justify-between">
              <button 
                id="tour-mode-move"
                onClick={() => setMode(GameMode.MOVE)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.MOVE ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Move size={18} /> Move
              </button>
              <button 
                id="tour-mode-pen"
                onClick={() => setMode(GameMode.PEN)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.PEN ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <PenTool size={18} /> Pen
              </button>
              <button 
                id="tour-mode-eraser"
                onClick={() => setMode(GameMode.ERASER)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.ERASER ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Eraser size={18} /> Eraser
              </button>
          </div>
        </div>
      </div>

      {/* --- RULES MODAL --- */}
      {showRules && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowRules(false)}>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-600 max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
                <h2 className="text-2xl font-bold text-white mb-4">How to Play</h2>
                <ul className="space-y-3 text-slate-300 text-sm">
                    <li className="flex gap-3 items-start">
                        <div className="bg-rose-600/20 text-rose-400 p-2 rounded-lg h-fit"><Scissors size={16}/></div>
                        <div><strong className="text-white block">Cut</strong> Slice shapes along grid lines using the Pen tool.</div>
                    </li>
                    <li className="flex gap-3 items-start">
                        <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg h-fit"><Move size={16}/></div>
                        <div><strong className="text-white block">Move</strong> Drag pieces to arrange them.</div>
                    </li>
                    <li className="flex gap-3 items-start">
                        <div className="bg-purple-600/20 text-purple-400 p-2 rounded-lg h-fit"><RotateCw size={16}/></div>
                        <div><strong className="text-white block">Transform</strong> Rotate and Flip pieces to fit.</div>
                    </li>
                    <li className="flex gap-3 items-start">
                        <div className="bg-green-600/20 text-green-400 p-2 rounded-lg h-fit"><Target size={16}/></div>
                        <div><strong className="text-white block">Goal</strong> Form the target shape anywhere on the grid.</div>
                    </li>
                </ul>
                <div className="mt-6 pt-4 border-t border-slate-700 flex flex-col gap-2">
                    <button 
                      onClick={startTour}
                      className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                      <Footprints size={16} /> Start Interactive Tour
                    </button>
                    <button onClick={() => setShowRules(false)} className="w-full px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition">
                      Got it
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
    </>
  );
};

export default GameCanvas;