import React, { useState, useRef } from 'react';
import { Cell, LevelData, Coordinate } from '../types';
import { CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, COLORS } from '../constants';
import { normalizePiece } from '../utils/geometry';
import { Save, X, Grid3X3, Target, Square, Trash2, ArrowLeft } from 'lucide-react';

interface LevelBuilderProps {
  onSave: (level: LevelData) => void;
  onCancel: () => void;
}

type BuilderMode = 'START' | 'TARGET';

const LevelBuilder: React.FC<LevelBuilderProps> = ({ onSave, onCancel }) => {
  const [levelName, setLevelName] = useState("My Custom Level");
  const [mode, setMode] = useState<BuilderMode>('START');
  
  // Store raw grid coordinates "x,y"
  const [startCells, setStartCells] = useState<Set<string>>(new Set());
  const [targetCells, setTargetCells] = useState<Set<string>>(new Set());
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const svgRef = useRef<SVGSVGElement>(null);

  const getGridPos = (e: React.PointerEvent) => {
    if (!svgRef.current) return null;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;
    const rawX = (e.clientX - CTM.e) / CTM.a;
    const rawY = (e.clientY - CTM.f) / CTM.d;
    const x = Math.floor(rawX / CELL_SIZE);
    const y = Math.floor(rawY / CELL_SIZE);
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return null;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const pos = getGridPos(e);
    if (!pos) return;
    
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);

    const key = `${pos.x},${pos.y}`;
    const activeSet = mode === 'START' ? startCells : targetCells;
    const isPresent = activeSet.has(key);
    setDragMode(isPresent ? 'remove' : 'add');
    
    modifyCell(pos.x, pos.y, !isPresent);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const pos = getGridPos(e);
    if (!pos) return;
    modifyCell(pos.x, pos.y, dragMode === 'add');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const modifyCell = (x: number, y: number, add: boolean) => {
    const key = `${x},${y}`;
    const setter = mode === 'START' ? setStartCells : setTargetCells;
    
    setter(prev => {
      const next = new Set(prev);
      if (add) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleClear = () => {
    if (confirm("Clear all shapes?")) {
      setStartCells(new Set());
      setTargetCells(new Set());
    }
  };

  const handleSaveLevel = () => {
    if (startCells.size === 0) {
      alert("Please draw a Starting Shape.");
      return;
    }
    if (targetCells.size === 0) {
      alert("Please draw a Target Shape.");
      return;
    }
    if (startCells.size !== targetCells.size) {
      alert(`Area mismatch! Start has ${startCells.size} blocks, Target has ${targetCells.size}. They must be equal.`);
      return;
    }

    // Convert sets to arrays
    const parseSet = (s: Set<string>) => Array.from(s).map((k: string) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });

    const startRaw = parseSet(startCells);
    const targetRaw = parseSet(targetCells);

    // Normalize Start Shape
    const startNorm = normalizePiece(startRaw);
    
    // Normalize Target Shape
    const targetNorm = normalizePiece(targetRaw);

    const newLevel: LevelData = {
      id: `custom-${Date.now()}`,
      name: levelName || "Untitled Level",
      initialShape: startNorm.normalized,
      startOffset: startNorm.offset, // Use the offset from normalization as the start position
      targetCells: targetNorm.normalized,
      targetOffset: targetNorm.offset, // Use the offset from normalization as the target position
      par: 2 // Default par for custom levels
    };

    onSave(newLevel);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto bg-slate-900 text-white relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Level Builder</h2>
        <button onClick={handleClear} className="text-rose-400 hover:text-rose-300">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Inputs */}
      <div className="p-4 space-y-4 bg-slate-800/50">
        <div>
          <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Level Name</label>
          <input 
            type="text" 
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="Enter name..."
          />
        </div>

        <div className="flex gap-2">
           <button 
             onClick={() => setMode('START')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded border-2 transition ${mode === 'START' ? 'border-blue-500 bg-blue-500/20 text-blue-200' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
           >
             <Square size={16} fill={mode === 'START' ? 'currentColor' : 'none'} />
             Start Shape
           </button>
           <button 
             onClick={() => setMode('TARGET')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded border-2 transition ${mode === 'TARGET' ? 'border-rose-500 bg-rose-500/20 text-rose-200' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
           >
             <Target size={16} />
             Target Shape
           </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-puzzle-bg relative">
        <svg 
          ref={svgRef}
          className="w-full h-full touch-none"
          viewBox={`0 0 ${GRID_WIDTH * CELL_SIZE} ${GRID_HEIGHT * CELL_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Grid Lines */}
          <defs>
            <pattern id="builder-grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#1e293b" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#builder-grid)" />

          {/* Render Target Cells (Ghost) */}
          {Array.from(targetCells).map((key: string) => {
            const [x, y] = key.split(',').map(Number);
            return (
              <rect 
                key={`target-${key}`}
                x={x * CELL_SIZE} 
                y={y * CELL_SIZE} 
                width={CELL_SIZE} 
                height={CELL_SIZE} 
                fill="none" 
                stroke="#f43f5e" 
                strokeWidth="2" 
                strokeDasharray="4 2"
                className="pointer-events-none"
              />
            );
          })}

          {/* Render Start Cells (Solid) */}
          {Array.from(startCells).map((key: string) => {
            const [x, y] = key.split(',').map(Number);
            return (
              <rect 
                key={`start-${key}`}
                x={x * CELL_SIZE + 2} 
                y={y * CELL_SIZE + 2} 
                width={CELL_SIZE - 4} 
                height={CELL_SIZE - 4} 
                fill="#3b82f6" 
                className="pointer-events-none opacity-90"
                stroke="white"
                strokeWidth="1"
              />
            );
          })}

          {/* Helper Grid Highlight */}
          {/* Optional: Show hover effect if needed, but touch/drag is main interaction */}
        </svg>

        {/* Legend/Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
           <span className="text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded">
             {mode === 'START' ? 'Draw the starting puzzle piece' : 'Draw the target shape outline'}
           </span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <button 
          onClick={handleSaveLevel}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
        >
          <Save size={20} />
          Save & Play
        </button>
      </div>
    </div>
  );
};

export default LevelBuilder;