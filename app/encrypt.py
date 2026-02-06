import bcrypt
def encryptString(input:str) -> str:
    salt = bcrypt.gensalt()
    encoded = input.encode('utf-8')
    encrypted = bcrypt.hashpw(encoded,salt)
    
    return encrypted.decode('utf-8')
