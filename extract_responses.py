import argparse
import logging
import os
import json
from dotenv import load_dotenv
from pathlib import Path
from ulid import ULID
from voz_vcdr.models import SurveyResponse
from voz_vcdr.processors.individual_scoring import encode_response
from voz_vcdr.processors.report_generator import (
    generate_csv_report,
    generate_html_report,
)

from voz_sdk.models import (
    QuestionResponse as VozQuestionResponse,
    QuestionResponses,
)
from voz_sdk.client import VozApi

from voz_vcdr.utils import (
    extract_transcript,
    fetch_survey_module,
    fetch_chosen_transcript_for_module,
    load_survey_config,
    reorder_module_questions
)

logging.basicConfig(
    level=logging.INFO,
    format="{asctime} - {levelname} - {message}",
    style="{",
    datefmt="%Y-%m-%d %H:%M",
)

logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv(override=True)


def upload_responses(conversation_id: ULID, module_id: ULID, data: SurveyResponse):
    """
    Post extracted responses to voz
    """
    responses = [
        VozQuestionResponse(
            questionId=q.id,
            agentTranscript=q.ai_transcript,
            participantTranscript=q.user_transcript,
            answer=q.answer,
            asked=q.asked,
            answered=q.answered,
            orderPosition=q.order_position,
            recallAttempts=q.recall_attempts,
            attemptDetails=q.attempt_details,
        )
        for q in data.questions
    ]
    model = QuestionResponses(responses)

    client = VozApi()
    response = client.post_responses(conversation_id, module_id, model)
    response.raise_for_status()


def extract_responses(conversation_id: ULID, module_id: ULID, upload: bool = True):
    local_workspace: Path = (
        Path(os.getenv("LOCAL_WORKSPACE") or ".") / str(conversation_id) / "scoring"
    )
    local_workspace.mkdir(parents=True, exist_ok=True)
    logger.info(f"Using workspace {local_workspace}")


    # Read the transcript
    full_transcript = fetch_chosen_transcript_for_module(conversation_id, module_id)
    module_transcript = extract_transcript(full_transcript, module_id)

    # Load the survey
    module = fetch_survey_module(module_id)
    module_reorder = reorder_module_questions(module)
    survey = load_survey_config(module_reorder)

    # Score the survey
    scored_result = encode_response(
        survey.model_dump_json(indent=True), module_transcript
    )

    if upload:
        upload_responses(conversation_id, module_id, scored_result)

    # Save the scoring output
    scoring_file = local_workspace / f"{module_id}_responses.json"
    with open(scoring_file, "w") as f:
        json.dump(scored_result.model_dump(), f, indent=4)
    logger.info(f"Scoring results saved to: {scoring_file}")

    # Save csv report
    report_path = local_workspace / f"{module_id}_responses.csv"
    generate_csv_report(scored_result, module_reorder, report_path)
    logger.info(f"csv report saved to: {report_path}")

    # Save html report
    html = generate_html_report(scored_result.model_dump())
    html_file = local_workspace / f"{module_id}_responses.html"
    with open(html_file, "w") as f:
        f.write(html)
    logger.info(f"HTML report saved to: {html_file}")


# def extract_responses_subject_judgment(conversation_id: ULID, module_id: ULID, upload: bool = True):
#     # TODO: BLOCKED response_scoring is not picked up at utils.fetch_survey_module
    
#     # TODO: testing
#     # subject
#     # memory part 1: 01KEWNHMWCMHQZMW901TZY3V2W
#     # memory part 2: 01KEWNHMX47Z4D9FQ4HD15BAV4
#     # orientation: 01KEWNHMX47R4ZANXZB72XQZDX
#     # judgment: 01KEWNHMX44EKVHD18NXMZZ16V
#     # partner

#     module_id = '01KEWNHMX44EKVHD18NXMZZ16V'
#     conversation_id = '01KFGYDFZEZ6Q11DE9AFN9WNJM'
    
#     local_workspace: Path = (
#         Path(os.getenv("LOCAL_WORKSPACE") or ".") / str(conversation_id) / "scoring"
#     )
#     local_workspace.mkdir(parents=True, exist_ok=True)
#     logger.info(f"Using workspace {local_workspace}")

#     # Read the transcript
#     full_transcript = fetch_chosen_transcript_for_module(conversation_id, module_id)
#     module_transcript = extract_transcript(full_transcript, module_id)

#     # Load the survey
#     module = fetch_survey_module(module_id)
#     # survey = load_survey_config_subject_judgment(module)

#     # Score the survey
#     scored_result = encode_response(
#         survey.model_dump_json(indent=True), module_transcript
#     )

#     if upload:
#         upload_responses(conversation_id, module_id, scored_result)

#     # Save the scoring output
#     scoring_file = local_workspace / f"{module_id}_responses.json"
#     with open(scoring_file, "w") as f:
#         json.dump(scored_result.model_dump(), f, indent=4)
#     logger.info(f"Scoring results saved to: {scoring_file}")

#     # Save csv report
#     report_path = local_workspace / f"{module_id}_responses.csv"
#     generate_csv_report(scored_result, module, report_path)
#     logger.info(f"csv report saved to: {report_path}")

#     # Save html report
#     html = generate_html_report(scored_result.model_dump())
#     html_file = local_workspace / f"{module_id}_responses.html"
#     with open(html_file, "w") as f:
#         f.write(html)
#     logger.info(f"HTML report saved to: {html_file}")


def cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--conversation_id", action="store", required=True)
    parser.add_argument("-m", "--module_id", action="store")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-u", "--upload", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logger.level = logging.DEBUG

    if args.module_id:
        extract_responses(args.conversation_id, args.module_id, args.upload)
    else:
        voz = VozApi()
        conversation = voz.get_conversation(args.conversation_id)
        for cm in [
            x
            for x in conversation.conversationModules
            if x.wasCompleted and "ARQ" not in x.moduleTitle
        ]:
            logger.info("-" * len(cm.moduleTitle))
            logger.info(cm.moduleId)
            logger.info(cm.moduleTitle)
            logger.info("-" * len(cm.moduleTitle))
            extract_responses(args.conversation_id, cm.moduleId, args.upload)


if __name__ == "__main__":
    cli()
