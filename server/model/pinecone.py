from pinecone import Pinecone
from dotenv import load_dotenv
import os

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
