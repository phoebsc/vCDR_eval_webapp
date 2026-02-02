import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SQLite Database Module for Benchmark Runs
 *
 * Provides persistent storage for benchmark runs with CRUD operations
 * following the schema defined in New_feature.md requirements.
 */

let db = null;

/**
 * Initialize SQLite database connection and create schema
 * @returns {Promise<sqlite3.Database>} Database connection
 */
export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const dataDir = path.join(__dirname, '..', 'data');
    const dbPath = path.join(dataDir, 'benchmarks.sqlite');

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('Connected to SQLite database at:', dbPath);

      // Create benchmark_runs table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS benchmark_runs (
          run_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'benchmark',
          num_turns INTEGER NOT NULL,
          interviewer_prompt_id TEXT NOT NULL,
          simulated_user_prompt_id TEXT NOT NULL,
          conversation_history_json TEXT NOT NULL,
          event_log_json TEXT NOT NULL
        )
      `;

      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating benchmark_runs table:', err);
          reject(err);
          return;
        }

        console.log('Database initialized successfully');
        resolve(db);
      });
    });
  });
}

/**
 * Save a completed benchmark run to the database
 * @param {string} runId - Unique run identifier
 * @param {Object} runData - Benchmark run data
 * @returns {Promise<Object>} Saved run data
 */
export function saveBenchmarkRun(runId, runData) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const {
      mode,
      conversation_history,
      event_log,
      interviewer_prompt_id,
      simulated_user_prompt_id
    } = runData;

    // Compute derived fields
    const num_turns = conversation_history ? conversation_history.length : 0;
    const created_at = new Date().toISOString();

    const insertQuery = `
      INSERT INTO benchmark_runs (
        run_id,
        created_at,
        mode,
        num_turns,
        interviewer_prompt_id,
        simulated_user_prompt_id,
        conversation_history_json,
        event_log_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      runId,
      created_at,
      mode || 'benchmark',
      num_turns,
      interviewer_prompt_id,
      simulated_user_prompt_id,
      JSON.stringify(conversation_history || []),
      JSON.stringify(event_log || [])
    ];

    db.run(insertQuery, params, function(err) {
      if (err) {
        console.error('Error saving benchmark run:', err);
        reject(err);
        return;
      }

      console.log(`Benchmark run ${runId} saved successfully`);
      resolve({
        run_id: runId,
        created_at,
        mode: mode || 'benchmark',
        num_turns,
        interviewer_prompt_id,
        simulated_user_prompt_id
      });
    });
  });
}

/**
 * Get metadata for all benchmark runs (excluding full transcript/event data)
 * @returns {Promise<Array>} Array of run metadata
 */
export function getBenchmarkRuns() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const selectQuery = `
      SELECT run_id, created_at, num_turns
      FROM benchmark_runs
      ORDER BY created_at DESC
    `;

    db.all(selectQuery, (err, rows) => {
      if (err) {
        console.error('Error retrieving benchmark runs:', err);
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

/**
 * Get a specific benchmark run by ID (full data)
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Complete run data
 */
export function getBenchmarkRun(runId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const selectQuery = `
      SELECT * FROM benchmark_runs WHERE run_id = ?
    `;

    db.get(selectQuery, [runId], (err, row) => {
      if (err) {
        console.error('Error retrieving benchmark run:', err);
        reject(err);
        return;
      }

      if (!row) {
        reject(new Error(`Benchmark run ${runId} not found`));
        return;
      }

      // Parse JSON fields
      const run = {
        ...row,
        conversation_history: JSON.parse(row.conversation_history_json),
        event_log: JSON.parse(row.event_log_json)
      };

      // Remove JSON string fields from response
      delete run.conversation_history_json;
      delete run.event_log_json;

      resolve(run);
    });
  });
}

/**
 * Close database connection
 */
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
        return;
      }

      console.log('Database connection closed');
      db = null;
      resolve();
    });
  });
}

/**
 * Get current database connection (for debugging)
 * @returns {sqlite3.Database|null} Current database connection
 */
export function getDatabase() {
  return db;
}