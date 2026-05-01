import React from 'react'

interface SummaryProps {
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPercent: number
  assetCount: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

function Summary({ totalValue, totalCost, totalPnL, totalPnLPercent, assetCount }: SummaryProps) {
  const isPositive = totalPnL >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Wartość portfela</p>
        </div>
        <p className="text-2xl font-bold text-white">{formatCurrency(totalValue)}</p>
        <p className="text-gray-500 text-xs mt-1">Wartość rynkowa w PLN</p>
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Zainwestowany kapitał</p>
        </div>
        <p className="text-2xl font-bold text-white">{formatCurrency(totalCost)}</p>
        <p className="text-gray-500 text-xs mt-1">Koszt zakupu w PLN</p>
      </div>

      <div className={`rounded-2xl p-6 border shadow-lg ${isPositive ? 'bg-green-900/20 border-green-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPositive ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
            <svg className={`w-5 h-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isPositive ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'} />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Zysk / Strata</p>
        </div>
        <p className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{formatCurrency(totalPnL)}
        </p>
        <p className={`text-sm mt-1 font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{totalPnLPercent.toFixed(2)}%
        </p>
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">Liczba pozycji</p>
        </div>
        <p className="text-2xl font-bold text-white">{assetCount}</p>
        <p className="text-gray-500 text-xs mt-1">Aktywów w portfelu</p>
      </div>
    </div>
  )
}

export default Summary
