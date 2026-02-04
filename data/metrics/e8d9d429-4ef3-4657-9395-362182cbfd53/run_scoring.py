
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add vCDR to Python path
# Use raw string to handle Windows backslashes properly
vcdr_src = Path(r"C:\Users\hchen\Documents\GitHub\openai-realtime-console\external\vCDR") / "src"
sys.path.insert(0, str(vcdr_src))

try:
    from voz_vcdr.extract_responses import extract_responses_benchmark
    from voz_vcdr.models import SurveyResponse
    from ulid import ULID
    def moduleTitle2ID(title: str) -> str:
        mapping = {
            'Subject - Memory - Part 1': '01KEWNHMWCMHQZMW901TZY3V2W',
            'Subject - Memory - Part 2': '01KEWNHMX47Z4D9FQ4HD15BAV4',
            'Subject - Orientation': '01KEWNHMX47R4ZANXZB72XQZDX',
            'Subject - Judgement & Problem Solving': '01KEWNHMX44EKVHD18NXMZZ16V',
            'Partner - Memory - Part 1': '01KEWNHMX4SH8HEN1E4YTATQF2',
            'Partner - Memory - Part 2': '01KEWNHMX417VK0YR2YEVX9B75',
            'Partner - Orientation': '01KEWNHMX5R7Y0Z86K4XBNR1YW',
            'Partner - Judgement & Problem Solving': '01KEWNHMX5BJK9H4XRD9KNF29W',
            'Partner - Community Affairs': '01KEWNHMX56WKPKG1CDPESEQVQ',
            'Partner - Home & Hobbies': '01KEWNHMX5JD91W5R3DSWEH8X4',
            'Partner - Personal Care': '01KEWNHMX5A9EEHF9TTXBP98V3',
        }

        matches = [v for k, v in mapping.items() if k in title]

        if len(matches) != 1:
            raise ValueError(
                f"Expected exactly one match for title '{title}', found {len(matches)}"
            )

        return matches[0]
    # Read the transcript
    # Use raw string to handle Windows backslashes properly
    with open(r"C:\Users\hchen\Documents\GitHub\openai-realtime-console\data\metrics\e8d9d429-4ef3-4657-9395-362182cbfd53\transcript.txt", "r") as f:
        transcript_text = f.read().strip()

    # Collect vCDR metadata
    import subprocess
    import voz_vcdr

    metadata = {
        "analysis_timestamp": datetime.now().isoformat(),
        "python_version": sys.version,
        "vcdr_source_path": str(vcdr_src),
    }

    # Get Git information from vCDR repository
    try:
        vcdr_repo_path = vcdr_src.parent
        git_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'],
                                           cwd=vcdr_repo_path,
                                           stderr=subprocess.DEVNULL).decode().strip()
        git_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                                           cwd=vcdr_repo_path,
                                           stderr=subprocess.DEVNULL).decode().strip()
        metadata.update({
            "git_commit": git_commit,
            "git_branch": git_branch,
            "git_commit_short": git_commit[:8]
        })
    except Exception as e:
        metadata.update({
            "git_commit": "unknown",
            "git_branch": "unknown",
            "git_error": str(e)
        })

    # Get vCDR version if available
    try:
        if hasattr(voz_vcdr, '__version__'):
            metadata["vcdr_version"] = voz_vcdr.__version__
        else:
            metadata["vcdr_version"] = "development"
    except:
        metadata["vcdr_version"] = "unknown"

    # Use the interviewer prompt for module ID mapping
    interviewer_prompt = "Subject - Judgement & Problem Solving"
    conversation_id = "e8d9d429-4ef3-4657-9395-362182cbfd53"

    print(f"[PYTHON] Processing transcript for interviewer prompt: {interviewer_prompt}")
    print(f"[PYTHON] Conversation ID: {conversation_id}")
    print(f"[PYTHON] vCDR Metadata: {metadata}")

    # Call the vCDR scoring function
    try:
        module_id_string = moduleTitle2ID(interviewer_prompt)
        module_id = ULID.from_str(module_id_string)
        result = extract_responses_benchmark(conversation_id, transcript_text, module_id)

        # Convert result to dict if it's a Pydantic model
        if hasattr(result, 'model_dump'):
            vcdr_data = result.model_dump()
        elif hasattr(result, 'dict'):
            vcdr_data = result.dict()
        else:
            vcdr_data = result

        # Structure the complete result with metadata and vCDR data
        complete_result = {
            "success": True,
            "metadata": metadata,
            "vcdr_results": vcdr_data,
            "run_id": conversation_id
        }

        print("VCDR_RESULT_START")
        print(json.dumps(complete_result, indent=2, default=str))
        print("VCDR_RESULT_END")

    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "run_id": "e8d9d429-4ef3-4657-9395-362182cbfd53"
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
