"""
update_portfolio.py
-------------------
Pobiera aktualne ceny rynkowe z Alpha Vantage dla wszystkich tickerów
zapisanych w tabeli `assets`, aktualizuje pole `current_price`,
a następnie zapisuje łączną wartość portfela w tabeli `portfolio_history`.

Wymagane zmienne środowiskowe (ustawiane jako GitHub Secrets):
  SUPABASE_URL            – URL projektu Supabase
  SUPABASE_SERVICE_KEY    – klucz service_role (nie anon!) z Supabase
  ALPHAVANTAGE_API_KEY    – klucz API z alphavantage.co
"""

import os
import sys
import time
from datetime import datetime, timezone

import requests
from supabase import create_client, Client


# ---------------------------------------------------------------------------
# Konfiguracja
# ---------------------------------------------------------------------------
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "https://swrpjlcnkrkzbwrmezwf.supabase.co")
SUPABASE_SERVICE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_KEY")

# *** Klucze Alpha Vantage (ustaw jako GitHub Secrets) ***
# Jeden klucz = 25 req/dzień. Dwa klucze = 50 req/dzień.
_key1: str = os.environ.get("ALPHAVANTAGE_API_KEY", "")
_key2: str = os.environ.get("ALPHAVANTAGE_API_KEY_2", "")
ALPHAVANTAGE_API_KEYS: list[str] = [k for k in [_key1, _key2] if k]
if not ALPHAVANTAGE_API_KEYS:
    ALPHAVANTAGE_API_KEYS = ["WKLEJ_KLUCZ_TUTAJ"]

ALPHAVANTAGE_URL = "https://www.alphavantage.co/query"
REQUEST_TIMEOUT = 20  # sekund
REQUEST_DELAY = 12.5  # sekund przerwy między żądaniami (free tier: 5 req/min)

HEADERS = {
    "User-Agent": "investment-dashboard/1.0",
    "Accept": "application/json",
}


# ---------------------------------------------------------------------------
# Pomocnicze funkcje
# ---------------------------------------------------------------------------

def detect_currency(ticker: str) -> str:
    """Zwraca walutę na podstawie tickera.
    .WA = GPW (PLN), .DE = Xetra (EUR), reszta = USD.
    """
    t = ticker.upper()
    if t.endswith(".WA"):
        return "PLN"
    if t.endswith(".DE"):
        return "EUR"
    return "USD"


def detect_asset_type(ticker: str) -> str:
    """Zwraca typ aktywa: 'etf' dla .DE (Xetra), 'stock' dla pozostałych."""
    return "etf" if ticker.upper().endswith(".DE") else "stock"


