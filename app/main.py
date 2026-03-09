from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import select, Session, delete
from sqlalchemy import func, desc, String, cast
from encrypt import encryptString, verifyPassword, generate_verification_code
from datetime import datetime, timezone, timedelta
from mailTo import emailSponsor, passwordResetEmail
from typing import Optional, Literal
from getEbayProduct import getEbayProduct
from html import unescape
from decimal import Decimal
import csv
import io
import os
import re

from db import getSession

from models import *

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/about/db-status")
def db_status(session: Session = Depends(getSession)):
    db_host = os.getenv("DB_HOST", "Unknown")
    try:
        session.exec(select(func.count()).select_from(User)).first()
        
        provider = "Local/Unknown"
        if db_host and "rds.amazonaws.com" in db_host:
            provider = "AWS RDS"
        elif db_host and "supabase" in db_host:
            provider = "Supabase"
            
        return {
            "status": f"Connected successfully to {db_host}",
            "endpoint": db_host,
            "provider": provider,
            "database_type": "MySQL"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to {db_host}: {str(e)}")

"""
#Password Complexity Helper Function
"""
def validate_password_complexity(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400,detail="Password must be at least 8 characters long")

    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")

    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

"""
#Notification Helper Function
"""
def create_notification(session: Session, user_id: int, message: str, notif_type: str):
    
    notification = Notification(
        UserID=user_id,
        Message=message,
        Type=notif_type,
        Created_At=datetime.now(timezone.utc)
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)

# -------------------------
# USER MANAGEMENT
# -------------------------

@app.get("/user")
def getUsers(
    session: Session = Depends(getSession),
    userName: Optional[str] = Query(None),
    userEmail: Optional[str] = Query(None),
    userPhoneNum: Optional[str] = Query(None),
    userRole: Optional[str] = Query(None),
):
    stmt = select(User)

    if userName:
        stmt = stmt.where(func.lower(User.User_Name).like(f"%{userName.lower()}%"))
    if userEmail:
        stmt = stmt.where(func.lower(User.User_Email).like(f"%{userEmail.lower()}%"))
    if userPhoneNum:
        stmt = stmt.where(func.lower(User.User_Phone_Num).like(f"%{userPhoneNum.lower()}%"))
    if userRole:
        stmt = stmt.where(func.lower(User.User_Role).like(f"%{userRole.lower()}%"))

    users = session.exec(stmt).all()
    return users



@app.post("/user")
def createUser(payload: UserCreate, session: Session = Depends(getSession)):
    
    if session.exec(select(User).where(User.User_Email == payload.email)).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    
    
    if session.exec(select(User).where(User.User_Phone_Num == payload.phone)).first():
        raise HTTPException(status_code=409, detail="Phone already in use")
    
    validate_password_complexity(payload.pssw)

    user = User(
        User_Name=payload.name,
        User_Role=payload.role,
        User_Email=payload.email,
        User_Phone_Num=payload.phone,
        User_Hashed_Pss=encryptString(payload.pssw),
        User_Login_Attempts=0,
        User_Lockout_Time=None,
        Verification_Code=None
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    
    if (payload.role).lower() == "driver":
        stmt = select(Driver_User).where(Driver_User.Registered_Driver == user.UserID)
        driver = session.exec(stmt).first()
        if driver:
            raise HTTPException(status_code= 400, detail="Driver already registered!")
        
        newDriver = Driver_User(
            Registered_Driver = user.UserID,
            Driver_Name= user.User_Name,
            User_Points= 0  
        )
        
        session.add(newDriver)
        session.commit()
        session.refresh(newDriver)
            
    


    if (payload.role or "").lower() == "sponsor":
        # If sponsor_join is provided, link this sponsor-user to an EXISTING Sponsor row
        join_key = (getattr(payload, "sponsor_join", None) or "").strip()
        sponsor = None

        if join_key:
            # Try exact email match first
            sponsor = session.exec(
                select(Sponsor).where(func.lower(Sponsor.Sponsor_Email) == join_key.lower())
            ).first()

            # Then try name match (partial)
            if not sponsor:
                sponsor = session.exec(
                    select(Sponsor).where(func.lower(Sponsor.Sponsor_Name).like(f"%{join_key.lower()}%"))
                ).first()

            if not sponsor:
                raise HTTPException(status_code=404, detail="Sponsor to join was not found. Ask an admin to create it, or use the correct sponsor email/name.")

        # Backwards-compatible behavior: if no sponsor_join was provided, auto-create a Sponsor record tied to the user's email.
        if not sponsor:
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

        # Link table (UserID -> Sponsor_ID) (upsert)
        if sponsor.Sponsor_ID is not None:
            link = session.exec(
                select(Sponsor_User).where(Sponsor_User.UserID == user.UserID)
            ).first()

            if not link:
                link = Sponsor_User(UserID=user.UserID, Sponsor_ID=sponsor.Sponsor_ID)
                session.add(link)
            else:
                link.Sponsor_ID = sponsor.Sponsor_ID
                session.add(link)

            session.commit()

    return {"userId": user.UserID, "role": user.User_Role, "email": user.User_Email}


@app.delete("/user/{user_id}")
def deleteUser(user_id: int, session: Session = Depends(getSession)):
    user = session.exec(select(User).where(User.UserID == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist")

    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully"}

@app.get("/user/login_attempts")
def getLoginAttempts(user_email : str, session: Session = Depends(getSession)):
    stmt = select(User).where(User.User_Email == user_email)
    user = session.exec(stmt).first()
    if not user:
        raise HTTPException(status_code=404, detail="User Does not exist!")
    
    stmt = session.exec(select(User.User_Login_Attempts).where(User.User_Email == user_email)).first()
    return stmt



# -------------------------
# AUTHENTICATION
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
        "phone": user.User_Phone_Num
    }



# -------------------------
# SPONSOR & DRIVER MANAGEMENT
# -------------------------

def _resolve_sponsor_from_email(session: Session, email: str) -> Optional[Sponsor]:
    """Resolve a Sponsor for either:
    1) a real Sponsor email (Sponsor.Sponsor_Email), or
    2) a sponsor-user's login email via Sponsor_User -> Sponsor.
    """
    sponsor = session.exec(select(Sponsor).where(func.lower(Sponsor.Sponsor_Email) == email.lower())).first()
    if sponsor:
        return sponsor

    user = session.exec(select(User).where(func.lower(User.User_Email) == email.lower())).first()
    if not user or user.UserID is None:
        return None

    link = session.exec(select(Sponsor_User).where(Sponsor_User.UserID == user.UserID)).first()
    if not link:
        return None

    sponsor = session.exec(select(Sponsor).where(Sponsor.Sponsor_ID == link.Sponsor_ID)).first()
    return sponsor


@app.get("/sponsor-user/resolve")
def resolveSponsorForSponsorUser(email: str, session: Session = Depends(getSession)):
    sponsor = _resolve_sponsor_from_email(session, email)
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found for this sponsor user email")
    return sponsor

@app.get("/sponsors")
def getSponsors(
    session: Session = Depends(getSession),
    sponsorName: Optional[str] = Query(None),
    sponsorPhoneNum: Optional[str] = Query(None),
    sponsorEmail: Optional[str] = Query(None)
):
    stmt = select(Sponsor)

    if sponsorName:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Name).like(f"%{sponsorName.lower()}%"))
    
    if sponsorPhoneNum:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Phone_Num).like(f"%{sponsorPhoneNum.lower()}%"))
    
    if sponsorEmail:
        stmt = stmt.where(func.lower(Sponsor.Sponsor_Email).like(f"%{sponsorEmail.lower()}%"))
    

    return session.exec(stmt).all()

