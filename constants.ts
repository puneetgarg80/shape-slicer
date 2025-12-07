import { LevelData } from './types';

export const CELL_SIZE = 36; // Slightly smaller to fit mobile widths
export const GRID_WIDTH = 12; // Narrower for portrait
export const GRID_HEIGHT = 24; // Taller for vertical stacking
export const DEFAULT_TARGET_OFFSET = { x: 4, y: 15 };
export const START_OFFSET = { x: 2, y: 2 }; // Start at top

// Helper to generate rectangles
const rect = (w: number, h: number) => {
  return Array.from({ length: w * h }, (_, i) => ({
    x: (i % w),
    y: Math.floor(i / w),
  }));
};

export const LEVELS: LevelData[] = [
  {
    id: 'level-1',
    name: 'The Plank',
    par: 1,
    targetCells: rect(4, 4), // 4x4 Square (16)
    initialShape: rect(8, 2), // 8x2 Rectangle (16)
    targetOffset: { x: 4, y: 15 } // Bottom
  },
  {
    id: 'level-2',
    name: 'The Tee',
    par: 2,
    targetCells: rect(5, 4), // 5x4 Rectangle (20)
    // T-Shape: Top bar 6x2 (12) + Stem 2x4 (8)
    initialShape: [
      ...Array.from({length: 12}, (_, i) => ({x: i%6, y: Math.floor(i/6)})), // 6x2 top
      ...Array.from({length: 8}, (_, i) => ({x: 2 + (i%2), y: 2 + Math.floor(i/2)})) // 2x4 stem
    ],
    targetOffset: { x: 3, y: 15 } // Bottom
  },
  {
    id: 'level-3',
    name: 'The Staircase',
    par: 1,
    targetCells: rect(6, 6), // 6x6 Square (36)
    initialShape: rect(9, 4), // 9x4 Rectangle (36)
    targetOffset: { x: 3, y: 14 } // Bottom
  },
  {
    id: 'level-4',
    name: 'The Cross',
    par: 2,
    targetCells: rect(5, 4), // 5x4 Rectangle (20)
    // Greek Cross-ish area 20 (5 blocks of 2x2)
    initialShape: [
      // Center
      ...rect(2,2).map(c => ({x: c.x+2, y: c.y+2})),
      // Top
      ...rect(2,2).map(c => ({x: c.x+2, y: c.y})),
      // Bottom
      ...rect(2,2).map(c => ({x: c.x+2, y: c.y+4})),
      // Left
      ...rect(2,2).map(c => ({x: c.x, y: c.y+2})),
      // Right
      ...rect(2,2).map(c => ({x: c.x+4, y: c.y+2})),
    ],
    targetOffset: { x: 3, y: 15 } // Bottom
  },
  {
    id: 'level-5',
    name: 'ZigZag',
    par: 1,
    targetCells: rect(8, 8), // 8x8 Square (64)
    initialShape: [
      ...rect(8, 7), // Top 7 rows
      // 8th row
      ...rect(1, 1).map(c => ({x: c.x, y: c.y + 7})),
      ...rect(5, 1).map(c => ({x: c.x + 2, y: c.y + 7})),
      // 9th row
      ...rect(1, 1).map(c => ({x: c.x + 2, y: c.y + 8})),
      ...rect(1, 1).map(c => ({x: c.x + 6, y: c.y + 8})),
    ],
    targetOffset: { x: 2, y: 13 } // Bottom
  }
];

// Colors
export const COLORS = [
  '#60a5fa', // Blue
  '#f472b6', // Pink
  '#4ade80', // Green
  '#fbbf24', // Amber
  '#a78bfa', // Purple
  '#f87171', // Red
];