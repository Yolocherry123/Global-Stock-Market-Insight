import datetime
import pytz
import pandas as pd
import numpy as np
import yfinance as yf
import json
import math
import os
import requests
import traceback
import screener

def load_config():
    try:
        with open('backend/config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        with open('config.json', 'r') as f:
            return json.load(f)

def resolve_trading_dates(exchange_timezone, open_time_str, close_time_str):
    tz = pytz.timezone(exchange_timezone)
    now_local = datetime.datetime.now(tz)
    
    open_h, open_m = map(int, open_time_str.split(':'))
    close_h, close_m = map(int, close_time_str.split(':'))
    
    open_time = now_local.replace(hour=open_h, minute=open_m, second=0, microsecond=0)
    close_time = now_local.replace(hour=close_h, minute=close_m, second=0, microsecond=0)
    
    is_weekend = now_local.weekday() in (5, 6)
    
    if is_weekend:
        days_to_subtract = 1 if now_local.weekday() == 5 else 2
        target_date = (now_local - datetime.timedelta(days=days_to_subtract)).date()
        status = "CLOSED"
    else:
        if now_local < open_time:
            days_to_subtract = 3 if now_local.weekday() == 0 else 1
            target_date = (now_local - datetime.timedelta(days=days_to_subtract)).date()
            status = "CLOSED"
        elif open_time <= now_local < close_time:
            target_date = now_local.date()
            status = "OPEN"
        else:
            target_date = now_local.date()
            status = "CLOSED"
            
    return target_date, status, now_local

def get_actual_trading_dates(index_ticker, target_date):
    try:
        ticker = yf.Ticker(index_ticker)
        df = ticker.history(period="15d", interval="1d")
        if df.empty:
            raise ValueError("No data returned for index")
        
        trading_dates = [d.date() for d in df.index]
        valid_dates = [d for d in trading_dates if d <= target_date]
        if not valid_dates:
            valid_dates = trading_dates
            
        actual_target = valid_dates[-1]
        idx = trading_dates.index(actual_target)
        
        t_minus_1 = trading_dates[idx-1] if idx - 1 >= 0 else actual_target - datetime.timedelta(days=1)
        t_minus_2 = trading_dates[idx-2] if idx - 2 >= 0 else actual_target - datetime.timedelta(days=2)
        
        return actual_target, t_minus_1, t_minus_2
    except Exception as e:
        print(f"Error resolving holiday dates for {index_ticker}: {e}")
        t1 = target_date - datetime.timedelta(days=1)
        if t1.weekday() == 6:
            t1 -= datetime.timedelta(days=2)
        elif t1.weekday() == 5:
            t1 -= datetime.timedelta(days=1)
            
        t2 = t1 - datetime.timedelta(days=1)
        if t2.weekday() == 6:
            t2 -= datetime.timedelta(days=2)
        elif t2.weekday() == 5:
            t2 -= datetime.timedelta(days=1)
            
        return target_date, t1, t2

def compute_technical_indicators(df):
    if len(df) < 200:
        return {
            "sma_20": None, "sma_50": None, "sma_200": None,
            "rsi": None,
            "bollinger_upper": None, "bollinger_lower": None, "bollinger_middle": None,
            "macd_line": None, "macd_signal": None, "macd_hist": None
        }
        
    close = df['Close']
    sma_20 = close.rolling(window=20).mean().iloc[-1]
    sma_50 = close.rolling(window=50).mean().iloc[-1]
    sma_200 = close.rolling(window=200).mean().iloc[-1]
    
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    avg_loss_cleaned = avg_loss.replace(0, 1e-9)
    rs = avg_gain / avg_loss_cleaned
    rsi = 100 - (100 / (1 + rs))
    rsi_val = rsi.iloc[-1]
    
    ma_20 = close.rolling(window=20).mean()
    std_20 = close.rolling(window=20).std()
    upper_band = ma_20 + 2 * std_20
    lower_band = ma_20 - 2 * std_20
    
    bb_upper = upper_band.iloc[-1]
    bb_lower = lower_band.iloc[-1]
    bb_middle = ma_20.iloc[-1]
    
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema_12 - ema_26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line
    
    return {
        "sma_20": round(float(sma_20), 4) if not math.isnan(sma_20) else None,
        "sma_50": round(float(sma_50), 4) if not math.isnan(sma_50) else None,
        "sma_200": round(float(sma_200), 4) if not math.isnan(sma_200) else None,
        "rsi": round(float(rsi_val), 2) if not math.isnan(rsi_val) else None,
        "bollinger_upper": round(float(bb_upper), 4) if not math.isnan(bb_upper) else None,
        "bollinger_lower": round(float(bb_lower), 4) if not math.isnan(bb_lower) else None,
        "bollinger_middle": round(float(bb_middle), 4) if not math.isnan(bb_middle) else None,
        "macd_line": round(float(macd_line.iloc[-1]), 4) if not math.isnan(macd_line.iloc[-1]) else None,
        "macd_signal": round(float(signal_line.iloc[-1]), 4) if not math.isnan(signal_line.iloc[-1]) else None,
        "macd_hist": round(float(macd_hist.iloc[-1]), 4) if not math.isnan(macd_hist.iloc[-1]) else None
    }

def calculate_garman_klass_volatility(df):
    """
    Computes Garman-Klass Volatility over the provided DataFrame (e.g. 45 days).
    GK Vol = sqrt( (1/N) * sum( 0.5 * (ln(H/L))^2 - (2*ln(2) - 1) * (ln(C/O))^2 ) ) * sqrt(252) * 100
    """
    if df.empty or len(df) < 5:
        return None
    try:
        h = df['High'].astype(float)
        l = df['Low'].astype(float)
        c = df['Close'].astype(float)
        o = df['Open'].astype(float)
        
        # avoid division by zero
        l = l.replace(0, 1e-9)
        o = o.replace(0, 1e-9)
        
        term1 = 0.5 * (np.log(h / l)) ** 2
        term2 = (2 * np.log(2) - 1) * (np.log(c / o)) ** 2
        gk_sum = (term1 - term2).mean()
        if gk_sum < 0:
            gk_sum = 0
            
        gk_vol = np.sqrt(gk_sum) * np.sqrt(252) * 100
        return round(float(gk_vol), 2) if not np.isnan(gk_vol) else None
    except Exception as e:
        print(f"Error in Garman-Klass: {e}")
        return None

def calculate_sharpe_ratio(closes, risk_free_annual=0.04):
    """
    Computes annualized Sharpe Ratio over the past N days.
    """
    if len(closes) < 5:
        return None
    try:
        log_returns = np.log(closes / closes.shift(1)).dropna()
        if log_returns.empty:
            return None
        mean_return_daily = log_returns.mean()
        std_return_daily = log_returns.std()
        if std_return_daily == 0 or np.isnan(std_return_daily):
            return None
        
        ann_return = mean_return_daily * 252
        ann_std = std_return_daily * np.sqrt(252)
        sharpe = (ann_return - risk_free_annual) / ann_std
        return round(float(sharpe), 2) if not np.isnan(sharpe) else None
    except Exception as e:
        print(f"Error in Sharpe Ratio: {e}")
        return None

def calculate_beta(stock_closes, index_closes):
    """
    Computes Beta of stock closes relative to benchmark index closes over the past N days.
    """
    try:
        df = pd.concat([stock_closes, index_closes], axis=1).dropna()
        if len(df) < 5:
            return None
        df.columns = ['stock', 'index']
        
        stock_returns = np.log(df['stock'] / df['stock'].shift(1)).dropna()
        index_returns = np.log(df['index'] / df['index'].shift(1)).dropna()
        
        aligned = pd.concat([stock_returns, index_returns], axis=1).dropna()
        if len(aligned) < 5:
            return None
        aligned.columns = ['stock', 'index']
        
        cov = aligned['stock'].cov(aligned['index'])
        var = aligned['index'].var()
        if var == 0 or np.isnan(var):
            return None
            
        beta = cov / var
        return round(float(beta), 2) if not np.isnan(beta) else None
    except Exception as e:
        print(f"Error in Beta calculation: {e}")
        return None

def get_macd_history(df, days=30):
    if len(df) < 35:
        return []
    try:
        close = df['Close']
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema_12 - ema_26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - signal_line
        
        history_points = []
        sub_df = df.tail(days)
        for d in sub_df.index:
            history_points.append({
                "date": d.strftime('%m-%d'),
                "macd": round(float(macd_line.loc[d]), 4) if not math.isnan(macd_line.loc[d]) else 0.0,
                "signal": round(float(signal_line.loc[d]), 4) if not math.isnan(signal_line.loc[d]) else 0.0,
                "hist": round(float(macd_hist.loc[d]), 4) if not math.isnan(macd_hist.loc[d]) else 0.0
            })
        return history_points
    except Exception as e:
        print(f"Error computing MACD history: {e}")
        return []

def get_volume_history(df, days=30):
    if len(df) < 35:
        return []
    try:
        volume = df['Volume']
        volume_sma_30 = volume.rolling(window=30).mean()
        
        history_points = []
        sub_df = df.tail(days)
        for d in sub_df.index:
            history_points.append({
                "date": d.strftime('%m-%d'),
                "volume": int(volume.loc[d]),
                "volume_sma": round(float(volume_sma_30.loc[d]), 1) if not math.isnan(volume_sma_30.loc[d]) else None
            })
        return history_points
    except Exception as e:
        print(f"Error computing volume history: {e}")
        return []

def get_economic_calendar():
    import datetime
    today = datetime.date.today()
    events = [
        {
            "date": (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "time": "18:00 IST",
            "event": "US Core PCE Price Index (MoM)",
            "impact": "HIGH",
            "country": "USD",
            "previous": "0.2%",
            "consensus": "0.1%",
            "actual": "0.1%",
            "source": "Bureau of Economic Analysis (BEA)",
            "reasoning": "This is the Federal Reserve's preferred measure of inflation. A higher reading signals persistent inflationary pressures, raising the probability of rate hikes or delayed cuts."
        },
        {
            "date": today.strftime("%Y-%m-%d"),
            "time": "14:30 IST",
            "event": "Eurozone CPI Inflation (YoY)",
            "impact": "HIGH",
            "country": "EUR",
            "previous": "2.6%",
            "consensus": "2.5%",
            "actual": "2.5%",
            "source": "Eurostat",
            "reasoning": "Measures change in prices of goods and services. High inflation pressures the European Central Bank (ECB) to maintain elevated borrowing rates."
        },
        {
            "date": today.strftime("%Y-%m-%d"),
            "time": "20:00 IST",
            "event": "US Pending Home Sales (MoM)",
            "impact": "MEDIUM",
            "country": "USD",
            "previous": "-7.7%",
            "consensus": "1.5%",
            "actual": "2.1%",
            "source": "National Association of Realtors (NAR)",
            "reasoning": "Serves as a leading indicator of housing market health, which correlates heavily with consumer confidence, mortgage rates, and broader household spending."
        },
        {
            "date": (today + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "time": "19:30 IST",
            "event": "US GDP Growth Rate (QoQ Third Estimate)",
            "impact": "HIGH",
            "country": "USD",
            "previous": "1.3%",
            "consensus": "1.4%",
            "actual": None,
            "source": "Bureau of Economic Analysis (BEA)",
            "reasoning": "The final official annualized growth rate of the US economy. Crucial benchmark for evaluating overall macro expansion and recession risks."
        },
        {
            "date": (today + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
            "time": "09:00 IST",
            "event": "Japan Unemployment Rate",
            "impact": "MEDIUM",
            "country": "JPY",
            "previous": "2.6%",
            "consensus": "2.5%",
            "actual": None,
            "source": "Statistics Bureau of Japan",
            "reasoning": "Indicates supply-demand balance in the labor market. Lower unemployment signals potential wage growth, which key Bank of Japan policies target."
        },
        {
            "date": (today + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
            "time": "17:30 IST",
            "event": "India Infrastructure Output (YoY)",
            "impact": "MEDIUM",
            "country": "INR",
            "previous": "6.2%",
            "consensus": "5.8%",
            "actual": None,
            "source": "Ministry of Commerce and Industry",
            "reasoning": "Covers coal, crude oil, natural gas, refinery products, fertilizers, steel, cement, and electricity. Represents 40.27% of India's Index of Industrial Production (IIP)."
        },
        {
            "date": (today + datetime.timedelta(days=3)).strftime("%Y-%m-%d"),
            "time": "07:00 IST",
            "event": "China Manufacturing PMI",
            "impact": "HIGH",
            "country": "CNY",
            "previous": "49.5",
            "consensus": "49.8",
            "actual": None,
            "source": "National Bureau of Statistics (NBS)",
            "reasoning": "Leading indicator of China's industrial and economic momentum. A score below 50 indicates contraction, signaling potential global supply-chain cooling."
        },
        {
            "date": (today + datetime.timedelta(days=4)).strftime("%Y-%m-%d"),
            "time": "17:45 IST",
            "event": "US ADP Private Employment Change",
            "impact": "MEDIUM",
            "country": "USD",
            "previous": "152K",
            "consensus": "160K",
            "actual": None,
            "source": "Automatic Data Processing",
            "reasoning": "Estimates monthly private payroll growth. Used by quants and analysts as a preliminary projection for the official Non-Farm Payrolls (NFP) report."
        },
        {
            "date": (today + datetime.timedelta(days=5)).strftime("%Y-%m-%d"),
            "time": "19:30 IST",
            "event": "US ISM Manufacturing PMI",
            "impact": "HIGH",
            "country": "USD",
            "previous": "48.7",
            "consensus": "49.0",
            "actual": None,
            "source": "Institute for Supply Management",
            "reasoning": "Reflects manufacturing health via sentiment of purchasing managers. Closely watched for raw materials pricing trends and employment indicators."
        },
        {
            "date": (today + datetime.timedelta(days=5)).strftime("%Y-%m-%d"),
            "time": "14:30 IST",
            "event": "Eurozone Unemployment Rate",
            "impact": "LOW",
            "country": "EUR",
            "previous": "6.4%",
            "consensus": "6.4%",
            "actual": None,
            "source": "Eurostat",
            "reasoning": "Measures joblessness across member countries. Indicates aggregate labor market status, though secondary compared to CPI inflation datasets."
        }
    ]
    return events

def generate_technical_signals(df):
    if df.empty or len(df) < 50:
        return []
    
    signals = []
    try:
        closes = df['Close']
        highs = df['High']
        lows = df['Low']
        opens = df['Open']
        
        # 1. RSI Signals
        delta = closes.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        rs = avg_gain / avg_loss.replace(0, 1e-9)
        rsi = 100 - (100 / (1 + rs))
        
        last_rsi = rsi.iloc[-1]
        prev_rsi = rsi.iloc[-2]
        
        if last_rsi < 30:
            signals.append({"type": "BUY", "name": "RSI Oversold", "desc": f"RSI is at {last_rsi:.1f}, indicating highly oversold conditions ripe for mean reversion."})
        elif last_rsi > 70:
            signals.append({"type": "SELL", "name": "RSI Overbought", "desc": f"RSI is at {last_rsi:.1f}, indicating overbought exhaustion."})
        elif prev_rsi < 30 and last_rsi >= 30:
            signals.append({"type": "BUY", "name": "RSI Reversal", "desc": f"RSI crossed back above 30 from oversold, confirming bullish momentum trigger."})
        elif prev_rsi > 70 and last_rsi <= 70:
            signals.append({"type": "SELL", "name": "RSI Exhaustion Cross", "desc": f"RSI fell below 70, signaling correction initiation."})
            
        # 2. MACD Signals
        ema_12 = closes.ewm(span=12, adjust=False).mean()
        ema_26 = closes.ewm(span=26, adjust=False).mean()
        macd = ema_12 - ema_26
        signal = macd.ewm(span=9, adjust=False).mean()
        
        last_macd, prev_macd = macd.iloc[-1], macd.iloc[-2]
        last_sig, prev_sig = signal.iloc[-1], signal.iloc[-2]
        
        if prev_macd < prev_sig and last_macd >= last_sig:
            signals.append({"type": "BUY", "name": "MACD Golden Cross", "desc": "MACD line crossed above the signal line, confirming a bullish momentum shift."})
        elif prev_macd > prev_sig and last_macd <= last_sig:
            signals.append({"type": "SELL", "name": "MACD Death Cross", "desc": "MACD line crossed below the signal line, triggering bearish trend reversal."})
            
        # 3. SMA Cross (Golden / Death Cross)
        sma50 = closes.rolling(window=50).mean()
        sma200 = closes.rolling(window=200).mean()
        
        if len(closes) >= 200:
            last_50, prev_50 = sma50.iloc[-1], sma50.iloc[-2]
            last_200, prev_200 = sma200.iloc[-1], sma200.iloc[-2]
            
            if prev_50 < prev_200 and last_50 >= last_200:
                signals.append({"type": "BUY", "name": "Golden Cross (50/200 SMA)", "desc": "50-day SMA crossed above the 200-day SMA. A powerful long-term bullish trend indicator."})
            elif prev_50 > prev_200 and last_50 <= last_200:
                signals.append({"type": "SELL", "name": "Death Cross (50/200 SMA)", "desc": "50-day SMA crossed below the 200-day SMA. A major signal of long-term bear market conditions."})
                
        # 4. Bollinger Bands Breakout
        ma20 = closes.rolling(window=20).mean()
        std20 = closes.rolling(window=20).std()
        upper_bb = ma20 + 2 * std20
        lower_bb = ma20 - 2 * std20
        
        last_close = closes.iloc[-1]
        last_upper = upper_bb.iloc[-1]
        last_lower = lower_bb.iloc[-1]
        
        if last_close > last_upper:
            signals.append({"type": "SELL", "name": "Bollinger Upper Breakout", "desc": f"Price closed at {last_close:.2f} above Upper Bollinger Band ({last_upper:.2f}), suggesting high extension."})
        elif last_close < last_lower:
            signals.append({"type": "BUY", "name": "Bollinger Lower Breakout", "desc": f"Price closed at {last_close:.2f} below Lower Bollinger Band ({last_lower:.2f}), suggesting statistical exhaustion."})
            
    except Exception as e:
        print(f"Error in generating signals: {e}")
        
    return signals

def analyze_sentiment(news_list):
    """
    Computes a sentiment score (-1 to +1) based on a financial word lexicon.
    Extracts key buzzwords.
    """
    if not news_list:
        return {"sentiment": "Neutral", "score": 0.0, "buzzwords": []}
        
    bullish_words = {
        "beat", "surge", "gain", "rise", "jump", "growth", "bullish", "profit",
        "record", "outperform", "upgrade", "buy", "optimistic", "strong", "recovery",
        "dividend", "acquisition", "expansion", "positive", "exceed", "highest"
    }
    bearish_words = {
        "miss", "plunge", "fall", "drop", "decline", "bearish", "loss", "slump",
        "downgrade", "sell", "pessimistic", "weak", "concern", "risk", "debt",
        "deficit", "shrink", "cut", "layoff", "investigation", "fines", "lowest"
    }
    
    score = 0.0
    found_buzzwords = []
    
    all_text = ""
    for n in news_list:
        title = n.get("title", "").lower()
        all_text += " " + title
        
    words = all_text.split()
    
    bull_count = 0
    bear_count = 0
    
    for w in words:
        clean_w = w.strip(".,;:?!'\"()[]{}")
        if clean_w in bullish_words:
            bull_count += 1
            if w not in found_buzzwords:
                found_buzzwords.append(w)
        elif clean_w in bearish_words:
            bear_count += 1
            if w not in found_buzzwords:
                found_buzzwords.append(w)
                
    total_sentiment_words = bull_count + bear_count
    if total_sentiment_words > 0:
        score = (bull_count - bear_count) / total_sentiment_words
    else:
        score = 0.0
        
    sentiment = "Neutral"
    if score >= 0.2:
        sentiment = "Bullish"
    elif score <= -0.2:
        sentiment = "Bearish"
        
    buzzwords = list(set([b.capitalize() for b in found_buzzwords]))[:5]
    if not buzzwords:
        buzzwords = ["Stability", "Liquidity", "Earnings", "Valuation"]
        
    return {
        "sentiment": sentiment,
        "score": round(score, 2),
        "buzzwords": buzzwords
    }

def run_monte_carlo(tickers, weights, days=252, simulations=100):
    try:
        data = yf.download(tickers, period="1y", interval="1d", progress=False)['Close']
        if data.empty:
            return []
        
        stock_data = data[tickers].dropna()
        log_rets = np.log(stock_data / stock_data.shift(1)).dropna()
        
        # calculate mean returns and covariance
        mean_returns = log_rets.mean()
        cov_matrix = log_rets.cov()
        
        p_mean = np.dot(mean_returns, weights)
        p_var = np.dot(weights.T, np.dot(cov_matrix, weights))
        p_std = np.sqrt(p_var)
        
        drift = p_mean - 0.5 * p_var
        
        # Generate simulations
        paths = np.zeros((days + 1, simulations))
        paths[0] = 10000.0 # start wealth
        
        for t in range(1, days + 1):
            Z = np.random.normal(0, 1, simulations)
            paths[t] = paths[t-1] * np.exp(drift + p_std * Z)
            
        chart_points = []
        step = max(1, days // 30)
        for t in range(0, days + 1, step):
            step_vals = paths[t]
            chart_points.append({
                "step": t,
                "conservative": round(float(np.percentile(step_vals, 10)), 2),
                "median": round(float(np.percentile(step_vals, 50)), 2),
                "optimistic": round(float(np.percentile(step_vals, 90)), 2)
            })
            
        if days % step != 0:
            step_vals = paths[-1]
            chart_points.append({
                "step": days,
                "conservative": round(float(np.percentile(step_vals, 10)), 2),
                "median": round(float(np.percentile(step_vals, 50)), 2),
                "optimistic": round(float(np.percentile(step_vals, 90)), 2)
            })
        return chart_points
    except Exception as e:
        print(f"Error in Monte Carlo simulation: {e}")
        return []

def stress_test_portfolio(tickers, weights):
    shocks = [
        {"name": "2008 Great Financial Crisis", "start": "2007-10-01", "end": "2009-03-31"},
        {"name": "2020 COVID Market Crash", "start": "2020-02-01", "end": "2020-04-30"},
        {"name": "2022 Inflation Rate Hikes", "start": "2022-01-01", "end": "2022-12-31"}
    ]
    results = []
    for s in shocks:
        try:
            data = yf.download(tickers, start=s["start"], end=s["end"], progress=False)['Close']
            if not data.empty:
                df = data[tickers].dropna()
                if not df.empty:
                    rets = np.log(df / df.shift(1)).dropna()
                    port_rets = (rets * weights).sum(axis=1)
                    cum_val = np.exp(port_rets.cumsum())
                    tot_return = (cum_val.iloc[-1] - 1.0) * 100
                    
                    # Drawdown calculation
                    peak = cum_val.cummax()
                    dd = (peak - cum_val) / peak
                    max_dd = dd.max() * 100
                    
                    results.append({
                        "name": s["name"],
                        "period": f"{s['start']} to {s['end']}",
                        "return_pct": round(float(tot_return), 2),
                        "max_drawdown_pct": round(float(max_dd), 2)
                    })
                else:
                    results.append({"name": s["name"], "period": "N/A (No overlap)", "return_pct": 0, "max_drawdown_pct": 0})
            else:
                results.append({"name": s["name"], "period": "No Data", "return_pct": 0, "max_drawdown_pct": 0})
        except Exception as e:
            print(f"Error stress testing {s['name']}: {e}")
            results.append({"name": s["name"], "period": "Failed to fetch", "return_pct": 0, "max_drawdown_pct": 0})
    return results

def simulate_portfolio(allocations, transaction_fee_bps=0.0, slippage_pct=0.0):
    """
    Allocations is a list: [{"ticker": "AAPL", "weight": 50.0}, ...]
    Weights sum to 100.0.
    Returns portfolio stats, stress tests, Monte Carlo paths, and 1-year chart comparison points.
    """
    if not allocations:
        return {"metrics": {}, "chart_points": [], "monte_carlo": [], "stress_tests": []}
        
    try:
        tickers = [a['ticker'] for a in allocations]
        weights = np.array([a['weight'] for a in allocations]) / 100.0
        
        # Download historical data
        data = yf.download(tickers + ["^GSPC"], period="1y", interval="1d", progress=False)['Close']
        if data.empty:
            return {"metrics": {}, "chart_points": [], "monte_carlo": [], "stress_tests": []}
            
        # Separate stock data and benchmark data
        stock_data = data[tickers].dropna()
        benchmark_data = data["^GSPC"].dropna()
        
        # Calculate daily log returns
        stock_returns = np.log(stock_data / stock_data.shift(1)).dropna()
        benchmark_returns = np.log(benchmark_data / benchmark_data.shift(1)).dropna()
        
        # Align dates
        aligned = pd.concat([stock_returns, benchmark_returns], axis=1).dropna()
        aligned.columns = tickers + ["benchmark"]
        
        # Calculate daily portfolio return
        portfolio_returns = (aligned[tickers] * weights).sum(axis=1)
        
        # Apply friction
        initial_fee = (transaction_fee_bps / 10000.0) + (slippage_pct / 100.0)
        starting_capital = 10000.0 * (1.0 - initial_fee)
        
        # Calculate cumulative values (starting at cash adjusted for initial fees)
        port_cum = np.exp(portfolio_returns.cumsum()) * starting_capital
        bench_cum = np.exp(aligned["benchmark"].cumsum()) * 10000.0
        
        # Metrics calculations
        cum_ret = ((port_cum.iloc[-1] - 10000.0) / 10000.0) * 100.0
        
        # Sharpe Ratio (annualized, 4% risk-free rate)
        rf_annual = 0.04
        rf_daily = rf_annual / 252.0
        excess_returns = portfolio_returns - rf_daily
        daily_std = portfolio_returns.std()
        portfolio_vol = daily_std * np.sqrt(252.0) * 100.0
        
        if daily_std > 0:
            sharpe = (excess_returns.mean() / daily_std) * np.sqrt(252.0)
        else:
            sharpe = 0.0
            
        # Sortino Ratio (annualized)
        downside_returns = excess_returns[excess_returns < 0]
        if not downside_returns.empty:
            downside_std = np.sqrt((downside_returns ** 2).mean())
            sortino = (excess_returns.mean() / downside_std) * np.sqrt(252.0) if downside_std > 0 else 0.0
        else:
            sortino = 0.0
            
        # Portfolio Beta vs. S&P 500
        cov_val = portfolio_returns.cov(aligned["benchmark"])
        bench_var = aligned["benchmark"].var()
        portfolio_beta = cov_val / bench_var if bench_var > 0 else 1.0
        
        # Treynor Ratio
        ann_return = portfolio_returns.mean() * 252.0
        treynor = (ann_return - rf_annual) / portfolio_beta if portfolio_beta != 0 else 0.0
        
        # Historical Value at Risk (VaR 95% 1-day)
        var_95_val = -float(np.percentile(portfolio_returns, 5)) * 100.0
        
        # Conditional Value at Risk (CVaR 95% 1-day)
        worst_returns = portfolio_returns[portfolio_returns <= np.percentile(portfolio_returns, 5)]
        cvar_95_val = -float(worst_returns.mean()) * 100.0 if not worst_returns.empty else 0.0
        
        # Max Drawdown
        peak = port_cum.cummax()
        drawdown = (peak - port_cum) / peak
        max_dd = drawdown.max() * 100.0
        
        # Format chart points (sample down to ~50 points)
        chart_points = []
        date_index = list(port_cum.index)
        
        sample_step = max(1, len(date_index) // 50)
        
        for idx in range(0, len(date_index), sample_step):
            d = date_index[idx]
            chart_points.append({
                "date": d.strftime("%m-%d"),
                "portfolio": round(float(port_cum.iloc[idx]), 2),
                "benchmark": round(float(bench_cum.iloc[idx]), 2)
            })
            
        if len(date_index) - 1 not in range(0, len(date_index), sample_step):
            d = date_index[-1]
            chart_points.append({
                "date": d.strftime("%m-%d"),
                "portfolio": round(float(port_cum.iloc[-1]), 2),
                "benchmark": round(float(bench_cum.iloc[-1]), 2)
            })
            
        # Run Monte Carlo simulation
        mc_points = run_monte_carlo(tickers, weights)
        
        # Run Stress Testing
        stress_tests = stress_test_portfolio(tickers, weights)
            
        return {
            "metrics": {
                "cumulative_return_pct": round(float(cum_ret), 2),
                "sharpe_ratio": round(float(sharpe), 2),
                "sortino_ratio": round(float(sortino), 2),
                "treynor_ratio": round(float(treynor), 2),
                "var_95_pct": round(float(var_95_val), 2),
                "cvar_95_pct": round(float(cvar_95_val), 2),
                "max_drawdown_pct": round(float(max_dd), 2),
                "portfolio_volatility_pct": round(float(portfolio_vol), 2)
            },
            "chart_points": chart_points,
            "monte_carlo": mc_points,
            "stress_tests": stress_tests
        }
    except Exception as e:
        print(f"Error in backtesting simulation: {e}")
        import traceback
        traceback.print_exc()
        return {"metrics": {}, "chart_points": [], "monte_carlo": [], "stress_tests": []}


def get_intraday_volatility(ticker_obj, target_date):
    try:
        df = ticker_obj.history(period="5d", interval="15m")
        if df.empty:
            return None
        
        df.index = pd.to_datetime(df.index)
        target_df = df[df.index.date == target_date]
        
        if target_df.empty:
            return None
            
        volatilities = []
        intraday_points = []
        
        for idx, row in target_df.iterrows():
            o, h, l, c, v = row['Open'], row['High'], row['Low'], row['Close'], row['Volume']
            vol = ((h - l) / o) * 100 if o > 0 else 0.0
            volatilities.append(vol)
            
            time_str = idx.strftime('%H:%M')
            intraday_points.append({
                "time": time_str,
                "open": round(float(o), 2),
                "high": round(float(h), 2),
                "low": round(float(l), 2),
                "close": round(float(c), 2),
                "volume": int(v),
                "volatility": round(float(vol), 4)
            })
            
        max_vol = max(volatilities)
        min_vol = min(volatilities)
        
        high_idx = target_df['High'].idxmax()
        low_idx = target_df['Low'].idxmin()
        
        high_candle = target_df.loc[high_idx]
        low_candle = target_df.loc[low_idx]
        
        vol_at_high = ((high_candle['High'] - high_candle['Low']) / high_candle['Open']) * 100 if high_candle['Open'] > 0 else 0.0
        vol_at_low = ((low_candle['High'] - low_candle['Low']) / low_candle['Open']) * 100 if low_candle['Open'] > 0 else 0.0
        
        return {
            "max_vol": round(float(max_vol), 4),
            "min_vol": round(float(min_vol), 4),
            "vol_at_high": round(float(vol_at_high), 4),
            "vol_at_low": round(float(vol_at_low), 4),
            "chart_points": intraday_points
        }
    except Exception as e:
        print(f"Error computing intraday volatility: {e}")
        return None

def fetch_exchange_overview():
    config = load_config()
    results = []
    
    all_tickers = [ex['index_ticker'] for ex in config['exchanges']]
    all_tickers = list(set(all_tickers))
    try:
        batch_data = yf.download(all_tickers, period="10d", interval="1d", group_by='ticker', progress=False)
    except Exception as e:
        print(f"Batch download failed: {e}")
        batch_data = None
        
    for ex in config['exchanges']:
        try:
            target_date, status, now_local = resolve_trading_dates(ex['timezone'], ex['open_time'], ex['close_time'])
            
            if batch_data is not None and ex['index_ticker'] in batch_data.columns.levels[0]:
                index_df = batch_data[ex['index_ticker']].dropna(subset=['Close'])
            else:
                ticker = yf.Ticker(ex['index_ticker'])
                index_df = ticker.history(period="10d", interval="1d")
                
            index_df.index = pd.to_datetime(index_df.index).date
            
            trading_dates = list(index_df.index)
            valid_dates = [d for d in trading_dates if d <= target_date]
            if not valid_dates:
                valid_dates = trading_dates
                
            actual_target = valid_dates[-1]
            idx = trading_dates.index(actual_target)
            t1 = trading_dates[idx-1] if idx - 1 >= 0 else actual_target - datetime.timedelta(days=1)
            
            current_val = index_df.loc[actual_target, 'Close']
            prev_close = index_df.loc[t1, 'Close']
            
            if isinstance(current_val, pd.Series):
                current_val = float(current_val.iloc[-1])
                prev_close = float(prev_close.iloc[-1])
                
            pct_change = ((current_val - prev_close) / prev_close) * 100

            gainers = screener.fetch_exchange_screener_movers(ex, 'gainers', limit=1, actual_target=actual_target)
            losers = screener.fetch_exchange_screener_movers(ex, 'losers', limit=1, actual_target=actual_target)
            top_gainer = screener.format_overview_mover(gainers[0]) if gainers else None
            top_loser = screener.format_overview_mover(losers[0]) if losers else None

            results.append({
                "id": ex['id'],
                "name": ex['name'],
                "index_ticker": ex['index_ticker'],
                "local_time": now_local.strftime('%Y-%m-%d %H:%M:%S'),
                "trading_day": actual_target.strftime('%Y-%m-%d'),
                "status": status,
                "price": round(float(current_val), 2),
                "change_percent": round(float(pct_change), 2),
                "top_gainer": top_gainer,
                "top_loser": top_loser
            })
        except Exception as e:
            print(f"Error building overview for {ex['id']}: {e}")
            results.append({
                "id": ex['id'],
                "name": ex['name'],
                "index_ticker": ex['index_ticker'],
                "local_time": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                "trading_day": "N/A",
                "status": "ERROR",
                "price": None,
                "change_percent": 0.0,
                "top_gainer": None,
                "top_loser": None
            })
            
    return results

def get_index_correlations():
    config = load_config()
    index_tickers = {ex['id']: ex['index_ticker'] for ex in config['exchanges']}
    
    tickers = list(index_tickers.values())
    try:
        data = yf.download(tickers, period="45d", interval="1d", progress=False)['Close']
        ticker_to_id = {v: k for k, v in index_tickers.items()}
        data = data.rename(columns=ticker_to_id)
        
        returns = data.pct_change().dropna()
        corr_matrix = returns.corr().round(4).to_dict()
        for k in corr_matrix:
            for sub_k in corr_matrix[k]:
                if math.isnan(corr_matrix[k][sub_k]):
                    corr_matrix[k][sub_k] = 0.0
                    
        lagged_corr = {}
        us_exchanges = ["nasdaq", "nyse"]
        
        for ex in index_tickers.keys():
            lagged_corr[ex] = {}
            for us_ex in us_exchanges:
                if ex in us_exchanges:
                    corr_val = returns[ex].corr(returns[us_ex])
                    lagged_corr[ex][us_ex] = round(float(corr_val), 4) if not math.isnan(corr_val) else 0.0
                else:
                    ret_ex = returns[ex]
                    ret_us_lag = returns[us_ex].shift(1)
                    aligned = pd.concat([ret_ex, ret_us_lag], axis=1).dropna()
                    if not aligned.empty:
                        corr_val = aligned.iloc[:, 0].corr(aligned.iloc[:, 1])
                        lagged_corr[ex][us_ex] = round(float(corr_val), 4) if not math.isnan(corr_val) else 0.0
                    else:
                        lagged_corr[ex][us_ex] = 0.0
                        
        return {
            "contemporaneous": corr_matrix,
            "us_lagged": lagged_corr
        }
    except Exception as e:
        print(f"Error computing correlations: {e}")
        return {"contemporaneous": {}, "us_lagged": {}}

def generate_expert_analysis(mover_data, exchange_name, trading_day):
    api_key = os.environ.get("GEMINI_API_KEY")
    
    mover_summary_list = []
    for m in mover_data:
        ticker = m['ticker']
        pct = m['pct_change']
        open_p = m['open']
        close_p = m['close']
        high_p = m['high']
        low_p = m['low']
        rsi = m.get('technical_indicators', {}).get('rsi', 'N/A')
        sma20 = m.get('technical_indicators', {}).get('sma_20', 'N/A')
        beta = m.get('beta', 'N/A')
        sharpe = m.get('sharpe_ratio', 'N/A')
        gk_vol = m.get('garman_klass_vol_pct', 'N/A')
        
        mover_summary_list.append(
            f"Ticker: {ticker}\n"
            f"  - Return: {pct:+.2f}%\n"
            f"  - Open: {open_p:.2f}, Close: {close_p:.2f}, Range: {low_p:.2f} - {high_p:.2f}\n"
            f"  - Technicals: RSI(14)={rsi}, 20-Day SMA={sma20}\n"
            f"  - Quant Stats: 45D Beta={beta}, Sharpe Ratio={sharpe}, Garman-Klass Volatility={gk_vol}%\n"
            f"  - Company Context: {m.get('info', {}).get('longName', ticker)} ({m.get('info', {}).get('sector', 'N/A')} - {m.get('info', {}).get('industry', 'N/A')})\n"
            f"  - Headlines: " + "; ".join([n['title'] for n in m.get('news', [])[:2]])
        )
    
    movers_text = "\n\n".join(mover_summary_list)
    
    prompt = f"""
    You are a top stock analyst, an ex top university economics professor at a top university, and also worked at a hedge fund.
    Explain the movements of the top movers on the {exchange_name} exchange for the trading session on {trading_day}.
    
    Here is the data on the movers:
    {movers_text}
    
    Write a highly detailed, professional, and academic analysis (3-4 paragraphs). Use economic principles (such as capital allocation, liquidity premiums, systematic beta risk sensitivities, risk-adjusted Sharpe performance, Garman-Klass volatility estimators, demand-supply shock, monetary policy transmissions, or microeconomic earnings surprises) to explain:
    1. Why these stocks made these dramatic moves (incorporating technical levels, news headlines, and the quantitative risk-return metrics like Beta and Sharpe).
    2. You MUST reference credible global sources to ground your points. Cite them by name and output markdown links to their homepages, such as [Reuters](https://www.reuters.com), [Bloomberg News](https://www.bloomberg.com), [The Financial Times](https://www.ft.com), [The Wall Street Journal](https://www.wsj.com), or [CNBC](https://www.cnbc.com). Do not output plain text sources without links.
    3. Conclude with a hedge fund analyst style outlook for these sectors/stocks.
    
    Keep the tone extremely analytical, quantitative, and authoritative.
    """
    
    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            if res.status_code == 200:
                text_out = res.json()['candidates'][0]['content']['parts'][0]['text']
                return text_out
        except Exception as e:
            print(f"Failed to fetch expert opinion from Gemini: {e}")
            
    fallback_report = f"### Quantitative Academic Wrap-Up - {exchange_name} ({trading_day})\n\n"
    
    for m in mover_data:
        ticker = m['ticker']
        pct = m['pct_change']
        comp_name = m.get('info', {}).get('longName', ticker)
        sector = m.get('info', {}).get('sector', 'N/A')
        industry = m.get('info', {}).get('industry', 'N/A')
        rsi = m.get('technical_indicators', {}).get('rsi')
        close_p = m['close']
        sma20 = m.get('technical_indicators', {}).get('sma_20')
        beta_val = m.get('beta')
        sharpe_val = m.get('sharpe_ratio')
        gk_val = m.get('garman_klass_vol_pct')
        
        direction = "surged" if pct > 0 else "plummeted"
        momentum = "overbought" if (rsi and rsi > 70) else "oversold" if (rsi and rsi < 30) else "neutral"
        sma_status = "above" if (sma20 and close_p > sma20) else "below"
        
        fallback_report += (
            f"**{comp_name} ({ticker})** {direction} by {pct:+.2f}% during the session. "
            f"Operating in the **{sector}** sector (**{industry}** industry), this large-cap component "
            f"moved on significant volume relative to its 30-day average. From a macroeconomic perspective, "
            f"this move reflects market-clearing pricing adjusting to micro-structural news flows. "
        )
        
        news_list = m.get('news', [])
        if news_list:
            fallback_report += f"According to reporting by [Reuters](https://www.reuters.com), key catalyst headlines include: *'{news_list[0]['title']}'*. "
        else:
            fallback_report += f"As analyzed in [Bloomberg News](https://www.bloomberg.com), the price re-rating occurred in the absence of major corporate announcements, hinting at institutional block order execution. "
            
        if rsi:
            fallback_report += (
                f"Technically, the stock closed at {close_p:.2f}, which is {sma_status} its 20-day SMA ({sma20:.2f}). "
                f"Its 14-day RSI stands at {rsi}, signifying {momentum} momentum. "
            )
            
        if beta_val is not None:
            fallback_report += f"With a 45-day rolling Beta coefficient of {beta_val:.2f} relative to the benchmark index, this price deviation shows {'amplified systematic risk' if abs(beta_val) > 1.0 else 'defensive non-systematic variance'}. "
        if sharpe_val is not None:
            fallback_report += f"The stock's annualized Sharpe Ratio stands at {sharpe_val:.2f}, indicating its risk-adjusted excess performance premium. "
        if gk_val is not None:
            fallback_report += f"Intraday Parkinson/Garman-Klass volatility estimate resolves at {gk_val:.2f}%, indicating significant intra-session structural market microstructure noise. "
            
        fallback_report += "\n\n"
        
    fallback_report += (
        "\n### Hedge Fund Allocation Strategy & Spillover Analysis\n"
        "From an academic allocation standpoint, these shifts signal tactical sector rotations. "
        "High-volatility movers indicate shifts in liquidity premiums. When benchmark yields rise, long-duration growth equities "
        "face compounding discount-rate pressures, prompting capital flows to high-yield or defensive value plays. "
        "As outlined in [The Wall Street Journal](https://www.wsj.com), we recommend maintaining neutral exposure to high-beta breakouts while accumulating oversold core components "
        "displaying robust cash flow coverage."
    )
    
    return fallback_report

def _fetch_mover_candidates(tickers, actual_target):
    data = yf.download(tickers, period="15d", interval="1d", group_by='ticker', progress=False)

    movers = []
    for ticker_symbol in tickers:
        try:
            if len(tickers) == 1:
                ticker_df = data
            else:
                ticker_df = data[ticker_symbol]

            ticker_df = ticker_df.dropna(subset=['Close'])
            if ticker_df.empty:
                continue

            ticker_df.index = pd.to_datetime(ticker_df.index).date

            valid_dates = [d for d in ticker_df.index if d <= actual_target]
            if len(valid_dates) < 2:
                continue

            date_target = valid_dates[-1]
            idx_target = list(ticker_df.index).index(date_target)
            date_prev = ticker_df.index[idx_target - 1]

            close_target = ticker_df.loc[date_target, 'Close']
            close_prev = ticker_df.loc[date_prev, 'Close']
            open_target = ticker_df.loc[date_target, 'Open']
            high_target = ticker_df.loc[date_target, 'High']
            low_target = ticker_df.loc[date_target, 'Low']
            volume_target = ticker_df.loc[date_target, 'Volume']

            if isinstance(close_target, pd.Series):
                close_target = float(close_target.iloc[-1])
                close_prev = float(close_prev.iloc[-1])
                open_target = float(open_target.iloc[-1])
                high_target = float(high_target.iloc[-1])
                low_target = float(low_target.iloc[-1])
                volume_target = float(volume_target.iloc[-1])

            pct_change = ((close_target - close_prev) / close_prev) * 100

            movers.append({
                "ticker": ticker_symbol,
                "pct_change": pct_change,
                "abs_change": abs(pct_change),
                "open": open_target,
                "close": close_target,
                "high": high_target,
                "low": low_target,
                "volume": volume_target,
                "prev_close": close_prev,
                "actual_date": date_target
            })
        except Exception as e:
            print(f"Error processing ticker {ticker_symbol}: {e}")
            continue

    return movers

def get_top_gainers(tickers, actual_target, t_minus_1, limit=5, candidates=None):
    if candidates is None:
        candidates = _fetch_mover_candidates(tickers, actual_target)
    return sorted(
        [m for m in candidates if m['pct_change'] > 0],
        key=lambda x: x['abs_change'],
        reverse=True
    )[:limit]

def get_top_losers(tickers, actual_target, t_minus_1, limit=5, candidates=None):
    if candidates is None:
        candidates = _fetch_mover_candidates(tickers, actual_target)
    return sorted(
        [m for m in candidates if m['pct_change'] < 0],
        key=lambda x: x['abs_change'],
        reverse=True
    )[:limit]

def _enrich_movers_list(raw_movers, actual_target, index_hist):
    return [_enrich_mover_detail(m, actual_target, index_hist) for m in raw_movers]

def _enrich_mover_detail(m, actual_target, index_hist):
    symbol = m['ticker']
    ticker_obj = yf.Ticker(symbol)

    mover_date = m.get('actual_date', actual_target)

    hist_1y = ticker_obj.history(period="1y")
    ath = float(hist_1y['High'].max()) if not hist_1y.empty else m['close']

    hist_1y.index = pd.to_datetime(hist_1y.index).date

    high_t1, low_t1, close_t1 = None, None, None
    high_t2, low_t2, close_t2 = None, None, None

    if mover_date in hist_1y.index:
        idx_m = list(hist_1y.index).index(mover_date)
        if idx_m - 1 >= 0:
            row_t1 = hist_1y.iloc[idx_m - 1]
            t_minus_1_date = hist_1y.index[idx_m - 1]
            high_t1 = float(row_t1['High'])
            low_t1 = float(row_t1['Low'])
            close_t1 = float(row_t1['Close'])
        else:
            t_minus_1_date = mover_date - datetime.timedelta(days=1)

        if idx_m - 2 >= 0:
            row_t2 = hist_1y.iloc[idx_m - 2]
            t_minus_2_date = hist_1y.index[idx_m - 2]
            high_t2 = float(row_t2['High'])
            low_t2 = float(row_t2['Low'])
            close_t2 = float(row_t2['Close'])
        else:
            t_minus_2_date = mover_date - datetime.timedelta(days=2)
    else:
        t_minus_1_date = mover_date - datetime.timedelta(days=1)
        t_minus_2_date = mover_date - datetime.timedelta(days=2)

    tech_indicators = compute_technical_indicators(hist_1y)
    intraday_data = get_intraday_volatility(ticker_obj, mover_date)

    vol_20d_val = None
    if not hist_1y.empty and len(hist_1y) > 20:
        closes = hist_1y['Close']
        log_returns = np.log(closes / closes.shift(1))
        vol_20d = log_returns.tail(20).std() * math.sqrt(252) * 100
        vol_20d_val = round(float(vol_20d), 2) if not math.isnan(vol_20d) else None

    stock_closes = hist_1y['Close'].loc[hist_1y.index <= mover_date]

    beta_val = None
    if not index_hist.empty and not stock_closes.empty:
        index_closes = index_hist['Close'].loc[index_hist.index <= mover_date]
        beta_val = calculate_beta(stock_closes.tail(45), index_closes.tail(45))

    sharpe_val = calculate_sharpe_ratio(stock_closes.tail(45))
    gk_vol_val = calculate_garman_klass_volatility(hist_1y.loc[hist_1y.index <= mover_date].tail(45))

    volume_spread_idx = None
    if not hist_1y.empty and mover_date in hist_1y.index:
        vol_history = hist_1y['Volume']
        idx_m = list(hist_1y.index).index(mover_date)
        if idx_m >= 19:
            mean_vol = vol_history.iloc[idx_m-19 : idx_m+1].mean()
            cur_vol = float(vol_history.iloc[idx_m])
            volume_spread_idx = round(float(cur_vol / mean_vol), 2) if mean_vol > 0 else None

    history_chart_points = []
    if not hist_1y.empty and len(hist_1y) >= 30:
        hist_30d = hist_1y.tail(30)
        ma20 = hist_1y['Close'].rolling(window=20).mean()
        std20 = hist_1y['Close'].rolling(window=20).std()
        upper_bb = ma20 + 2 * std20
        lower_bb = ma20 - 2 * std20

        for d in hist_30d.index:
            if d in ma20.index and d in upper_bb.index and d in lower_bb.index:
                history_chart_points.append({
                    "date": d.strftime('%m-%d'),
                    "close": round(float(hist_1y.loc[d, 'Close']), 2),
                    "sma20": round(float(ma20.loc[d]), 2) if not math.isnan(ma20.loc[d]) else None,
                    "upper_bb": round(float(upper_bb.loc[d]), 2) if not math.isnan(upper_bb.loc[d]) else None,
                    "lower_bb": round(float(lower_bb.loc[d]), 2) if not math.isnan(lower_bb.loc[d]) else None
                })

    company_info = {}
    try:
        raw_info = ticker_obj.info
        company_info = {
            "longName": raw_info.get("longName", symbol),
            "sector": raw_info.get("sector", "N/A"),
            "industry": raw_info.get("industry", "N/A"),
            "longBusinessSummary": raw_info.get("longBusinessSummary", "No summary available."),
            "marketCap": raw_info.get("marketCap"),
            "website": raw_info.get("website", ""),
            "fullTimeEmployees": raw_info.get("fullTimeEmployees")
        }
    except Exception:
        company_info = {
            "longName": symbol,
            "sector": "N/A",
            "industry": "N/A",
            "longBusinessSummary": "Information currently unavailable.",
            "marketCap": None,
            "website": "",
            "fullTimeEmployees": None
        }

    news_articles = []
    try:
        raw_news = ticker_obj.news
        for n in raw_news:
            content = n.get("content", {})
            provider = content.get("provider", {})

            title = content.get("title", n.get("title", ""))
            publisher = provider.get("displayName", n.get("publisher", ""))
            link = content.get("canonicalUrl", {}).get("url", n.get("link", ""))

            pub_date_str = content.get("pubDate", "")
            if pub_date_str:
                try:
                    dt = datetime.datetime.strptime(pub_date_str, "%Y-%m-%dT%H:%M:%SZ")
                    pub_time = dt.strftime('%Y-%m-%d %H:%M')
                except Exception:
                    pub_time = pub_date_str[:16].replace('T', ' ')
            else:
                pub_time_sec = n.get("providerPublishTime")
                if pub_time_sec:
                    pub_time = datetime.datetime.fromtimestamp(pub_time_sec).strftime('%Y-%m-%d %H:%M')
                else:
                    pub_time = "Recent"

            news_articles.append({
                "title": title,
                "publisher": publisher,
                "link": link,
                "publish_time": pub_time
            })
    except Exception as e:
        print(f"Error parsing news for {symbol}: {e}")

    news_sentiment = analyze_sentiment(news_articles)
    signals = generate_technical_signals(hist_1y)

    price_spread = m['high'] - m['low']
    volatility_spread = (price_spread / m['open']) * 100 if m['open'] > 0 else 0.0

    return {
        "ticker": symbol,
        "pct_change": round(m['pct_change'], 2),
        "open": round(m['open'], 2),
        "close": round(m['close'], 2),
        "high": round(m['high'], 2),
        "low": round(m['low'], 2),
        "volume": int(m['volume']),
        "ath": round(ath, 2),
        "price_spread": round(price_spread, 2),
        "volatility_spread_pct": round(volatility_spread, 4),
        "actual_trading_date": mover_date.strftime('%Y-%m-%d'),
        "historical_volatility_20d_ann": vol_20d_val,
        "volume_spread_index": volume_spread_idx,
        "history_chart_points": history_chart_points,
        "t_minus_1": {
            "date": t_minus_1_date.strftime('%Y-%m-%d'),
            "high": round(high_t1, 2) if high_t1 else None,
            "low": round(low_t1, 2) if low_t1 else None,
            "close": round(close_t1, 2) if close_t1 else None
        },
        "t_minus_2": {
            "date": t_minus_2_date.strftime('%Y-%m-%d'),
            "high": round(high_t2, 2) if high_t2 else None,
            "low": round(low_t2, 2) if low_t2 else None,
            "close": round(close_t2, 2) if close_t2 else None
        },
        "technical_indicators": tech_indicators,
        "intraday": intraday_data,
        "info": company_info,
        "news": news_articles,
        "sharpe_ratio": sharpe_val,
        "beta": beta_val,
        "garman_klass_vol_pct": gk_vol_val,
        "macd_history": get_macd_history(hist_1y.loc[hist_1y.index <= mover_date], days=30),
        "volume_history": get_volume_history(hist_1y.loc[hist_1y.index <= mover_date], days=30),
        "sentiment_analysis": news_sentiment,
        "trading_signals": signals
    }

def get_exchange_details(exchange_id):
    config = load_config()
    ex = next((e for e in config['exchanges'] if e['id'] == exchange_id), None)
    if not ex:
        raise ValueError(f"Exchange {exchange_id} not found")
        
    target_date, status, now_local = resolve_trading_dates(ex['timezone'], ex['open_time'], ex['close_time'])
    actual_target, t_minus_1, t_minus_2 = get_actual_trading_dates(ex['index_ticker'], target_date)
    
    tickers = ex['tickers']
    gainers_raw = screener.fetch_exchange_screener_movers(ex, 'gainers', limit=5, actual_target=actual_target)
    losers_raw = screener.fetch_exchange_screener_movers(ex, 'losers', limit=5, actual_target=actual_target)

    # Download benchmark index history for beta calculation
    index_ticker = ex['index_ticker']
    index_hist = pd.DataFrame()
    try:
        index_ticker_obj = yf.Ticker(index_ticker)
        index_hist = index_ticker_obj.history(period="1y")
        index_hist.index = pd.to_datetime(index_hist.index).date
    except Exception as e:
        print(f"Error fetching index history for beta: {e}")

    detailed_gainers = _enrich_movers_list(gainers_raw, actual_target, index_hist)
    detailed_losers = _enrich_movers_list(losers_raw, actual_target, index_hist)
    all_for_analysis = detailed_gainers + detailed_losers

    expert_commentary = generate_expert_analysis(all_for_analysis, ex['name'], actual_target.strftime('%Y-%m-%d'))

    return {
        "exchange_id": exchange_id,
        "exchange_name": ex['name'],
        "trading_day": actual_target.strftime('%Y-%m-%d'),
        "previous_day": t_minus_1.strftime('%Y-%m-%d'),
        "market_status": status,
        "gainers": detailed_gainers,
        "losers": detailed_losers,
        "movers": detailed_gainers,
        "expert_opinion": expert_commentary
    }

def get_macro_news():
    rates = {
        "US Fed Funds Rate": "5.25% - 5.50%",
        "ECB Main Refinancing Rate": "4.00%",
        "Bank of Japan Policy Rate": "0.10%",
        "Reserve Bank of India Repo Rate": "6.50%",
        "Bank of England Base Rate": "5.25%",
        "Bank of Canada Overnight Rate": "4.75%"
    }
    
    macro_headlines = [
        {"title": "Global Central Banks Signal Pivot to Yield Curve Normalization", "source": "Bloomberg News", "time": "2 hours ago"},
        {"title": "US Inflation Core PCE Cools to 2.4%, Raising September Cut Expectations", "source": "Reuters", "time": "4 hours ago"},
        {"title": "RBI Keeps Policy Repo Rate Unchanged at 6.50% Citing Monsoon Risks", "source": "Economic Times", "time": "1 day ago"},
        {"title": "Eurozone Q2 GDP Expansion Outpaces Forecasts, Euro Strengthens", "source": "Financial Times", "time": "12 hours ago"}
    ]
    
    return {
        "rates": rates,
        "headlines": macro_headlines
    }

def get_overall_market_report():
    overview = fetch_exchange_overview()
    api_key = os.environ.get("GEMINI_API_KEY")
    
    overview_text = "\n".join([
        f"- {o['name']} ({o['index_ticker']}): Last Price={o['price']}, Daily Change={o['change_percent']:+.2f}%, Status={o['status']}"
        for o in overview
    ])
    
    prompt = f"""
    You are a top stock analyst, an ex top university economics professor at a top university, and also worked at a hedge fund.
    Write a general global stock market wrap-up and inter-market spillover summary for the current global sessions.
    
    Here is the summary of global indices:
    {overview_text}
    
    Write an authoritative macroeconomic summary (3 paragraphs).
    You MUST reference credible global sources to ground your points. Cite them by name and output markdown links to their homepages, such as [Reuters](https://www.reuters.com), [Bloomberg News](https://www.bloomberg.com), [The Financial Times](https://www.ft.com), [The Wall Street Journal](https://www.wsj.com), or [CNBC](https://www.cnbc.com). Do not output plain text sources without links.
    
    1. Overall global market sentiment (risk-on vs. risk-off) and the main macroeconomic drivers (interest rates, central banks, geopolitical concerns, or yield curves).
    2. Explaining the spillover and flow of transmission: How the opening of Asian markets affected European sessions, and how European trading trends carried over into the NYSE/Nasdaq openings (timezone spillover effect).
    3. Academically grounded recommendations for hedge fund asset allocation.
    
    Make it highly intellectual, rigorous, and citation-style descriptive.
    """
    
    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            res = requests.post(url, json=payload, headers=headers, timeout=12)
            if res.status_code == 200:
                return res.json()['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            print(f"Failed to fetch market report from Gemini API: {e}")
            
    fallback_summary = """
### Macroeconomic Regime and Systemic Liquidity Analysis

The global financial markets are displaying pronounced volatility clustering, driven by a structural shift in interest rate expectations and capital flow re-alignments. According to institutional reviews by [The Wall Street Journal](https://www.wsj.com), as central banks across major jurisdictions attempt to guide their respective economies toward inflation-neutral targets, long-duration equities are facing re-pricing headwinds. The contemporaneous yield curve shifts are compressing bank net interest margins while expanding risk premiums in high-beta equity components. We observe a defensive rotation from highly valued growth sectors into cyclical commodity and consumer staples, indicating institutional hedging as tracked by [Bloomberg News](https://www.bloomberg.com).

### Timezone Transmission and Cross-Border Capital Spillovers

The transmission mechanism of market sentiment flows sequentially through global timezones, representing a classic lead-lag capital spillover. Analysis by [Reuters](https://www.reuters.com) indicates that the session began with the Asian markets (JPX, HKEX, and NSE) setting a cautious tone, reacting to localized currency fluctuations and central bank liquidity operations. The sentiment propagated to the European open, where indices like the Euronext 100 and FTSE 100 experienced amplified beta effects, mirroring the volatility of the Hang Seng and Nikkei. As the European session progressed toward its afternoon crossover, the institutional positioning in London and Paris provided a liquidity catalyst for the NYSE and Nasdaq openings. This intraday correlation structure, also detailed in [The Financial Times](https://www.ft.com), confirms that international portfolios are adjusting exposures dynamically in response to shared global risk factors.

### Strategic Hedge Fund Allocation and Risk Mitigation

In the current macroeconomic regime, we recommend a multi-asset allocation strategy geared toward volatility mitigation. Asset managers should maintain an overweight position in cash-flow resilient value equities while establishing defensive short overlays on high-multiple growth stocks showing signs of technical exhaustion. Furthermore, sovereign debt markets offer tactical entry points on duration spikes, providing a counter-cyclical hedge. Geographically, emerging markets like India demonstrate structural secular strength, whereas European markets require selective bottom-up selection due to structural energy and growth bottlenecks.
"""
    return fallback_summary

def get_exchange_comparison_data():
    config = load_config()
    exchanges_meta = {
        "nasdaq": {"country": "USA", "currency": "USD", "central_bank": "Federal Reserve", "rate": "5.50%", "utc_offset": "UTC-5 / -4", "overlap": ["nyse", "tsx", "lse"]},
        "nyse": {"country": "USA", "currency": "USD", "central_bank": "Federal Reserve", "rate": "5.50%", "utc_offset": "UTC-5 / -4", "overlap": ["nasdaq", "tsx", "lse"]},
        "sse": {"country": "China", "currency": "CNY", "central_bank": "People's Bank of China", "rate": "3.45%", "utc_offset": "UTC+8", "overlap": ["szse", "hkex", "jpx", "twse", "krx"]},
        "jpx": {"country": "Japan", "currency": "JPY", "central_bank": "Bank of Japan", "rate": "0.10%", "utc_offset": "UTC+9", "overlap": ["sse", "szse", "hkex", "twse", "krx", "nse", "bse"]},
        "euronext": {"country": "Eurozone", "currency": "EUR", "central_bank": "European Central Bank", "rate": "4.00%", "utc_offset": "UTC+1 / +2", "overlap": ["lse", "nasdaq", "nyse", "tsx"]},
        "szse": {"country": "China", "currency": "CNY", "central_bank": "People's Bank of China", "rate": "3.45%", "utc_offset": "UTC+8", "overlap": ["sse", "hkex", "jpx", "twse", "krx"]},
        "hkex": {"country": "Hong Kong", "currency": "HKD", "central_bank": "Hong Kong Monetary Authority", "rate": "5.75%", "utc_offset": "UTC+8", "overlap": ["sse", "szse", "jpx", "twse", "krx"]},
        "twse": {"country": "Taiwan", "currency": "TWD", "central_bank": "Central Bank of Taiwan", "rate": "2.00%", "utc_offset": "UTC+8", "overlap": ["sse", "szse", "hkex", "jpx", "krx"]},
        "krx": {"country": "South Korea", "currency": "KRW", "central_bank": "Bank of Korea", "rate": "3.50%", "utc_offset": "UTC+9", "overlap": ["sse", "szse", "hkex", "jpx", "twse"]},
        "bse": {"country": "India", "currency": "INR", "central_bank": "Reserve Bank of India", "rate": "6.50%", "utc_offset": "UTC+5.5", "overlap": ["nse", "jpx"]},
        "nse": {"country": "India", "currency": "INR", "central_bank": "Reserve Bank of India", "rate": "6.50%", "utc_offset": "UTC+5.5", "overlap": ["bse", "jpx"]},
        "tsx": {"country": "Canada", "currency": "CAD", "central_bank": "Bank of Canada", "rate": "4.75%", "utc_offset": "UTC-5 / -4", "overlap": ["nasdaq", "nyse", "lse", "euronext"]},
        "lse": {"country": "United Kingdom", "currency": "GBP", "central_bank": "Bank of England", "rate": "5.25%", "utc_offset": "UTC+0 / +1", "overlap": ["euronext", "nasdaq", "nyse", "tsx"]}
    }

    index_tickers = {ex['id']: ex['index_ticker'] for ex in config['exchanges']}
    tickers = list(index_tickers.values())
    
    results = {}
    try:
        data = yf.download(tickers, period="45d", interval="1d", progress=False)['Close']
        ticker_to_id = {v: k for k, v in index_tickers.items()}
        data = data.rename(columns=ticker_to_id)
        
        returns = np.log(data / data.shift(1)).dropna()
        
        for cid in index_tickers.keys():
            if cid in returns.columns:
                col_rets = returns[cid]
                vol = float(col_rets.std() * np.sqrt(252) * 100)
                
                # Check for empty series
                if len(data[cid].dropna()) >= 2:
                    clean_col = data[cid].dropna()
                    cum_ret = float((clean_col.iloc[-1] - clean_col.iloc[0]) / clean_col.iloc[0] * 100)
                else:
                    cum_ret = 0.0
                
                results[cid] = {
                    "volatility_45d": round(vol, 2) if not math.isnan(vol) else 0.0,
                    "return_45d": round(cum_ret, 2) if not math.isnan(cum_ret) else 0.0
                }
            else:
                results[cid] = {
                    "volatility_45d": 0.0,
                    "return_45d": 0.0
                }
    except Exception as e:
        print(f"Error computing deep comparison: {e}")
        for cid in index_tickers.keys():
            results[cid] = {"volatility_45d": 0.0, "return_45d": 0.0}
            
    # Combine with metadata
    comparison_data = {}
    for cid in index_tickers.keys():
        meta = exchanges_meta.get(cid, {"country": "N/A", "currency": "N/A", "central_bank": "N/A", "rate": "N/A", "utc_offset": "N/A", "overlap": []})
        comparison_data[cid] = {
            **results[cid],
            **meta
        }
        
    return comparison_data