@app.get("/sponsors/get_driver_login_attempts")
def driverLoginAttempts(driver_email : str, session : Session = Depends(getSession)):
    log_in_attempts = getLoginAttempts(driver_email, session)
    return log_in_attempts





@app.get("/driver")
def getDrivers(
    session: Session = Depends(getSession),
):
    stmt = select(Driver_User)
    drivers = session.exec(stmt).all()
    return drivers



@app.patch("/driver")
def enrollDriverWithSponsor(payload: EnrollDriver, session: Session = Depends(getSession)):
    stmt = select(Driver_User).where(Driver_User.Registered_Driver == payload.driver_id)
    driver = session.exec(stmt).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found!")

    stmt = select(Sponsor).where(Sponsor.Sponsor_ID == payload.sponsor_id)
    sponsor = session.exec(stmt).first()

    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found!")
    
    
    
    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == payload.driver_id, Sponsorship.Sponsor_ID == payload.sponsor_id)
    existingSponsorship = session.exec(stmt).first()
    
   
    if existingSponsorship:
        raise HTTPException(status_code=400, detail= f"Driver {driver.Driver_Name} is already enrolled at {sponsor.Sponsor_Name}.")
    
    
    
    
    
    newEnrolledDriver = Sponsorship(
        Driver_User_ID= payload.driver_id,
        Sponsor_ID= payload.sponsor_id,
        Membership_Status= "Active",
        Member_Since= datetime.now(timezone.utc)
    )
    
    session.add(newEnrolledDriver)
    session.commit()
    session.refresh(newEnrolledDriver)
    

    return {"message": "Driver successfully enrolled in the program!"}





@app.delete("/sponsors/drop_driver")
def dropDriver(
    sponsor_id : int,
    user_id : int,
    drop_reason : Optional[str] = Query(None),
    session : Session = Depends(getSession)
):
    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == user_id)
    driver = session.exec(stmt).first()
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver Not Found!")
    
    stmt = select(Sponsorship).where(Sponsorship.Sponsor_ID == sponsor_id)
    sponsor = session.exec(stmt).first()
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found!")
    
    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == user_id, Sponsorship.Sponsor_ID == sponsor_id)
    target = session.exec(stmt).first()
    
    session.delete(target)
    session.commit()
    
    if drop_reason:
        return {"message":f"Driver {driver.Driver_User_ID} was dropped from the program. Reason: {drop_reason}"}
    else:
        return{"message": f"Driver {driver.Driver_User_ID} was dropped from the program."}


# TODO: Fix suspension logic to make compatable with new schema (For Liam)


# @app.patch("/sponsors/suspend_driver")
# def suspendDriver(
#     sponsor_email: str,
#     driver_email: str,
#     reason: str,
#     duration_minutes: int,
#     session: Session = Depends(getSession)
# ):
#     sponsor = session.exec(select(Sponsor).where(Sponsor.Sponsor_Email == sponsor_email)).first()
#
#     if not sponsor:
#         raise HTTPException(status_code=404, detail="Sponsor not found")
#
#     driver_user_id = session.exec(select(User.UserID).where(User.User_Email == driver_email)).first()
#
#     if not driver_user_id:
#         raise HTTPException(status_code=404, detail="Driver not found")
#
#     driver = session.exec(
#         select(Driver_User).where(Driver_User.Registered_Driver == driver_user_id, Driver_User.Sponsor_ID == sponsor.Sponsor_ID)).first()
#
#     if not driver:
#         raise HTTPException(status_code=404, detail="Driver not linked to this sponsor")
#
#     driver.Is_Suspended = True
#     driver.Suspension_Reason = reason
#     driver.Suspension_Until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
#
#     session.add(driver)
#     session.commit()
#     session.refresh(driver)
#
#     return {
#         "message": "Driver suspended successfully",
#         "until": driver.Suspension_Until,
#         "reason": driver.Suspension_Reason
#     }

