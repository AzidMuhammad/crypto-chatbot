import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { useState } from "react";

import ChatInterface from "~/components/ChatInterface";
import CandlestickChart from "~/components/CandlestickChart";
import TechnicalIndicators from "~/components/TechnicalIndicators";
import { 
  getCoinId, 
  getMarketDataByTimeframe, 
  applyIndicators, 
  detectTrend,
  getMultiTimeframeAnalysis,
  type CoinData,
  type MultiTimeframeAnalysis 
} from "~/services/crypto.server";

type ActionErrorResponse = {
  error: string;
  analysis: string;
};

type ActionSuccessResponse = {
  symbol: string;
  data: CoinData[];
  trend: string;
  analysis: string;
  multiTimeframeAnalysis?: MultiTimeframeAnalysis;
  timeframe: string;
  success: true;
};

type ActionResponse = ActionErrorResponse | ActionSuccessResponse;

export async function loader({ request }: LoaderFunctionArgs) {
  return json({ 
    message: "Welcome to Crypto AI Analyzer!" 
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const message = formData.get("message")?.toString() || "";

  const symbolMatch = message.match(/(?:analyze|check|show|get)\s+([a-zA-Z]{2,10})/i) || 
                     message.match(/\b([a-zA-Z]{2,10})\b/);
  
  const timeframeMatch = message.match(/\b(15m|30m|1h|12h|24h|7d|30d|6M|1Y)\b/i);
  const requestedTimeframe = timeframeMatch ? timeframeMatch[1].toLowerCase() : '24h';
  
  const isMultiTimeframeRequest = /multi|multiple|all|various|different.*timeframe/i.test(message);
  
  if (!symbolMatch) {
    return json<ActionErrorResponse>({ 
      error: "Please specify a cryptocurrency symbol (e.g., 'Analyze BTC' or 'Check ETH 1h')",
      analysis: "❌ No cryptocurrency symbol found in your message. Please try something like 'Analyze BTC' or 'Check ETH trends on 1h timeframe'."
    });
  }

  const symbol = symbolMatch[1].toUpperCase();

  try {
    if (isMultiTimeframeRequest) {
      const multiTimeframeAnalysis = await getMultiTimeframeAnalysis(symbol);
      
      const coinId = await getCoinId(symbol);
      const marketData = await getMarketDataByTimeframe(coinId, '24h');
      const dataWithIndicators = applyIndicators(marketData);
      const trend = detectTrend(dataWithIndicators);
      
      const analysis = generateBasicAnalysis(dataWithIndicators, symbol, '24h');

      return json<ActionSuccessResponse>({
        symbol,
        data: dataWithIndicators,
        trend,
        analysis,
        multiTimeframeAnalysis,
        timeframe: '24h (Multi-Timeframe Analysis)',
        success: true
      });
    } else {
      const coinId = await getCoinId(symbol);
      const marketData = await getMarketDataByTimeframe(coinId, requestedTimeframe);
      const dataWithIndicators = applyIndicators(marketData);
      const trend = detectTrend(dataWithIndicators);
      
      const analysis = generateBasicAnalysis(dataWithIndicators, symbol, requestedTimeframe);

      return json<ActionSuccessResponse>({
        symbol,
        data: dataWithIndicators,
        trend,
        analysis,
        timeframe: requestedTimeframe,
        success: true
      });
    }

  } catch (error) {
    console.error("Analysis error:", error);
    return json<ActionErrorResponse>({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      analysis: `❌ Sorry, I couldn't analyze ${symbol}. ${error instanceof Error ? error.message : 'Please try again with a valid cryptocurrency symbol.'}`
    });
  }
}

function generateBasicAnalysis(data: CoinData[], symbol: string, timeframe: string): string {
  if (data.length === 0) {
    return `❌ Unable to analyze ${symbol} at this time. Please try again later.`;
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 7)];
  
  const priceChange = ((latest.close - previous.close) / previous.close) * 100;
  const rsi = latest.rsi_14 ?? 50;
  const trend = detectTrend(data);
  const currentPrice = latest.close;
  const emaPosition = latest.close > (latest.ema_20 ?? latest.close) ? "above" : "below";

  let analysis = `📊 ${symbol} Analysis (${timeframe})\n\n`;
  
  analysis += `💰 Price Movement: ${currentPrice.toFixed(6)}\n`;
  analysis += `📈 Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% from ${timeframe === '24h' ? 'yesterday' : 'previous period'}\n\n`;
  
  analysis += `🎯 Trend: ${trend}\n`;
  if (trend === 'Uptrend') {
    analysis += `✅ The market is showing bullish momentum with higher highs and higher lows.\n`;
  } else if (trend === 'Downtrend') {
    analysis += `❌ The market is in a bearish phase with lower highs and lower lows.\n`;
  } else {
    analysis += `⚖️ The market is consolidating in a sideways pattern.\n`;
  }
  
  analysis += `\n📊 RSI (14): ${rsi.toFixed(2)}\n`;
  if (rsi > 70) {
    analysis += `⚠️ Overbought: RSI indicates potential selling pressure. Consider taking profits.\n`;
  } else if (rsi < 30) {
    analysis += `🔥 Oversold: RSI suggests potential buying opportunity. Watch for reversal signals.\n`;
  } else if (rsi > 55) {
    analysis += `📈 Bullish: RSI shows positive momentum but not yet overbought.\n`;
  } else if (rsi < 45) {
    analysis += `📉 Bearish: RSI indicates selling pressure but not yet oversold.\n`;
  } else {
    analysis += `⚖️ Neutral: RSI is in equilibrium zone. Wait for clearer signals.\n`;
  }
  
  analysis += `\n🔄 EMA-20: Price is trading ${emaPosition} the 20-period EMA\n`;
  if (emaPosition === "above") {
    analysis += `✅ This suggests short-term bullish momentum and potential support.\n`;
  } else {
    analysis += `❌ This indicates short-term bearish pressure and potential resistance.\n`;
  }

  analysis += `\n🎯 Trading Recommendation:\n`;
  if (trend === 'Uptrend' && rsi < 70 && emaPosition === "above") {
    analysis += `🟢 BUY: Multiple indicators align for a bullish outlook.\n`;
  } else if (trend === 'Downtrend' && rsi > 30 && emaPosition === "below") {
    analysis += `🔴 SELL: Bearish indicators suggest further downside.\n`;
  } else if (rsi > 70 || rsi < 30) {
    analysis += `⏳ WAIT: Extreme RSI levels suggest waiting for better entry.\n`;
  } else {
    analysis += `🟡 HOLD: Mixed signals suggest maintaining current positions.\n`;
  }
  
  analysis += `\n⚠️ Risk Management:\n`;
  analysis += `• Set stop-loss orders to manage downside risk\n`;
  analysis += `• Consider position sizing based on volatility\n`;
  analysis += `• Monitor key support/resistance levels\n`;
  analysis += `• Always trade with proper risk management\n`;
  
  analysis += `\n💡 Note: This analysis is for educational purposes only. Always do your own research before making trading decisions.`;

  return analysis;
}

function isSuccessResponse(data: ActionResponse | undefined): data is ActionSuccessResponse {
  return data !== undefined && 'success' in data && data.success === true;
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionResponse | undefined;
  const [showChart, setShowChart] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('24h');
  const [showMultiTimeframe, setShowMultiTimeframe] = useState(false);

  const hasData = isSuccessResponse(actionData);
  const hasMultiTimeframeData = hasData && actionData.multiTimeframeAnalysis;

  const timeframeOptions = [
    { value: '15m', label: '15 Menit' },
    { value: '30m', label: '30 Menit' },
    { value: '1h', label: '1 Jam' },
    { value: '12h', label: '12 Jam' },
    { value: '24h', label: '24 Jam' },
    { value: '7d', label: '7 Hari' },
    { value: '30d', label: '30 Hari' },
    { value: '6M', label: '6 Bulan' },
    { value: '1Y', label: '1 Tahun' }
  ];

  const getTimeframeData = (timeframe: string) => {
    if (!hasMultiTimeframeData) return null;
    return actionData.multiTimeframeAnalysis?.timeframes.find(tf => tf.timeframe === timeframe);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-48">
        </div>

        <div className="mb-8">
          <ChatInterface />
        </div>

        {hasData && (
          <div className="space-y-6 mt-8">
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => setShowChart(!showChart)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {showChart ? 'Hide Chart' : 'Show Chart'}
              </button>

              {hasMultiTimeframeData && (
                <button
                  onClick={() => setShowMultiTimeframe(!showMultiTimeframe)}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  {showMultiTimeframe ? '⏱️ Hide Multi-Timeframe' : '⏱️ Show Multi-Timeframe'}
                </button>
              )}
            </div>

            {hasMultiTimeframeData && (
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  📊 Overall Analysis - {actionData.symbol}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-gray-700/30 rounded-lg">
                    <h4 className="text-sm text-gray-400 mb-2">Overall Sentiment</h4>
                    <span className={`text-lg font-bold ${
                      actionData.multiTimeframeAnalysis?.overallSentiment.includes('Bullish') 
                        ? 'text-green-400' 
                        : actionData.multiTimeframeAnalysis?.overallSentiment.includes('Bearish')
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }`}>
                      {actionData.multiTimeframeAnalysis?.overallSentiment}
                    </span>
                  </div>
                  <div className="text-center p-4 bg-gray-700/30 rounded-lg">
                    <h4 className="text-sm text-gray-400 mb-2">Risk Level</h4>
                    <span className={`text-lg font-bold ${
                      actionData.multiTimeframeAnalysis?.riskLevel === 'High' 
                        ? 'text-red-400' 
                        : actionData.multiTimeframeAnalysis?.riskLevel === 'Low'
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}>
                      {actionData.multiTimeframeAnalysis?.riskLevel}
                    </span>
                  </div>
                  <div className="text-center p-4 bg-gray-700/30 rounded-lg">
                    <h4 className="text-sm text-gray-400 mb-2">Trading Recommendation</h4>
                    <span className={`text-lg font-bold ${
                      actionData.multiTimeframeAnalysis?.tradingRecommendation === 'Buy' 
                        ? 'text-green-400' 
                        : actionData.multiTimeframeAnalysis?.tradingRecommendation === 'Sell'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }`}>
                      {actionData.multiTimeframeAnalysis?.tradingRecommendation}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {hasMultiTimeframeData && showMultiTimeframe && (
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
                <h3 className="text-xl font-bold text-white mb-6">
                  ⏱️ Multi-Timeframe Analysis
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {actionData.multiTimeframeAnalysis?.timeframes.map((tf) => (
                    <div 
                      key={tf.timeframe}
                      className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all cursor-pointer"
                      onClick={() => setSelectedTimeframe(tf.timeframe)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold text-white">{tf.duration}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tf.trend === 'Uptrend' 
                            ? 'bg-green-500/20 text-green-400' 
                            : tf.trend === 'Downtrend'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {tf.trend}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-300">
                        <div>Price Change: <span className={tf.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {tf.priceChange >= 0 ? '+' : ''}{tf.priceChange.toFixed(2)}%
                        </span></div>
                        <div>Volatility: <span className="text-yellow-400">
                          {(tf.volatility * 100).toFixed(2)}%
                        </span></div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedTimeframe && (
                  <div className="bg-gray-700/20 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3">
                      Detailed Analysis - {timeframeOptions.find(opt => opt.value === selectedTimeframe)?.label || selectedTimeframe}
                    </h4>
                    <p className="text-gray-300 leading-relaxed">
                      {getTimeframeData(selectedTimeframe)?.analysis || 'No analysis available for this timeframe.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {showChart && (
              <div className="space-y-6">
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
                  <div className="flex justify-between items-center mb-4">
                  </div>
                  <TechnicalIndicators 
                    data={actionData.data} 
                    trend={actionData.trend} 
                  />
                </div>

                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
                  <CandlestickChart 
                    data={actionData.data} 
                    symbol={actionData.symbol} 
                  />
                </div>
              </div>
            )}

          </div>
        )}

        {!hasData && (
          <footer className="mt-12 text-center">
          </footer>
        )}
      </div>
    </div>
  );
}