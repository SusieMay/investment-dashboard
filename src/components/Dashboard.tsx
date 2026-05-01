import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Asset, PortfolioHistory } from '../types'
import { ChartPoint } from './PortfolioLineChart'
import Summary from './Summary'
import PortfolioLineChart from './PortfolioLineChart'
import PortfolioPieChart from './PortfolioPieChart'
import AssetTable from './AssetTable'
import AddAssetForm from './AddAssetForm'
import Dividends from './Dividends'
import RealizedProfit from './RealizedProfit'

interface DashboardProps {
  onLogout: () => void
}

type Tab = 'portfolio' | 'dividends' | 'realized'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'portfolio', label: 'Portfel', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'dividends', label: 'Dywidendy', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'realized', label: 'Zrealizowany zysk', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
]

type FilterType = 'all' | 'stocks' | 'etfs'
type ChartView = 'value' | 'pnl'

function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')
  const [assets, setAssets] = useState<Asset[]>([])
  const [history, setHistory] = useState<PortfolioHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(4.0)
  const [eurRate, setEurRate] = useState<number>(4.3)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [chartView, setChartView] = useState<ChartView>('value')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [assetsResult, historyResult, rateResult] = await Promise.allSettled([
        supabase.from('assets').select('*').order('created_at', { ascending: true }),
        supabase
          .from('portfolio_history')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(60),
        fetch('https://open.er-api.com/v6/latest/USD').then((r) => r.json()),
      ])

      if (assetsResult.status === 'fulfilled') {
        if (assetsResult.value.error) throw assetsResult.value.error
        setAssets(assetsResult.value.data ?? [])
      } else {
        throw new Error('Błąd pobierania aktywów')
      }

      if (historyResult.status === 'fulfilled' && !historyResult.value.error) {
        setHistory(historyResult.value.data ?? [])
      }

      if (rateResult.status === 'fulfilled') {
        const rateData = rateResult.value as { rates?: { PLN?: number; EUR?: number } }
        const usdPln = rateData?.rates?.PLN
        const eurUsd = rateData?.rates?.EUR
        if (typeof usdPln === 'number' && usdPln > 0) {
          setExchangeRate(usdPln)
          if (typeof eurUsd === 'number' && eurUsd > 0) {
            setEurRate((1 / eurUsd) * usdPln)
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError('Błąd podczas ładowania danych. Sprawdź połączenie z bazą danych.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshingPrices(true)
    setError(null)
    try {
      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-prices')
      if (refreshError) throw refreshError
      const rate = (refreshData as { usdPln?: number } | null)?.usdPln
      if (typeof rate === 'number' && rate > 0) setExchangeRate(rate)
      await fetchData()
    } catch (err) {
      console.error(err)
      setError('Nie udało się odświeżyć cen rynkowych. Sprawdź konfigurację funkcji Supabase.')
    } finally {
      setRefreshingPrices(false)
    }
  }

  const toPLN = (value: number, currency: string) => {
    if (currency === 'PLN') return value
    if (currency === 'EUR') return value * eurRate
    return value * exchangeRate
  }

  const totalValue = assets.reduce(
    (sum, asset) =>
      sum + toPLN((asset.current_price ?? asset.average_price) * asset.quantity, asset.currency ?? 'USD'),
    0
  )
  const totalCost = assets.reduce(
    (sum, asset) => sum + toPLN(asset.average_price * asset.quantity, asset.currency ?? 'USD'),
    0
  )
  const totalPnL = totalValue - totalCost
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  // Filtrowanie aktywów: all / stocks / etfs
  const filteredAssets = filterType === 'all'
    ? assets
    : assets.filter(a => (a.asset_type ?? 'stock') === (filterType === 'stocks' ? 'stock' : 'etf'))

  // Dane do wykresu liniowego zależne od filtra i widoku
  const lineChartData: ChartPoint[] = history.map(h => {
    let value: number
    if (filterType === 'all') {
      value = chartView === 'value' ? h.total_value : (h.total_pnl ?? 0)
    } else if (filterType === 'stocks') {
      value = chartView === 'value' ? (h.value_stocks ?? 0) : (h.pnl_stocks ?? 0)
    } else {
      value = chartView === 'value' ? (h.value_etfs ?? 0) : (h.pnl_etfs ?? 0)
    }
    return { date: h.created_at, value }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur border-b border-gray-700/50 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Dashboard Inwestycyjny</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                USD/PLN: <span className="text-gray-400 font-mono">{exchangeRate.toFixed(4)}</span>
                {' · '}
                EUR/PLN: <span className="text-gray-400 font-mono">{eurRate.toFixed(4)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading || refreshingPrices}
              className="text-gray-400 hover:text-white disabled:opacity-40 transition-colors p-2 rounded-lg hover:bg-gray-700"
              aria-label="Odśwież ceny"
            >
              <svg
                className={`w-4 h-4 ${loading || refreshingPrices ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Wyloguj
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-400 text-sm">Ładowanie danych portfela...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 bg-red-900/20 border border-red-800/50 rounded-2xl p-4 mb-6">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-300 font-medium text-sm">Błąd ładowania danych</p>
              <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                <Summary
                  totalValue={totalValue}
                  totalCost={totalCost}
                  totalPnL={totalPnL}
                  totalPnLPercent={totalPnLPercent}
                  assetCount={assets.length}
                />

                {/* Filtr: Wszystkie / Akcje / ETFy */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Widok:</span>
                  <div className="flex gap-1 bg-gray-800 rounded-xl p-1 border border-gray-700">
                    {([
                      { id: 'all', label: 'Wszystkie' },
                      { id: 'stocks', label: 'Akcje' },
                      { id: 'etfs', label: 'ETFy' },
                    ] as { id: FilterType; label: string }[]).map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          filterType === f.id
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-white mb-1">
                          Historia {chartView === 'value' ? 'wartości' : 'zysku / straty'} portfela
                        </h2>
                        <p className="text-xs text-gray-500">
                          {filterType === 'all' ? 'Cały portfel' : filterType === 'stocks' ? 'Akcje' : 'ETFy'} · ostatnie 60 rekordów (PLN)
                        </p>
                      </div>
                      {/* Przełącznik Wartość / Zysk·Strata */}
                      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
                        {([
                          { id: 'value', label: 'Wartość' },
                          { id: 'pnl', label: 'Zysk / Strata' },
                        ] as { id: ChartView; label: string }[]).map(v => (
                          <button
                            key={v.id}
                            onClick={() => setChartView(v.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              chartView === v.id
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PortfolioLineChart data={lineChartData} chartType={chartView} />
                  </div>
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                    <h2 className="text-base font-semibold text-white mb-1">Skład portfela</h2>
                    <p className="text-xs text-gray-500 mb-4">
                      {filterType === 'all' ? 'Wszystkie aktywa' : filterType === 'stocks' ? 'Akcje' : 'ETFy'} wg wartości (PLN)
                    </p>
                    <PortfolioPieChart assets={filteredAssets} exchangeRate={exchangeRate} eurRate={eurRate} />
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">Portfel aktywów</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{filteredAssets.length} pozycji</p>
                      </div>
                    </div>
                    <AssetTable assets={filteredAssets} onDelete={fetchData} />
                  </div>
                  <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
                    <h2 className="text-base font-semibold text-white mb-1">Dodaj aktywo</h2>
                    <p className="text-xs text-gray-500 mb-5">Uzupełnij dane nowej pozycji</p>
                    <AddAssetForm onAdd={fetchData} />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Dywidendy ── */}
            {activeTab === 'dividends' && <Dividends />}

            {/* ── TAB: Zrealizowany zysk ── */}
            {activeTab === 'realized' && <RealizedProfit exchangeRate={exchangeRate} eurRate={eurRate} />}
          </>
        )}
      </main>
    </div>
  )
}

export default Dashboard
