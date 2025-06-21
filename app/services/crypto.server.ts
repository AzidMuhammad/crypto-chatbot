import axios from 'axios';

// Gunakan environment variables atau fallback ke hardcoded values
const API_KEY_COINCAP = process.env.COINCAP_API_KEY || "9633c3f27380e288ca4f247026fa95916100bc7a02aa21e6fa3ccd696aab73a9";
const AI_API_KEY = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "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";
const AI_MODEL = process.env.AI_MODEL || "deepseek/deepseek-r1:free";

// Tambahkan base URL untuk OpenRouter
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface CoinData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ema_20?: number;
  rsi_14?: number;
  macd?: number;
  macd_signal?: number;
  bb_upper?: number;
  bb_lower?: number;
  obv?: number;
}

export async function getCoinId(symbol: string): Promise<string> {
  try {
    const headers = { "Authorization": `Bearer ${API_KEY_COINCAP}` };
    const response = await axios.get("https://rest.coincap.io/v3/assets", { 
      headers,
      timeout: 10000 // Tambahkan timeout
    });
    
    const coin = response.data.data.find((coin: any) => 
      coin.symbol.toLowerCase() === symbol.toLowerCase()
    );
    
    if (!coin) {
      throw new Error(`Coin '${symbol}' tidak ditemukan.`);
    }
    
    return coin.id;
  } catch (error) {
    throw new Error(`Gagal mengambil coin ID: ${error}`);
  }
}

export async function getMarketData(coinId: string, interval: string = 'h1'): Promise<CoinData[]> {
  try {
    const headers = { "Authorization": `Bearer ${API_KEY_COINCAP}` };
    const url = `https://rest.coincap.io/v3/assets/${coinId}/history`;
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const params = {
      interval,
      start: startTime.getTime(),
      end: endTime.getTime(),
    };

    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 15000 // Tambahkan timeout
    });
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

    return processedData;
  } catch (error) {
    throw new Error(`Gagal mengambil data harga: ${error}`);
  }
}

// Simplified technical indicators calculations
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is just the average of first 'period' values
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;
  
  // Calculate subsequent EMAs
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate gains and losses
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate RSI
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
  
  // Calculate EMA
  const ema20 = calculateEMA(closes, 20);
  
  // Calculate RSI
  const rsi14 = calculateRSI(closes, 14);
  
  // Calculate Bollinger Bands
  const bb = calculateBollingerBands(closes, 20, 2);
  
  // Apply indicators to data
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

