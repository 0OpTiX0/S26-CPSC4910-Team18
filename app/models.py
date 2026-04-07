from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel
from pydantic import BaseModel
from decimal import Decimal




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
    Verification_Code : Optional[str] = Field(default = None)
    Notifications_Enabled: bool = Field(default=True)
    Time_Zone: str = Field(default="UTC")
    Is_Disabled: bool = Field(default=False)
    Disabled_Reason: Optional[str] = None

class Market(SQLModel, table=True):
    __tablename__ = "Market"
    Market_ID : Optional[int] = Field(unique=True, primary_key=True, default=None)
    Market_Name : str
    Market_Description : str
    Market_Sponsor : Optional[int] = Field(foreign_key="Sponsor.Sponsor_ID", default=None)
    Point_Value: Optional[Decimal] = Field(default=Decimal("1.00"))


class Sponsor(SQLModel, table=True):
    __tablename__ = "Sponsor"
    Sponsor_ID : Optional[int] = Field(unique=True, primary_key=True, default=None)
    Sponsor_Name : str
    Sponsor_Description : str
    Sponsor_Email : str = Field(unique=True)
    Sponsor_Phone_Num : str = Field(unique=True)

class Driver_User(SQLModel, table=True):
    __tablename__ = "Driver_User"

    Registered_Driver: Optional[int] = Field(default=None, foreign_key="User.UserID", primary_key=True)
    Driver_Name: str
    Is_Suspended: bool = Field(default=False)
    Suspension_Reason: Optional[str] = None
    Suspension_Until: Optional[datetime] = None
    
    

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
   __tablename__ = "Reports"
   AuditID: Optional[int] = Field(unique=True, primary_key=True, default=None)
   UserID: int = Field(foreign_key="User.UserID")
   Category: str
   Issue_Type: str
   Issue_Description: str
   Created_At: datetime
   Status: str




class Point_Transaction(SQLModel, table=True):
    __tablename__="Point_Transaction"
    TransactionID: Optional[int] = Field(unique=True, primary_key=True, default=None)
    Driver_User_ID : Optional[int] = Field(foreign_key="Driver_User.Registered_Driver")
    Driver_Name: str
    Sponsor_Name: str
    Points_Change: str
    Points_After_Change: int
    Reason_For_Change:str
    Created_At: datetime
    

class Cart(SQLModel, table=True):
    __tablename__ ="Cart"
    CartID : Optional[int] = Field(unique=True, primary_key=True, default= None)
    DriverID: Optional[int] = Field(foreign_key="Driver_User.Registered_Driver")
    Cart_Total: Optional[int] = Field(default= 0)
    Status: str
    Created_At: datetime
    Checked_Out_At: datetime

class Product(SQLModel, table=True):
    __tablename__ = "Product"
    ProductID: Optional[int] = Field(default=None, unique=True, primary_key=True)
    MarketID: Optional[int] = Field(foreign_key="Market.Market_ID")
    Product_Name: str
    Product_Description: str
    Product_Price: int
    Product_Ebay_Prod_ID: str
    Product_Qty:int
    #We're going to use paths to pull images from storage instad of storing bits.
    Product_Image: str
    Last_Refreshed: datetime
    
class CartItem(SQLModel, table=True):
    __tablename__ = "Cart_Item"
    Cart_Item_ID: Optional[int] = Field(unique=True, primary_key=True, default = None)
    CartID: Optional[int] = Field(foreign_key="Cart.CartID")
    ProdID: Optional[int] = Field(foreign_key="Product.ProductID")
    Prod_Qty: int
    Prod_Price: int

class Notification(SQLModel, table=True):
    __tablename__ = "Notification"
    NotificationID: Optional[int] = Field(default=None, primary_key=True, unique=True)
    UserID: int = Field(foreign_key="User.UserID")
    Message: str
    Type: str   # e.g. "Profile", "Points", "Application"
    Is_Read: bool = Field(default=False)
    Created_At: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    

class PasswordChangeLog(SQLModel, table=True):
    __tablename__ = "Password_Changes"
    Log_ID : Optional[int] = Field(default=None, primary_key=True, unique=True)
    User_Type: str
    user_id: Optional[int] = Field(foreign_key="User.UserID")
    UserName: str
    ChangedAt: datetime
    
class MembershipDecisionLog(SQLModel, table=True):
    __tablename__ = "Application_Decisions"
    DecisionID: Optional[int] = Field(primary_key=True, default= None, unique= True)
    Driver_ID: Optional[int] = Field(foreign_key="Driver_User.Registered_Driver")
    Driver_Name: str
    Decision: str
    Reason: str
    Sponsor: str
    AuthorizedBy: str
    Decision_Made_At: datetime
    

class Sponsorship(SQLModel, table=True):
    __tablename__ = "Sponsorships"
    Driver_User_ID: Optional[int] = Field(primary_key=True, foreign_key="Driver_User.Registered_Driver")
    Sponsor_ID: Optional[int] = Field(primary_key=True, foreign_key="Sponsor.Sponsor_ID")
    User_Points: int = Field(default=0)
    Membership_Status: str
    Member_Since: datetime



    

# Payload classes for API Endpoints. They allow for information exchagne between frontend and backend



class UserCreate(BaseModel):
    name: str
    role: str
    sponsor_join: Optional[str] = None #Sponsor users can join an existing Sponsor by email or name
    email: str
    phone: str
    pssw: str
    logattp: int = 0
    lockout: Optional[datetime] = None
    verification_code: Optional[str] = None
    timezone: Optional[str] = "UTC"
    
class LoginRequest(BaseModel):
    email: str
    password: str
    

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
    


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


class AdminUpdate(BaseModel):
    type:str
    payload:str


class NewReport(BaseModel):
    userID:int
    category:str
    issue_type:str
    issue_description:str
    created_at:datetime
    status:str
    
class NewPointChange(BaseModel):
    driver_id: int
    sponsor_id: int
    points_change: int
    reason:str
    created_at: Optional[datetime] = None

class NotificationPreferenceUpdate(BaseModel):
    enabled: bool

# Market Payload

class MarketCreate(BaseModel):
    name : str
    description : str

class EnrollDriver(BaseModel):
    driver_id: int
    sponsor_id: int
    

# Cart Payload

class UpdateCart(BaseModel):
    cart_id : int
    cart_item_id : int
    prod_id : int
    prod_qty : Optional[int] = None

class AddToCart(BaseModel):
    product_id: str
    product_name: str
    status: str


class Purchase(BaseModel):
    market_id: int
    product_id: int
    driver_id: int
    sponsor_user_email: Optional[str] = None
    
    
class PointToDollar(BaseModel):
    
    market_id: int
    point_to_dollar_value : Decimal

class RedeemRequest(BaseModel):
    driver_id: int
    product_id: int
    quantity: int = 1

