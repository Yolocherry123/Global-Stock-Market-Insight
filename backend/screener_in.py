import os
import re
import threading
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.screener.in"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

CACHE = {}
CACHE_TTL_SECONDS = 86400

SESSION = None
LOGGED_IN = False
_REQUEST_LOCK = threading.Lock()
_LAST_REQUEST_AT = 0.0
MIN_REQUEST_INTERVAL = 1.2

TABLE_SECTIONS = [
    ("quarterly", "quarters", "quarters"),
    ("profitLoss", "profit-loss", "profit-loss"),
    ("balanceSheet", "balance-sheet", "balance-sheet"),
    ("cashFlow", "cash-flow", "cash-flow"),
    ("ratiosTable", "ratios", "ratios"),
    ("shareholding", "shareholding", "shareholding"),
]


def ticker_to_symbol(ticker):
    raw = (ticker or "").strip().upper()
    if not raw:
        return ""
    for suffix in (".NS", ".BO", ".NSE", ".BSE"):
        if raw.endswith(suffix):
            return raw[: -len(suffix)]
    return raw


def infer_exchange_id(ticker):
    raw = (ticker or "").strip().upper()
    if raw.endswith(".NS"):
        return "nse"
    if raw.endswith(".BO"):
        return "bse"
    return None


def _cache_get(key):
    entry = CACHE.get(key)
    if not entry:
        return None
    cached_at, data = entry
    if time.time() - cached_at > CACHE_TTL_SECONDS:
        CACHE.pop(key, None)
        return None
    return data


def _cache_set(key, data):
    CACHE[key] = (time.time(), data)


def _throttled_get(url, **kwargs):
    """Serialize Screener.in requests with spacing and 429 retries."""
    global _LAST_REQUEST_AT
    session = _get_session()
    last_error = None
    for attempt in range(6):
        with _REQUEST_LOCK:
            elapsed = time.time() - _LAST_REQUEST_AT
            if elapsed < MIN_REQUEST_INTERVAL:
                time.sleep(MIN_REQUEST_INTERVAL - elapsed)
            _LAST_REQUEST_AT = time.time()
            resp = session.get(url, **kwargs)

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After", "")
            try:
                wait = float(retry_after)
            except (TypeError, ValueError):
                wait = min(45, 3 * (2 ** attempt))
            last_error = (
                "Screener.in rate limit reached. Please wait a minute and try again."
            )
            time.sleep(wait)
            continue

        if resp.status_code in (500, 502, 503, 504):
            time.sleep(1.5 * (attempt + 1))
            continue

        return resp

    raise ValueError(last_error or "Screener.in is temporarily unavailable. Try again shortly.")


def _get_session():
    global SESSION, LOGGED_IN
    if SESSION is None:
        SESSION = requests.Session()
        SESSION.headers.update({"User-Agent": USER_AGENT})

    if not LOGGED_IN:
        email = os.environ.get("SCREENER_IN_EMAIL", "").strip()
        password = os.environ.get("SCREENER_IN_PASSWORD", "").strip()
        if email and password:
            try:
                login_page = SESSION.get(f"{BASE_URL}/login/", timeout=30)
                login_page.raise_for_status()
                soup = BeautifulSoup(login_page.text, "html.parser")
                csrf_input = soup.find("input", {"name": "csrfmiddlewaretoken"})
                csrf = csrf_input["value"] if csrf_input else ""
                SESSION.post(
                    f"{BASE_URL}/login/",
                    data={
                        "csrfmiddlewaretoken": csrf,
                        "username": email,
                        "password": password,
                        "next": "/",
                    },
                    headers={"Referer": f"{BASE_URL}/login/"},
                    timeout=30,
                )
                LOGGED_IN = True
            except Exception:
                pass
    return SESSION


def _fetch_page(symbol):
    url = f"{BASE_URL}/company/{symbol}/consolidated/"
    resp = _throttled_get(url, timeout=45)
    if resp.status_code == 404:
        raise ValueError(f"Company '{symbol}' not found on Screener.in")
    if resp.status_code == 429:
        raise ValueError(
            "Screener.in rate limit reached. Please wait a minute and try again."
        )
    resp.raise_for_status()
    return resp.text