@app.get("/sponsors/{sponsor_email}/applications/pending", response_model=list[Driver_Application])
def getPendingApplications(
    sponsor_email: str,
    session: Session = Depends(getSession)
):
    sponsor = session.exec(select(Sponsor).where(Sponsor.Sponsor_Email == sponsor_email)).first()

    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    applications = session.exec(
        select(Driver_Application).where(
            Driver_Application.Sponsor_ID == sponsor.Sponsor_ID,
            Driver_Application.Applicant_Status == "Pending"
        )
    ).all()

    return applications



@app.get("/sponsors/{sponsor_email}/drivers")
def getSponsorships(
    sponsor_id: int,
    session: Session = Depends(getSession)
):
    
    stmt = select(Sponsorship).where(Sponsorship.Sponsor_ID == sponsor_id)
    sponsorships = session.exec(stmt).all()
    
    if not sponsorships:
        raise HTTPException(status_code=404, detail="No drivers are enrolled for this sponsor.")
    
    return sponsorships






# -------------------------
# APPLICATION WORKFLOW
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

    existing = session.exec(select(Driver_Application).where(Driver_Application.Applicant_Email == payload.appEmail)).first()
    if existing:
        if existing.Applicant_Status == "Rejected":
            session.delete(existing)
            session.commit()
        else:
            raise HTTPException(status_code=400, detail="An active application already exists")

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

    if user.UserID is not None:
        create_notification(
            session,
            user.UserID,
            f"Your application to sponsor {sponsor.Sponsor_Name} has been submitted.",
            "Application"
        )
        session.commit()

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
    admin_name: str, #Every application update must be done by an admin (Sponsor User or Admin User)
    rejection_reason: Optional[str] = None,
    session: Session = Depends(getSession),
):
    application = session.exec(
        select(Driver_Application).where(Driver_Application.ApplicationID == application_id)
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.Applicant_Status = decision
    
    
    
    
    if decision == "Rejected":
        application.Rejection_Reason = rejection_reason
    else:
        application.Rejection_Reason = None
        
    session.add(application)
    session.commit()
    session.refresh(application)

    if decision == "Approved":
        stmt = select(Driver_User).where(Driver_User.Registered_Driver == application.UserID)
        driver = session.exec(stmt).first()
        if not driver:
            raise HTTPException(status_code=404, detail= "Driver does not exist")
        
        stmt = select(User).where(User.UserID == driver.Registered_Driver)
        user = session.exec(stmt).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User does not exist")
        
        stmt = select(Sponsor).where(Sponsor.Sponsor_ID == application.Sponsor_ID)
        sponsor = session.exec(stmt).first()
        if not sponsor:
            raise HTTPException(status_code=404, detail="Sponsor does not exist")
        
        log = MembershipDecisionLog (
            Driver_ID = driver.Registered_Driver,
            Driver_Name = user.User_Name,
            Decision = decision,
            Reason = "Congratulations!",
            Sponsor = sponsor.Sponsor_Name,
            AuthorizedBy= admin_name,
            Decision_Made_At= datetime.now(timezone.utc)  
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        
        
        create_notification(
            session,
            application.UserID,
            "Your application has been approved!",
            "Application"
        )
        
        
    elif decision == "Rejected":
        stmt = select(Driver_User).where(Driver_User.Registered_Driver == application.UserID)
        driver = session.exec(stmt).first()
        if not driver:
            raise HTTPException(status_code=404, detail= "Driver does not exist")
        
        stmt = select(User).where(User.UserID == driver.Registered_Driver)
        user = session.exec(stmt).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User does not exist")
        
        stmt = select(Sponsor).where(Sponsor.Sponsor_ID == application.Sponsor_ID)
        sponsor = session.exec(stmt).first()
        if not sponsor:
            raise HTTPException(status_code=404, detail="Sponsor does not exist")
        
        log = MembershipDecisionLog (
            Driver_ID = driver.Registered_Driver,
            Driver_Name = user.User_Name,
            Decision = decision,
            Reason = rejection_reason or "",
            Sponsor = sponsor.Sponsor_Name,
            AuthorizedBy= admin_name,
            Decision_Made_At= datetime.now(timezone.utc)  
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        
        
        create_notification(
            session,
            application.UserID,
            f"Your application was rejected. Reason: {rejection_reason}",
            "Application"
        )

    return  {"message":"Application decision updated successfully. Decision Recorded"}




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
    
    stmt = select(Sponsor).where(Sponsor.Sponsor_Name == payload.name)
    existingSponsor = session.exec(stmt)
    
    if existingSponsor:
        raise HTTPException(status_code= 400, detail="This sponsor already exists!")
    
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


@app.patch("/admin/{sponsor_id}")
def updateSponsor(sponsor_id:int, update:AdminUpdate, session:Session = Depends(getSession)):
    stmt = select(Sponsor).where(Sponsor.Sponsor_ID == sponsor_id)
    sponsor = session.exec(stmt).first()
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Requested sponsor does not exist")
    
    if update.type.strip().lower() == "name":
        sponsor.Sponsor_Name = update.payload
        session.add(sponsor)
        session.commit()
        session.refresh(sponsor)
    elif update.type.strip().lower() == "email":
        sponsor.Sponsor_Email = update.payload
        session.add(sponsor)
        session.commit()
        session.refresh(sponsor)
    elif update.type.strip().lower() == "description":
        sponsor.Sponsor_Description = update.payload
        session.add(sponsor)
        session.commit()
        session.refresh(sponsor)
    elif update.type.strip().lower() == "phone number":
        sponsor.Sponsor_Phone_Num = update.payload
        session.add(sponsor)
        session.commit()
        session.refresh(sponsor)
    else:
        raise HTTPException(status_code=400, detail="Unable to update sponsor. Please check input.")
    
    
    return({"message":"Sponsor Updated Successfully"})



@app.delete("/sponsor/{sponsor_id}")
def deleteSponsor(sponsor_id:int, session:Session=Depends(getSession)):
    stmt = select(Sponsor).where(Sponsor.Sponsor_ID == sponsor_id)
    sponsor = session.exec(stmt).first()
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor does not exist")
    
    session.delete(sponsor)
    session.commit()
    return({"message":"Sponsor deleted successfully"})
    

# -------------------------
# ACCOUNT & PROFILE
# -------------------------


@app.get("/account/{user_id}")
def viewProfile(user_id: int, session: Session = Depends(getSession)):
    user = session.exec(
        select(User).where(User.UserID == user_id)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "userId": user.UserID,
        "name": user.User_Name,
        "email": user.User_Email,
        "phone": user.User_Phone_Num,
        "role": user.User_Role,
        "loginAttempts": user.User_Login_Attempts,
        "lockoutTime": user.User_Lockout_Time,
    }

"""
#Liam's version of updating info endpoint
"""
@app.patch("/account/{user_id}")
def updateProfile(
    user_id: int,
    payload: ProfileUpdateRequest,
    session: Session = Depends(getSession),
):
    user = session.exec(
        select(User).where(User.UserID == user_id)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name:
        user.User_Name = payload.name

    if payload.email:
        # Prevent duplicate email
        existing = session.exec(
            select(User).where(User.User_Email == payload.email)
        ).first()
        if existing and existing.UserID != user_id:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.User_Email = payload.email

    if payload.phone:
        existing = session.exec(
            select(User).where(User.User_Phone_Num == payload.phone)
        ).first()
        if existing and existing.UserID != user_id:
            raise HTTPException(status_code=409, detail="Phone already in use")
        user.User_Phone_Num = payload.phone

    session.add(user)
    session.commit()
    session.refresh(user)

    create_notification(
        session,
        user.UserID,
        "Your profile information was updated.",
        "Profile"
    )

    return {"message": "Profile updated successfully"}




@app.post("/account/{user_id}/request_password_change")
def requestPswChange(user_id: int, session : Session=Depends(getSession)):
    
    stmt = select(User).where(User.UserID == user_id)
    user = session.exec(stmt).first()
    
    if not user:
        raise HTTPException(status_code=404,detail="User not found")
    
    verifCode = generate_verification_code()
    user.Verification_Code = encryptString(verifCode)
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    if not passwordResetEmail(user.User_Email, verifCode):
        user.Verification_Code = None
        session.add(user)
        session.commit()
        raise HTTPException(status_code=500, detail="Email failed to send")

    return {"message":f"Change password email sent successfully to: {user.User_Email}"}    


@app.post("/account/{user_id}/verify_token")
def verifyToken(user_id: int,tokenAttempt: str, session: Session = Depends(getSession)):
    stmt = select(User).where(User.UserID == user_id)
    user = session.exec(stmt).first()
    
    if not user:
        raise HTTPException(status_code=404,detail="User not found")
    
    if not user.Verification_Code:
        raise HTTPException(status_code=400, detail="No verification token requested")

    if not verifyPassword(tokenAttempt, user.Verification_Code):
        raise HTTPException(status_code=401, detail="Invalid verification token")

    return {"message": "Verification token is valid"}
    

    
@app.post("/account/{user_id}/change-password")
def changePassword(
    user_id: int,
    payload: ChangePasswordRequest,
    session: Session = Depends(getSession),
):
    user = session.exec(
        select(User).where(User.UserID == user_id)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verifyPassword(payload.current_password, user.User_Hashed_Pss):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if verifyPassword(payload.new_password, user.User_Hashed_Pss):
        raise HTTPException(status_code=409, detail="New password cannot be the same as the current password")

    
    validate_password_complexity(payload.new_password)

    user.User_Hashed_Pss = encryptString(payload.new_password)

    session.add(user)
    session.commit()

   # create_notification(
   #     session,
   #     user.UserID,
   #     "Your password was successfully changed.",
   #     "Security"
   # )
    
    newPasswordChange = PasswordChangeLog(
        user_id= user.UserID,
        User_Type= user.User_Role,
        UserName= user.User_Name,
        ChangedAt= datetime.now(timezone.utc)
    )
    session.add(newPasswordChange)
    session.commit()
    session.refresh(newPasswordChange)
    
    return {"message": "Password changed successfully"}

@app.get("/log/pss_logs")
def getAllPasswordLogs(userid: Optional[int] = Query(None), session:Session =Depends(getSession)):
    stmt = select(PasswordChangeLog)
    
    if userid is not None:
        stmt = stmt.where(PasswordChangeLog.user_id == userid)
    
    logs = session.exec(stmt).all()
    
    return logs

    


# -------------------------
# REPORTS
# -------------------------

# Gets all user reports
@app.get("/report")
def getReports(auditID: Optional[int] = Query(None),
                user: Optional[int] = Query(None),
                category: Optional[str] = Query(None),
                status: Optional[str] = Query(None),
                session: Session = Depends(getSession)):
    
    stmt = select(UserReports)
    
    if auditID is not None:
        stmt = stmt.where(UserReports.AuditID == auditID) 
    if user is not None:
        stmt = stmt.where(UserReports.UserID == user)
    if category is not None:
        stmt = stmt.where(UserReports.Category == category)
    if status is not None:
        stmt = stmt.where(UserReports.Status == status)
        

    reports = session.exec(stmt).all()
    

    if not reports:
        raise HTTPException(status_code=404, detail="No Reports Found!")
    
    
    return reports

#Creates a user bug report
@app.post("/report", status_code=201)
def createReport(payload:NewReport, session:Session = Depends(getSession)):
    stmt = select(User).where(User.UserID == payload.userID)
    user = session.exec(stmt).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User is not registered")
    
    report = UserReports(
        UserID= payload.userID,
        Category= payload.category,
        Issue_Type=payload.issue_type,
        Issue_Description=payload.issue_description,
        Created_At= datetime.now(timezone.utc),
        Status= payload.status
        )
    
    
    session.add(report)
    session.commit()
    session.refresh(report)
    
    return({"message": "Report filed successfully!"})

#Updates the status of a report
@app.patch("/report/{report_id}")
def updateReportStatus(report_id:int, status_update:str, session: Session=Depends(getSession)):
    stmt = select(UserReports).where(UserReports.AuditID == report_id)
    report = session.exec(stmt).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report does not exist or has been resolved.")
    
    report.Status = status_update
    
    session.add(report)
    session.commit()
    session.refresh(report)
    
    return {"message": f"Status for report: {report.AuditID} updated successfully"}
    

    
#Resolves a report via deletion
@app.delete("/report/{report_id}")
def resolveReport(report_id:int, session:Session = Depends(getSession)):
    stmt = select(UserReports).where(UserReports.AuditID == report_id)
    report = session.exec(stmt).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found!")
    
    session.delete(report)
    session.commit()
        
    return {"message":"Report resolved successfully"}

# -------------------------
# POINTS & TRANSACTIONS
# -------------------------



# Gets all transaction reports for a single driver
@app.get("/report/transaction/{driver_id}")
def getPointStatusReport(driver_id:int, session: Session = Depends(getSession)):
    stmt = select(Driver_User).where(Driver_User.Registered_Driver == driver_id)
    driver = session.exec(stmt).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    
    stmt = select(Point_Transaction).where(Point_Transaction.Driver_User_ID == driver_id)
    statusReport = session.exec(stmt).all()
    
    if not statusReport:
        raise HTTPException(status_code=404, detail="No recent reports found for this driver")
    
    return statusReport


#Gets a drivers user points to redeem
@app.get("/points/{driver_id}")
def getDriverPoints(driver_id: int, sponsor_id:int ,session:Session=Depends(getSession)):
    
    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == driver_id, Sponsorship.Sponsor_ID == sponsor_id)
    
    sponsorship = session.exec(stmt).first()
    
    if not sponsorship:
        raise HTTPException(status_code= 404, detail="Sponsorship does not exist. Check existing sponsorships.")
    
    return sponsorship.User_Points
    
    
#Adds or subtracts points while also creating a transaction report
#Joseph-> Ive gotta fix this endpoint so that it is compatable with the new schema

@app.patch("/points")
def changePoints(payload:NewPointChange, session: Session=Depends(getSession)):
    stmt = select(Driver_User).where(Driver_User.Registered_Driver == payload.driver_id)
    driver = session.exec(stmt).first()
     
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found!")
    
    if driver.Is_Suspended:
        raise HTTPException(status_code=403, detail="Driver is suspended")

    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == payload.driver_id, Sponsorship.Sponsor_ID == payload.sponsor_id)
    sponsorship = session.exec(stmt).first()
    
    if not sponsorship:
        raise HTTPException(status_code= 404, detail="Sponsorship does not exist. Check existing sponsorships.")
    
    stmt = select(Sponsor).where(Sponsor.Sponsor_ID == payload.sponsor_id)
    sponsor = session.exec(stmt).first()


    new_total = sponsorship.User_Points + payload.points_change
    
    if new_total < 0:
        raise HTTPException(status_code=400, detail="User points cant go below zero!")

    sponsorship.User_Points = new_total
     
    newTransaction = Point_Transaction(
        Driver_User_ID= payload.driver_id,
        Driver_Name= driver.Driver_Name,
        Sponsor_Name= sponsor.Sponsor_Name if sponsor else "Unassigned",
        Points_Change= str(payload.points_change),
        Reason_For_Change= payload.reason,
        Created_At= datetime.now(timezone.utc),
        Points_After_Change= sponsorship.User_Points
    )
     
    session.add(driver)
    session.add(newTransaction)
    session.commit()          
    session.refresh(driver)
    session.refresh(newTransaction)

    if driver.Registered_Driver is not None:
        create_notification(
            session,
            driver.Registered_Driver,
            f"Your points changed by {payload.points_change}. Reason: {payload.reason}. New total: {sponsorship.User_Points}",
            "Points"
        )
        session.commit()
     
     
    return({"message": "Transaction successful and log recorded."})

#Deletes a transaction log
@app.delete("/transaction/{transaction_id}")
def deleteTransactionLog(transaction_id: int, session: Session=Depends(getSession)):
    stmt = select(Point_Transaction).where(Point_Transaction.TransactionID == transaction_id)
    
    transaction = session.exec(stmt).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction does not exist")

    
    session.delete(transaction)
    session.commit()
    
    return {"message":"Transaction deleted successfully"}

# -------------------------
# MARKET & CART
# -------------------------

# Market API Endpoints

@app.post("/market")
def createMarket(payload: MarketCreate, sponsor_email : Optional[str] = Query(None), session: Session = Depends(getSession)):
    if sponsor_email:
        stmt = session.exec(select(Sponsor.Sponsor_ID).where(Sponsor.Sponsor_Email == sponsor_email)).first()

        if not stmt:
            raise HTTPException(status_code=404, detail="Sponsor does not exist")

        market = Market(
            Market_Name=payload.name,
            Market_Description=payload.description,
            Market_Sponsor=stmt
        )

        session.add(market)
        session.commit()
        session.refresh(market)
        return market
    
    

@app.get("/market/{market_id}")
def getMarket(market_id : int, session: Session = Depends(getSession)):
    stmt = select(Market).where(Market.Market_ID == market_id)
    market_item = session.exec(stmt).first()

    if not market_item:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return market_item




@app.delete("/market/{market_id}")
def deleteMarket(market_id : int, session: Session = Depends(getSession)):
    stmt = select(Market).where(Market.Market_ID == market_id)
    market_item = session.exec(stmt).first()

    if not market_item:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    session.delete(market_item)
    session.commit()

    return({"message":"Market Item Deleted Successfully"})


@app.get("/cart/{driver_id}")
def getCart(driver_id:int, 
            status: Optional[str] = Query(None),
            session:Session = Depends(getSession)):
    stmt = select(Driver_User).where(Driver_User.Registered_Driver == driver_id)
    driver = session.exec(stmt).first()
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver does not exist")
    
    stmt = select(Cart).where(Cart.DriverID == driver_id)
    
    if status is not None:
        stmt = stmt.where(Cart.Status == status)
    
    cart = session.exec(stmt).all()
    
    return cart


# Joseph: Gabe, please patch this endpoint so that it works with the new schema. 

# @app.post("/cart/{user_id}")
# def createCart(user_id: int, payload: AddToCart, session: Session = Depends(getSession)):
#     driver = session.exec(select(Driver_User).where(Driver_User.Registered_Driver == user_id)).first()
#     
#     cart = session.exec(select(Cart).where(Cart.DriverID == user_id, Cart.Status == "Pending")).first()
#     
#     if not cart:
#         cart = Cart(
#             DriverID=user_id,
#             Status="Pending",
#             Created_At=datetime.now(timezone.utc),
#             Checked_Out_At=datetime.now(timezone.utc) 
#         )
#         session.add(cart)
#         session.commit()
#         session.refresh(cart)
#         
#     cart_item = CartItem(
#         CartID=cart.CartID,
#         ProdID=payload.product_id,
#         Prod_Name=payload.product_name, 
#         Prod_Qty=1,
#         Prod_Price=5 
#     )
#     
#     session.add(cart_item)
#     session.commit()
#     
#     return {"Added to cart successfully"}
    
@app.delete("/cart/{driver_id}")
def deleteCart(driver_id : int, cart_id : int, session: Session = Depends(getSession)):
    cart = session.exec(select(Cart).where(Cart.DriverID == driver_id)).first()

    if not cart:
        raise HTTPException(status_code=404, detail="Cart Not Found /W DriverID!")
    
    cart = session.exec(select(Cart).where(Cart.CartID == cart_id)).first()

    if not cart:
        raise HTTPException(status_code=404, detail="Cart Not Found /W CartID!")
    
    session.delete(cart)
    session.commit()

    return({"message":"Cart Deleted Successfully"})

@app.delete("/cart/{driver_id}/{cart_item_id}")
def deleteCartItem(cart_id : int, cart_item_id : int, session: Session = Depends(getSession)):
    cart_item = session.exec(select(CartItem).where(CartItem.CartID == cart_id)).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="CartItem Not Found /W CartID!")
    
    cart_item = session.exec(select(CartItem).where(CartItem.Cart_Item_ID == cart_item_id)).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="CartItem Not Found /W CartItemID!")
    
    session.delete(cart_item)
    session.commit()

    return({"message":"Cart Item Deleted Successfully"})

@app.patch("/cart/{driver_id}")
def updateCart(driver_id : int, payload : UpdateCart, session: Session = Depends(getSession)):
    cart = session.exec(select(Cart).where(Cart.DriverID == driver_id)).first()

    if not cart:
        raise HTTPException(status_code=404, detail="Cart Not Found /W DriverID!")
    
    cart = session.exec(select(Cart).where(Cart.CartID == payload.cart_id)).first()

    if not cart:
        raise HTTPException(status_code=404, detail="Cart Not Found /W CartID!")
    
    cart_item = session.exec(select(CartItem).where(CartItem.CartID == cart.CartID)).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="CartItem Not Found /W CartID!")
    
    cart_item = session.exec(select(CartItem).where(CartItem.Cart_Item_ID == payload.cart_item_id)).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="CartItem Not Found /W CartItemID!")
    
    cart_item.ProdID = payload.prod_id

    if payload.prod_qty:
        cart_item.Prod_Qty = payload.prod_qty
    
    session.add(cart_item)
    session.commit()
    session.refresh(cart_item)

    return cart_item


