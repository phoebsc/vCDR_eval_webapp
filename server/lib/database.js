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
          interviewer_prompt_name TEXT,
          simulated_user_prompt_name TEXT,
          quality_metrics_json TEXT,
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

        // Add new columns if they don't exist (for existing databases)
        const addColumns = [
          `ALTER TABLE benchmark_runs ADD COLUMN interviewer_prompt_name TEXT`,
          `ALTER TABLE benchmark_runs ADD COLUMN simulated_user_prompt_name TEXT`,
          `ALTER TABLE benchmark_runs ADD COLUMN quality_metrics_json TEXT`,
          `ALTER TABLE benchmark_runs ADD COLUMN benchmark_tests_json TEXT`
        ];

        let completed = 0;
        addColumns.forEach(query => {
          db.run(query, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('Error adding column:', err);
            }
            completed++;
            if (completed === addColumns.length) {
              console.log('Database initialized successfully');
              resolve(db);
            }
          });
        });
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
      simulated_user_prompt_id,
      interviewer_prompt_name,
      simulated_user_prompt_name
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
        interviewer_prompt_name,
        simulated_user_prompt_name,
        conversation_history_json,
        event_log_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      runId,
      created_at,
      mode || 'benchmark',
      num_turns,
      interviewer_prompt_id,
      simulated_user_prompt_id,
      interviewer_prompt_name,
      simulated_user_prompt_name,
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
        simulated_user_prompt_id,
        interviewer_prompt_name,
        simulated_user_prompt_name
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
        event_log: JSON.parse(row.event_log_json),
        quality_metrics: row.quality_metrics_json ? JSON.parse(row.quality_metrics_json) : null,
        benchmark_tests: row.benchmark_tests_json ? JSON.parse(row.benchmark_tests_json) : null
      };

      // Remove JSON string fields from response
      delete run.conversation_history_json;
      delete run.event_log_json;
      delete run.quality_metrics_json;
      delete run.benchmark_tests_json;

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
 * Update quality metrics for a benchmark run
 * @param {string} runId - Run identifier
 * @param {Object} qualityMetrics - Quality metrics data
 * @returns {Promise<void>}
 */
export function updateQualityMetrics(runId, qualityMetrics) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const updateQuery = `
      UPDATE benchmark_runs
      SET quality_metrics_json = ?
      WHERE run_id = ?
    `;

    db.run(updateQuery, [JSON.stringify(qualityMetrics), runId], function(err) {
      if (err) {
        console.error('Error updating quality metrics:', err);
        reject(err);
        return;
      }

      if (this.changes === 0) {
        reject(new Error(`Benchmark run ${runId} not found`));
        return;
      }

      console.log(`Quality metrics updated for run: ${runId}`);
      resolve();
    });
  });
}

/**
 * Update benchmark tests for a benchmark run
 * @param {string} runId - Run identifier
 * @param {Object} benchmarkTests - Benchmark tests data
 * @returns {Promise<void>}
 */
export function updateBenchmarkTests(runId, benchmarkTests) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const updateQuery = `
      UPDATE benchmark_runs
      SET benchmark_tests_json = ?
      WHERE run_id = ?
    `;

    db.run(updateQuery, [JSON.stringify(benchmarkTests), runId], function(err) {
      if (err) {
        console.error('Error updating benchmark tests:', err);
        reject(err);
        return;
      }

      if (this.changes === 0) {
        reject(new Error(`Benchmark run ${runId} not found`));
        return;
      }

      console.log(`Benchmark tests updated for run: ${runId}`);
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