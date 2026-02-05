# vCDR Python Integration Example

This document shows how the metricsService.js integrates with your vCDR Python scripts from the scoring_edits branch.

## How It Works

### 1. Transcript Format Conversion

Your conversation data gets converted to the exact format your vCDR script expects:

```javascript
// Input: Conversation history array
[
  { speaker: 'interviewer', content: 'Hello, how are you today?', timestamp: '...' },
  { speaker: 'simulated_user', content: 'I am doing well, thank you.', timestamp: '...' },
  { speaker: 'interviewer', content: 'Can you tell me about your memory?', timestamp: '...' }
]

// Output: vCDR transcript format string
`AGENT: Hello, how are you today?
PARTICIPANT: I am doing well, thank you.
AGENT: Can you tell me about your memory?
`
```

### 2. Python Script Generation

The system creates a custom Python script that:

1. **Imports your vCDR modules** from the scoring_edits branch
2. **Reads the formatted transcript** in "AGENT: xxx\nPARTICIPANT: xxx\n" format
3. **Converts to vCDR transcript items** format
4. **Calls your encode_response function** from individual_scoring.py
5. **Returns structured JSON results**

### 3. Example Generated Python Script

```python
import sys
import json
from pathlib import Path

# Add vCDR to Python path
vcdr_src = Path("/path/to/external/vCDR") / "src"
sys.path.insert(0, str(vcdr_src))

from voz_vcdr.processors.individual_scoring import encode_response

# Read transcript in format: "AGENT: text\nPARTICIPANT: text\n"
transcript_text = """AGENT: Hello, how are you today?
PARTICIPANT: I am doing well, thank you.
AGENT: Can you tell me about your memory?
PARTICIPANT: My memory is generally good."""

# Convert to vCDR transcript items
transcript_items = [
    {"speaker": "AGENT", "text": "Hello, how are you today?", "order": 1},
    {"speaker": "PARTICIPANT", "text": "I am doing well, thank you.", "order": 2},
    {"speaker": "AGENT", "text": "Can you tell me about your memory?", "order": 3},
    {"speaker": "PARTICIPANT", "text": "My memory is generally good.", "order": 4}
]

# Create survey config for analysis
survey_config = {
    "module_id": "benchmark_analysis",
    "questions": [
        {"id": "overall_quality", "prompt": "Rate conversation quality", "type": "analysis"}
    ]
}

# Call your vCDR scoring function
result = encode_response(
    json.dumps(survey_config),
    transcript_items
)

# Return structured results
print("VCDR_RESULT_START")
print(json.dumps({
    "success": True,
    "source": "vcdr_python_scoring",
    "results": result.model_dump()
}))
print("VCDR_RESULT_END")
```

### 4. Integration Flow

```
1. User clicks "Compute Quality Metrics" in UI
2. Node.js metricsService.js receives conversation history
3. Convert conversation to "AGENT: xxx\nPARTICIPANT: xxx\n" format
4. Generate custom Python script with your vCDR imports
5. Execute Python script with proper PYTHONPATH to vCDR/src
6. Parse structured JSON output from Python
7. Save results to database
8. Display in UI
```

## Testing the Integration

### Manual Test

You can test the transcript format conversion with this example:

```javascript
// Test the conversion function
const conversationHistory = [
  { speaker: 'interviewer', content: 'What is your name?', timestamp: '2024-01-01T10:00:00Z' },
  { speaker: 'simulated_user', content: 'My name is John.', timestamp: '2024-01-01T10:00:05Z' },
  { speaker: 'interviewer', content: 'How old are you?', timestamp: '2024-01-01T10:00:10Z' },
  { speaker: 'simulated_user', content: 'I am 65 years old.', timestamp: '2024-01-01T10:00:15Z' }
];

const vCDRFormat = convertToVCDRTranscriptFormat(conversationHistory);
console.log(vCDRFormat);

// Expected output:
// AGENT: What is your name?
// PARTICIPANT: My name is John.
// AGENT: How old are you?
// PARTICIPANT: I am 65 years old.
```

### Expected Python Dependencies

The integration assumes your vCDR environment has:

- Python 3.8+
- All vCDR dependencies from pyproject.toml
- Access to OpenAI API (for LLM scoring)
- Proper environment variables (.env file)

### Error Handling

The system includes robust error handling:

1. **Python Import Errors**: Falls back to simplified metrics
2. **vCDR Scoring Errors**: Captures and logs detailed error info
3. **Timeout Protection**: 60-second timeout for Python execution
4. **Parse Errors**: Graceful handling of malformed Python output

### Troubleshooting

**Common Issues:**

1. **"ImportError: Could not import vCDR modules"**
   - Check Python environment and dependencies
   - Verify PYTHONPATH includes vCDR/src

2. **"vCDR Python script timed out"**
   - Large transcripts may need longer processing time
   - Check OpenAI API connectivity and rate limits

3. **"Failed to parse vCDR output"**
   - Check Python script execution logs
   - Verify JSON output format

**Debug Logs:**

The system provides detailed logging:
- `[METRICS]` - Node.js metrics service logs
- `[PYTHON STDOUT]` - Python script output
- `[PYTHON STDERR]` - Python script errors

## Customization

You can customize the integration by:

1. **Modifying the survey config** in `createSurveyConfig()`
2. **Adjusting Python script template** in `callVCDRScoring()`
3. **Adding custom vCDR parameters** through the options parameter
4. **Extending transcript item format** in `convertToTranscriptItems()`

The integration is designed to be flexible and work with your existing vCDR scoring_edits branch while providing fallback options for development and testing.