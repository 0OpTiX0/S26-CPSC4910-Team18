import pymysql
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlmodel import Session
from dotenv import load_dotenv

# Load environment variables from app/.env or repo-root .env
BASE_DIR = Path(__file__).resolve().parent
for env_path in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
    if env_path.exists():
        load_dotenv(env_path)
        break

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT =int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME")

try:
    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        connect_timeout=5,
    )
    print("Connection Successful!")
except Exception as e:
    print("Connection failed")
    print(e)


DB_URL = URL.create(
        drivername= "mysql+pymysql",
        username = DB_USER,
        password = DB_PASSWORD,
        host = DB_HOST,
        port = DB_PORT,
        database = DB_NAME
        )

engine = create_engine(DB_URL)


try:
    with engine.connect() as conn:
        pass
except Exception as e:
    print("Engine Connection Failed!")
    print(e)
    print("Connection attempted with these creds: ")
    print("DB_HOST =", repr(os.getenv("DB_HOST")))
    print("DB_PORT =", repr(os.getenv("DB_PORT")))
    print("DB_USER =", repr(os.getenv("DB_USER")))
    print("DB_NAME =", repr(os.getenv("DB_NAME"))) 



def getSession():
    with Session(engine) as session:
        yield session
