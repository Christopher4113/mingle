from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
import os
load_dotenv()

TOKEN_SECRET = os.getenv("TOKEN_SECRET")  # 👈 use the SAME var as Next.js
ALGORITHM = os.getenv("ALGORITHM", "HS256")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # You can still use this to extract token

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate JWT",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, TOKEN_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        username = payload.get("username")
        if user_id is None:
            raise credentials_exception
        return {"user_id": user_id, "username": username}
    except JWTError:
        raise credentials_exception