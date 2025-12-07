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

export const ARENA_LEVELS: LevelData[] = [
  {
    id: 'main-challenge',
    name: 'ZigZag Challenge',
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

export const GYM_LEVELS: LevelData[] = [
  {
    id: 'practice-level-1',
    name: 'Gym: Basics I',
    par: 1,
    targetCells: rect(8, 8), // 8x8 Square (64)
    initialShape: [
      ...rect(8, 3), // Top 3 rows
      // 4th row
      ...rect(7, 1).map(c => ({x: c.x, y: c.y + 3})),
      // 5,6,7,8th rows
      ...rect(8, 4).map(c => ({x: c.x, y: c.y + 4})),
      // 9th row
      ...rect(1, 1).map(c => ({x: c.x + 1, y: c.y + 8})),
    ],
    targetOffset: { x: 2, y: 13 } // Bottom
  },
  {
    id: 'practice-level-2',
    name: 'Gym: Basics II',
    par: 1,
    targetCells: rect(8, 8), // 8x8 Square (64)
    initialShape: [
      ...rect(8, 7), // Top 7 rows
      // 8th row
      ...rect(1, 1).map(c => ({x: c.x, y: c.y + 7})),
      ...rect(6, 1).map(c => ({x: c.x + 2, y: c.y + 7})),
      // 9th row
      ...rect(1, 1).map(c => ({x: c.x + 6, y: c.y + 8})),
    ],
    targetOffset: { x: 2, y: 13 } // Bottom
  },
  {
    id: 'practice-level-3',
    name: 'Gym: Basics III',
    par: 1,
    targetCells: rect(8, 8), // 8x8 Square (64)
    initialShape: [
      ...rect(8, 7), // Top 7 rows
      // 8th row
      ...rect(1, 1).map(c => ({x: c.x, y: c.y + 7})),
      ...rect(6, 1).map(c => ({x: c.x + 2, y: c.y + 7})),
      // 9th row
      ...rect(1, 1).map(c => ({x: c.x + 3, y: c.y + 8})),
    ],
    targetOffset: { x: 2, y: 13 } // Bottom
  }
];

// Combine for backward compatibility if needed, though App.tsx handles separation
export const LEVELS = [...ARENA_LEVELS, ...GYM_LEVELS];

// Colors
export const COLORS = [
  '#60a5fa', // Blue
  '#f472b6', // Pink
  '#4ade80', // Green
  '#fbbf24', // Amber
  '#a78bfa', // Purple
  '#f87171', // Red
];