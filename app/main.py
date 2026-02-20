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
            "status": "Connected ✅",
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

# -------------------------
# USERS
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
        stmt = stmt.where(User.User_Role == userRole)

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
    )
    session.add(user)
    session.commit()
    session.refresh(user)


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
        if sponsor.Sponsor_ID is not None:
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

@app.get("/user/login_attempts")
def getLoginAttempts(user_email : str, session: Session = Depends(getSession)):
    stmt = session.exec(select(User.User_Login_Attempts).where(User.User_Email == user_email)).first()
    return stmt

@app.post("/user/driver_user")
def createDriverUser(payload: DriverUserCreate, session: Session = Depends(getSession)):
    sponsor = session.exec(
            select(Sponsor.Sponsor_ID).where(Sponsor.Sponsor_Email == payload.sponsor_email)
        ).first()
    
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor does not exist")
    
    driver = session.exec(
        select(User.UserID).where(User.User_Email == payload.email)
    ).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver does not exist")
    
    driver_user = Driver_User(
        UserID=driver,
        Sponsor_ID=sponsor
    )

    session.add(driver_user)
    session.commit()
    session.refresh(driver_user)

    return driver_user

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
# SPONSOR LOOKUP / LISTING
# -------------------------





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

@app.delete("/sponsors/drop_driver")
def dropDriver(
    sponsor_email : str,
    user_email : str,
    drop_reason : Optional[str] = Query(None),
    session : Session = Depends(getSession)
):
    u_stmt = session.exec(select(User.UserID).where(User.User_Email == user_email)).first()

    if not u_stmt:
        raise HTTPException(status_code=404, detail="User does not exist")
    
    s_stmt = session.exec(select(Sponsor.Sponsor_ID).where(Sponsor.Sponsor_Email == sponsor_email)).first()

    if not s_stmt:
        raise HTTPException(status_code=404, detail="Sponsor does not exist")

    stmt = session.exec(select(Driver_User).where(Driver_User.UserID == u_stmt, Driver_User.Sponsor_ID == s_stmt)).first()

    if not stmt:
        raise HTTPException(status_code=404, detail="Driver does not exist")
    
    session.delete(stmt)
    session.commit()

    if drop_reason:
        return {"message": drop_reason}
    else:
        return {"message": "Driver Dropped from Program Successfully"}

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
    

# -------------------------
# Profiles
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

    return {"message": "Profile updated successfully"}

"""
#Liam's version of changing password endpoint
"""
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

    return {"message": "Password changed successfully"}



@app.post("/reset-password")
def resetPassword(
    payload: ResetPasswordRequest,
    session: Session = Depends(getSession),
):
    user = session.exec(
        select(User).where(User.User_Email == payload.email)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if verifyPassword(payload.new_password, user.User_Hashed_Pss):
        raise HTTPException(status_code=409, detail="New password cannot be the same as the current password")

    validate_password_complexity(payload.new_password)

    user.User_Hashed_Pss = encryptString(payload.new_password)
    user.User_Login_Attempts = 0
    user.User_Lockout_Time = None

    session.add(user)
    session.commit()

    return {"message": "Password reset successfully"}
    

"""
#Joseph's Endpoint for updating user information

@app.patch("/account/{account_id}")
def updateCreds(account_id: int, update:CredsUpdate, session:Session = Depends(getSession)):
    stmt = select(User).where(User.UserID == account_id)
    user = session.exec(stmt).first()
    if not user:
        raise HTTPException(status_code=404, detail="User Not Found!")
    
    
    

    if(update.type.lower() == "password"):
        user.User_Hashed_Pss =  encryptString(update.payload)
        session.add(user)
        session.commit()
        session.refresh(user)
    elif(update.type.lower() == "email"):
        user.User_Email = update.payload
        session.add(user)
        session.commit()
        session.refresh(user)
    elif(update.type.lower() == "username"):
        user.User_Name = update.payload
        session.add(user)
        session.commit()
        session.refresh(user)
    elif(update.type.lower() == "phone number"):
        user.User_Phone_Num = update.payload
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        raise HTTPException(status_code=400, detail="Could not update account. Check input")
        
        
    return({"message": "User updated successfully"})
    """
    

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


@app.get("/report")
def getReports(auditID: Optional[int] = Query(None),
                user: Optional[int] = Query(None),
                category: Optional[str] = Query(None),
                session: Session = Depends(getSession)):
    
    stmt = select(UserReports)
    
    if auditID is not None:
        stmt = stmt.where(UserReports.AuditID == auditID) 
    if user is not None:
        stmt = stmt.where(UserReports.UserID == user)
    if category is not None:
        stmt = stmt.where(UserReports.Category == category)
        

    reports = session.exec(stmt).all()
    

    if not reports:
        raise HTTPException(status_code=404, detail="No Reports Found!")
    
    
    return reports


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
        Created_At= datetime.now(timezone.utc)
        )
    
    
    session.add(report)
    session.commit()
    session.refresh(report)
    
    return({"message": "Report filed successfully!"})



@app.delete("/report/{report_id}")
def resolveReport(report_id:int, session:Session = Depends(getSession)):
    stmt = select(UserReports).where(UserReports.AuditID == report_id)
    report = session.exec(stmt).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found!")
    
    session.delete(report)
    session.commit()
        
    return {"message":"Report resolved successfully"}


@app.get("/points/{driver_id}")
def getPointStatusReport(driver_id:int, session: Session = Depends(getSession)):
    stmt = select(Driver_User).where(Driver_User.UserID == driver_id)
    driver = session.exec(stmt).first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    
    stmt = select(Point_Transaction).where(Point_Transaction.Driver_User_ID == driver_id)
    statusReport = session.exec(stmt).all()
    
    if not statusReport:
        raise HTTPException(status_code=404, detail="No recent reports found for this driver")
    
    return statusReport

# Market Api Endpoints

@app.post("/market")
def createMarket(payload: MarketCreate, session: Session = Depends(getSession)):
    market = Market(
        Market_Name=payload.name,
        Market_Description=payload.description
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
    stmt = select(Driver_User).where(Driver_User.UserID == driver_id)
    driver = session.exec(stmt).first()
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver does not exist")
    
    stmt = select(Cart).where(Cart.DriverID == driver_id)
    
    if status is not None:
        stmt = stmt.where(Cart.Status == status)
    
    cart = session.exec(stmt).all()
    
    return cart


@app.post("/cart/{user_id}")
def createCart(user_id:int, session: Session = Depends(getSession)):
    stmt = select(User).where(User.UserID == user_id)
    
    user = session.exec(stmt).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User Not Found!")
    
    
    
    
 
#@app.patch("/cart/{cart_id}")
#def updateOrderStatus(cart_id: int):

#@app.delete("/cart/{cart_id}")
#def deleteOrder(cart_id: int)   
    