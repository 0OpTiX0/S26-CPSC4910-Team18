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
    Applicant_Email : str = Field(unique = True)
    Applicant_Phone_Num : str
    Applicant_Status : str
    Rejection_Reason : Optional[str] = None
    Submitted_At : datetime
    

class UserReports(SQLModel, table=True):
    __tablename__ = "UserReports"
    


# Payload classes for API Endpoints. They allow for information exchagne between frontend and backend



class UserCreate(BaseModel):
    name: str
    role: str
    email: str
    phone: str
    pssw: str
    logattp: int = 0
    lockout: Optional[datetime] = None
    
class LoginRequest(BaseModel):
    email: str
    password: str
    
class DeleteRequest(BaseModel):
    target: str
    
class ApplicationRequest(BaseModel):
    appEmail: str
    sponsEmail: str
    appPhoneNum: str
    appStatus: Optional[str] = None
    subTime: Optional[datetime] = None
    
class AppDeleteReq(BaseModel):
    id: int

class SponsorCreate(BaseModel):
    name: str
    market_id: int
    description: str
    email: str
    phone: str
    
    
'''
class CredsUpdate(BaseModel):
    type:str
    payload:str
'''

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str


class AdminUpdate(BaseModel):
    type:str
    payload:str