def fetch_rates() -> tuple[float, float]:
    """Pobiera kursy USD/PLN i EUR/PLN. Zwraca (usdpln, eurpln)."""
    try:
        resp = requests.get("https://open.er-api.com/v6/latest/USD", timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()["rates"]
        usd_pln = float(data["PLN"])
        eur_usd = float(data["EUR"])  # EUR wyrażone w USD (np. 0.92)
        eur_pln = (1.0 / eur_usd) * usd_pln
        return usd_pln, eur_pln
    except (requests.RequestException, KeyError, ValueError) as exc:
        print(f"  [OSTRZEŻENIE] Nie można pobrać kursów walut: {exc}")
        return 4.0, 4.3  # wartości awaryjne


def get_supabase_client() -> Client:
    if not SUPABASE_SERVICE_KEY:
        print("BŁĄD: Zmienna środowiskowa SUPABASE_SERVICE_KEY nie jest ustawiona.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


_fetch_counter = 0


def fetch_price(ticker: str) -> float | None:
    """
    Pobiera aktualną cenę rynkową z Alpha Vantage (GLOBAL_QUOTE).
    Rotuje klucze API jeśli skonfigurowano więcej niż jeden.
    Zwraca None, jeśli wystąpił błąd lub ticker jest nieznany.
    """
    global _fetch_counter
    api_key = ALPHAVANTAGE_API_KEYS[_fetch_counter % len(ALPHAVANTAGE_API_KEYS)]
    _fetch_counter += 1
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": ticker,
        "apikey": api_key,
    }
    try:
        resp = requests.get(ALPHAVANTAGE_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        # Wykryj limit API
        if "Note" in data:
            print(f"  [LIMIT API] Alpha Vantage: {data['Note']}")
            return None
        if "Information" in data:
            print(f"  [INFO API] Alpha Vantage: {data['Information']}")
            return None

        price_str = data.get("Global Quote", {}).get("05. price")
        if not price_str:
            print(f"  [OSTRZEŻENIE] Brak ceny dla {ticker} (brak w odpowiedzi)")
            return None

        return float(price_str)
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        print(f"  [OSTRZEŻENIE] Nie można pobrać ceny dla {ticker}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Główna logika
# ---------------------------------------------------------------------------

def main() -> None:
    supabase = get_supabase_client()

    # 1. Pobierz wszystkie aktywa
    result = supabase.table("assets").select("*").execute()
    assets: list[dict] = result.data or []

    if not assets:
        print("Brak aktywów w bazie. Zakończono.")
        return

    print(f"Znaleziono {len(assets)} aktywów.")

    # 2. Pobierz unikalne tickery
    tickers = list({asset["ticker"] for asset in assets})
    print(f"Pobieranie cen dla: {', '.join(tickers)}\n")

    usdpln, eurpln = fetch_rates()
    print(f"Kurs USD/PLN: {usdpln:.4f}  EUR/PLN: {eurpln:.4f}\n")

    prices: dict[str, float] = {}
    for ticker in tickers:
        price = fetch_price(ticker)
        if price is not None:
            prices[ticker] = price
            print(f"  {ticker:12s}  ${price:>12.4f}")
        time.sleep(REQUEST_DELAY)

    if not prices:
        print("\nNie udało się pobrać żadnej ceny. Przerywam.")
        sys.exit(1)

    # 3. Zaktualizuj current_price i asset_type w tabeli assets
    print("\nAktualizowanie cen w bazie danych...")
    for asset in assets:
        ticker = asset["ticker"]
        if ticker in prices:
            supabase.table("assets").update({
                "current_price": prices[ticker],
                "currency": detect_currency(ticker),
                "asset_type": detect_asset_type(ticker),
            }).eq("id", asset["id"]).execute()

    # 4. Oblicz wartości i zyski/straty w PLN z podziałem na akcje/ETFy
    total_value_pln: float = 0.0
    total_pnl: float = 0.0
    value_stocks: float = 0.0
    value_etfs: float = 0.0
    pnl_stocks: float = 0.0
    pnl_etfs: float = 0.0

    for asset in assets:
        ticker = asset["ticker"]
        current_price = (
            prices.get(ticker)
            or (float(asset["current_price"]) if asset.get("current_price") else None)
            or float(asset.get("average_price", 0))
        )
        avg_price = float(asset.get("average_price", 0))
        qty = float(asset["quantity"])
        cur = detect_currency(ticker)
        atype = detect_asset_type(ticker)

        value_native = current_price * qty
        cost_native = avg_price * qty
        pnl_native = value_native - cost_native

        if cur == "PLN":
            value_pln = value_native
            pnl_pln = pnl_native
        elif cur == "EUR":
            value_pln = value_native * eurpln
            pnl_pln = pnl_native * eurpln
        else:
            value_pln = value_native * usdpln
            pnl_pln = pnl_native * usdpln

        total_value_pln += value_pln
        total_pnl += pnl_pln

        if atype == "etf":
            value_etfs += value_pln
            pnl_etfs += pnl_pln
        else:
            value_stocks += value_pln
            pnl_stocks += pnl_pln

        print(f"  {ticker:12s}  [{atype:5s}]  {value_native:>12.4f} {cur}  →  {value_pln:>12.2f} PLN  (P&L: {pnl_pln:+.2f} PLN)")

    # 5. Zapisz do portfolio_history
    supabase.table("portfolio_history").insert({
        "total_value":  round(total_value_pln, 4),
        "total_pnl":    round(total_pnl, 4),
        "value_stocks": round(value_stocks, 4),
        "value_etfs":   round(value_etfs, 4),
        "pnl_stocks":   round(pnl_stocks, 4),
        "pnl_etfs":     round(pnl_etfs, 4),
        "created_at":   datetime.now(timezone.utc).isoformat(),
    }).execute()

    print(f"\nŁączna wartość portfela: {total_value_pln:,.2f} PLN  (P&L: {total_pnl:+,.2f} PLN)")
    print(f"  Akcje: {value_stocks:,.2f} PLN  (P&L: {pnl_stocks:+,.2f} PLN)")
    print(f"  ETFy:  {value_etfs:,.2f} PLN  (P&L: {pnl_etfs:+,.2f} PLN)")
    print("Historia portfela zaktualizowana pomyślnie.")


if __name__ == "__main__":
    main()
