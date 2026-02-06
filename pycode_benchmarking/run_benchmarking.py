import argparse
import json
from datetime import datetime
from pathlib import Path
import traceback
import sys

from tests import (
    conversation_flow,
    # engagement,
    # response_quality,
    # conversation_health,
)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--options", required=True)

    args = parser.parse_args()

    transcript = Path(args.transcript).read_text().strip()

    try:
        tests = [
            conversation_flow.run(transcript),
            # engagement.run(transcript),
            # response_quality.run(transcript),
            # conversation_health.run(transcript),
        ]

        print("BENCHMARK_RESULT_START")
        print(json.dumps({
            "success": True,
            "run_id": args.run_id,
            "timestamp": datetime.now().isoformat(),
            "tests": tests,
        }, indent=2))
        print("BENCHMARK_RESULT_END")

    except Exception as e:
        # Print full traceback to stderr for debugging
        traceback.print_exc(file=sys.stderr)

        print("BENCHMARK_ERROR_START")
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
        }, indent=2))
        print("BENCHMARK_ERROR_END")
        raise SystemExit(1)

if __name__ == "__main__":
    main()
