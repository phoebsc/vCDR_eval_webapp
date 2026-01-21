import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and parse text prompt files
 * Simple text file loader for prompt configurations
 */

/**
 * Load a prompt configuration from text file
 * @param {string} promptName - Name of the prompt file (without .txt extension)
 * @returns {Object} Parsed prompt configuration
 */
export function loadPrompt(promptName) {
  try {
    const promptsDir = path.join(__dirname, '..', 'prompts');
    const filePath = path.join(promptsDir, `${promptName}.txt`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }

    const textContent = fs.readFileSync(filePath, 'utf-8');

    // Return a simple config object with the text content as the prompt
    const config = {
      name: promptName.charAt(0).toUpperCase() + promptName.slice(1),
      prompt: textContent.trim(),
      // Default values that were previously in YAML
      model: promptName === 'interviewer' ? 'gpt-realtime' : 'gpt-4',
      role: promptName
    };

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