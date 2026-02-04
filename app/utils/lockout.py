
from datetime import datetime, timedelta

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

def is_locked(account):
    return account.Lockout_Until and account.Lockout_Until > datetime.utcnow()

def record_failed_attempt(account):
    account.Failed_Login_Attempts += 1
    if account.Failed_Login_Attempts >= MAX_ATTEMPTS:
        account.Lockout_Until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)

def reset_attempts(account):
    account.Failed_Login_Attempts = 0
    account.Lockout_Until = None

