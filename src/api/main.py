from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database.init_db import init_db
from src.api.routes import health, notifications, runs

app = FastAPI(title="VisionGuard Events API", version="1.0.0")

# Allow the Vite dev server and local preview to call the API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    init_db()

app.include_router(health.router)
app.include_router(runs.router)
app.include_router(notifications.router)
