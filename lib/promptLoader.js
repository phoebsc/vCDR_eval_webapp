import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and parse YAML prompt files
 * Simple YAML parser for our specific use case
 */
function parseSimpleYAML(yamlContent) {
  const lines = yamlContent.split('\n');
  const result = {};
  let currentKey = null;
  let currentValue = '';
  let inMultiline = false;
  let indentLevel = 0;

  for (let line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      if (inMultiline && currentKey) {
        currentValue += '\n';
      }
      continue;
    }

    // Handle multiline strings (starting with |)
    if (trimmedLine.endsWith('|')) {
      const key = trimmedLine.slice(0, -1).trim().replace(':', '');
      currentKey = key;
      currentValue = '';
      inMultiline = true;
      continue;
    }

    if (inMultiline) {
      // Check if we're still in the multiline block
      const lineIndent = line.length - line.trimStart().length;
      if (indentLevel === 0) {
        indentLevel = lineIndent;
      }

      if (lineIndent >= indentLevel && trimmedLine) {
        if (currentValue) currentValue += '\n';
        currentValue += line.slice(indentLevel);
      } else {
        // End of multiline block
        result[currentKey] = currentValue;
        inMultiline = false;
        currentKey = null;
        currentValue = '';
        indentLevel = 0;

        // Process this line as a regular key-value pair
        if (trimmedLine.includes(':')) {
          const [key, ...valueParts] = trimmedLine.split(':');
          const value = valueParts.join(':').trim();

          if (value.startsWith('"') && value.endsWith('"')) {
            result[key.trim()] = value.slice(1, -1);
          } else {
            result[key.trim()] = value || {};
          }
        }
      }
    } else {
      // Handle regular key-value pairs
      if (trimmedLine.includes(':')) {
        const [key, ...valueParts] = trimmedLine.split(':');
        const value = valueParts.join(':').trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          result[key.trim()] = value.slice(1, -1);
        } else if (value) {
          result[key.trim()] = value;
        } else {
          result[key.trim()] = {};
        }
      }
    }
  }

  // Handle case where file ends while in multiline
  if (inMultiline && currentKey) {
    result[currentKey] = currentValue;
  }

  return result;
}

/**
 * Load a prompt configuration from YAML file
 * @param {string} promptName - Name of the prompt file (without .yaml extension)
 * @returns {Object} Parsed prompt configuration
 */
export function loadPrompt(promptName) {
  try {
    const promptsDir = path.join(__dirname, '..', 'prompts');
    const filePath = path.join(promptsDir, `${promptName}.yaml`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }

    const yamlContent = fs.readFileSync(filePath, 'utf-8');
    const config = parseSimpleYAML(yamlContent);

    return config;
  } catch (error) {
    console.error(`Error loading prompt "${promptName}":`, error);
    throw error;
  }
}

/**
 * Get the system prompt text for a specific role
 * @param {string} promptName - Name of the prompt file
 * @returns {string} System prompt text
 */
export function getSystemPrompt(promptName) {
  const config = loadPrompt(promptName);
  return config.prompt || '';
}

/**
 * Get the full configuration for a specific prompt
 * @param {string} promptName - Name of the prompt file
 * @returns {Object} Complete prompt configuration
 */
export function getPromptConfig(promptName) {
  return loadPrompt(promptName);
}