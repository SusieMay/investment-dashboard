export interface Asset {
  id: string
  user_id: string
  ticker: string
  quantity: number
  average_price: number
  current_price: number | null
  currency: string
  asset_type: string  // 'stock' | 'etf'
  created_at: string
}

export interface PortfolioHistory {
  id: string
  created_at: string
  total_value: number
  total_pnl: number
  value_stocks: number
  value_etfs: number
  pnl_stocks: number
  pnl_etfs: number
}

export interface NewAsset {
  ticker: string
  quantity: number
  average_price: number
}

export interface Dividend {
  id: string
  ticker: string
  amount_pln: number
  year: number
  created_at: string
}

export interface RealizedTrade {
  id: string
  ticker: string
  quantity: number
  buy_price: number
  sell_price: number
  currency: string
  buy_date: string
  sell_date: string
  days_held: number
  profit_pln: number
  created_at: string
}