def _extract_company_id(html):
    patterns = [
        r'data-company-id=["\'](\d+)["\']',
        r"company_id['\"]?\s*[:=]\s*['\"]?(\d+)",
        r"/api/company/(\d+)/",
    ]
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            return match.group(1)
    raise ValueError("Could not extract company ID from Screener page")


def _clean_label(text):
    label = (text or "").strip()
    label = re.sub(r"\s*\+\s*$", "", label)
    label = re.sub(r"\s*-\s*$", "", label)
    return label.strip()


def _parse_cell_value(raw):
    if raw is None:
        return None
    text = str(raw).strip()
    if not text or text in ("-", "—"):
        return None
    if text.endswith("%"):
        return text
    cleaned = text.replace(",", "").replace("₹", "").strip()
    if not cleaned:
        return None
    try:
        if "." in cleaned:
            return float(cleaned)
        return int(cleaned)
    except ValueError:
        return text


def _row_has_expand_button(first_cell):
    if not first_cell:
        return False
    return first_cell.find("button") is not None


def _get_expand_parent_label(first_cell):
    button = first_cell.find("button")
    if button:
        return _clean_label(button.get_text())
    return _clean_label(first_cell.get_text())


def _fetch_schedules(company_id, parent, section):
    url = f"{BASE_URL}/api/company/{company_id}/schedules/"
    params = {"parent": parent, "section": section, "consolidated": ""}
    try:
        resp = _throttled_get(url, params=params, timeout=30)
    except ValueError:
        raise
    except Exception:
        return []

    if resp.status_code != 200:
        return []

    try:
        data = resp.json()
    except Exception:
        return []

    children = []
    if not isinstance(data, dict):
        return children

    for child_label, period_values in data.items():
        if child_label in ("setAttributes", "isExpandable"):
            continue
        if not isinstance(period_values, dict):
            continue

        values = {}
        nested_parent = None
        nested_section = section
        for period, val in period_values.items():
            if period == "setAttributes":
                continue
            if period == "isExpandable":
                match = re.search(
                    r'showSchedule\("([^"]+)",\s*"([^"]+)"',
                    str(val),
                )
                if match:
                    nested_parent = match.group(1)
                    nested_section = match.group(2)
                continue
            values[period] = _parse_cell_value(val)

        child_row = {
            "label": child_label,
            "values": values,
            "expandable": nested_parent is not None,
            "children": [],
        }
        if nested_parent:
            child_row["children"] = _fetch_schedules(
                company_id, nested_parent, nested_section
            )
        children.append(child_row)
    return children


def _parse_table_rows(tbody, periods, company_id, section_param):
    rows = []
    if not tbody:
        return rows

    expandable_tasks = []

    for tr in tbody.find_all("tr", recursive=False):
        cells = tr.find_all("td")
        if not cells:
            continue

        first_cell = cells[0]
        label = _get_expand_parent_label(first_cell)
        if not label or label.lower() == "raw pdf":
            continue

        values = {}
        for idx, period in enumerate(periods):
            cell_idx = idx + 1
            if cell_idx < len(cells):
                values[period] = _parse_cell_value(cells[cell_idx].get_text())

        expandable = _row_has_expand_button(first_cell)
        row = {
            "label": label,
            "values": values,
            "expandable": expandable,
            "children": [],
        }
        rows.append(row)
        if expandable and company_id:
            expandable_tasks.append((len(rows) - 1, label))

    if expandable_tasks and company_id:
        for idx, parent in expandable_tasks:
            rows[idx]["children"] = _fetch_schedules(
                company_id, parent, section_param
            )

    return rows


def _rows_need_schedule_backfill(rows):
    for row in rows or []:
        if row.get("expandable") and not row.get("children"):
            return True
        if row.get("children") and _rows_need_schedule_backfill(row["children"]):
            return True
    return False


def _backfill_expandable_rows(rows, company_id, section_param):
    for row in rows or []:
        if row.get("expandable") and not row.get("children"):
            row["children"] = _fetch_schedules(
                company_id, row["label"], section_param
            )
        if row.get("children"):
            _backfill_expandable_rows(row["children"], company_id, section_param)


