#Our API endpoints will go here.
#This is where our main API will be for the project.




import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select, col
from typing import Optional, List
import httpx





app = FastAPI()

@app.get("/")
def root():
    return("Hello World")
