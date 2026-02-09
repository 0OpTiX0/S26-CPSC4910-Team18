from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select, Session, delete
from sqlalchemy import func  # <-- IMPORTANT (fixes your func NameError)
from encrypt import encryptString, verifyPassword
from datetime import datetime, timezone, timedelta
from mailTo import emailSponsor
from typing import Optional, Literal
import secrets
from pydantic import BaseModel

from db import getSession

from models import (
    User,
    Sponsor,
    Market,
    Driver_User,
    Sponsor_User,
    Driver_Application,
    UserCreate,
    LoginRequest,
    DeleteRequest,
    ApplicationRequest,
    AppDeleteReq,
    SponsorCreate,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

# -------------------------
# USERS
# -------------------------

@app.get("/user")
def getUsers(session: Session = Depends(getSession)):
    return session.exec(select(User)).all()

@app.post("/user")
def createUser(payload: UserCreate, session: Session = Depends(getSession)):
    # Uniqueness checks
    if session.exec(select(User).where(User.User_Email == payload.email)).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    if session.exec(select(User).where(User.User_Phone_Num == payload.phone)).first():
        raise HTTPException(status_code=409, detail="Phone already in use")

    # 1) Create User (login uses this)
    user = User(
        User_Name=payload.name,
        User_Role=payload.role,
        User_Email=payload.email,
        User_Phone_Num=payload.phone,
        User_Hashed_Pss=encryptString(payload.pssw),
        User_Login_Attempts=0,
        User_Lockout_Time=None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # 2) If sponsor role, also ensure Sponsor row exists + link Sponsor_User
    if (payload.role or "").lower() == "sponsor":
        sponsor = session.exec(
            select(Sponsor).where(Sponsor.Sponsor_Email == payload.email)
        ).first()

        if not sponsor:
            sponsor = Sponsor(
                Sponsor_Name=payload.name,
                Sponsor_Description="",
                Sponsor_Email=payload.email,
                Sponsor_Phone_Num=payload.phone,
            )
            session.add(sponsor)
            session.commit()
            session.refresh(sponsor)

        # Link table (UserID -> Sponsor_ID)
        link = session.exec(
            select(Sponsor_User).where(Sponsor_User.UserID == user.UserID)
        ).first()

        if not link:
            link = Sponsor_User(UserID=user.UserID, Sponsor_ID=sponsor.Sponsor_ID)
            session.add(link)
            session.commit()

    return {"userId": user.UserID, "role": user.User_Role, "email": user.User_Email}

@app.delete("/user")
def deleteUser(payload: DeleteRequest, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.User_Name == payload.target)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist")

    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully"}

# -------------------------
# LOGIN (User table)
# -------------------------

LOCKOUT_THRESHOLD = 3
LOCKOUT_DURATION = timedelta(seconds=60)

@app.post("/login")
def login(payload: LoginRequest, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.User_Email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now = datetime.now(timezone.utc)

    if user.User_Lockout_Time:
        lockout_until = user.User_Lockout_Time.replace(tzinfo=timezone.utc) + LOCKOUT_DURATION
        if now < lockout_until:
            remaining = int((lockout_until - now).total_seconds())
            raise HTTPException(status_code=403, detail={"message": "Account locked", "remaining_seconds": remaining})
        user.User_Login_Attempts = 0
        user.User_Lockout_Time = None
        session.add(user)
        session.commit()
        session.refresh(user)

    if not verifyPassword(payload.password, user.User_Hashed_Pss):
        user.User_Login_Attempts = (user.User_Login_Attempts or 0) + 1

        if user.User_Login_Attempts >= LOCKOUT_THRESHOLD:
            user.User_Lockout_Time = now
            session.add(user)
            session.commit()
            raise HTTPException(status_code=403, detail={"message": "Account locked", "remaining_seconds": int(LOCKOUT_DURATION.total_seconds())})

        session.add(user)
        session.commit()
        remaining_attempts = max(0, LOCKOUT_THRESHOLD - user.User_Login_Attempts)
        raise HTTPException(status_code=401, detail={"message": "Invalid credentials", "remaining_attempts": remaining_attempts})

    user.User_Login_Attempts = 0
    user.User_Lockout_Time = None
    session.add(user)
    session.commit()

    return {
        "message": "Login successful",
        "userId": user.UserID,
        "role": user.User_Role,
        "email": user.User_Email,
        "name": user.User_Name,
    }

# -------------------------
# PASSWORD RESET / CHANGE
# -------------------------

_reset_tokens: dict[str, dict] = {}

class PasswordResetEmailRequest(BaseModel):
    email: str

class PasswordResetRequest(BaseModel):
    token: str
    new_password: str

class PasswordChangeRequest(BaseModel):
    email: str
    current_password: str
    new_password: str

@app.post("/password/change")
def change_password(payload: PasswordChangeRequest, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.User_Email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verifyPassword(payload.current_password, user.User_Hashed_Pss):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.User_Hashed_Pss = encryptString(payload.new_password)
    user.User_Login_Attempts = 0
    user.User_Lockout_Time = None
    session.add(user)
    session.commit()
    return {"message": "Password updated successfully"}

@app.post("/password/request-reset")
def request_password_reset(payload: PasswordResetEmailRequest, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.User_Email == payload.email)).first()
    if not user:
        return {"message": "If that email exists, a reset link was sent."}

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "userId": user.UserID,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=20)).timestamp(),
    }
    return {"message": "Reset token generated (demo).", "token": token}

