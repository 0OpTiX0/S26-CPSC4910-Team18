from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel

from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel

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

"""

class Admin(SQLModel, table=True):
    __tablename__ = "Admins"
    Admin_ID: Optional[int]= Field(default=None, primary_key=True)
    Admin_name:str
    Admin_Email:str = Field(index=True, unique=True)
    Admin_Phone_Num:str = Field(index=True, unique=True)
    Admin_Hash_Key:str
    Failed_Login_Attempts: int = Field(default=0)
    Lockout_Until: Optional[datetime] = None




#Market_ID is a foreign key and will be developed in the future when we implement the Market system
#For now, just leave it as an int for the time being

class Sponsor(SQLModel, table=True):
    __tablename__= "Sponsors"
    Sponsor_ID: Optional[int]= Field(default=None, primary_key=True)
    Sponsor_Name:str
    Market_ID: int
    Sponsor_Description: str
    Sponsor_Email:str = Field(unique=True)
    Sponsor_Phone_Num:str

    sponsor_users: List["Sponsor_User"] = Relationship(back_populates="sponsor")
    drivers: List["Driver"] = Relationship(back_populates="sponsor")




class Sponsor_User(SQLModel, table=True):
    __tablename__= "Sponsor_Users"
    sUser_ID: Optional[int]=Field(default=None, primary_key=True)
    sUser_Name: str
    sUser_Email: str = Field(index=True, unique=True)
    sUser_Phone_Num: str = Field(index=True, unique=True)
    sUser_Hashed_Pss: str
    Failed_Login_Attempts: int = Field(default=0)
    Lockout_Until: Optional[datetime] = None

    Sponsor_ID: int = Field(foreign_key="Sponsors.Sponsor_ID", index=True)
    sponsor: Optional["Sponsor"] = Relationship(back_populates = "sponsor_users")





class Driver(SQLModel, table=True):
    __tablename__ = "Drivers"
    DriverID: Optional[int] = Field(default=None, primary_key=True)
    Driver_Name:str
    Driver_Email:str = Field(index=True, unique=True)
    Driver_Phone_Num:str = Field(index=True, unique=True)
    Sponsor_ID: int = Field(foreign_key="Sponsors.Sponsor_ID", index=True)
    Driver_Hashed_Pss:str
    Driver_Points: int = Field(default = 0)
    Failed_Login_Attempts: int = Field(default=0)
    Lockout_Until: Optional[datetime] = None


    sponsor: Optional["Sponsor"] = Relationship(back_populates= "drivers")

"""