# ------------------------
# CSV GENERATORS
# ------------------------



@app.get("/report/bug_report_csv")
def exportReportsCSV(
    auditID: Optional[int] = Query(None),
    user: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: Session = Depends(getSession),
):
    stmt = select(UserReports)

    if auditID is not None:
        stmt = stmt.where(UserReports.AuditID == auditID)
    if user is not None:
        stmt = stmt.where(UserReports.UserID == user)
    if category is not None:
        stmt = stmt.where(UserReports.Category == category)
    if status is not None:
        stmt = stmt.where(UserReports.Status == status)

    reports = session.exec(stmt).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "AuditID",
            "UserID",
            "Category",
            "Issue_Type",
            "Issue_Description",
            "Created_At",
            "Status",
        ]
    )

    for report in reports:
        writer.writerow(
            [
                report.AuditID,
                report.UserID,
                report.Category,
                report.Issue_Type,
                report.Issue_Description,
                report.Created_At.isoformat() if report.Created_At else None,
                report.Status,
            ]
        )

    buffer.seek(0)
    filename = f"reports_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)

@app.get("/driver/transaction_report_csv")
def getDriverCSV(driver_id: Optional[int] = Query(None), 
                 session: Session = Depends(getSession)):
    
    stmt = select(Point_Transaction)
    
    #This is for if an admin wants to generate a transaction CSV for a
    #specific driver
    if driver_id is not None:
        stmt = stmt.where(Point_Transaction.Driver_User_ID == driver_id)
    
    
    reports = session.exec(stmt).all()
    
    buffer =io.StringIO()
    
    writer = csv.writer(buffer)
    
    writer.writerow(
        [
            "Transaction ID",
            "Driver ID",
            "Driver Name",
            "Current Sponsor",
            "Points Change",
            "Driver Points After Change",
            "Reason for Change",
            "Report Timestamp"
        ]
    )
    
    for report in reports:
        writer.writerow(
            [
                report.TransactionID,
                report.Driver_User_ID,
                report.Driver_Name,
                report.Sponsor_Name,
                report.Points_Change,
                report.Points_After_Change,
                report.Reason_For_Change,
                report.Created_At,
            ]
        )
    buffer.seek(0)
    filename = f"transaction_report_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)

