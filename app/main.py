from fastapi import FastAPI, Depends
from db import getSession
from sqlmodel import select, Session, delete
from models import(
    User,
    Market,
    Sponsor,
    Driver_User,
    Sponsor_User,
    Driver_Application,
    UserCreate
)
from encrypt import encryptString

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
        User_Role=payload.email,
        User_Email=payload.email,
        User_Phone_Num=payload.phone,
        User_Hashed_Pss=encryptString(payload.pssw) 
    )
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
        



