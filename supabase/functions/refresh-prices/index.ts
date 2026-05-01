import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const REQUEST_TIMEOUT_MS = 15000
const REQUEST_DELAY_MS = 400

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AssetRow = {
  id: string
  ticker: string
}

const detectCurrency = (ticker: string): string => {
  const t = ticker.toUpperCase()
  if (t.endsWith('.WA')) return 'PLN'
  if (t.endsWith('.DE')) return 'EUR'
  return 'USD'
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchRates(): Promise<{ usdPln: number; eurPln: number }> {
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { 'Accept': 'application/json' },
    })
    if (!resp.ok) return { usdPln: 4.0, eurPln: 4.3 }
    const data = await resp.json()
    const usdPln = data?.rates?.PLN
    const eurUsd = data?.rates?.EUR
    const usdPlnVal = typeof usdPln === 'number' && usdPln > 0 ? usdPln : 4.0
    // EUR/PLN = (1/EUR_per_USD) * USD/PLN
    const eurPlnVal = typeof eurUsd === 'number' && eurUsd > 0 ? (1 / eurUsd) * usdPlnVal : 4.3
    return { usdPln: usdPlnVal, eurPln: eurPlnVal }
  } catch {
    return { usdPln: 4.0, eurPln: 4.3 }
  }
}

async function fetchPrice(ticker: string): Promise<number | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`)
    }

    const payload = await response.json()
    const price = payload?.chart?.result?.[0]?.meta?.regularMarketPrice

    return typeof price === 'number' && Number.isFinite(price) ? price : null
  } catch (error) {
    console.error(`Price refresh failed for ${ticker}:`, error)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('id, ticker')
    .order('created_at', { ascending: true })

  if (assetsError) {
    return new Response(JSON.stringify({ error: assetsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const assetRows = (assets ?? []) as AssetRow[]

  if (assetRows.length === 0) {
    return new Response(JSON.stringify({ updatedAssets: 0, updatedTickers: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const uniqueTickers = [...new Set(assetRows.map((asset) => asset.ticker))]
  const prices = new Map<string, number>()

  for (const ticker of uniqueTickers) {
    const price = await fetchPrice(ticker)

    if (price != null) {
      prices.set(ticker, price)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  if (prices.size === 0) {
    return new Response(JSON.stringify({ error: 'No prices fetched from Yahoo Finance' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let updatedAssets = 0

  for (const asset of assetRows) {
    const currentPrice = prices.get(asset.ticker)

    if (currentPrice == null) {
      continue
    }

    const { error: updateError } = await supabase
      .from('assets')
      .update({
        current_price: currentPrice,
        currency: detectCurrency(asset.ticker),
      })
      .eq('id', asset.id)

    if (updateError) {
      console.error(`Database update failed for ${asset.ticker}:`, updateError)
      continue
    }

    updatedAssets += 1
  }

  const rates = await fetchRates()
  return new Response(JSON.stringify({
    updatedAssets,
    updatedTickers: prices.size,
    usdPln: rates.usdPln,
    eurPln: rates.eurPln,
    refreshedAt: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})