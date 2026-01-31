from pydantic import BaseModel, EmailStr
from enum import Enum

class RoleEnum(str, Enum):
    driver = "driver"
    sponsor = "sponsor"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleNum

class UserLogin(BaseModel):
    email: EmailStr
    password: EmailStr

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum

