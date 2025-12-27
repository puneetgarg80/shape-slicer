import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, 'logs');

const storageDriver = process.env.STORAGE_DRIVER || 'fs';
const bucketName = process.env.GCS_BUCKET_NAME;

let gcsBucket = null;
if (storageDriver === 'gcs') {
    if (!bucketName) {
        console.error("STORAGE_DRIVER is 'gcs' but GCS_BUCKET_NAME is not set. Falling back to 'fs'.");
    } else {
        try {
            const storage = new Storage();
            gcsBucket = storage.bucket(bucketName);
            console.log(`[STORAGE] GCS Driver initialized for bucket: ${bucketName}`);
        } catch (err) {
            console.error("[STORAGE] Failed to initialize GCS Driver:", err);
        }
    }
} else {
    // Ensure local logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
}

/**
 * Saves log data to the configured storage backend.
 * 
 * @param {string} userName - The name of the user
 * @param {string} filename - The name of the file (e.g. sess-123.json)
 * @param {object} data - The JSON object to save
 * @returns {Promise<void>}
 */
export async function saveLog(userName, filename, data) {
    const jsonString = JSON.stringify(data, null, 2);

    if (storageDriver === 'gcs' && gcsBucket) {
        const destination = `users/${userName}/logs/${filename}`;
        const file = gcsBucket.file(destination);

        try {
            await file.save(jsonString, {
                contentType: 'application/json',
                metadata: {
                    cacheControl: 'no-cache',
                },
            });
            console.log(`[STORAGE] Saved to GCS: gs://${bucketName}/${destination}`);
        } catch (err) {
            console.error(`[STORAGE] Error saving to GCS:`, err);
            throw err;
        }
    } else {
        // File System Fallback
        const filePath = path.join(LOGS_DIR, filename);
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, jsonString, (err) => {
                if (err) {
                    console.error('[STORAGE] Error writing local file:', err);
                    reject(err);
                } else {
                    console.log(`[STORAGE] Saved locally: ${filePath}`);
                    resolve();
                }
            });
        });
    }
}
