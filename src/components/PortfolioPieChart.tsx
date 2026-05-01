import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import { Asset } from '../types'

interface Props {
  assets: Asset[]
  exchangeRate: number
  eurRate?: number
}

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#84CC16']

function PortfolioPieChart({ assets, exchangeRate, eurRate = 4.3 }: Props) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-gray-500 gap-2">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <span className="text-sm">Brak aktywów</span>
      </div>
    )
  }

  const data = assets.map((asset) => {
    const nativeValue = (asset.current_price ?? asset.average_price) * asset.quantity
    const cur = asset.currency ?? 'USD'
    const valuePLN = cur === 'PLN' ? nativeValue : cur === 'EUR' ? nativeValue * eurRate : nativeValue * exchangeRate
    return { name: asset.ticker, value: parseFloat(valuePLN.toFixed(2)) }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '12px',
            color: '#F9FAFB',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          }}
          formatter={(value: number, name: string) => [
            new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value),
            name,
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: '#D1D5DB', fontSize: '12px' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default PortfolioPieChart
