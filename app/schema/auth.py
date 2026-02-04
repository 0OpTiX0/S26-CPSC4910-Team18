   
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
        email: EmailStr
        password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

