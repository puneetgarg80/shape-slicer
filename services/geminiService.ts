import { GoogleGenAI } from "@google/genai";
import { Piece, Cell } from '../types';
import { getAbsoluteCells } from '../utils/geometry';

// Initialize Gemini Client
// IMPORTANT: Access API key from process.env.API_KEY securely
// We wrap this in a try-catch and check typeof to avoid ReferenceError in purely browser environments
let apiKey = '';
try {
  if (typeof process !== 'undefined' && process.env) {
    apiKey = process.env.API_KEY || '';
  }
} catch (e) {
  console.warn('Unable to access process.env');
}

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
  // We will represent the grid as a string map.
  
  // 1. Build ASCII Map
  // Finding bounds
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

    The goal is to cut this shape into 2 pieces and rearrange them to form a perfect 6x6 square.
    
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
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The stars are silent. Try moving pieces closer.";
  }
};