@app.get("/user/password_report_csv")
def getPasswordChangeCSV(driver_id: Optional[int] = Query(None), session: Session=Depends(getSession)):
    stmt = select(PasswordChangeLog)
    
    if driver_id is not None:
        stmt = stmt.where(PasswordChangeLog.user_id == driver_id)
        
    logs = session.exec(stmt).all()
    
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    
    writer.writerow(
        [
        "Log ID",
        "User ID",
        "User Type",
        "User Name",
        "Changed At"
        ]
    )
    
    for log in logs:
        writer.writerow(
            [
                log.Log_ID,
                log.user_id,
                log.User_Type,
                log.UserName,
                log.ChangedAt  
            ]
        )
    buffer.seek(0)
    filename = f"password_change_report_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)

@app.get("/application/decision_report_csv")
def getDecisionReportsCSV(driver_id: Optional[int]= Query(None), session: Session=Depends(getSession)):
    stmt = select(MembershipDecisionLog)
    if driver_id is not None:
        stmt = stmt.where(MembershipDecisionLog.Driver_ID == driver_id)
        
    logs = session.exec(stmt).all()
    
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    
    writer.writerow(
        [
           "Decision ID",
           "Driver ID",
           "Driver Name",
           "Decision",
           "Reason",
           "Sponsor",
           "Authorized By",
           "Decision Date"
        ]
    )
    for log in logs:
        writer.writerow(
            [
               log.DecisionID,
               log.Driver_ID,
               log.Driver_Name,
               log.Decision,
               log.Reason,
               log.Sponsor,
               log.AuthorizedBy,
               log.Decision_Made_At 
            ]
        )
    buffer.seek(0)
    filename = f"application_decision_report_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)


