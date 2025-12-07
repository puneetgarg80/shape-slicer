import { Cell, Coordinate, Piece, GridEdge } from '../types';

// Check if two cells are equal
export const isSameCell = (c1: Cell, c2: Cell) => c1.x === c2.x && c1.y === c2.y;

// Rotate a point 90 degrees clockwise around (0,0)
export const rotatePoint = (p: Coordinate): Coordinate => ({ x: -p.y, y: p.x });

// Flip a point horizontally around x=0
export const flipPoint = (p: Coordinate): Coordinate => ({ x: -p.x, y: p.y });

// Get absolute coordinates of a piece's cells on the grid
export const getAbsoluteCells = (piece: Piece): Cell[] => {
  return piece.cells.map(cell => {
    let curr = { ...cell };
    
    // Apply Flip
    if (piece.isFlipped) {
      curr = flipPoint(curr);
    }

    // Apply Rotation
    const rots = (piece.rotation / 90) % 4;
    for (let i = 0; i < rots; i++) {
      curr = rotatePoint(curr);
    }

    // Apply Translation
    return {
      x: curr.x + piece.position.x,
      y: curr.y + piece.position.y,
    };
  });
};

// Normalize piece cells so top-left is at (0,0)
export const normalizePiece = (cells: Cell[]): { normalized: Cell[], offset: Coordinate } => {
  if (cells.length === 0) return { normalized: [], offset: { x: 0, y: 0 } };
  
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));

  return {
    normalized: cells.map(c => ({ x: c.x - minX, y: c.y - minY })),
    offset: { x: minX, y: minY },
  };
};

// Check if pieces match the target shape exactly (position independent)
export const checkSolution = (pieces: Piece[], targetCells: Cell[]): boolean => {
  // Enforce puzzle constraints: Exactly 2 pieces, minimum 3 cells each
  if (pieces.length !== 2) return false;
  if (pieces.some(p => p.cells.length < 3)) return false;

  const allAbsCells = pieces.flatMap(getAbsoluteCells);
  if (allAbsCells.length === 0) return false;

  // Normalize current arrangement to (0,0) to compare shape only, ignoring position
  const { normalized: currentShape } = normalizePiece(allAbsCells);

  // Normalize target shape to (0,0) as well for fair comparison
  const { normalized: targetShape } = normalizePiece(targetCells);

  // Quick count check
  if (currentShape.length !== targetShape.length) return false;

  // Convert to set for O(1) lookups
  const currentSet = new Set(currentShape.map(c => `${c.x},${c.y}`));
  
  // Verify every cell in target exists in current configuration
  for (const c of targetShape) {
    if (!currentSet.has(`${c.x},${c.y}`)) return false;
  }

  return true;
};

// Convert a continuous path of grid intersections to Cut Edges
export const pointsToEdges = (points: Coordinate[]): GridEdge[] => {
  const edges: GridEdge[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Determine edge type based on grid logic
    // A vertical edge at (x,y) separates cell (x,y) and (x+1,y).
    // The grid line X=k separates column k-1 and k.
    
    if (p1.x === p2.x) {
      // Vertical movement along line X=p1.x
      // This line separates column p1.x-1 and p1.x
      // Corresponds to vertical edge of cell (p1.x-1, y)
      const y = Math.min(p1.y, p2.y);
      edges.push({ x: p1.x - 1, y: y, vertical: true });
    } else if (p1.y === p2.y) {
      // Horizontal movement along line Y=p1.y
      // This line separates row p1.y-1 and p1.y
      // Corresponds to horizontal edge of cell (x, p1.y-1)
      const x = Math.min(p1.x, p2.x);
      edges.push({ x: x, y: p1.y - 1, vertical: false });
    }
  }
  return edges;
};

// Interpolate points for fast drag movements (Manhattan path)
export const interpolatePoints = (p1: Coordinate, p2: Coordinate): Coordinate[] => {
  const points: Coordinate[] = [];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  // Just return end point if same
  if (dx === 0 && dy === 0) return [];
  
  // X movement then Y movement
  const stepX = dx > 0 ? 1 : -1;
  let currX = p1.x;
  for (let i = 0; i < Math.abs(dx); i++) {
    currX += stepX;
    points.push({ x: currX, y: p1.y });
  }

  const stepY = dy > 0 ? 1 : -1;
  let currY = p1.y;
  for (let i = 0; i < Math.abs(dy); i++) {
    currY += stepY;
    points.push({ x: p2.x, y: currY });
  }

  return points;
};

export const getEdgeAsKey = (e: GridEdge): string => `${e.x},${e.y},${e.vertical ? 'v' : 'h'}`;

export const parseEdgeKey = (k: string): GridEdge => {
  const [x, y, d] = k.split(',');
  return { x: parseInt(x), y: parseInt(y), vertical: d === 'v' };
};

// THE CUTTING ALGORITHM
export const performCut = (piece: Piece, cutEdges: GridEdge[]): Piece[] => {
  const absCells = getAbsoluteCells(piece);
  const cellSet = new Set(absCells.map(c => `${c.x},${c.y}`));
  const visited = new Set<string>();
  const newPieces: Cell[][] = [];

  // Convert cutEdges to a lookup for fast checking
  // Edge format: "x,y,v" (vertical right of x,y) or "x,y,h" (horizontal bottom of x,y)
  const cuts = new Set<string>();
  cutEdges.forEach(e => {
    cuts.add(`${e.x},${e.y},${e.vertical ? 'v' : 'h'}`);
  });

  const getNeighbors = (c: Cell): Cell[] => {
    const n: Cell[] = [];
    
    // Right (check vertical edge at x,y)
    if (cellSet.has(`${c.x + 1},${c.y}`) && !cuts.has(`${c.x},${c.y},v`)) {
      n.push({ x: c.x + 1, y: c.y });
    }
    // Left (check vertical edge at x-1,y)
    if (cellSet.has(`${c.x - 1},${c.y}`) && !cuts.has(`${c.x - 1},${c.y},v`)) {
      n.push({ x: c.x - 1, y: c.y });
    }
    // Down (check horizontal edge at x,y)
    if (cellSet.has(`${c.x},${c.y + 1}`) && !cuts.has(`${c.x},${c.y},h`)) {
      n.push({ x: c.x, y: c.y + 1 });
    }
    // Up (check horizontal edge at x,y-1)
    if (cellSet.has(`${c.x},${c.y - 1}`) && !cuts.has(`${c.x},${c.y - 1},h`)) {
      n.push({ x: c.x, y: c.y - 1 });
    }
    return n;
  };

  for (const startNode of absCells) {
    const key = `${startNode.x},${startNode.y}`;
    if (visited.has(key)) continue;

    // Flood fill to find component
    const component: Cell[] = [];
    const queue = [startNode];
    visited.add(key);
    component.push(startNode);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = getNeighbors(curr);
      for (const nei of neighbors) {
        const neiKey = `${nei.x},${nei.y}`;
        if (!visited.has(neiKey)) {
          visited.add(neiKey);
          component.push(nei);
          queue.push(nei);
        }
      }
    }
    newPieces.push(component);
  }

  // Convert components back to Pieces
  return newPieces.map((comp, idx) => {
    const { normalized, offset } = normalizePiece(comp);
    return {
      id: `${piece.id}-${Date.now()}-${idx}`,
      cells: normalized,
      position: offset,
      rotation: 0,
      isFlipped: false,
      color: piece.color,
    };
  });
};

export const gridToPixel = (v: number, size: number) => v * size;
export const pixelToGrid = (v: number, size: number) => Math.round(v / size);