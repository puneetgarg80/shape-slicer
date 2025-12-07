import React, { useRef, useState, useEffect } from 'react';
import { Piece, Cell, Coordinate, GameMode } from '../types';
import { getAbsoluteCells, performCut, pointsToEdges, interpolatePoints, checkSolution, getEdgeAsKey, parseEdgeKey } from '../utils/geometry';
import { CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, DEFAULT_TARGET_OFFSET, COLORS } from '../constants';
import { Scissors, Move, RotateCw, RotateCcw, FlipHorizontal, Sparkles, RefreshCw, Menu, Undo, Redo, PenTool, Eraser, Trash2 } from 'lucide-react';

interface GameCanvasProps {
  pieces: Piece[];
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>;
  targetCells: Cell[];
  targetOffset?: Coordinate;
  onWin: () => void;
  onRequestHint: () => void;
  hint: string | null;
  resetLevel: () => void;
  onOpenLevelSelect: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  pieces, setPieces, targetCells, targetOffset, onWin, onRequestHint, hint, resetLevel, onOpenLevelSelect,
  onUndo, onRedo, canUndo, canRedo
}) => {
  const [mode, setMode] = useState<GameMode>(GameMode.MOVE);
  
  // Selection & Moving
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Coordinate | null>(null); // Pixel offset from top-left of piece
  const [dragPosition, setDragPosition] = useState<Coordinate | null>(null); // Current raw pixel position of top-left of piece

  // Cutting (Drawing)
  const [drawnEdges, setDrawnEdges] = useState<Set<string>>(new Set());
  const [lastDrawGridPos, setLastDrawGridPos] = useState<Coordinate | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const finalTargetOffset = targetOffset || DEFAULT_TARGET_OFFSET;

  // Reset drawing when level resets or changes
  useEffect(() => {
    setDrawnEdges(new Set());
  }, [pieces.length === 1 && pieces[0].id === 'root-piece']); // Rough heuristic for reset, or pass explicit prop

  // Reset local state on external reset
  const handleResetLevel = () => {
    setDrawnEdges(new Set());
    setMode(GameMode.MOVE);
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
      if (checkSolution(updatedPieces, targetCells, finalTargetOffset)) {
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
      if (piecesToAdd.length > 0) setSelectedPieceId(piecesToAdd[0].id);
    }
    
    // Clear drawing after attempt
    setDrawnEdges(new Set());
  };

  const clearDrawing = () => {
    setDrawnEdges(new Set());
  };

  const rotateSelected = (dir: 1 | -1) => {
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

  const flipSelected = () => {
    if (!selectedPieceId) return;
    setPieces(prev => {
      const piece = prev.find(p => p.id === selectedPieceId);
      if (!piece) return prev;

      const oldCenter = getPieceCenter(piece);
      const tempPiece = { ...piece, isFlipped: !piece.isFlipped };
      const newNaturalCenter = getPieceCenter(tempPiece);

      const offsetX = Math.round(oldCenter.x - newNaturalCenter.x);
      const offsetY = Math.round(oldCenter.y - newNaturalCenter.y);

      return prev.map(p => {
        if (p.id === selectedPieceId) {
          return { ...p, isFlipped: !p.isFlipped, position: { x: p.position.x + offsetX, y: p.position.y + offsetY } };
        }
        return p;
      });
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto relative bg-puzzle-bg overflow-hidden touch-none select-none">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center p-4 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenLevelSelect}
            className="p-2 -ml-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
            aria-label="Level Menu"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Shape Slicer</h1>
            <div className="text-xs text-slate-400">Match the ghost shape</div>
          </div>
        </div>
        <div className="flex gap-1">
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
              onClick={onRequestHint} 
              disabled={!!hint}
              className={`p-2 rounded-full transition active:scale-95 ${hint ? 'bg-purple-900 text-purple-300' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
            >
              <Sparkles size={18} />
            </button>
        </div>
      </div>

      {/* --- HINT --- */}
      {hint && (
        <div className="absolute top-20 left-4 right-4 z-20 bg-purple-900/90 text-purple-100 p-3 rounded-lg text-sm border border-purple-500 shadow-xl animate-bounce-slight">
          <strong>AI Hint:</strong> {hint}
        </div>
      )}

      {/* --- FLOATING ACTION BUTTONS --- */}
      {drawnEdges.size > 0 && (
         <div className="absolute top-24 right-4 z-30 flex flex-col gap-2 animate-fade-in">
             <button 
                onClick={executeCut}
                className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center justify-center animate-bounce-slight"
                title="Execute Cut"
              >
                <Scissors size={24} />
             </button>
             <button 
                onClick={clearDrawing}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shadow-md flex items-center justify-center"
                title="Clear Drawing"
              >
                <Trash2 size={20} />
             </button>
         </div>
      )}

      {/* --- CANVAS --- */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center">
        <svg 
          ref={svgRef}
          className={`w-full h-full bg-puzzle-bg ${mode === GameMode.MOVE ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
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
          <g transform={`translate(${finalTargetOffset.x * CELL_SIZE}, ${finalTargetOffset.y * CELL_SIZE})`}>
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
          <div className="flex bg-slate-800 p-1 rounded-xl self-center shadow-lg w-full max-w-xs justify-between">
              <button 
                onClick={() => setMode(GameMode.MOVE)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.MOVE ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Move size={18} /> Move
              </button>
              <button 
                onClick={() => setMode(GameMode.PEN)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.PEN ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <PenTool size={18} /> Pen
              </button>
              <button 
                onClick={() => setMode(GameMode.ERASER)}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${mode === GameMode.ERASER ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Eraser size={18} /> Eraser
              </button>
          </div>

          {/* Manipulation Controls (Only visible in Move Mode) */}
          <div className={`flex justify-between items-center px-4 transition-all duration-300 ${mode === GameMode.MOVE && selectedPieceId ? 'opacity-100 translate-y-0 h-16' : 'opacity-0 translate-y-4 h-0 pointer-events-none'}`}>
             <button onClick={() => rotateSelected(-1)} className="flex flex-col items-center gap-1 text-slate-300 active:text-white active:scale-95 transition">
               <div className="p-3 bg-slate-800 rounded-full border border-slate-600 shadow-sm">
                 <RotateCcw size={20} />
               </div>
               <span className="text-[10px] font-bold tracking-wider">LEFT</span>
             </button>

             <button onClick={() => flipSelected()} className="flex flex-col items-center gap-1 text-slate-300 active:text-white active:scale-95 transition">
               <div className="p-3 bg-slate-800 rounded-full border border-slate-600 shadow-sm">
                 <FlipHorizontal size={20} />
               </div>
               <span className="text-[10px] font-bold tracking-wider">FLIP</span>
             </button>

             <button onClick={() => rotateSelected(1)} className="flex flex-col items-center gap-1 text-slate-300 active:text-white active:scale-95 transition">
               <div className="p-3 bg-slate-800 rounded-full border border-slate-600 shadow-sm">
                 <RotateCw size={20} />
               </div>
               <span className="text-[10px] font-bold tracking-wider">RIGHT</span>
             </button>
          </div>
          
          {/* Helper Text for Pen Mode */}
          {(mode === GameMode.PEN || mode === GameMode.ERASER) && (
              <div className="text-center text-xs text-slate-400 h-16 flex items-center justify-center animate-fade-in">
                  {mode === GameMode.PEN ? 'Draw lines on grid boundaries' : 'Drag over red lines to remove them'}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;