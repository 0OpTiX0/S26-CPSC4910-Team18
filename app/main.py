from fastapi import FastAPI, Depends
from db import getSession
from sqlmodel import select, Session, delete
from models import(
    User,
    Market,
    Sponsor,
    Driver_User,
    Sponsor_User,
    Driver_Application 
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
    



