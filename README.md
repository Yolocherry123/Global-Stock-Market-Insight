# Global Stock Market Insights Dashboard

A powerful, real-time web application to track and analyze global stock markets. This platform provides insights into index performance, top movers, market correlations, macroeconomic data, and comprehensive reports across major global exchanges.

## Features

- **Global Market Overview**: Live-tracking of key global exchanges including NASDAQ, NYSE, London Stock Exchange (LSE), Tokyo Exchange (JPX), Bombay Stock Exchange (BSE), and more.
- **Intraday & Historical Candlestick Charts**: Custom SVG-based interactive charts with precise coordinate mapping and technical indicators.
- **RSI Gauge Meter**: Built-in Relative Strength Index (RSI) analysis to identify Overbought and Oversold market conditions.
- **Index Correlations**: Advanced correlation matrices showcasing how different global indices move in relation to one another.
- **Macroeconomic Metrics**: Real-time tracking of interest rates, inflation, and GDP growth across major world economies.
- **Backtesting & Research comparison tools**: Build and backtest trading strategies directly inside the dashboard.
- **Live News & Reports**: Aggregated market reports and news parsed dynamically into markdown-friendly card views.

---

## Tech Stack

### Frontend
- **React 19**
- **Vite** (Next-generation frontend tooling)
- **Lucide React** (Beautiful modern icons)
- **CSS3** (Custom responsive grid layout & dark-themed UI)

### Backend
- **FastAPI** (High-performance Python web framework)
- **Uvicorn** (Lightning-fast ASGI server)
- **yfinance** (Yahoo Finance API for real-time market data)
- **Pandas & NumPy** (High-performance data analysis and correlation calculation)

---

## Getting Started

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.10+](https://www.python.org/)

### Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd "SMB Anti"
   ```

2. **Frontend Setup:**
   Navigate to the root directory and install dependencies:
   ```bash
   npm install
   ```

3. **Backend Setup:**
   Install required Python packages:
   ```bash
   pip install fastapi uvicorn yfinance pandas numpy requests pytz
   ```

### Running the Application

1. **Start the FastAPI Backend:**
   ```bash
   cd backend
   python server.py
   ```
   The backend will start running at `http://127.0.0.1:8000`.

2. **Start the React Frontend:**
   In another terminal, run from the root directory:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the provided local address (usually `http://localhost:5173/`).

---

## License
This project is licensed under the MIT License.
