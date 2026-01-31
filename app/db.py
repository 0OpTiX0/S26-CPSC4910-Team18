import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import QueuePool
from typing import Generator

DATABASE_URL = "cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com"
if not DATABASE_URL:
    raise RuntimeError("Issues loading your database")

#db connector
engine = create_engine(
    DATABASE_URL,
    poolclass= QueuePool,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
    echo=False
)

#Creates db tables for all SQLModel classes if they dont already exist
SQLModel.metadata.create_all(engine)

#yeields a database session tied to the engine.
def get_session()-> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session