// Function to clean AI response from symbols and format as paragraphs
function formatAIResponse(rawResponse: string): string {
  // Remove common symbols and formatting characters
  let cleanResponse = rawResponse
    .replace(/[📈📉💡⚡🎯🔍📊💰⭐🚀❌✅⚠️🔔]/g, '') // Remove emojis
    .replace(/[•◦▪▫►▸‣⁃]/g, '') // Remove bullet points
    .replace(/^\d+\.\s*/gm, '') // Remove numbered lists
    .replace(/^\-\s*/gm, '') // Remove dash lists
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .replace(/#{1,6}\s*/g, '') // Remove markdown headers
    .replace(/\n{3,}/g, '\n\n') // Limit multiple line breaks
    .replace(/^\s*[\-\*]\s*/gm, '') // Remove remaining list markers
    .trim();

  // Split into sections and format as paragraphs
  const sections = cleanResponse.split(/\n\s*\n/);
  const formattedSections = sections
    .filter(section => section.trim().length > 0)
    .map(section => {
      // Clean up each section
      const cleanSection = section
        .replace(/\n+/g, ' ') // Replace line breaks with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
      
      return cleanSection;
    })
    .filter(section => section.length > 10); // Filter out very short sections

  return formattedSections.join('\n\n');
}

// Enhanced function to make API calls to OpenRouter with proper error handling
async function callOpenRouterAPI(messages: any[], retryCount = 0): Promise<string> {
  const maxRetries = 3;
  
  try {
    // Debug log untuk memastikan API key tersedia
    console.log('API Key available:', AI_API_KEY ? 'Yes' : 'No');
    console.log('API Key prefix:', AI_API_KEY ? AI_API_KEY.substring(0, 10) + '...' : 'None');
    
    if (!AI_API_KEY || AI_API_KEY === 'undefined') {
      throw new Error('OpenRouter API key tidak ditemukan dalam environment variables');
    }
    
    // Perbaikan untuk headers sesuai kebijakan OpenRouter
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
    };

    // Tambahkan HTTP-Referer hanya jika tersedia
    if (typeof window !== 'undefined') {
      headers["HTTP-Referer"] = window.location.origin;
    } else if (process.env.VERCEL_URL) {
      headers["HTTP-Referer"] = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      headers["HTTP-Referer"] = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
    }

    // Tambahkan X-Title untuk identifikasi
    headers["X-Title"] = "Crypto Analysis Tool";

    const requestBody = {
      model: AI_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1500, // Kurangi untuk menghindari masalah
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      // Tambahkan stream: false untuk memastikan response non-streaming
      stream: false
    };

    console.log('Making API call to OpenRouter with model:', AI_MODEL);
    console.log('Request headers:', Object.keys(headers));
    
    const response = await axios.post(
      OPENROUTER_BASE_URL,
      requestBody,
      {
        headers,
        timeout: 45000, // Kurangi timeout
        validateStatus: function (status) {
          return status < 500; // Resolve only if status is less than 500
        },
        // Tambahkan transformRequest untuk debugging
        transformRequest: [(data) => {
          console.log('Request payload size:', JSON.stringify(data).length);
          return JSON.stringify(data);
        }]
      }
    );

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    // Handle different response status codes
    if (response.status === 401) {
      console.error('Authentication failed. API key may be invalid or expired.');
      throw new Error("API key tidak valid atau sudah expired");
    }
    
    if (response.status === 402) {
      console.error('Payment required. Credits may be exhausted.');
      throw new Error("Kredit API habis, silakan top up atau coba lagi nanti");
    }
    
    if (response.status === 429) {
      console.log('Rate limit hit, status 429');
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Rate limit hit, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callOpenRouterAPI(messages, retryCount + 1);
      }
      throw new Error("Rate limit exceeded, silakan coba lagi nanti");
    }

    if (response.status >= 400) {
      console.error('API error:', response.status, response.statusText, response.data);
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }

    console.log('Response data structure:', Object.keys(response.data || {}));
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      const rawResponse = response.data.choices[0].message?.content;
      if (!rawResponse) {
        throw new Error("Response content kosong dari AI");
      }
      return formatAIResponse(rawResponse);
    } else {
      console.error('Invalid response structure:', response.data);
      throw new Error("Format response tidak valid dari AI");
    }
  } catch (error: any) {
    console.error("OpenRouter API Error Details:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? Object.keys(error.config.headers) : undefined
      }
    });
    
    // Specific error handling untuk debugging
    if (error.response?.status === 401) {
      console.error('401 Error - Possible causes:');
      console.error('1. Invalid API key');
      console.error('2. API key not properly formatted');
      console.error('3. API key expired or revoked');
      console.error('Current API key prefix:', AI_API_KEY ? AI_API_KEY.substring(0, 15) + '...' : 'Not found');
      return "Analisis gagal: API key tidak valid. Periksa konfigurasi API key OpenRouter.";
    }
    
    if (retryCount < maxRetries && (!error.response || error.response.status >= 500)) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      console.log(`Network/server error, retrying ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenRouterAPI(messages, retryCount + 1);
    }
    
    // Return user-friendly error messages
    if (error.response?.status === 402) {
      return "Analisis gagal: Kredit API habis. Silakan coba lagi nanti.";
    } else if (error.response?.status === 429) {
      return "Analisis gagal: Rate limit exceeded. Silakan coba lagi dalam beberapa menit.";
    } else if (error.code === 'ECONNABORTED') {
      return "Analisis gagal: Timeout. Silakan coba lagi.";
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return "Analisis gagal: Koneksi ke server gagal. Periksa koneksi internet.";
    } else {
      return `Analisis gagal: ${error.message}. Silakan coba lagi nanti.`;
    }
  }
}

// Declare file system interface for browser environment
declare global {
  interface Window {
    fs?: {
      readFile: (filename: string, options?: { encoding?: string }) => Promise<string | Uint8Array>;
    };
  }
}

// Function to read and parse crypto-related files
export async function readCryptoFile(filename: string): Promise<any> {
  try {
    // Check if file system API is available (browser environment)
    if (typeof window !== 'undefined' && window.fs) {
      const fileData = await window.fs.readFile(filename, { encoding: 'utf8' });
      
      // Determine file type and parse accordingly
      const extension = filename.toLowerCase().split('.').pop();
      
      switch (extension) {
        case 'json':
          return JSON.parse(fileData as string);
        
        case 'csv':
          // Parse CSV data for crypto trading data
          const Papa = require('papaparse');
          const csvResult = Papa.parse(fileData as string, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim().toLowerCase()
          });
          return csvResult.data;
        
        case 'txt':
          // Parse text file for crypto analysis or trading signals
          return (fileData as string).split('\n').filter((line: string) => line.trim() !== '');
        
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } else {
      // Fallback for server environment - you might want to use Node.js fs here
      throw new Error('File system not available in this environment');
    }
  } catch (error) {
    console.error('Error reading crypto file:', error);
    throw new Error(`Failed to read file ${filename}: ${error}`);
  }
}

// Function to analyze uploaded crypto data
export async function analyzeCryptoFile(filename: string, symbol?: string): Promise<string> {
  try {
    const fileData = await readCryptoFile(filename);
    
    // Detect data type and structure
    let analysisPrompt = '';
    
    if (Array.isArray(fileData) && fileData.length > 0) {
      const firstItem = fileData[0];
      
      // Check if it's OHLCV data
      if (firstItem.open !== undefined || firstItem.close !== undefined || 
          firstItem.high !== undefined || firstItem.low !== undefined) {
        
        const recentData = fileData.slice(-50); // Last 50 data points
        analysisPrompt = `
Analyze this cryptocurrency trading data from uploaded file ${filename}:

Data contains ${fileData.length} records with the following recent data:
${JSON.stringify(recentData.slice(-10), null, 2)}

Sample data structure: ${JSON.stringify(Object.keys(firstItem), null, 2)}

Please provide comprehensive analysis covering:
- Price trend analysis based on OHLCV data
- Volume analysis if available
- Key support and resistance levels
- Trading opportunities and signals
- Risk assessment and recommendations
`;
      }
      // Check if it's portfolio data
      else if (firstItem.symbol || firstItem.coin || firstItem.asset) {
        analysisPrompt = `
Analyze this cryptocurrency portfolio data from uploaded file ${filename}:

Portfolio contains ${fileData.length} assets:
${JSON.stringify(fileData, null, 2)}

Please provide analysis covering:
- Portfolio diversification assessment
- Risk analysis across different assets
- Performance evaluation
- Rebalancing recommendations
- Market exposure analysis
`;
      }
      // Generic crypto data analysis
      else {
        analysisPrompt = `
Analyze this cryptocurrency data from uploaded file ${filename}:

Data structure: ${JSON.stringify(Object.keys(firstItem), null, 2)}
Sample data: ${JSON.stringify(fileData.slice(0, 5), null, 2)}
Total records: ${fileData.length}

Please provide comprehensive analysis based on the available data structure and values.
`;
      }
    }
    // Handle text data (trading signals, news, analysis)
    else if (typeof fileData === 'string' || (Array.isArray(fileData) && typeof fileData[0] === 'string')) {
      const textContent = Array.isArray(fileData) ? fileData.join('\n') : fileData;
      analysisPrompt = `
Analyze this cryptocurrency-related text data from uploaded file ${filename}:

Content:
${textContent.substring(0, 2000)}${textContent.length > 2000 ? '...' : ''}

Please provide analysis covering:
- Key insights and market signals
- Sentiment analysis if applicable
- Trading implications
- Risk factors mentioned
- Actionable recommendations
`;
    }
    else {
      analysisPrompt = `
Analyze this cryptocurrency data from uploaded file ${filename}:

Data: ${JSON.stringify(fileData, null, 2).substring(0, 1500)}

Please provide comprehensive analysis based on the uploaded data.
`;
    }

    // Call AI analysis with improved error handling
    const messages = [
      { 
        role: "system", 
        content: "You are a professional cryptocurrency analyst. Analyze uploaded crypto data and provide insights in clean paragraph format without using any symbols, emojis, bullet points, or numbered lists. Write in a professional, narrative style." 
      },
      { role: "user", content: analysisPrompt }
    ];

    return await callOpenRouterAPI(messages);
  } catch (error) {
    console.error("File analysis error:", error);
    return `Failed to analyze file ${filename}. Please ensure the file contains valid cryptocurrency data and try again.`;
  }
}

// Enhanced analysis combining live data and file data
export async function analyzeWithFileData(data: CoinData[], symbol: string, filename?: string): Promise<string> {
  try {
    let fileAnalysis = '';
    
    if (filename) {
      const fileData = await readCryptoFile(filename);
      fileAnalysis = `

Additional context from uploaded file ${filename}:
${JSON.stringify(fileData, null, 2).substring(0, 1000)}${JSON.stringify(fileData, null, 2).length > 1000 ? '...' : ''}
`;
    }

    const trend = detectTrend(data);
    const recentData = data.slice(-20);
    
    const formattedData = recentData.map(d => ({
      timestamp: new Date(d.timestamp).toLocaleString(),
      close: d.close.toFixed(4),
      ema_20: (d.ema_20 ?? 0).toFixed(4),
      rsi_14: (d.rsi_14 ?? 50).toFixed(2),
      bb_upper: (d.bb_upper ?? 0).toFixed(4),
      bb_lower: (d.bb_lower ?? 0).toFixed(4),
    }));

    const prompt = `
Analyze the ${symbol.toUpperCase()} cryptocurrency combining live market data with uploaded file information.

Current trend detected: ${trend}

Live market data (last 20 hours):
${JSON.stringify(formattedData, null, 2)}
${fileAnalysis}

Please provide comprehensive analysis in clean paragraph format covering:

Market Context: Integrate insights from both live data and uploaded file information to provide complete market context.

Technical Analysis: Analyze current technical indicators including RSI, EMA, and Bollinger Bands in relation to any historical data from the file.

Cross-Reference Analysis: Compare current market conditions with patterns or data from the uploaded file to identify correlations or divergences.

Enhanced Opportunities: Identify trading opportunities that consider both real-time market conditions and historical context from the file.

Comprehensive Risk Assessment: Provide risk analysis incorporating both current market volatility and historical patterns from the uploaded data.

Strategic Forecast: Offer enhanced predictions for the next 24-48 hours based on the combined analysis of live and historical data.

Please write your response in clear, professional paragraphs without using any symbols, emojis, bullet points, or numbered lists.
`;

    const messages = [
      { 
        role: "system", 
        content: "You are a professional cryptocurrency analyst. Provide comprehensive analysis combining live market data with uploaded file information in clean paragraph format without using any symbols, emojis, bullet points, or numbered lists. Write in a professional, narrative style." 
      },
      { role: "user", content: prompt }
    ];

    return await callOpenRouterAPI(messages);
  } catch (error) {
    console.error("Enhanced analysis error:", error);
    return "Enhanced analysis failed. Please try again later.";
  }
}

export async function analyzeWithAI(data: CoinData[], symbol: string): Promise<string> {
  const trend = detectTrend(data);
  const recentData = data.slice(-20);
  
  const formattedData = recentData.map(d => ({
    timestamp: new Date(d.timestamp).toLocaleString(),
    close: d.close.toFixed(4),
    ema_20: (d.ema_20 ?? 0).toFixed(4),
    rsi_14: (d.rsi_14 ?? 50).toFixed(2),
    bb_upper: (d.bb_upper ?? 0).toFixed(4),
    bb_lower: (d.bb_lower ?? 0).toFixed(4),
  }));

  const prompt = `
Analyze the hourly chart of ${symbol.toUpperCase()} cryptocurrency as a professional analyst. 

Current trend detected: ${trend}

Recent market data for the last 20 hours:
${JSON.stringify(formattedData, null, 2)}

Please provide a comprehensive analysis in clean paragraph format covering these aspects:

Market Trend Analysis: Explain the current market direction and momentum based on the price action and technical indicators.

Technical Indicators Interpretation: Analyze the RSI levels, EMA position, and Bollinger Bands to determine market conditions such as overbought or oversold situations.

Entry and Exit Opportunities: Identify potential buying or selling points based on the technical analysis and current price levels.

Risk Management: Suggest appropriate stop-loss levels and take-profit targets based on support and resistance levels.

Short-term Forecast: Provide insights on the likely price movement over the next 24 to 48 hours based on current market conditions and technical patterns.

Please write your response in clear, professional paragraphs without using any symbols, emojis, bullet points, or numbered lists. Focus on providing actionable insights in a narrative format.
`;

  const messages = [
    { 
      role: "system", 
      content: "You are a professional cryptocurrency analyst. Provide analysis in clean paragraph format without using any symbols, emojis, bullet points, or numbered lists. Write in a professional, narrative style." 
    },
    { role: "user", content: prompt }
  ];

  return await callOpenRouterAPI(messages);
}