def _repair_expandable_sections(data, company_id):
    if not company_id:
        return
    for result_key, _, section_param in TABLE_SECTIONS:
        section = data.get(result_key)
        if section and section.get("rows"):
            _backfill_expandable_rows(section["rows"], company_id, section_param)


def _data_needs_schedule_repair(data):
    for result_key, _, _ in TABLE_SECTIONS:
        section = data.get(result_key)
        if section and _rows_need_schedule_backfill(section.get("rows")):
            return True
    return False


def _parse_table_section(soup, section_id, section_param, company_id):
    section = soup.find(id=section_id)
    if not section:
        return {"periods": [], "rows": []}

    table = section.find("table", class_=re.compile(r"data-table"))
    if not table:
        table = section.find("table")
    if not table:
        return {"periods": [], "rows": []}

    thead = table.find("thead")
    tbody = table.find("tbody")
    periods = []
    if thead:
        header_cells = thead.find_all("th")
        if header_cells:
            periods = [_clean_label(th.get_text()) for th in header_cells[1:]]
        else:
            header_row = thead.find("tr")
            if header_row:
                periods = [
                    _clean_label(th.get_text())
                    for th in header_row.find_all(["th", "td"])[1:]
                ]

    rows = _parse_table_rows(tbody, periods, company_id, section_param)
    return {"periods": periods, "rows": rows}


def _parse_top_ratios(soup):
    ratios = {}
    for li in soup.select("ul#top-ratios li, .company-ratios li, .ratios li"):
        name_el = li.find(class_=re.compile(r"name|label", re.I))
        value_el = li.find(class_=re.compile(r"value|number", re.I))
        if name_el and value_el:
            ratios[_clean_label(name_el.get_text())] = value_el.get_text().strip()
            continue
        spans = li.find_all("span")
        if len(spans) >= 2:
            ratios[_clean_label(spans[0].get_text())] = spans[1].get_text().strip()
    if ratios:
        return ratios

    for item in soup.select(".company-info .company-ratios .ratio, #top-ratios .ratio"):
        parts = [p.get_text().strip() for p in item.find_all(["span", "div"]) if p.get_text().strip()]
        if len(parts) >= 2:
            ratios[parts[0]] = parts[1]
    return ratios


def _parse_about(soup):
    about_section = soup.find(id="company-info") or soup.find(class_=re.compile(r"about"))
    if not about_section:
        about_p = soup.select_one(".about p, #company-info p")
        return about_p.get_text().strip() if about_p else ""
    paragraphs = about_section.find_all("p")
    if paragraphs:
        return " ".join(p.get_text().strip() for p in paragraphs[:2])
    return about_section.get_text().strip()[:500]


def _parse_company_name(soup):
    h1 = soup.find("h1")
    if h1:
        return _clean_label(h1.get_text())
    title = soup.find("title")
    if title:
        return title.get_text().split("|")[0].strip()
    return ""


def _parse_website(soup):
    for a in soup.select(".company-links a, .company-info a"):
        href = a.get("href", "")
        if href.startswith("http") and "screener.in" not in href:
            return href
    return ""


def _parse_price(soup):
    for sel in (".company-info .number", "#top-price .number", ".company-price .number"):
        el = soup.select_one(sel)
        if el:
            return _parse_cell_value(el.get_text().replace("₹", ""))
    return None


def _parse_pros_cons(soup):
    pros, cons = [], []
    pros_ul = soup.select_one(".pros ul, #analysis .pros ul, .company-profile .pros ul")
    cons_ul = soup.select_one(".cons ul, #analysis .cons ul, .company-profile .cons ul")
    if pros_ul:
        pros = [li.get_text().strip() for li in pros_ul.find_all("li") if li.get_text().strip()]
    if cons_ul:
        cons = [li.get_text().strip() for li in cons_ul.find_all("li") if li.get_text().strip()]
    return pros, cons


