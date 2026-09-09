from fastapi import APIRouter


router = APIRouter(tags=["health"])

@router.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
