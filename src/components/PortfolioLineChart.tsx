import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

export interface ChartPoint {
  date: string
  value: number
}

interface Props {
  data: ChartPoint[]
  chartType: 'value' | 'pnl'
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getDate()}.${d.getMonth() + 1}`
}

const formatShort = (value: number) => {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}${abs.toFixed(0)}`
}

const formatFull = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

function PortfolioLineChart({ data, chartType }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-gray-500 gap-2">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm">Brak danych historycznych</span>
        <span className="text-xs text-gray-600">Dane pojawią się po pierwszym uruchomieniu automatyzacji</span>
      </div>
    )
  }

  const lineColor = chartType === 'pnl' ? '#10B981' : '#6366F1'
  const lineColorDot = chartType === 'pnl' ? '#059669' : '#312E81'
  const label = chartType === 'pnl' ? 'Zysk / Strata' : 'Wartość portfela'
  const hasPnl = chartType === 'pnl'

  const chartData = data.map((item) => ({
    date: formatDate(item.date),
    value: item.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
        {hasPnl && <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />}
        <XAxis
          dataKey="date"
          stroke="#4B5563"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          stroke="#4B5563"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatShort}
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '12px',
            color: '#F9FAFB',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          }}
          formatter={(value: number) => [formatFull(value), label]}
          labelStyle={{ color: '#9CA3AF', marginBottom: 4 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: lineColor, stroke: lineColorDot, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default PortfolioLineChart