@app.post("/password/reset")
def reset_password(payload: PasswordResetRequest, session: Session = Depends(getSession)):
    record = _reset_tokens.get(payload.token)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if datetime.now(timezone.utc).timestamp() > float(record["expiresAt"]):
        _reset_tokens.pop(payload.token, None)
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user = session.get(User, int(record["userId"]))
    if not user:
        _reset_tokens.pop(payload.token, None)
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.User_Hashed_Pss = encryptString(payload.new_password)
    user.User_Login_Attempts = 0
    user.User_Lockout_Time = None

    session.add(user)
    session.commit()
    _reset_tokens.pop(payload.token, None)

    return {"message": "Password updated successfully"}

# -------------------------
# SPONSOR LOOKUP / LISTING
# -------------------------

@app.get("/sponsor/lookup")
def sponsor_lookup(email: str = Query(...), session: Session = Depends(getSession)):
    sponsor = session.exec(select(Sponsor).where(Sponsor.Sponsor_Email == email)).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found for that email")
    # NOTE: sponsor-applications.js expects sponsorId
    return {
        "sponsorId": sponsor.Sponsor_ID,
        "sponsorEmail": sponsor.Sponsor_Email,
        "sponsorName": sponsor.Sponsor_Name,
    }

@app.get("/sponsors")
def getSponsors(
    session: Session = Depends(getSession),
    sponsorName: Optional[str] = Query(None),
    sponsorPhoneNum: Optional[str] = Query(None),
    sponsorEmail: Optional[str] = Query(None),
    sponsorDescription: Optional[str] = Query(None),
):
    stmt = select(Sponsor)

    if sponsorName:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Name).like(f"%{sponsorName.lower()}%"))
    if sponsorPhoneNum:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Phone_Num).like(f"%{sponsorPhoneNum.lower()}%"))
    if sponsorEmail:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Email).like(f"%{sponsorEmail.lower()}%"))
    if sponsorDescription:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Description).like(f"%{sponsorDescription.lower()}%"))

    return session.exec(stmt).all()

# -------------------------
# APPLICATIONS
# -------------------------

@app.post("/application")
def submitApplication(payload: ApplicationRequest, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.User_Email == payload.appEmail)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if user.UserID is None:
        raise HTTPException(status_code=500, detail="User ID is missing for the user")

    sponsor = session.exec(select(Sponsor).where(Sponsor.Sponsor_Email == payload.sponsEmail)).first()
    if not sponsor or not sponsor.Sponsor_ID:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    if not emailSponsor(user.User_Email, sponsor.Sponsor_Email):
        print("There was a problem sending the application")

    application = Driver_Application(
        Sponsor_ID=sponsor.Sponsor_ID,
        UserID=user.UserID,
        Applicant_Email=payload.appEmail,
        Applicant_Phone_Num=payload.appPhoneNum,
        Applicant_Status="Pending",
        Submitted_At=datetime.now(timezone.utc),
    )

    session.add(application)
    session.commit()
    session.refresh(application)

    return {"message": "Email sent successfully and application saved to database!"}

@app.get("/application")
def getAllApplications(
    session: Session = Depends(getSession),
    sponsor_id: Optional[int] = Query(None),
    applicant_email: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    stmt = select(Driver_Application)
    if sponsor_id is not None:
        stmt = stmt.where(Driver_Application.Sponsor_ID == sponsor_id)
    if status:
        stmt = stmt.where(Driver_Application.Applicant_Status == status)
    if applicant_email:
        stmt = stmt.where(Driver_Application.Applicant_Email == applicant_email)

    return session.exec(stmt).all()

@app.patch("/application/{application_id}")
def updateStatus(
    application_id: int,
    decision: Literal["Pending", "Approved", "Rejected"],
    session: Session = Depends(getSession),
):
    application = session.exec(
        select(Driver_Application).where(Driver_Application.ApplicationID == application_id)
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.Applicant_Status = decision
    session.add(application)
    session.commit()
    session.refresh(application)

    return application

@app.delete("/application")
def deleteApp(payload: AppDeleteReq, session: Session = Depends(getSession)):
    target = session.exec(
        select(Driver_Application).where(Driver_Application.ApplicationID == payload.id)
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Application not found.")

    session.delete(target)
    session.commit()
    return {"message": "Application Deleted Successfully"}

@app.post("/sponsor")
def createSponsor(payload: SponsorCreate, session: Session = Depends(getSession)):
    sponsor = Sponsor(
        Sponsor_Name=payload.name,
        Sponsor_Description=payload.description,
        Sponsor_Email=payload.email,
        Sponsor_Phone_Num=payload.phone,
    )

    session.add(sponsor)
    session.commit()
    session.refresh(sponsor)
    return sponsor
