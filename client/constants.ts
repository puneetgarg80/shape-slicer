import { LevelData } from './types';

export const CELL_SIZE = 42; // Increased from 36 to 42 for better visibility
export const GRID_WIDTH = 12; // Narrower for portrait
export const GRID_HEIGHT = 24; // Taller for vertical stacking
export const DEFAULT_TARGET_OFFSET = { x: 4, y: 13 };
export const START_OFFSET = { x: 2, y: 0 };

// Helper to generate rectangles
const rect = (w: number, h: number) => {
  return Array.from({ length: w * h }, (_, i) => ({
    x: (i % w),
    y: Math.floor(i / w),
  }));
};

const ARENA_LEVELS: LevelData[] = [
  {
    id: 'main-challenge',
    name: 'Gym: Level 6',
    par: 1,
    targetCells: rect(6, 5),   // 6x5 Square (3 6)
    initialShape: [
      ...rect(6, 4), // Top 4 rows
      // 5th row
      ...rect(1, 1).map(c => ({ x: c.x, y: c.y + 4 })),
      ...rect(3, 1).map(c => ({ x: c.x + 2, y: c.y + 4 })),
      // 6th row
      ...rect(1, 1).map(c => ({ x: c.x + 2, y: c.y + 5 })),
      ...rect(1, 1).map(c => ({ x: c.x + 4, y: c.y + 5 })),
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  }
];

const GYM_LEVELS: LevelData[] = [
  {
    id: 'practice-level-1',
    name: 'Gym: Level 1',
    par: 1,
    targetCells: rect(5, 5), // 5x5 Square (25)
    initialShape: [
      ...rect(5, 2), // Top 2 rows
      // 3rd row
      ...rect(5, 1).map(c => ({ x: c.x - 1, y: c.y + 2 })),
      // 4,5th rows
      ...rect(5, 2).map(c => ({ x: c.x, y: c.y + 3 }))
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  },
  {
    id: 'practice-level-2',
    name: 'Gym: Level 2',
    par: 1,
    targetCells: rect(5, 5), // 5x5 Square (25)
    initialShape: [
      ...rect(5, 1), // Top 1 row
      // 2nd row
      ...rect(6, 1).map(c => ({ x: c.x - 1, y: c.y + 1 })),
      // 3rd row
      ...rect(5, 1).map(c => ({ x: c.x, y: c.y + 2 })),
      // 4th rows
      ...rect(4, 1).map(c => ({ x: c.x, y: c.y + 3 })),
      // 5th rows
      ...rect(5, 1).map(c => ({ x: c.x, y: c.y + 4 }))
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  },
  {
    id: 'practice-level-3',
    name: 'Gym: Level 3',
    par: 1,
    targetCells: rect(4, 4), // 4x4 Square (16)
    initialShape: [
      ...rect(4, 2), // Top 2 rows
      // 3rd row
      ...rect(3, 1).map(c => ({ x: c.x, y: c.y + 2 })),
      // 4th row
      ...rect(4, 1).map(c => ({ x: c.x, y: c.y + 3 })),
      // 5th row
      ...rect(1, 1).map(c => ({ x: c.x + 1, y: c.y + 4 })),
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  },
  {
    id: 'practice-level-4',
    name: 'Gym: Level 4',
    par: 1,
    targetCells: rect(5, 5), // 5x5 Square (25)
    initialShape: [
      ...rect(5, 4), // Top 4 rows
      // 5th row
      ...rect(1, 1).map(c => ({ x: c.x, y: c.y + 4 })),
      ...rect(3, 1).map(c => ({ x: c.x + 2, y: c.y + 4 })),
      // 6th row
      ...rect(1, 1).map(c => ({ x: c.x + 3, y: c.y + 5 })),
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  },
  {
    id: 'practice-level-5',
    name: 'Gym: Level 5',
    par: 1,
    targetCells: rect(4, 4), // 4x4 Square (16)
    initialShape: [
      ...rect(4, 3), // Top 3 rows
      // 4th row
      ...rect(3, 1).map(c => ({ x: c.x, y: c.y + 3 })),
      // 5th row
      ...rect(1, 1).map(c => ({ x: c.x + 1, y: c.y + 4 })),
    ],
    targetOffset: { x: 2, y: 8 } // Bottom
  }
];

// Combine Gym first, then Arena
export const LEVELS = [...GYM_LEVELS, ...ARENA_LEVELS];

// Colors
export const COLORS = [
  '#60a5fa', // Blue
  '#f472b6', // Pink
  '#4ade80', // Green
  '#fbbf24', // Amber
  '#a78bfa', // Purple
  '#f87171', // Red
];