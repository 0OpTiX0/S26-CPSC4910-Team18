from fastapi import APIRouter, HTTPException
from user import UserLogin
from <security_file> import <verify_password>
from <jwt_file> import <create_token>

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/driver/login")
def driver_login(credentials: UserLogin):
    user = next((u for u in <db> if u["email"] == credentials.email), None)

    if not user or user["role"] != "driver":
        raise HTTPException(status_code=401, detail="Invalid driver credentials")

    if not <verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid driver credentials")

    token = <create_token>
    return {"access_token": token, "token_type": bearer}

@router.post("/driver/sponsor")
def sponsor_login(credentials: UserLogin):
    user = next((u for u in <db> if u["email"] == credentials.email), None)

    if not user or user["role"] != "sponsor":
        raise HTTPException(status_code=401, detail="Invalid driver credentials")

    if not <verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid driver credentials")

    token = <create_token>
    return {"access_token": token, "token_type": bearer}
