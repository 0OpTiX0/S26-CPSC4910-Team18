from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    print("hello world!")
    return {"ok": True}