def _parse_growth_cards(soup):
    growth = {"sales": {}, "profit": {}, "price": {}, "roe": {}}
    mapping = {
        "compounded sales growth": "sales",
        "compounded profit growth": "profit",
        "stock price cagr": "price",
        "return on equity": "roe",
    }
    for card in soup.select(".company-info ~ div table, .growth-table, section table"):
        caption = ""
        caption_el = card.find_previous(["h3", "h4", "strong"])
        if caption_el:
            caption = caption_el.get_text().strip().lower()
        rows = card.find_all("tr")
        if len(rows) < 2:
            continue
        header_text = card.get_text().lower()
        key = None
        for phrase, gkey in mapping.items():
            if phrase in header_text or phrase in caption:
                key = gkey
                break
        if not key:
            continue
        for tr in rows:
            cells = tr.find_all(["td", "th"])
            if len(cells) >= 2:
                label = _clean_label(cells[0].get_text())
                value = cells[1].get_text().strip()
                if label and value:
                    growth[key][label] = value

    for heading in soup.find_all(["h3", "h4", "strong", "th"]):
        text = heading.get_text().strip().lower()
        for phrase, gkey in mapping.items():
            if phrase in text:
                table = heading.find_parent("table")
                if not table:
                    table = heading.find_next("table")
                if table:
                    for tr in table.find_all("tr"):
                        cells = tr.find_all(["td", "th"])
                        if len(cells) >= 2:
                            label = _clean_label(cells[0].get_text())
                            value = cells[1].get_text().strip()
                            if label and value and label.lower() not in phrase:
                                growth[gkey][label] = value
    return growth


def _parse_peers(soup):
    peers = []
    peer_section = soup.find(id="peers")
    if not peer_section:
        return peers
    table = peer_section.find("table")
    if not table:
        return peers
    thead = table.find("thead")
    headers = []
    if thead:
        headers = [_clean_label(th.get_text()) for th in thead.find_all("th")]

    for tr in table.find("tbody").find_all("tr") if table.find("tbody") else []:
        cells = tr.find_all("td")
        if not cells:
            continue
        name_el = cells[1].find("a") if len(cells) > 1 else None
        name = name_el.get_text().strip() if name_el else cells[1].get_text().strip() if len(cells) > 1 else ""
        if not name or name.lower() == "median":
            continue
        peer = {"name": name}
        if name_el:
            href = name_el.get("href", "")
            peer["url"] = href if href.startswith("http") else f"{BASE_URL}{href}"
            match = re.search(r"/company/([^/]+)/", href)
            if match:
                peer["symbol"] = match.group(1).upper()
        for idx, header in enumerate(headers[2:], start=2):
            if idx < len(cells):
                peer[header] = cells[idx].get_text().strip()
        peers.append(peer)
    return peers


def fetch_company(ticker):
    symbol = ticker_to_symbol(ticker)
    if not symbol:
        raise ValueError("Invalid ticker symbol")

    cache_key = f"screener_in:{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        company_id = cached.get("company_id")
        if not company_id:
            try:
                html = _fetch_page(symbol)
                company_id = _extract_company_id(html)
                cached["company_id"] = company_id
            except Exception:
                return cached
        if _data_needs_schedule_repair(cached):
            _repair_expandable_sections(cached, company_id)
            _cache_set(cache_key, cached)
        return cached

    html = _fetch_page(symbol)
    soup = BeautifulSoup(html, "html.parser")
    company_id = _extract_company_id(html)

    result = {
        "symbol": symbol,
        "company_id": company_id,
        "name": _parse_company_name(soup),
        "about": _parse_about(soup),
        "website": _parse_website(soup),
        "price": _parse_price(soup),
        "ratios": _parse_top_ratios(soup),
        "growth": _parse_growth_cards(soup),
        "pros": [],
        "cons": [],
        "peers": _parse_peers(soup),
    }

    pros, cons = _parse_pros_cons(soup)
    result["pros"] = pros
    result["cons"] = cons

    for result_key, section_id, section_param in TABLE_SECTIONS:
        result[result_key] = _parse_table_section(
            soup, section_id, section_param, company_id
        )

    _repair_expandable_sections(result, company_id)
    _cache_set(cache_key, result)
    return result
