from fastapi import FastAPI
from db import engine, getSession
from sqlalchemy import select

app = FastAPI()

@app.get("/health")
def health():
    return {"ok": True}


