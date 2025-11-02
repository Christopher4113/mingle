from typing import List
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from helpers.extractToken import get_current_user
from model.pinecone import (
    add_user_pinecone,
    append_interest_context,
    get_interest_context,
    user_exists,
    fetch_user_vector,
    set_user_bio,
    upsert_user_with_bio_reembed,
    index
)
from agent.agent import recommend_names_from_pool
from pydantic import BaseModel, Field
from enum import Enum


class InterestType(str, Enum):
    networking = "Networking"
    social = "Social"
    wellness = "Wellness"
    creative = "Creative"
    learning = "Learning"


# ---------- Schemas ----------
class RecommendationsIn(BaseModel):
    bio: str | None = None
    profile: str | None = None
    interest: InterestType = InterestType.networking

class RecommendationsBulkIn(BaseModel):
    snippets: List[str] = Field(default_factory=list, description="Other people's bio snippets")
    names: List[str] = Field(default_factory=list, description="Candidate names")


class RecommendationsRequest(RecommendationsIn, RecommendationsBulkIn):
    pass

class RecommendationItem(BaseModel):
    name: str
    score: int = Field(ge=0, le=100)
    reason: str

class RecommendationsOut(BaseModel):
    ok: bool
    user_id: str
    created_user: bool
    added_bio_now: bool
    has_bio_after: bool
    recommendations: List[RecommendationItem] = Field(default_factory=list)

# ---------- App ----------
app = FastAPI()
origins = [
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI!"}

@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "username": current_user["username"]
    }

@app.post("/register_pinecone_user")
def register_user_in_pinecone(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    username = current_user["username"]
    default_text = f"This is the profile for {username}"
    add_user_pinecone(user_id=user_id, username=username, text=default_text)
    return {"message": f"User {username} registered in Pinecone with ID {user_id}"}

@app.get("/check_user_exists")
def check_user_exists(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    try:
        response = index.fetch(ids=[user_id])
        exists = user_id in response.vectors
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- The wired endpoint ----------
@app.post("/recommendations", response_model=RecommendationsOut)
def get_recommendations(
    body: RecommendationsRequest,
    top_k: int = Query(5, ge=1, le=50, description="Max number of names to return"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    username = current_user["username"]

    # Normalize inputs
    bio = (body.bio or "").strip()
    snippets = [s.strip() for s in (body.snippets or []) if s and s.strip()]
    names = [n.strip() for n in (body.names or []) if n and n.strip()]
    profile = (body.profile or "").strip()
    interest = body.interest

    if not names:
        raise HTTPException(status_code=400, detail="`names` is required and cannot be empty.")
    if not snippets:
        # Not fatal, but warn—LLM can still match by user bio alone.
        # You can make this a 400 if you prefer strict input.
        snippets = []

    # Pinecone bookkeeping (create user, attach or update bio)
    if not user_exists(user_id):
        add_user_pinecone(
            user_id=user_id,
            username=username,
            text=f"This is the profile for {username}",
            bio=bio if bio else None
        )
        created = True
    else:
        created = False

    vec = fetch_user_vector(user_id)
    has_bio_already = bool(vec and getattr(vec, "metadata", {}) and vec.metadata.get("bio"))

    if bio and not has_bio_already:
        upsert_user_with_bio_reembed(user_id=user_id, username=username, bio=bio)
        added_bio_now = True
    else:
        added_bio_now = False

    # ✅ Always re-fetch the latest vector metadata from Pinecone
    updated_vec = fetch_user_vector(user_id)
    stored_bio = ""
    if updated_vec and getattr(updated_vec, "metadata", None):
        stored_bio = updated_vec.metadata.get("bio", "").strip()

    # Fall back to incoming bio if Pinecone bio is empty
    final_bio = stored_bio or bio

    prior_ctx = get_interest_context(user_id, interest.value)
    
    # ---- Call the LLM recommender ----
    try:
        recs_raw = recommend_names_from_pool(
            bio=final_bio,
            snippets=snippets,
            names=names,
            profile=profile,
            prior_context=prior_ctx,
            top_k=min(top_k, len(names)),
        )
        # Coerce to pydantic schema (validates and trims)
        recs_items = [RecommendationItem(**r) for r in recs_raw]
    except Exception as e:
        # Surface a clean error; you can log full details server-side
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {e}")
    
    try:
        append_interest_context(
            user_id=user_id,
            interest=interest.value,
            new_items=[r.model_dump() for r in recs_items],  # includes name/reason/score
            max_items=100,  # tune as needed
        )
    except Exception:
        pass

    return RecommendationsOut(
        ok=True,
        user_id=user_id,
        created_user=created,
        added_bio_now=added_bio_now,
        has_bio_after=bool(final_bio),
        recommendations=recs_items,
    )