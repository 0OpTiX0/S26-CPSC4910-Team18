import bcrypt
def encryptString(input:str) -> str:
    salt = bcrypt.gensalt()
    encoded = input.encode('utf-8')
    encrypted = bcrypt.hashpw(encoded,salt)
    
    return encrypted.decode('utf-8')


def verifyPassword(attemptedPss:str, correctPss:str)->bool:
    return bcrypt.checkpw(attemptedPss.encode('utf-8'), correctPss.encode('utf-8'))