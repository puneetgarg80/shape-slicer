# Shape Slicer: Geometry Puzzle

Shape Slicer is an interactive web-based puzzle game where players must cut, rotate, and rearrange geometric shapes to match a specific target outline.

## Features

- **Dynamic Slicing**: Use the Pen tool to draw cuts across grid lines, splitting shapes into smaller polyominoes.
- **Piece Manipulation**: Drag, rotate (90° increments), and flip pieces horizontally to solve the puzzle.
- **Level System**: Includes a set of progressive levels challenging different spatial reasoning skills.
- **Level Builder**: An integrated editor allowing users to create custom puzzles by drawing starting and target shapes directly on the grid.
- **AI Hints**: Powered by Google Gemini, the game analyzes the current board state to provide cryptic but helpful textual hints.
- **Mobile-First Design**: Optimized for vertical layouts on mobile devices with touch-friendly controls.

## How to Play

1. **Observe**: Compare your starting blue shape(s) with the dotted red target outline at the bottom.
2. **Cut**: Select the **Pen** tool. Draw lines along the grid edges to slice your pieces.
   - *Note: You can only cut along grid lines.*
3. **Arrange**: Select the **Move** tool. Drag pieces to the target area.
   - Tap buttons to **Rotate** or **Flip** the selected piece.
4. **Win**: The level is complete when all pieces fit perfectly inside the target outline without overlapping.

## Technical Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS via CDN
- **AI**: Google GenAI SDK (`@google/genai`)
- **Icons**: Lucide React
- **Build System**: No-build setup using native ES Modules and `importmap`.

## Development

This project uses a browser-native ESM setup. 
- `index.html`: Contains the import map and entry point.
- `src/`: (Conceptually the root) contains all React components and logic.

### AI Configuration
To enable the AI Hint feature, the application expects a valid Gemini API key. In this environment, it attempts to read `process.env.API_KEY`.

## Credits
Built with React and Google Gemini.
