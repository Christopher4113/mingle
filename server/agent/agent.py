from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from typing import List, Dict, Any
from dotenv import load_dotenv
import os
import json
import re

# ------------ Env & LLM ------------
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Use a more stable model
LLM_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL,
    temperature=0.1,  # Lower temperature for more consistent output
    max_output_tokens=2048,
    api_key=GOOGLE_API_KEY,
)

def recommend_names_from_pool(
    bio: str,
    snippets: List[str],
    names: List[str],
    top_k: int = 5,
    llm: ChatGoogleGenerativeAI = llm,
) -> List[Dict[str, Any]]:
    """
    Given a user's bio, a set of other people's bio snippets, and a candidate name pool,
    use Gemini (via LangChain) to recommend up to top_k names from the pool.

    Returns a list of dicts like:
      [{"name": "...","score": 0-100,"reason": "..."}]
    """

    # Guardrails / defaults
    bio = (bio or "").strip()
    snippets = [s.strip() for s in (snippets or []) if s and s.strip()]
    names = [n.strip() for n in (names or []) if n and n.strip()]
    if not names:
        return []

    # Prompt: keep it tight, constrain output, forbid inventing names
    template = """
        You are helping pick relevant people for a user to connect with.

        USER BIO:
        {bio}

        OTHER PEOPLE'S BIOS (snippets):
        {snippets_block}

        CANDIDATE NAMES (the only names you may choose from):
        {names_block}

        TASK:
        1) Select up to {top_k} names from the CANDIDATE NAMES that best match the USER BIO,
        using the OTHER PEOPLE'S BIOS as evidence of fit (skills, interests, domain, goals).
        2) Assign a 0-100 relevance score (higher is better).
        3) Briefly explain the reason for each pick (one sentence).
        4) DO NOT invent names that are not in CANDIDATE NAMES.

        STRICT OUTPUT (valid JSON only, no prose outside JSON):
        {{
        "recommendations": [
            {{"name": "<name from candidate list>", "score": <int 0-100>, "reason": "<short reason>"}}
        ]
        }}
    """
    prompt = PromptTemplate.from_template(template)

    # Build neat bullet blocks to help the model
    snippets_block = "\n".join(f"- {s}" for s in snippets) if snippets else "- (none provided)"
    names_block = "\n".join(f"- {n}" for n in names)

    formatted = prompt.format(
        bio=bio,
        snippets_block=snippets_block,
        names_block=names_block,
        top_k=min(max(top_k, 1), len(names)),
    )

    # Call LLM
    result = llm.invoke(formatted)
    raw = getattr(result, "content", result)  # ChatGoogleGenerativeAI returns an object with .content

    # Parse JSON robustly
    def _parse_recs(txt: str) -> List[Dict[str, Any]]:
        # Try direct JSON
        try:
            obj = json.loads(txt)
            recs = obj.get("recommendations", [])
            if isinstance(recs, list):
                return recs
        except Exception:
            pass
        # Try to extract the first JSON object
        m = re.search(r"\{.*\}", txt, flags=re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(0))
                recs = obj.get("recommendations", [])
                if isinstance(recs, list):
                    return recs
            except Exception:
                pass
        return []

    recs = _parse_recs(raw)

    # Post-validate: keep only candidates that are in the provided pool; coerce fields
    name_set = {n.lower(): n for n in names}
    cleaned = []
    for r in recs:
        n = (r.get("name") or "").strip()
        if n.lower() in name_set:
            try:
                score = int(r.get("score", 0))
            except Exception:
                score = 0
            reason = (r.get("reason") or "").strip()
            cleaned.append({"name": name_set[n.lower()], "score": max(0, min(100, score)), "reason": reason})

    # If model returns more than top_k, trim; also sort by score desc
    cleaned.sort(key=lambda x: x.get("score", 0), reverse=True)
    cleaned = cleaned[: min(max(top_k, 1), len(names))]

    return cleaned