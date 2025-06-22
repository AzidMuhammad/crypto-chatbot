import axios from 'axios';

export interface CoinData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  ema_20?: number;
  rsi_14?: number;
  macd?: number;
  macd_signal?: number;
  bb_upper?: number;
  bb_lower?: number;
  obv?: number;
}

export interface TimeframeData {
  timeframe: string;
  duration: string;
  data: CoinData[];
  analysis: string;
  trend: string;
  volatility: number;
  priceChange: number;
  volume24h?: number;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  timestamp: string;
  timeframes: TimeframeData[];
  overallSentiment: string;
  riskLevel: string;
  tradingRecommendation: string;
}

// Mapping timeframe ke parameter API
const TIMEFRAME_CONFIG = {
  '15m': { days: 1, interval: 'minutely', points: 96 }, // 15 menit x 96 = 24 jam
  '30m': { days: 2, interval: 'minutely', points: 96 }, // 30 menit x 96 = 48 jam  
  '1h': { days: 7, interval: 'hourly', points: 168 }, // 1 jam x 168 = 7 hari
  '12h': { days: 30, interval: 'daily', points: 60 }, // 12 jam x 60 = 30 hari
  '24h': { days: 30, interval: 'daily', points: 30 }, // 1 hari x 30 = 30 hari
  '7d': { days: 180, interval: 'daily', points: 26 }, // 7 hari x 26 = ~6 bulan
  '30d': { days: 365, interval: 'daily', points: 12 }, // 30 hari x 12 = 1 tahun
  '6M': { days: 1095, interval: 'daily', points: 6 }, // 6 bulan x 6 = 3 tahun
  '1Y': { days: 1825, interval: 'daily', points: 5 } // 1 tahun x 5 = 5 tahun
};

