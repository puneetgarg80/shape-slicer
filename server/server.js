import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveLog } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json()); // Parse JSON bodies

const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Endpoint to save logs
app.post('/api/logs', (req, res) => {
    const { sessionId, userName, actions } = req.body;

    if (!sessionId || !actions) {
        return res.status(400).json({ error: 'Missing sessionId or actions' });
    }

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${sessionId}.json`;
    const filePath = path.join(LOGS_DIR, filename);

    const logData = {
        sessionId,
        userName,
        lastUpdate: new Date().toISOString(),
        actions
    };

    saveLog(userName || 'anonymous', filename, logData)
        .then(() => {
            console.log(`[LOG] Saved ${actions.length} actions for session ${sessionId}`);
            res.json({ success: true, count: actions.length });
        })
        .catch((err) => {
            console.error('Error saving log:', err);
            res.status(500).json({ error: 'Failed to save log' });
        });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
