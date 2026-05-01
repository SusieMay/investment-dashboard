import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { RealizedTrade } from '../types'

const formatPLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)

const formatNative = (v: number, currency: string) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(v)

const daysBetween = (from: string, to: string): number => {
  if (!from || !to) return 0
  const diff = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

function RealizedProfit({ exchangeRate, eurRate }: { exchangeRate: number; eurRate: number }) {
  const [trades, setTrades] = useState<RealizedTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // form
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)

  const currency = ticker.toUpperCase().endsWith('.WA') ? 'PLN' : ticker.toUpperCase().endsWith('.DE') ? 'EUR' : 'USD'
  const daysHeld = daysBetween(buyDate, sellDate)

  // Przeliczenie zysku na PLN
  const calcProfitPln = (qty: number, bp: number, sp: number, cur: string) => {
    const profitNative = (sp - bp) * qty
    if (cur === 'PLN') return profitNative
    if (cur === 'EUR') return profitNative * eurRate
    return profitNative * exchangeRate
  }

  const previewProfit =
    quantity && buyPrice && sellPrice
      ? calcProfitPln(parseFloat(quantity), parseFloat(buyPrice), parseFloat(sellPrice), currency)
      : null

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('realized_trades')
      .select('*')
      .order('sell_date', { ascending: false })
    setTrades(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const totalProfit = trades.reduce((s, t) => s + t.profit_pln, 0)
  const wins = trades.filter(t => t.profit_pln > 0).length
  const losses = trades.filter(t => t.profit_pln <= 0).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    const qty = parseFloat(quantity)
    const bp = parseFloat(buyPrice)
    const sp = parseFloat(sellPrice)
    const cur = t.endsWith('.WA') ? 'PLN' : t.endsWith('.DE') ? 'EUR' : 'USD'

    if (!t) { setFormError('Podaj ticker.'); return }
    if (isNaN(qty) || qty <= 0) { setFormError('Ilość musi być dodatnia.'); return }
    if (isNaN(bp) || bp <= 0) { setFormError('Cena kupna musi być dodatnia.'); return }
    if (isNaN(sp) || sp <= 0) { setFormError('Cena sprzedaży musi być dodatnia.'); return }
    if (!buyDate) { setFormError('Podaj datę kupna.'); return }
    if (!sellDate) { setFormError('Podaj datę sprzedaży.'); return }
    if (new Date(sellDate) < new Date(buyDate)) { setFormError('Data sprzedaży nie może być wcześniejsza niż kupna.'); return }

    setFormLoading(true)
    setFormError(null)

    const profitPln = calcProfitPln(qty, bp, sp, cur)

    const { error } = await supabase.from('realized_trades').insert([{
      ticker: t,
      quantity: qty,
      buy_price: bp,
      sell_price: sp,
      currency: cur,
      buy_date: buyDate,
      sell_date: sellDate,
      profit_pln: profitPln,
    }])

    setFormLoading(false)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }

    setTicker(''); setQuantity(''); setBuyPrice(''); setSellPrice(''); setBuyDate(''); setSellDate('')
    setFormSuccess(true)
    setTimeout(() => setFormSuccess(false), 3000)
    fetchTrades()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('realized_trades').delete().eq('id', id)
    setDeletingId(null)
    fetchTrades()
  }

  return (
    <div className="space-y-6">
      {/* Karty podsumowania */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Łączny zysk (PLN)</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? '+' : ''}{formatPLN(totalProfit)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Transakcji</p>
          <p className="text-2xl font-bold text-white">{trades.length}</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Zyskownych</p>
          <p className="text-2xl font-bold text-green-400">{wins}</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Stratnych</p>
          <p className="text-2xl font-bold text-red-400">{losses}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Formularz */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <h2 className="text-base font-semibold text-white mb-1">Dodaj transakcję</h2>
          <p className="text-xs text-gray-500 mb-5">Zamknięta pozycja</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-400">Ticker</label>
                {ticker && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-md border ${
                    currency === 'PLN'
                      ? 'bg-red-900/30 text-red-300 border-red-800/40'
                      : currency === 'EUR'
                      ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40'
                      : 'bg-blue-900/30 text-blue-300 border-blue-800/40'
                  }`}>
                    {currency === 'PLN' ? 'PLN · GPW' : currency === 'EUR' ? 'EUR · Xetra' : 'USD · NYSE/NASDAQ'}
                  </span>
                )}
              </div>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="np. XTB.WA, NVO"
                maxLength={20}
                className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Ilość</label>
              <input
                type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="np. 10" min="0" step="any"
                className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Kupno ({currency})</label>
                <input
                  type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Sprzedaż ({currency})</label>
                <input
                  type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Data kupna</label>
                <input
                  type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Data sprzedaży</label>
                <input
                  type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Podgląd na żywo */}
            {(daysHeld > 0 || previewProfit != null) && (
              <div className="bg-gray-700/50 rounded-xl px-4 py-3 space-y-1 text-sm">
                {daysHeld > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Dni trzymania:</span>
                    <span className="text-white font-mono font-semibold">{daysHeld} dni</span>
                  </div>
                )}
                {previewProfit != null && (
                  <div className="flex justify-between text-gray-400">
                    <span>Szacowany zysk:</span>
                    <span className={`font-mono font-semibold ${previewProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {previewProfit >= 0 ? '+' : ''}{formatPLN(previewProfit)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {formError && (
              <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-3 py-2.5">
                <p className="text-red-300 text-sm">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="bg-green-900/30 border border-green-800/50 rounded-xl px-3 py-2.5">
                <p className="text-green-300 text-sm">Transakcja zapisana!</p>
              </div>
            )}
            <button
              type="submit" disabled={formLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {formLoading ? 'Zapisywanie...' : '+ Dodaj transakcję'}
            </button>
          </form>
        </div>

        {/* Tabela */}
        <div className="xl:col-span-2 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <h2 className="text-base font-semibold text-white mb-4">Historia transakcji</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <p className="text-sm">Brak zamkniętych transakcji</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-3 px-2 font-medium">Ticker</th>
                    <th className="pb-3 px-2 font-medium text-right">Ilość</th>
                    <th className="pb-3 px-2 font-medium text-right">Kupno</th>
                    <th className="pb-3 px-2 font-medium text-right">Sprzedaż</th>
                    <th className="pb-3 px-2 font-medium text-right">Dni</th>
                    <th className="pb-3 px-2 font-medium text-right">Zysk (PLN)</th>
                    <th className="pb-3 px-2 font-medium text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => {
                    const isPos = t.profit_pln >= 0
                    return (
                      <tr key={t.id} className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors">
                        <td className="py-3 px-2">
                          <span className="font-bold text-white bg-indigo-600/20 border border-indigo-600/30 rounded-md px-2 py-0.5 text-xs font-mono">{t.ticker}</span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300 font-mono">{t.quantity}</td>
                        <td className="py-3 px-2 text-right font-mono text-gray-300">
                          <div>{formatNative(t.buy_price, t.currency)}</div>
                          <div className="text-xs text-gray-500">{t.buy_date}</div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-300">
                          <div>{formatNative(t.sell_price, t.currency)}</div>
                          <div className="text-xs text-gray-500">{t.sell_date}</div>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400 font-mono">{t.days_held}d</td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-mono font-semibold ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                            {isPos ? '+' : ''}{formatPLN(t.profit_pln)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors p-1 rounded"
                          >
                            {deletingId === t.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RealizedProfit
