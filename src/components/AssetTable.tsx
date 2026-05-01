import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Asset } from '../types'

interface Props {
  assets: Asset[]
  onDelete: () => void
}

const formatNative = (value: number | null, currency = 'USD') =>
  value != null
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value)
    : '—'

function AssetTable({ assets, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDeleteRequest = (id: string) => {
    setConfirmId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmId) return
    setDeletingId(confirmId)
    setConfirmId(null)
    try {
      const { error } = await supabase.from('assets').delete().eq('id', confirmId)
      if (error) throw error
      onDelete()
    } catch (err) {
      console.error('Błąd usuwania:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm">Brak aktywów w portfelu</p>
        <p className="text-xs text-gray-600">Dodaj pierwsze aktywo za pomocą formularza</p>
      </div>
    )
  }

  return (
    <>
      {confirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Usunąć aktywo?</h3>
            <p className="text-gray-400 text-sm mb-6">Ta operacja jest nieodwracalna.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition-colors text-sm font-medium"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-colors text-sm font-medium"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-700">
              <th className="pb-3 px-2 font-medium">Ticker</th>
              <th className="pb-3 px-2 font-medium text-right">Ilość</th>
              <th className="pb-3 px-2 font-medium text-right">Śr. cena zakupu</th>
              <th className="pb-3 px-2 font-medium text-right">Cena rynkowa</th>
              <th className="pb-3 px-2 font-medium text-right">Zysk / Strata</th>
              <th className="pb-3 px-2 font-medium text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const currentPrice = asset.current_price ?? asset.average_price
              const pnl = (currentPrice - asset.average_price) * asset.quantity
              const pnlPercent =
                asset.average_price > 0
                  ? ((currentPrice - asset.average_price) / asset.average_price) * 100
                  : 0
              const isPositive = pnl >= 0

              return (
                <tr
                  key={asset.id}
                  className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors"
                >
                  <td className="py-3.5 px-2">
                    <span className="font-bold text-white bg-indigo-600/20 border border-indigo-600/30 rounded-md px-2 py-0.5 text-xs tracking-wider">
                      {asset.ticker}
                    </span>
                  </td>
                  <td className="py-3.5 px-2 text-right text-gray-300 font-mono">
                    {asset.quantity}
                  </td>
                  <td className="py-3.5 px-2 text-right text-gray-300 font-mono">
                    {formatNative(asset.average_price, asset.currency ?? 'USD')}
                  </td>
                  <td className="py-3.5 px-2 text-right font-mono">
                    {asset.current_price != null ? (
                      <span className="text-white">{formatNative(asset.current_price, asset.currency ?? 'USD')}</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Oczekuje aktualizacji</span>
                    )}
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <div className={`flex flex-col items-end ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      <span className="font-mono font-medium">
                        {isPositive ? '+' : ''}{formatNative(pnl, asset.currency ?? 'USD')}
                      </span>
                      <span className="text-xs opacity-75">
                        {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <button
                      onClick={() => handleDeleteRequest(asset.id)}
                      disabled={deletingId === asset.id}
                      className="text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors p-1 rounded"
                      aria-label={`Usuń ${asset.ticker}`}
                    >
                      {deletingId === asset.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default AssetTable
