
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add vCDR to Python path
vcdr_src = Path("C:\Users\hchen\Documents\GitHub\openai-realtime-console\external\vCDR") / "src"
sys.path.insert(0, str(vcdr_src))

try:
    from voz_vcdr.extract_responses import extract_responses_benchmark
    from voz_vcdr.models import SurveyResponse
    from ulid import ULID
    def moduleTitle2ID(title: str) -> str:
        mapping = {
            'Subject - Memory - Part 1': '1111',
            'Subject - Memory - Part 2': '2222',
            'Subject - Orientation': '3333',
            'Subject - Judgement & Problem Solving': '4444',
            'Partner - Memory - Part 1': '5555',
            'Partner - Memory - Part 2': '6666',
            'Partner - Orientation': '7777',
            'Partner - Judgement & Problem Solving': '9999',
            'Partner - Community Affairs': '8888',
            'Partner - Home & Hobbies': '55554',
            'Partner - Personal Care': '6677',
        }

        matches = [v for k, v in mapping.items() if k in title]

        if len(matches) != 1:
            raise ValueError(
                f"Expected exactly one match for title '{title}', found {len(matches)}"
            )

        return matches[0]
    # Read the transcript
    with open("C:\Users\hchen\Documents\GitHub\openai-realtime-console\data\metrics\0dcad5dc-507c-429d-a10e-40dbc7502224\transcript.txt", "r") as f:
        transcript_text = f.read().strip()

    # Use the interviewer prompt for module ID mapping
    interviewer_prompt = "interviewer"
    conversation_id = "0dcad5dc-507c-429d-a10e-40dbc7502224"

    print(f"[PYTHON] Processing transcript for interviewer prompt: {interviewer_prompt}")
    print(f"[PYTHON] Conversation ID: {conversation_id}")
    print(f"[PYTHON] Transcript length: {len(transcript_text)} characters")

    # Call the vCDR scoring function
    try:
        module_id_string = moduleTitle2ID(interviewer_prompt)
        module_id = ULID.from_str(module_id_string)
        result = extract_responses_benchmark(conversation_id, transcript_text, module_id)

        # Convert result to dict if it's a Pydantic model
        if hasattr(result, 'model_dump'):
            result_dict = result.model_dump()
        elif hasattr(result, 'dict'):
            result_dict = result.dict()
        else:
            result_dict = result

        print("VCDR_RESULT_START")
        print(json.dumps(result_dict, indent=2, default=str))
        print("VCDR_RESULT_END")

    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "run_id": "0dcad5dc-507c-429d-a10e-40dbc7502224"
        }
        print("VCDR_ERROR_START")
        print(json.dumps(error_output, indent=2))
        print("VCDR_ERROR_END")
        sys.exit(1)

except ImportError as e:
    print(f"IMPORT_ERROR: Could not import vCDR modules: {e}")
    sys.exit(2)
except Exception as e:
    print(f"GENERAL_ERROR: {e}")
    sys.exit(3)
