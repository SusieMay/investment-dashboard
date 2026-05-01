import React, { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { Dividend } from '../types'

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#F97316']

const formatPLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v)

const currentYear = new Date().getFullYear()

function Dividends() {
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // form
  const [ticker, setTicker] = useState('')
  const [amountPln, setAmountPln] = useState('')
  const [year, setYear] = useState(String(currentYear))
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)

  const fetchDividends = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('dividends')
      .select('*')
      .order('year', { ascending: false })
      .order('created_at', { ascending: false })
    setDividends(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDividends() }, [fetchDividends])

  // Aggregacja dywidend wg roku dla wykresu
  const chartData = Object.values(
    dividends.reduce<Record<number, { year: number; total: number }>>((acc, d) => {
      if (!acc[d.year]) acc[d.year] = { year: d.year, total: 0 }
      acc[d.year].total += d.amount_pln
      return acc
    }, {})
  ).sort((a, b) => a.year - b.year)

  const totalDividends = dividends.reduce((s, d) => s + d.amount_pln, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    const amount = parseFloat(amountPln)
    const y = parseInt(year, 10)

    if (!t) { setFormError('Podaj ticker spółki.'); return }
    if (isNaN(amount) || amount <= 0) { setFormError('Kwota musi być liczbą dodatnią.'); return }
    if (isNaN(y) || y < 1900 || y > 2100) { setFormError('Podaj prawidłowy rok.'); return }

    setFormLoading(true)
    setFormError(null)
    const { error } = await supabase.from('dividends').insert([{ ticker: t, amount_pln: amount, year: y }])
    setFormLoading(false)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    setTicker(''); setAmountPln(''); setYear(String(currentYear))
    setFormSuccess(true)
    setTimeout(() => setFormSuccess(false), 3000)
    fetchDividends()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('dividends').delete().eq('id', id)
    setDeletingId(null)
    fetchDividends()
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Łączne dywidendy</p>
          <p className="text-2xl font-bold text-green-400">{formatPLN(totalDividends)}</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Liczba wypłat</p>
          <p className="text-2xl font-bold text-white">{dividends.length}</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Rok bieżący</p>
          <p className="text-2xl font-bold text-white">
            {formatPLN(dividends.filter(d => d.year === currentYear).reduce((s, d) => s + d.amount_pln, 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Wykres */}
        <div className="xl:col-span-2 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <h2 className="text-base font-semibold text-white mb-1">Dywidendy wg roku</h2>
          <p className="text-xs text-gray-500 mb-4">Łączna kwota w PLN</p>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm">Brak danych – dodaj pierwszą dywidendę</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="year" stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} />
                <YAxis
                  stroke="#4B5563"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#F9FAFB', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}
                  formatter={(v: number) => [formatPLN(v), 'Dywidendy']}
                  labelStyle={{ color: '#9CA3AF', marginBottom: 4 }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((_e, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Formularz dodawania */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
          <h2 className="text-base font-semibold text-white mb-1">Dodaj dywidendę</h2>
          <p className="text-xs text-gray-500 mb-5">Wpisz otrzymaną wypłatę</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Ticker</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="np. XTB.WA, NVO"
                maxLength={20}
                className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Kwota (PLN)</label>
              <input
                type="number"
                value={amountPln}
                onChange={e => setAmountPln(e.target.value)}
                placeholder="np. 250.00"
                min="0"
                step="any"
                className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Rok</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                min="1900"
                max="2100"
                className="w-full bg-gray-700 text-white placeholder-gray-500 border border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            {formError && (
              <div className="flex items-start gap-2 bg-red-900/30 border border-red-800/50 rounded-xl px-3 py-2.5">
                <p className="text-red-300 text-sm">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-800/50 rounded-xl px-3 py-2.5">
                <p className="text-green-300 text-sm">Dywidenda dodana!</p>
              </div>
            )}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {formLoading ? 'Zapisywanie...' : '+ Dodaj dywidendę'}
            </button>
          </form>
        </div>
      </div>

      {/* Tabela dywidend */}
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
        <h2 className="text-base font-semibold text-white mb-4">Historia dywidend</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : dividends.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Brak wpisów</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-3 px-2 font-medium">Ticker</th>
                  <th className="pb-3 px-2 font-medium text-right">Rok</th>
                  <th className="pb-3 px-2 font-medium text-right">Kwota (PLN)</th>
                  <th className="pb-3 px-2 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map(d => (
                  <tr key={d.id} className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors">
                    <td className="py-3 px-2">
                      <span className="font-bold text-white bg-green-600/20 border border-green-600/30 rounded-md px-2 py-0.5 text-xs font-mono">
                        {d.ticker}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">{d.year}</td>
                    <td className="py-3 px-2 text-right font-mono text-green-400 font-medium">{formatPLN(d.amount_pln)}</td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={deletingId === d.id}
                        className="text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors p-1 rounded"
                      >
                        {deletingId === d.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dividends
