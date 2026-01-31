#Our API endpoints will go here.
#This is where our main API will be for the project.


from app.models import(
    Admin,
    Sponsor,
    Sponsor_User,
    Driver,
)
from app.db import engine



import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select, col
from typing import Optional, List
from sqlalchemy import func, asc, desc, text
from fastapi.middleware.cors import CORSMiddleware



#database spooler to eliminate latency for first-time responses it also checks to see if the database is alive
@asynccontextmanager
async def lifespan(app:FastAPI):
    try:
        #pre-pool connections to test if alive
        with engine.connect() as conn:
            for _ in range(5):
                conn.execute(text("SELECT 1"))
            conn.commit()
        
        # Warms the ORM/query path with lightweight queries so the first real request is less "cold".
        with Session(engine) as s:
            s.exec(select(Admin).limit(1)).all()
            s.exec(select(Sponsor).limit(1)).all()
            s.exec(select(Sponsor_User).limit(1)).all()
            s.exec(select(Driver).limit(1)).all()
    #exception in case something went wrong.
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"DB warm-up skipped {e}")
    
    #relinquish database control to API
    yield
    
    try:
        engine.dispose()
    except Exception:
        pass
        


#Creates the application
app = FastAPI(root_path="/api", lifespan=lifespan) 

# Sessions are short-lived units of work for talking to databases
# This will create and yield a session when this is executed
def get_session():
    with Session(engine) as session:
        yield session
        
        

@app.get("/")
def root():
    return("Hello World")


"""
CORS (Cross-Origin-Resource Sharing) is a browser security ruile that controls wether a webpage running at one orgin is allowed to 
make requests to your API at different origns. 

Basically it enforces who is allows to read from your API responses from a browser
    
"""

ALLOWED_ORIGINS = [
    "http://98.93.133.29",
    "http://localhost",
    "http://127.0.0.1",
]

#This is adding middleware to the API which prevents CORS errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,  # set True only if you’ll use cookies/auth
)


def cf_or_remote_ip(request):
    # Safe as long as origin is CF-only (Tunnel or firewall to CF IPs)
    return request.headers.get("cf-connecting-ip") or get_remote_address(request)
