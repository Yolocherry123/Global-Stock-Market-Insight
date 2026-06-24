from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
import analyst
import traceback

app = FastAPI(title="Global Stock Market Insights API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/exchanges")
def get_exchanges():
    try:
        overview = analyst.fetch_exchange_overview()
        return {"exchanges": overview}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/movers/{exchange_id}")
def get_movers(exchange_id: str):
    try:
        data = analyst.get_exchange_details(exchange_id)
        return data
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/correlation")
def get_correlation():
    try:
        corr_data = analyst.get_index_correlations()
        return corr_data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/macro")
def get_macro():
    try:
        macro_data = analyst.get_macro_news()
        return macro_data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/report")
def get_report():
    try:
        report = analyst.get_overall_market_report()
        return {"report": report}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/calendar")
def get_calendar():
    try:
        calendar_events = analyst.get_economic_calendar()
        return {"events": calendar_events}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class AllocationItem(BaseModel):
    ticker: str
    weight: float

class BacktestRequest(BaseModel):
    allocations: List[AllocationItem]
    transaction_fee_bps: float = 0.0
    slippage_pct: float = 0.0
    market: str = "us"

class FundamentalsCompareRequest(BaseModel):
    tickers: List[str]

@app.post("/api/backtest")
def post_backtest(req: BacktestRequest):
    try:
        alloc_list = [{"ticker": a.ticker, "weight": a.weight} for a in req.allocations]
        result = analyst.simulate_portfolio(
            alloc_list,
            transaction_fee_bps=req.transaction_fee_bps,
            slippage_pct=req.slippage_pct,
            market=req.market,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/research/comparison")
def get_research_comparison():
    try:
        data = analyst.get_exchange_comparison_data()
        return data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/research/{exchange_id}")
def get_exchange_research(exchange_id: str):
    try:
        return analyst.get_exchange_research(exchange_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/fundamentals/catalog")
def get_fundamentals_catalog():
    try:
        return analyst.get_fundamentals_catalog()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/fundamentals/company/{ticker}")
def get_fundamental_company(ticker: str):
    try:
        return analyst.get_fundamental_company(ticker)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fundamentals/compare")
def post_fundamentals_compare(req: FundamentalsCompareRequest):
    try:
        if not req.tickers:
            raise HTTPException(status_code=400, detail="At least one ticker is required.")
        return analyst.compare_fundamentals(req.tickers)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class FundamentalsSummaryRequest(BaseModel):
    tickers: List[str]

class WatchlistItem(BaseModel):
    ticker: str
    exchange_id: str = ""
    yahoo_symbol: str = ""
    display_name: str = ""

@app.get("/api/market/catalog")
def get_market_catalog():
    try:
        return analyst.get_market_catalog()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/watchlist/quotes")
def post_watchlist_quotes(items: List[WatchlistItem]):
    try:
        if not items:
            return {"quotes": []}
        payload = [item.model_dump() for item in items]
        return analyst.fetch_watchlist_quotes(payload)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fundamentals/summary")
def post_fundamentals_summary(req: FundamentalsSummaryRequest):
    try:
        if not req.tickers:
            raise HTTPException(status_code=400, detail="At least one ticker is required.")
        return analyst.generate_fundamentals_summary(req.tickers)
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
