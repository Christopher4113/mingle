from pinecone import Pinecone
from dotenv import load_dotenv
import os
import json
from datetime import datetime, timezone

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)


def _embed_text(text: str) -> list[float]:
    resp = pc.inference.embed(
        model="llama-text-embed-v2",
        inputs=[text],
        parameters={"input_type": "query"},
    )
    if not resp.data:
        raise ValueError("Embedding failed or returned empty result")
    return resp.data[0]["values"]


def fetch_user_vector(user_id: str):

    resp = index.fetch(ids=[user_id])
    return resp.vectors.get(user_id) if hasattr(resp, "vectors") else None


def user_exists(user_id: str) -> bool:
    return fetch_user_vector(user_id) is not None


def add_user_pinecone(user_id: str, username: str | None, text: str = "default user profile", bio: str | None = None):
    text_to_embed = bio if (bio and bio.strip()) else text
    embedding = _embed_text(text_to_embed)

    metadata: dict = {"user_id": user_id}
    if username:
        metadata["username"] = str(username)
    if bio:
        metadata["bio"] = str(bio)

    index.upsert(vectors=[{
        "id": user_id,
        "values": embedding,
        "metadata": metadata
    }])


def set_user_bio(user_id: str, bio: str):
    index.update(id=user_id, set_metadata={"bio": str(bio)})


def upsert_user_with_bio_reembed(user_id: str, username: str | None, bio: str):
    embedding = _embed_text(bio)
    metadata: dict = {"user_id": user_id, "bio": str(bio)}
    if username:
        metadata["username"] = str(username)

    index.upsert(vectors=[{
        "id": user_id,
        "values": embedding,
        "metadata": metadata
    }])


def get_context_from_pinecone(user_id: str):
    vec = fetch_user_vector(user_id)
    return vec.metadata if vec else None


def _ctx_key(interest: str) -> str:
    # Ensure stable, safe key names
    return f"ctx_{interest}"

def get_interest_context(user_id: str, interest: str) -> list[dict]:
    vec = fetch_user_vector(user_id)
    if not vec or not getattr(vec, "metadata", None):
        return []
    raw = vec.metadata.get(_ctx_key(interest))
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return []

def append_interest_context(
    user_id: str,
    interest: str,
    new_items: list[dict],
    max_items: int = 100,
):
    """
    new_items: list of {name:str, reason:str, score:int, ts?:str}
    """
    current = get_interest_context(user_id, interest)

    # Deduplicate by (name, reason) keeping highest score / most recent
    dedup = {(i.get("name","").strip().lower(), i.get("reason","").strip()): i for i in current}

    now_iso = datetime.now(timezone.utc).isoformat()
    for it in new_items:
        n = (it.get("name") or "").strip()
        r = (it.get("reason") or "").strip()
        s = int(it.get("score", 0))
        key = (n.lower(), r)
        entry = {"name": n, "reason": r, "score": s, "ts": it.get("ts") or now_iso}
        if key in dedup:
            # keep the higher-score / newer one
            prev = dedup[key]
            if s > int(prev.get("score", 0)) or (prev.get("ts","") < entry["ts"]):
                dedup[key] = entry
        else:
            dedup[key] = entry

    merged = list(dedup.values())
    # sort by score desc then recency desc
    merged.sort(key=lambda x: (int(x.get("score",0)), x.get("ts","")), reverse=True)
    if len(merged) > max_items:
        merged = merged[:max_items]

    # Write back to metadata
    index.update(
        id=user_id,
        set_metadata={_ctx_key(interest): json.dumps(merged, ensure_ascii=False)}
    )