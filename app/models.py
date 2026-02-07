from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime
from typing import Optional
from pydantic import BaseModel



class User(SQLModel, table=True):
    __tablename__= "User"
    UserID : Optional[int] = Field(default=None, primary_key=True, unique=True)
    User_Name : str
    User_Role : str
    User_Email : str = Field(unique=True)
    User_Phone_Num : str = Field(unique=True)
    User_Hashed_Pss : str
    User_Login_Attempts : int = Field(default=0)
    User_Lockout_Time : Optional[datetime] = Field(default=None)

class Market(SQLModel, table=True):
    __tablename__ = "Market"
    Market_ID : Optional[int] = Field(unique=True, primary_key=True, default=None)
    Market_Name : str
    Market_Description : str

class Sponsor(SQLModel, table=True):
    __tablename__ = "Sponsor"
    Sponsor_ID : Optional[int] = Field(unique=True, primary_key=True, default=None)
    Sponsor_Name : str
    Market_ID : int = Field(foreign_key="Market.Market_ID")
    Sponsor_Description : str
    Sponsor_Email : str = Field(unique=True)
    Sponsor_Phone_Num : str = Field(unique=True)

class Driver_User(SQLModel, table = True):
    __tablename__ = "Driver_User"
    UserID : Optional[int] = Field(unique=True, primary_key=True, default=None, foreign_key="User.UserID")
    Sponsor_ID : int = Field(foreign_key="Sponsor.Sponsor_ID")
    User_Points : int = Field(default=0)

class Sponsor_User(SQLModel, table=True):
    __tablename__ = "Sponsor_User"
    UserID : Optional[int] = Field(unique=True, primary_key=True, default=None, foreign_key="User.UserID")
    Sponsor_ID : int = Field(foreign_key="Sponsor.Sponsor_ID")

class Driver_Application(SQLModel, table=True):
    __tablename__ = "Driver_Application"
    ApplicationID: Optional[int] = Field(unique=True, primary_key=True, default=None)
    Sponsor_ID : int = Field(foreign_key="Sponsor.Sponsor_ID")
    UserID : int = Field(foreign_key="User.UserID")
    Applicant_Email : str
    Applicant_Phone_num : str
    Applicant_Status : str
    Submitted_At : datetime


# Payload classes for API Endpoints. They allow for information exchagne between frontend and backend



class UserCreate(BaseModel):
    name: str
    role:str
    email:str
    phone:str
    pssw:str
    logattp:int
    lockout:datetime
    
class LoginRequest(BaseModel):
    email: str
    password: str
    
class DeleteRequest(BaseModel):
    target: str