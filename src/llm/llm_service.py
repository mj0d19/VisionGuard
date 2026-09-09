from __future__ import annotations

import json
import os
from pathlib import Path

from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv

# Load project-root .env even when the process cwd is elsewhere (e.g. uvicorn from another folder)
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Only load project-root .env (avoids find_dotenv() edge cases and cwd-dependent files)
load_dotenv(_PROJECT_ROOT / ".env")

CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "llama3.1-8b")


class LLMNotConfiguredError(RuntimeError):
    """Raised when CEREBRAS_API_KEY is missing or blank."""


def ask_llm(context: dict, question: str) -> str:
    """
    Sends the context and question to a LLM API and returns the answer.
    """
    prompt = json.dumps(
        {
            "instructions": (
                "Answer the question using only the provided database context from VisionGuard. "
                "Prefer concrete facts from segments, alerts, and run metadata. "
                "If the answer is not supported by the logs, say that it is not available in the database context."
            ),
            "context": context,
            "question": question,
        },
        indent=2,
        ensure_ascii=True,
        default=str,
    )

    raw_key = os.getenv("CEREBRAS_API_KEY")
    api_key = (raw_key or "").strip()
    if not api_key:
        base = (
            "LLM is not configured: set CEREBRAS_API_KEY in the environment or in the "
            "project root .env file. Get a key from https://cloud.cerebras.ai"
        )
        # Dotenv often sets an empty string when .env has CEREBRAS_API_KEY= with no value
        if raw_key is not None and not str(raw_key).strip():
            base += (
                " Your CEREBRAS_API_KEY entry exists but is empty — paste the secret "
                "after the equals sign on one line, save .env, and restart the API server."
            )
        raise LLMNotConfiguredError(base)

    client = Cerebras(api_key=api_key)
    chat_completion = client.chat.completions.create(
        model=CEREBRAS_MODEL,
        max_tokens=512,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant for video event analysis. Use the database context exactly as provided.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    return chat_completion.choices[0].message.content.strip()
