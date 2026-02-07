from fastapi import FastAPI, Depends, HTTPException
from db import getSession
from sqlmodel import select, Session, delete
from encrypt import encryptString,verifyPassword
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
    ApplicationRequest
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
    
    stmt = select(Sponsor).where(Sponsor.Sponsor_Email == payload.sponsEmail)
    sponsor = session.exec(stmt).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    
    
    
        