# Need CSV for sales generation. Will look at once we move on market features



# -------------------------
# NOTIFICATIONS
# -------------------------

@app.get("/notifications/{user_id}")
def getNotifications(user_id: int, session: Session = Depends(getSession)):
    notifications = session.exec(
        select(Notification)
        .where(Notification.UserID == user_id)
        .order_by(Notification.Created_At.desc())
    ).all()

    return notifications

@app.patch("/notifications/{notification_id}/read")
def markAsRead(notification_id: int, session: Session = Depends(getSession)):
    notification = session.exec(
        select(Notification).where(Notification.NotificationID == notification_id)
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.Is_Read = True
    session.add(notification)
    session.commit()

    return {"message": "Notification marked as read"}



    
 
# ------------------------
#  MARKET ENDPOINTS
# ------------------------

#Adds items to sponsor market

@app.post("/products/{market_id}")
def addProductsToMarket(market_id: int, ebayItemID: str, session: Session = Depends(getSession)):
    market = session.exec(select(Market).where(Market.Market_ID == market_id)).first()
    if not market:
        raise HTTPException(status_code=404, detail="Sponsor Market not found!")
    
    status, data = getEbayProduct(ebayItemID)
    
    if status != 200:
        raise HTTPException(status_code=502, detail="eBay lookup failed")

    raw_title = (data.get("title") or "").strip()
    raw_description = data.get("description") or ""
    raw_image_url = (data.get("image", {}).get("imageUrl") or "").strip()
    raw_price = data.get("price", {}).get("value")
    raw_qty = 0
    availabilities = data.get("estimatedAvailabilities") or []
    if availabilities:
        raw_qty = availabilities[0].get("estimatedAvailableQuantity") or 0

    description_no_style = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw_description, flags=re.IGNORECASE | re.DOTALL)
    description_no_tags = re.sub(r"<[^>]+>", " ", description_no_style)
    description_text = re.sub(r"\s+", " ", unescape(description_no_tags)).strip()

    title = raw_title[:45] if raw_title else "eBay Item"
    description = description_text[:100]
    image_url = raw_image_url[:255]

    try:
        price = int(round(float(raw_price))) if raw_price is not None else 0
    except (TypeError, ValueError):
        price = 0

    try:
        product_qty = int(raw_qty)
    except (TypeError, ValueError):
        product_qty = 0

    product = Product(
        MarketID=market_id,
        Product_Name=title,
        Product_Description=description,
        Product_Price=price,
        Product_Qty=product_qty,
        Product_Image=image_url,
        Last_Refreshed=datetime.now(timezone.utc),
    )
    session.add(product)
    session.commit()
    session.refresh(product)

    return {
        "message": "Product added to market",
        "product_id": product.ProductID,
        "source_item_id": data.get("itemId"),
        "source_legacy_item_id": data.get("legacyItemId"),
    }



