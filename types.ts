export type Coordinate = {
  x: number;
  y: number;
};

export type Cell = Coordinate;

export interface Piece {
  id: string;
  cells: Cell[]; // Relative coordinates to the piece's position
  position: Coordinate; // Board position (top-left of bounding box usually, or just an anchor)
  rotation: number; // 0, 90, 180, 270
  isFlipped: boolean; // Horizontal flip
  color: string;
}

export enum GameMode {
  VIEW = 'VIEW',
  MOVE = 'MOVE',
  PEN = 'PEN',
  ERASER = 'ERASER',
}

export interface LevelData {
  id: string;
  name: string;
  targetCells: Cell[]; // The shape we want to form (usually a square)
  initialShape: Cell[]; // The starting shape
  par: number; // Max cuts allowed (usually 1 or 2)
  targetOffset?: Coordinate; // Optional override for target position
  startOffset?: Coordinate; // Optional override for start piece position
}

export type GridEdge = {
  x: number; // coordinate of the cell to the left/top
  y: number;
  vertical: boolean; // true if vertical edge (right of x,y), false if horizontal (bottom of x,y)
};