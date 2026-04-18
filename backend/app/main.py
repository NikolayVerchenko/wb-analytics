import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from backend.app.db import close_db_pool, init_db_pool
from backend.app.modules.accounts.router import router as accounts_router
from backend.app.modules.auth.router import router as auth_router
from backend.app.modules.economics.router import router as economics_router
from backend.app.modules.supplies.router import router as supplies_router
from backend.app.modules.stocks.router import router as stocks_router
from backend.app.modules.sync.router import router as sync_router
from backend.app.modules.tax.router import router as tax_router
from backend.app.modules.telegram_auth.router import router as telegram_auth_router
from backend.app.settings import get_settings

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()
    yield
    await close_db_pool()

app = FastAPI(title='WB Analytics API', version='0.1.0', lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


app.include_router(accounts_router, prefix='/accounts', tags=['accounts'])
app.include_router(auth_router, prefix='/auth', tags=['auth'])
app.include_router(economics_router, prefix='/economics', tags=['economics'])
app.include_router(tax_router, prefix='/tax-settings', tags=['tax-settings'])
app.include_router(supplies_router, prefix='/supplies', tags=['supplies'])
app.include_router(stocks_router, prefix='/stocks', tags=['stocks'])
app.include_router(sync_router, prefix='/sync', tags=['sync'])
app.include_router(telegram_auth_router, prefix='/auth', tags=['auth'])

if __name__ == '__main__':
    import os
    import uvicorn
    
    os.environ['WEB_CONCURRENCY'] = '1'
    uvicorn.run(app, host='0.0.0.0', port=8010, loop='none')
