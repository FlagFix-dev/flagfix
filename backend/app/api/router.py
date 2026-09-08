from fastapi import APIRouter

from app.api import auth, orgs, problems

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(orgs.router)
api_router.include_router(problems.router)