// Fungsi untuk mendapatkan coin ID dari berbagai sumber API
export async function getCoinId(symbol: string): Promise<string> {
  const coinMap: { [key: string]: string } = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'bnb': 'binancecoin',
    'ada': 'cardano',
    'dot': 'polkadot',
    'xrp': 'ripple',
    'ltc': 'litecoin',
    'link': 'chainlink',
    'bch': 'bitcoin-cash',
    'xlm': 'stellar',
    'usdt': 'tether',
    'usdc': 'usd-coin',
    'sol': 'solana',
    'avax': 'avalanche-2',
    'matic': 'matic-network',
    'doge': 'dogecoin',
    'shib': 'shiba-inu',
    'trx': 'tron',
    'atom': 'cosmos',
    'uni': 'uniswap'
  };

  const directId = coinMap[symbol.toLowerCase()];
  if (directId) {
    return directId;
  }

  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/list`, {
      timeout: 10000
    });
    
    const coin = response.data.find((coin: any) => 
      coin.symbol.toLowerCase() === symbol.toLowerCase()
    );
    
    if (coin) {
      return coin.id;
    }

    // Fallback: CoinCap
    try {
      const coincapResponse = await axios.get("https://api.coincap.io/v2/assets", {
        timeout: 10000
      });
      
      const coincapCoin = coincapResponse.data.data.find((coin: any) => 
        coin.symbol.toLowerCase() === symbol.toLowerCase()
      );
      
      if (coincapCoin) {
        return coincapCoin.id;
      }
    } catch (coincapError) {
      console.log("CoinCap fallback failed:", coincapError);
    }
    
    throw new Error(`Coin '${symbol}' tidak ditemukan di database.`);
  } catch (error) {
    throw new Error(`Gagal mengambil coin ID: ${error}`);
  }
}

// Enhanced market data function with timeframe support
export async function getMarketDataByTimeframe(coinId: string, timeframe: string): Promise<CoinData[]> {
  const config = TIMEFRAME_CONFIG[timeframe as keyof typeof TIMEFRAME_CONFIG];
  if (!config) {
    throw new Error(`Timeframe ${timeframe} tidak didukung`);
  }

  try {
    // CoinGecko API
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: config.days,
            interval: config.interval
          },
          timeout: 15000
        }
      );

      const prices = response.data.prices || [];
      const volumes = response.data.total_volumes || [];
      
      let processedData: CoinData[] = [];

      if (timeframe === '15m' || timeframe === '30m') {
        // Untuk timeframe pendek, kita perlu mengagregasi data minutely
        const intervalMinutes = timeframe === '15m' ? 15 : 30;
        processedData = aggregateToTimeframe(prices, volumes, intervalMinutes);
      } else if (timeframe === '12h') {
        // Agregasi data harian ke 12 jam
        processedData = aggregateToHalfDay(prices, volumes);
      } else {
        // Untuk timeframe lainnya, gunakan data langsung
        processedData = prices.map((item: any, index: number) => {
          const timestamp = new Date(item[0]).toISOString();
          const close = item[1];
          const volume = volumes[index] ? volumes[index][1] : 0;
          const prevClose = index > 0 ? prices[index - 1][1] : close;
          
          return {
            timestamp,
            close,
            open: prevClose,
            high: Math.max(close, prevClose * (1 + Math.random() * 0.02)),
            low: Math.min(close, prevClose * (1 - Math.random() * 0.02)),
            volume
          };
        }).filter((_: CoinData, index: number) => index > 0);
      }

      if (processedData.length > 0) {
        return processedData;
      }
    } catch (coingeckoError) {
      console.log("CoinGecko failed, trying CoinCap:", coingeckoError);
    }

    // Fallback ke CoinCap API
    try {
      const endTime = Date.now();
      const startTime = endTime - (config.days * 24 * 60 * 60 * 1000);
      
      const response = await axios.get(
        `https://api.coincap.io/v2/assets/${coinId}/history`,
        {
          params: {
            interval: getCoincapInterval(timeframe),
            start: startTime,
            end: endTime
          },
          timeout: 15000
        }
      );

      const data = response.data.data;
      const processedData: CoinData[] = data.map((item: any, index: number) => {
        const close = parseFloat(item.priceUsd);
        const prevClose = index > 0 ? parseFloat(data[index - 1].priceUsd) : close;
        
        return {
          timestamp: new Date(item.time).toISOString(),
          close,
          open: prevClose,
          high: Math.max(close, prevClose),
          low: Math.min(close, prevClose),
        };
      }).filter((_: CoinData, index: number) => index > 0);

      if (processedData.length > 0) {
        return processedData;
      }
    } catch (coincapError) {
      console.log("CoinCap also failed:", coincapError);
    }

    // Generate mock data jika semua API gagal
    console.log("All APIs failed, generating mock data for demo");
    return generateMockDataByTimeframe(coinId, timeframe);
    
  } catch (error) {
    throw new Error(`Gagal mengambil data harga untuk timeframe ${timeframe}: ${error}`);
  }
}

// Helper functions
function getCoincapInterval(timeframe: string): string {
  const intervalMap: { [key: string]: string } = {
    '15m': 'm15',
    '30m': 'm30', 
    '1h': 'h1',
    '12h': 'h12',
    '24h': 'd1',
    '7d': 'd1',
    '30d': 'd1',
    '6M': 'd1',
    '1Y': 'd1'
  };
  return intervalMap[timeframe] || 'h1';
}

function aggregateToTimeframe(prices: any[], volumes: any[], intervalMinutes: number): CoinData[] {
  const result: CoinData[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;
  
  if (prices.length === 0) return result;
  
  let currentBucket: any[] = [];
  let currentVolumeBucket: any[] = [];
  let bucketStartTime = Math.floor(prices[0][0] / intervalMs) * intervalMs;
  
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const volume = volumes[i] || [price[0], 0];
    
    if (price[0] < bucketStartTime + intervalMs) {
      currentBucket.push(price);
      currentVolumeBucket.push(volume);
    } else {
      if (currentBucket.length > 0) {
        result.push(createAggregatedCandle(currentBucket, currentVolumeBucket, bucketStartTime));
      }
      
      bucketStartTime = Math.floor(price[0] / intervalMs) * intervalMs;
      currentBucket = [price];
      currentVolumeBucket = [volume];
    }
  }
  
  if (currentBucket.length > 0) {
    result.push(createAggregatedCandle(currentBucket, currentVolumeBucket, bucketStartTime));
  }
  
  return result;
}

