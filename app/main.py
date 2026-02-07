from fastapi import FastAPI, Depends, HTTPException, Query
from db import getSession
from sqlmodel import select, Session, delete
from encrypt import encryptString,verifyPassword
from datetime import datetime, timezone
from mailTo import emailSponsor
from typing import Optional, Literal
from models import(
    User,
    Market,
    Sponsor,
    Driver_User,
    Sponsor_User,
    Driver_Application,
    UserCreate,
    LoginRequest,
    DeleteRequest,
    ApplicationRequest,
    AppDeleteReq
)


app = FastAPI()
session = getSession()

@app.get("/health")
def health():
    return {"ok": True}


@app.get("/user")
def getUsers(session: Session = Depends(getSession)):
    stmt = select(User)
    users = session.exec(stmt).all()
    return users

@app.post("/user")
def createUser(payload: UserCreate, session:Session = Depends(getSession)):
    
    user = User(
        User_Name=payload.name,
        User_Role=payload.role,
        User_Email=payload.email,
        User_Phone_Num=payload.phone,
        User_Hashed_Pss=encryptString(payload.pssw) 
    )
    
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@app.delete("/user")
def deleteUser(payload:DeleteRequest, session:Session = Depends(getSession)):
        stmt = select(User).where(User.User_Name == payload.target)
        user = session.exec(stmt).first()
        if not user:
                raise HTTPException(status_code=404,detail="User does not exist")
        
        session.delete(user)
        session.commit()
        return{"message":"User deleted successfully"}        



@app.post("/login")
def login(payload:LoginRequest, session:Session = Depends(getSession)):
        
        stmt = select(User).where(User.User_Email == payload.email)
        user = session.exec(stmt).first()
        
        if not user:
                raise HTTPException(status_code=404, detail="Invalid Credientials")
        
        print("db email: ", user.User_Email)
        print("payload email: ", payload.email)
        
        if not verifyPassword(payload.password, user.User_Hashed_Pss):
                raise HTTPException(status_code=401, detail="Invalid Credentials")
        
        userRole = user.User_Role
        
        if userRole == "Admin":
                return {"message":"Logged in as ADMIN"}
        elif userRole == "Sponsor":
                return {"message":"Logged in as Sponsor"}
        elif userRole == "Sponsor_User":
                return {"message":"Logged in as Sponsor_User"} 
        elif userRole == "Driver":
                return{"message":"Logged in as Driver"}
            

@app.post("/application")
def submitApplication(payload: ApplicationRequest, session:Session = Depends(getSession)):
    stmt = select(User).where(User.User_Email == payload.appEmail)
    user = session.exec(stmt).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
    if user.UserID is None:
        raise HTTPException(status_code=500, detail="User ID is missing for the user")
    
    stmt = select(Sponsor).where(Sponsor.Sponsor_Email == payload.sponsEmail)
    sponsor = session.exec(stmt).first()
    if not sponsor or not sponsor.Sponsor_ID:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    
    if not emailSponsor(user.User_Email, sponsor.Sponsor_Email):
        print("There was a problem sending the application")

    
    application = Driver_Application(
        Sponsor_ID= sponsor.Sponsor_ID,
        UserID= user.UserID,
        Applicant_Email= payload.appEmail,
        Applicant_Phone_Num=payload.appPhoneNum,
        Applicant_Status="Pending",
        Submitted_At= datetime.now(timezone.utc)
    )
    
    session.add(application)
    session.commit()
    session.refresh(application)
    
    return{"message":"Email sent successfully and application saved to database!"}

#Queries all applications from the database
@app.get("/application")
def getAllApplications(session:Session = Depends(getSession),
                       sponsor_id: Optional[int] = Query(None),
                       applicant_email: Optional[str] = Query(None),
                       status: Optional[str] = Query(None)
                       ):
    stmt = select(Driver_Application)
    
    
    if sponsor_id is not None:
        stmt = stmt.where(Driver_Application.Sponsor_ID == sponsor_id)
    if status:
        stmt = stmt.where(Driver_Application.Applicant_Status == status)
    if applicant_email:
        stmt = stmt.where(Driver_Application.Applicant_Email == applicant_email)

    return session.exec(stmt).all()


#updates application status
@app.patch("/application/{application_id}")
def updateStatus(
    application_id: int,
    decision: Literal["Pending", "Approved", "Rejected"],
    session: Session = Depends(getSession),
):
    stmt = select(Driver_Application).where(
        Driver_Application.ApplicationID == application_id
    )
    application = session.exec(stmt).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.Applicant_Status = decision
    session.add(application)
    session.commit()
    session.refresh(application)

    return application

    
@app.delete("/application")
def deleteApp(payload:AppDeleteReq, session:Session = Depends(getSession)):
    stmt = select(Driver_Application).where(Driver_Application.ApplicationID == payload.id)
    target = session.exec(stmt).first()
    if not target:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    session.delete(target)
    session.commit()
    return {"message":"Application Deleted Successfully"}

    
    