from typing import List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from helpers.extractToken import get_current_user
from model.pinecone import (
    add_user_pinecone,
    user_exists,
    fetch_user_vector,
    set_user_bio,
    upsert_user_with_bio_reembed,
    index
)
from pydantic import BaseModel, Field


class RecommendationsIn(BaseModel):
    bio: str | None = None

class RecommendationsBulkIn(BaseModel):
    snippets: List[str] = Field(default_factory=list, description="Other's Bio")
    names: List[str] = Field(default_factory=list, description="Other's Names")

class RecommendationsRequest(RecommendationsIn, RecommendationsBulkIn):
    pass

app = FastAPI()
origins = [
    "http://localhost:3000",  # your frontend
    # add more origins if deployed
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
    
    # You can customize this text to represent the user's profile, preferences, etc.
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
    
@app.post("/recommendations")
def get_recommendations(body: RecommendationsRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    username = current_user["username"]
    bio = (body.bio or "").strip()
    snippets = [s.strip() for s in body.snippets if s and s.strip()]
    names = [n.strip() for n in body.names if n and n.strip()]
    if not user_exists(user_id):
        add_user_pinecone(user_id=user_id, username=username, text=f"This is the profile for {username}", bio=bio if bio else None)
        created = True
    else:
        created = False
    vec = fetch_user_vector(user_id)
    has_bio_already = bool(vec and vec.metadata and vec.metadata.get("bio"))

    if bio and not has_bio_already:
        upsert_user_with_bio_reembed(user_id=user_id, username=username, bio=bio)
        updated_bio = True
    else:
        updated_bio = False
    

    return {
        "ok": True,
        "user_id": user_id,
        "created_user": created,
        "added_bio_now": updated_bio,
        "has_bio_after": True if (bio or has_bio_already) else False,
        "note": "Ready for recommendation logic next."
    }