#gets all products for a specific market
@app.get("/products/{market_id}")
def getAllProducts(market_id: int, product_name: Optional[str] = Query(None), session: Session = Depends(getSession)):
    
    stmt = select(Market).where(Market.Market_ID == market_id)
    
    market = session.exec(stmt).all()
    
    if not market:
        raise HTTPException(status_code=404, detail="Sponsor Market not found!")
    
    stmt = select(Product).where(Product.MarketID == market_id)

    if product_name is not None:
        stmt = stmt.where(func.lower(Product.Product_Name).like(f"%{product_name.lower()}%"))
    
    
    products = session.exec(stmt).all()
    
    return products
 
 
@app.patch("/products/purchase")
def purchaseProduct(payload: Purchase, session: Session=Depends(getSession)):
     
    stmt = select(Market).where(Market.Market_ID == payload.market_id)
    market = session.exec(stmt).first()
    
    if not market:
        raise HTTPException(status_code=404, detail="Market does not exist")
    
    stmt = select(Product).where(Product.ProductID == payload.product_id, Product.MarketID == payload.market_id)
    product = session.exec(stmt).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in specific market")
    
    
    stmt = select(Sponsorship).where(Sponsorship.Driver_User_ID == payload.driver_id, Sponsorship.Sponsor_ID == market.Market_Sponsor)
    customer = session.exec(stmt).first()
    if not customer:
        raise HTTPException(status_code=404, detail="User is not authorized to shop in this market")
    
    
    stmt = select(Driver_User).where(Driver_User.Registered_Driver == payload.driver_id)
    driver = session.exec(stmt).first()
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found!")
    
    
    stmt = select(Sponsor).where(Sponsor.Sponsor_ID == customer.Sponsor_ID)
    sponsor = session.exec(stmt).first()
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
   
    
    if market.Point_Value is None or market.Point_Value == 0:
        raise HTTPException(status_code=400, detail="Invalid point value")
    
    cost_in_points = Decimal(product.Product_Price) / market.Point_Value
    
    if customer.User_Points < cost_in_points:
        raise HTTPException(status_code=400, detail="User cannot afford item. Please select another")
    
    
    product.Product_Qty -= 1
    customer.User_Points -= product.Product_Price
    
    session.add(product)
    session.add(customer)
    
    
    transaction_log = Point_Transaction(
        Driver_User_ID=customer.Driver_User_ID,
        Driver_Name= driver.Driver_Name,
        Sponsor_Name= sponsor.Sponsor_Name,
        Points_Change= str(0 - product.Product_Price),
        Points_After_Change= customer.User_Points,
        Reason_For_Change= "User purchase",
        Created_At= datetime.now(timezone.utc)
    )
    
    session.add(transaction_log)
    session.commit()
    session.refresh(product)
    session.refresh(customer)
    session.refresh(transaction_log)

    create_notification(
        session,
        payload.driver_id,
        f"Purchase complete: {product.Product_Name} for {product.Product_Price} points. Remaining points: {customer.User_Points}",
        "Purchase"
    )

    return {"message": "Purchase completed successfully"}

