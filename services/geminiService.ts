import { GoogleGenAI } from "@google/genai";
import { Piece, Cell } from '../types';
import { getAbsoluteCells } from '../utils/geometry';

// Initialize Gemini Client
// IMPORTANT: Access API key from process.env.API_KEY securely
let apiKey = '';
try {
  // Check specifically for the process global to avoid ReferenceErrors in strict browser environments
  if (typeof process !== 'undefined' && process.env) {
    apiKey = process.env.API_KEY || '';
  }
} catch (e) {
  // process is not available, ignore
}

// Clean the key
apiKey = apiKey.trim();

let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Failed to initialize Gemini Client", e);
  }
}

export const getGeminiHint = async (
  pieces: Piece[], 
  targetCells: Cell[]
): Promise<string> => {
  if (!ai) return "Gemini API Key is missing. Cannot generate hint.";

  // Construct a text representation of the current board state
  const allCells = pieces.flatMap(getAbsoluteCells);
  if (allCells.length === 0) return "No pieces on board.";

  const minX = Math.min(...allCells.map(c => c.x));
  const maxX = Math.max(...allCells.map(c => c.x));
  const minY = Math.min(...allCells.map(c => c.y));
  const maxY = Math.max(...allCells.map(c => c.y));
  
  let gridStr = "";
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const hasCell = allCells.some(c => c.x === x && c.y === y);
      gridStr += hasCell ? "#" : ".";
    }
    gridStr += "\n";
  }

  const prompt = `
    I am playing a geometry dissection puzzle.
    I have a shape represented by the following grid (Where '#' is a piece part and '.' is empty):
    
    ${gridStr}

    The goal is to cut this shape into exactly 2 pieces and rearrange them to form the target shape.
    
    Constraints:
    1. The solution must consist of exactly 2 pieces.
    2. Each piece must have at least 3 grid cells.
    
    Current state: ${pieces.length} pieces.
    
    Provide a short, cryptic but helpful hint on how to solve this. 
    If there is 1 piece, suggest where to cut (e.g., "Look for a staircase pattern"). 
    If there are 2 pieces, suggest how to arrange them (e.g., "Try filling the corners first").
    Keep it under 20 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || "The hint is unclear.";
  } catch (error: any) {
    // Handle 403 Permission Denied specifically to avoid alarming console errors
    // and provide better feedback to the user
    if (error.status === 403 || (error.message && error.message.includes('403'))) {
        console.warn("Gemini API Permission Denied. Please check API Key permissions.");
        return "Hint unavailable: Permission Denied.";
    }
    
    console.error("Gemini Error:", error);
    return "The stars are silent. Try moving pieces closer.";
  }
};