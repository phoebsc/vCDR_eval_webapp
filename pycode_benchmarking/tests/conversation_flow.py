def run(transcript: str) -> dict:
    lines = transcript.split("\n")
    agent = [l for l in lines if l.startswith("AGENT:")]
    participant = [l for l in lines if l.startswith("PARTICIPANT:")]

    total = len(lines)
    balance = len(participant) / len(agent) if agent else 0

    return {
        "title": "Conversation Flow Test",
        "variables": [
            {"metric": "Total Turns", "value": total},
            {"metric": "Turn Balance", "value": round(balance, 2)},
        ],
    }
