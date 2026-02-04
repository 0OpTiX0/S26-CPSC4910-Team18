#import pymysql
import os
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlmodel import Session

#try:
#    connection = pymysql.connect(
#            host ="cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com",
#            user = "CPSC4911_admin",
#            password = "AmR3rnvsSJRrJaMJ5Jt2",
#            database = "Team18CapstoneDB",
#            connect_timeout = 5
#            )
#    print ("Connection Successful!")
#except Exception as e:
#    print("Connection failed")
#    print(e)



DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT =int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME")



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
