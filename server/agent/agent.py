from langchain_google_genai import ChatGoogleGenerativeAI
from langchain import PromptTemplate

from dotenv import load_dotenv
import os
import json
import re

# ------------ Env & LLM ------------
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Use a more stable model
LLM_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL,
    temperature=0.1,  # Lower temperature for more consistent output
    max_output_tokens=2048,
    api_key=GOOGLE_API_KEY,
)