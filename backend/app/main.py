from fastapi import FastAPI

from backend.app.modules.accounts.router import router as accounts_router
from backend.app.modules.economics.router import router as economics_router
from backend.app.modules.tax.router import router as tax_router
from backend.app.modules.supplies.router import router as supplies_router

app = FastAPI(title="WB Analytics API", version="0.1.0")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
app.include_router(economics_router, prefix="/economics", tags=["economics"])
app.include_router(tax_router, prefix="/tax-settings", tags=["tax-settings"])
app.include_router(supplies_router, prefix="/supplies", tags=["supplies"])