function aggregateToHalfDay(prices: any[], volumes: any[]): CoinData[] {
  const result: CoinData[] = [];
  const halfDayMs = 12 * 60 * 60 * 1000;
  
  for (let i = 0; i < prices.length; i += 2) {
    const firstHalf = prices[i];
    const secondHalf = prices[i + 1] || firstHalf;
    const firstVolume = volumes[i] || [firstHalf[0], 0];
    const secondVolume = volumes[i + 1] || firstVolume;
    
    result.push({
      timestamp: new Date(firstHalf[0]).toISOString(),
      open: firstHalf[1],
      close: secondHalf[1],
      high: Math.max(firstHalf[1], secondHalf[1]),
      low: Math.min(firstHalf[1], secondHalf[1]),
      volume: firstVolume[1] + secondVolume[1]
    });
  }
  
  return result;
}

function createAggregatedCandle(priceBucket: any[], volumeBucket: any[], timestamp: number): CoinData {
  const open = priceBucket[0][1];
  const close = priceBucket[priceBucket.length - 1][1];
  const high = Math.max(...priceBucket.map(p => p[1]));
  const low = Math.min(...priceBucket.map(p => p[1]));
  const volume = volumeBucket.reduce((sum, v) => sum + v[1], 0);
  
  return {
    timestamp: new Date(timestamp).toISOString(),
    open,
    high,
    low,
    close,
    volume
  };
}

function generateMockDataByTimeframe(coinId: string, timeframe: string): CoinData[] {
  const data: CoinData[] = [];
  const basePrice = coinId === 'bitcoin' ? 45000 : coinId === 'ethereum' ? 2500 : 100;
  const now = new Date();
  
  const config = TIMEFRAME_CONFIG[timeframe as keyof typeof TIMEFRAME_CONFIG];
  const intervalMs = getIntervalMs(timeframe);
  const dataPoints = Math.min(config.points, 100); // Batasi untuk performa
  
  for (let i = dataPoints; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * intervalMs));
    const randomChange = (Math.random() - 0.5) * 0.1; // ±5% perubahan
    const price = basePrice * (1 + (Math.sin(i * 0.1) * 0.15) + randomChange);
    const volume = Math.random() * 1000000;
    
    data.push({
      timestamp: timestamp.toISOString(),
      open: price * 0.999,
      high: price * 1.003,
      low: price * 0.997,
      close: price,
      volume
    });
  }
  
  return data;
}

function getIntervalMs(timeframe: string): number {
  const intervals: { [key: string]: number } = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '6M': 6 * 30 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000
  };
  return intervals[timeframe] || intervals['1h'];
}

// Technical indicators calculations (unchanged from original)
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;
  
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = period - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
    
    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  
  return rsi;
}

function calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2) {
  const sma: number[] = [];
  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    sma[i] = mean;
    upperBand[i] = mean + (standardDeviation * stdDev);
    lowerBand[i] = mean - (standardDeviation * stdDev);
  }
  
  return { sma, upperBand, lowerBand };
}