@app.get("/products/purchase/history")
def getOrderHistory(driver_id:int, session: Session=Depends(getSession)):
    stmt = select(Point_Transaction).where(
        Point_Transaction.Driver_User_ID == driver_id,
        cast(Point_Transaction.Reason_For_Change, String).like("%User Purchase%")
    ) 
    
    transaction_history = session.exec(stmt).all()
    
    if not transaction_history:
        raise HTTPException(status_code=404, detail="No purchases have been made for this user")
    
    
    return transaction_history



"""
Points are to be translated as follows:  

    USD to points : (Cost in USD)/(point_to_dollar_value) = points
    
    Points to USD : (points) * (point_to_dollar_value) = cost in USD
  
"""

@app.patch("/market/set_point_to_dollar")
def setPointToDollarValue(payload: PointToDollar, session : Session=Depends(getSession)):
    
    stmt = select(Market).where(Market.Market_ID == payload.market_id)
    market = session.exec(stmt).first()
    
    if not market:
        raise HTTPException(status_code=404, detail="Market not found!")
    
    if payload.point_to_dollar_value <= 0:
        raise HTTPException(status_code=400, detail="Point-to-dollar conversion rate cannot be below or equal to 0")
    
    market.Point_Value = payload.point_to_dollar_value
    
    session.add(market)
    session.commit()
    session.refresh(market)
    
    return {"message":"Point to dollar value updated!"}








