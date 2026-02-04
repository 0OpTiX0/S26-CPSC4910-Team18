
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import get_session
from schema.auth import LoginRequest, ChangePasswordRequest
from utils.security import verify_password, hash_password
from utils.jwt import create_access_token
from utils.lockout import is_locked, record_failed_attempt, reset_attempts
from utils.dependencies import get_current_user
from models import Driver, Sponsor_User, Admin

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/driver/login")
def driver_login(credentials: LoginRequest, session: Session = Depends(get_session)):
    driver = session.exec(
            select(Driver).where(Driver.Driver_Email == credentials.email)
            ).first()

    if driver and is_locked(driver):
        raise HTTPException(status_code=403, detail="Account locked")
    if not driver or not verify_password(credentials.password, driver.Driver_Hashed_Pss):
        if driver:
            record_failed_attempt(driver)
            session.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
   
    reset_attempts(driver)
    session.commit()

    token = create_access_token({"sub": str(driver.DriverID), "role": "driver"})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/sponsor/login")
def sponsor_login(credentials: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(Sponsor_User).where(Sponsor_User.sUser_Email == credentials.email)
    ).first()

    if user and is_locked(user):
        raise HTTPException(status_code=403, detail="Account locked")

    if not user or not verify_password(credentials.password, user.sUser_Hashed_Pss):
        if user:
            record_failed_attempt(user)
            session.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
     
    reset_attempts(user)
    session.commit()

    token = create_access_token({"sub": str(user.sUser_ID), "role": "sponsor"})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/admin/login")
def admin_login(credentials: LoginRequest, session: Session = Depends(get_session)):
    admin = session.exec(
            select(Admin).where(Admin.Admin_Email == credentials.email)
    ).first()

    if admin and is_locked(admin):
        raise HTTPException(status_code=403, detail="Account locked")

    if not admin or not verify_password(credentials.password, admin.Admin_Hash_Key):
        if admin:
            record_failed_attempt(admin)
            session.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    reset_attempts(admin)
    session.commit()

    token = create_access_token({"sub": str(admin.Admin_ID), "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    role = user["role"]
    user_id = int(user["sub"])

    if role == "driver":
        account = session.get(Driver, user_id)
        field = "Driver_Hashed_Pss"
    elif role == "sponsor":
        account = session.get(Sponsor_User, user_id)
        field = "sUser_Hashed_Pss"
    elif role == "admin":
        account = session.get(Admin, user_id)
        field = "Admin_Hash_Key"
    else:
        raise HTTPException(status_code=403, detail="Invalid role")

    if not verify_password(data.current_password, getattr(account, field)):
        raise HTTPException(status_code=401, detail="Incorrect current password")

    setattr(account, field, hash_password(data.new_password))
    session.commit()

    return {"message": "Password updated successfully"}

