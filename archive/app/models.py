from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from pydantic import BaseModel, EmailStr




class Admin(SQLModel, table=True):
    Admin_ID: Optional[int]= Field(default=None, primary_key=True)
    Admin_name:str
    Admin_Email:str = Field(index=True, unique=True)
    Admin_Phone_Num:str = Field(index=True, unique=True)
    Admin_Hash_Key:str




#Market_ID is a foreign key and will be developed in the future when we implement the Market system
#For now, just leave it as an int for the time being
class Sponsor(SQLModel, table=True):
    Sponsor_ID: Optional[int]= Field(default=None, primary_key=True)
    Sponsor_Name:str
    Market_ID: int
    Sponsor_Description: str
    Sponsor_Email:str = Field(unique=True)
    Sponsor_Phone_Num:str

    sponsor_users: List["Sponsor_User"] = Relationship(back_populates="sponsor")
    drivers: List["Driver"] = Relationship(back_populates="sponsor")




class Sponsor_User(SQLModel, table=True):
    sUser_ID: Optional[int]=Field(default=None, primary_key=True)
    sUser_Name: str
    sUser_Email: str = Field(index=True, unique=True)
    sUser_Phone_Num: str = Field(index=True, unique=True)
    sUser_Hashed_Pss: str


    Sponsor_ID: int = Field(foreign_key="sponsor.Sponsor_ID", index=True)
    sponsor: Optional["Sponsor"] = Relationship(back_populates = "sponsor_users")





class Driver(SQLModel, table=True):
    DriverID: Optional[int] = Field(default=None, primary_key=True)
    Driver_Name:str
    Driver_Email:str = Field(index=True, unique=True)
    Driver_Phone_Num:str = Field(index=True, unique=True)
    Sponsor_ID: int = Field(foreign_key="sponsor.Sponsor_ID", index=True)
    Driver_Hashed_Pss:str
    Driver_Points: int = Field(default = 0)

    sponsor: Optional["Sponsor"] = Relationship(back_populates= "drivers")