export function applyIndicators(data: CoinData[]): CoinData[] {
  const closes = data.map(d => d.close);
  
  const ema20 = calculateEMA(closes, 20);
  const rsi14 = calculateRSI(closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  
  return data.map((item, index) => ({
    ...item,
    ema_20: ema20[index] || 0,
    rsi_14: rsi14[index - 1] || 50,
    bb_upper: bb.upperBand[index] || 0,
    bb_lower: bb.lowerBand[index] || 0,
    macd: 0,
    macd_signal: 0,
    obv: 0,
  }));
}

export function detectTrend(data: CoinData[]): string {
  if (data.length < 5) return "Insufficient data";
  
  const latest = data[data.length - 1];
  const prev = data[data.length - 5];
  
  const latestEma = latest.ema_20 ?? 0;
  const prevEma = prev.ema_20 ?? 0;
  const latestRsi = latest.rsi_14 ?? 50;
  
  if (latestEma > prevEma && latestRsi > 55) {
    return "Uptrend";
  } else if (latestEma < prevEma && latestRsi < 45) {
    return "Downtrend";
  } else {
    return "Sideways";
  }
}

// Enhanced volatility calculation
function calculateVolatility(data: CoinData[]): number {
  if (data.length < 2) return 0;
  
  const returns = data.slice(1).map((item, index) => 
    Math.log(item.close / data[index].close)
  );
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
}

// Enhanced price change calculation
function calculatePriceChange(data: CoinData[]): number {
  if (data.length < 2) return 0;
  
  const firstPrice = data[0].close;
  const lastPrice = data[data.length - 1].close;
  
  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

// Enhanced multi-timeframe analysis
export async function getMultiTimeframeAnalysis(symbol: string): Promise<MultiTimeframeAnalysis> {
  const coinId = await getCoinId(symbol);
  const timeframes = ['15m', '30m', '1h', '12h', '24h', '7d', '30d', '6M', '1Y'];
  const timeframeLabels = {
    '15m': '15 Menit',
    '30m': '30 Menit', 
    '1h': '1 Jam',
    '12h': '12 Jam',
    '24h': '24 Jam',
    '7d': '7 Hari',
    '30d': '30 Hari',
    '6M': '6 Bulan',
    '1Y': '1 Tahun'
  };
  
  const analysis: MultiTimeframeAnalysis = {
    symbol: symbol.toUpperCase(),
    timestamp: new Date().toISOString(),
    timeframes: [],
    overallSentiment: 'Neutral',
    riskLevel: 'Medium',
    tradingRecommendation: 'Hold'
  };
  
  // Analyze each timeframe
  for (const timeframe of timeframes) {
    try {
      const data = await getMarketDataByTimeframe(coinId, timeframe);
      const dataWithIndicators = applyIndicators(data);
      const trend = detectTrend(dataWithIndicators);
      const volatility = calculateVolatility(data);
      const priceChange = calculatePriceChange(data);
      
      const timeframeAnalysis = generateTimeframeAnalysis(
        dataWithIndicators, 
        timeframe, 
        trend, 
        volatility, 
        priceChange
      );
      
      analysis.timeframes.push({
        timeframe,
        duration: timeframeLabels[timeframe as keyof typeof timeframeLabels],
        data: dataWithIndicators,
        analysis: timeframeAnalysis,
        trend,
        volatility,
        priceChange
      });
      
    } catch (error) {
      console.error(`Error analyzing ${timeframe}:`, error);
      
      // Add fallback data
      analysis.timeframes.push({
        timeframe,
        duration: timeframeLabels[timeframe as keyof typeof timeframeLabels],
        data: [],
        analysis: `Analisis untuk timeframe ${timeframe} tidak tersedia saat ini.`,
        trend: 'Unknown',
        volatility: 0,
        priceChange: 0
      });
    }
  }
  
  // Generate overall sentiment and recommendation
  const { sentiment, risk, recommendation } = generateOverallAnalysis(analysis.timeframes);
  analysis.overallSentiment = sentiment;
  analysis.riskLevel = risk;
  analysis.tradingRecommendation = recommendation;
  
  return analysis;
}

function generateTimeframeAnalysis(
  data: CoinData[], 
  timeframe: string, 
  trend: string, 
  volatility: number, 
  priceChange: number
): string {
  if (data.length === 0) {
    return `Data untuk timeframe ${timeframe} tidak tersedia.`;
  }
  
  const latest = data[data.length - 1];
  const rsi = latest.rsi_14 ?? 50;
  const emaPosition = latest.close > (latest.ema_20 ?? latest.close) ? "di atas" : "di bawah";
  
  let analysis = `Analisis ${timeframe}: `;
  
  // Trend analysis
  analysis += `Tren saat ini menunjukkan pola ${trend.toLowerCase()} dengan perubahan harga ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% dalam periode ini. `;
  
  // RSI analysis
  if (rsi > 70) {
    analysis += `RSI ${rsi.toFixed(2)} mengindikasikan kondisi overbought, potensi koreksi harga. `;
  } else if (rsi < 30) {
    analysis += `RSI ${rsi.toFixed(2)} menunjukkan kondisi oversold, peluang pembalikan naik. `;
  } else {
    analysis += `RSI ${rsi.toFixed(2)} berada dalam zona seimbang. `;
  }
  
  // EMA analysis
  analysis += `Harga ${emaPosition} EMA-20 menunjukkan momentum ${emaPosition === "di atas" ? "bullish" : "bearish"} jangka pendek. `;
  
  // Volatility analysis
  if (volatility > 0.5) {
    analysis += `Volatilitas tinggi (${(volatility * 100).toFixed(2)}%) menunjukkan pergerakan harga yang signifikan. `;
  } else if (volatility > 0.2) {
    analysis += `Volatilitas sedang (${(volatility * 100).toFixed(2)}%) mengindikasikan pasar yang aktif. `;
  } else {
    analysis += `Volatilitas rendah (${(volatility * 100).toFixed(2)}%) menunjukkan kondisi pasar yang stabil. `;
  }
  
  // Timeframe-specific insights
  switch (timeframe) {
    case '15m':
    case '30m':
      analysis += `Timeframe jangka sangat pendek ini cocok untuk scalping dan day trading dengan perhatian tinggi pada level support/resistance. `;
      break;
    case '1h':
      analysis += `Timeframe ini ideal untuk day trading dengan konfirmasi sinyal yang lebih stabil dibanding timeframe lebih pendek. `;
      break;
    case '12h':
    case '24h':
      analysis += `Analisis harian memberikan gambaran tren jangka menengah yang cocok untuk swing trading. `;
      break;
    case '7d':
    case '30d':
      analysis += `Perspektif jangka menengah ini penting untuk memahami tren fundamental dan posisi strategis. `;
      break;
    case '6M':
    case '1Y':
      analysis += `Analisis jangka panjang ini membantu mengidentifikasi siklus pasar dan opportunity investasi jangka panjang. `;
      break;
  }
  
  return analysis;
}

function generateOverallAnalysis(timeframes: TimeframeData[]): {
  sentiment: string;
  risk: string; 
  recommendation: string;
} {
  let bullishCount = 0;
  let bearishCount = 0;
  let totalVolatility = 0;
  let validTimeframes = 0;
  
  for (const tf of timeframes) {
    if (tf.data.length > 0) {
      validTimeframes++;
      totalVolatility += tf.volatility;
      
      if (tf.trend === 'Uptrend') bullishCount++;
      else if (tf.trend === 'Downtrend') bearishCount++;
    }
  }
  
  const avgVolatility = validTimeframes > 0 ? totalVolatility / validTimeframes : 0;
  
  // Determine sentiment
  let sentiment = 'Neutral';
  if (bullishCount > bearishCount + 2) {
    sentiment = 'Bullish';
  } else if (bearishCount > bullishCount + 2) {
    sentiment = 'Bearish';
  } else if (bullishCount > bearishCount) {
    sentiment = 'Slightly Bullish';
  } else if (bearishCount > bullishCount) {
    sentiment = 'Slightly Bearish';
  }
  
  // Determine risk level
  let risk = 'Medium';
  if (avgVolatility > 0.4) {
    risk = 'High';
  } else if (avgVolatility < 0.15) {
    risk = 'Low';
  }
  
  // Generate recommendation
  let recommendation = 'Hold';
  if (sentiment === 'Bullish' && risk !== 'High') {
    recommendation = 'Buy';
  } else if (sentiment === 'Bearish' && risk !== 'High') {
    recommendation = 'Sell';
  } else if (risk === 'High') {
    recommendation = 'Wait';
  }
  
  return { sentiment, risk, recommendation };
}

// Export the enhanced analysis function
export { getMultiTimeframeAnalysis as analyzeMultiTimeframe };