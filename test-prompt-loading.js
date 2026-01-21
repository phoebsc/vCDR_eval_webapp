import { getSystemPrompt, getPromptConfig } from './lib/promptLoader.js';

console.log('Testing text file loading...\n');

try {
  // Test candidate prompt
  console.log('=== CANDIDATE CONFIG ===');
  const candidateConfig = getPromptConfig('candidate');
  console.log('Config:', candidateConfig);
  console.log('\nSystem Prompt:');
  console.log(getSystemPrompt('candidate'));

  console.log('\n=== INTERVIEWER CONFIG ===');
  const interviewerConfig = getPromptConfig('interviewer');
  console.log('Config:', interviewerConfig);
  console.log('\nSystem Prompt:');
  console.log(getSystemPrompt('interviewer'));

  console.log('\n✅ Text files loaded successfully!');
} catch (error) {
  console.error('❌ Error loading text files:', error);
}