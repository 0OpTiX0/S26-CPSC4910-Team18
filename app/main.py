from typing import Annotated
from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlmodel import Session, select
from db import getSession
from models import(
        Admin,
        Sponsor,
        Sponsor_User,
        Driver
        )

app = FastAPI(
        docs_url = "/api/docs",
        openapi_url = "/api/openapi.json",
        redoc_url="/api/redoc",

       )



SessionDep = Annotated[Session, Depends(getSession)]


@app.get("/api/admins")
def getAdmins(*, session: Session = Depends(getSession)):
       admins = session.exec(select(Admin)).all()
       return(admins)

@app.post("/api/admins")
def createAdmin(id : int, name : str, email : str, phone_num : str, hash_key : str, session : Session = Depends(getSession)):
	return True

