import type { CoinData, TimeframeData } from '~/services/crypto.server';

interface TechnicalIndicatorsProps {
  data: CoinData[];
  trend: string;
  volatility?: number;
  priceChange?: number;
  timeframe?: string;
}

export default function TechnicalIndicators({ 
  data, 
  trend, 
  volatility = 0, 
  priceChange = 0,
  timeframe = '24h'
}: TechnicalIndicatorsProps) {
  if (data.length === 0) return null;

  const latest = data[data.length - 1];
  
  const getRSIColor = (rsi?: number) => {
    if (!rsi) return 'text-gray-400';
    if (rsi > 70) return 'text-red-400';
    if (rsi < 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'Uptrend') return 'text-green-400';
    if (trend === 'Downtrend') return 'text-red-400';
    return 'text-gray-400';
  };

  const getBBPosition = () => {
    const price = latest.close;
    const upper = latest.bb_upper;
    const lower = latest.bb_lower;
    
    if (!upper || !lower || upper === 0 || lower === 0) {
      return { text: 'BB Data Unavailable', color: 'text-gray-400' };
    }
    
    if (price > upper) return { text: 'Above Upper Band', color: 'text-red-400' };
    if (price < lower) return { text: 'Below Lower Band', color: 'text-green-400' };
    return { text: 'Within Bands', color: 'text-blue-400' };
  };

  const bbPosition = getBBPosition();

  const formatNumber = (value?: number, decimals = 2) => {
    if (value === undefined || value === null || value === 0) return 'N/A';
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: Math.max(decimals, 6) 
    });
  };

  const getRSIStatus = (rsi?: number) => {
    if (!rsi) return 'No Data';
    if (rsi > 70) return 'Overbought';
    if (rsi < 30) return 'Oversold';
    return 'Neutral';
  };

  const getVolatilityColor = (vol: number) => {
    if (vol > 0.4) return 'text-red-400';
    if (vol > 0.2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getVolatilityStatus = (vol: number) => {
    if (vol > 0.4) return 'High';
    if (vol > 0.2) return 'Medium';
    return 'Low';
  };

  // Calculate 24h change if we have enough data points
  const get24hChange = () => {
    // For different timeframes, calculate appropriate lookback period
    let lookbackPeriods = 1; // Default for 1h timeframe
    
    switch (timeframe) {
      case '15m':
        lookbackPeriods = 96; // 24 hours = 96 * 15min
        break;
      case '30m':
        lookbackPeriods = 48; // 24 hours = 48 * 30min
        break;
      case '1h':
        lookbackPeriods = 24; // 24 hours = 24 * 1h
        break;
      case '12h':
        lookbackPeriods = 2; // 24 hours = 2 * 12h
        break;
      case '24h':
      case '7d':
      case '30d':
      case '6M':
      case '1Y':
        lookbackPeriods = 1; // Use the provided priceChange instead
        break;
    }

    if (timeframe === '24h' || timeframe === '7d' || timeframe === '30d' || timeframe === '6M' || timeframe === '1Y') {
      // For longer timeframes, use the provided priceChange
      return {
        change: (latest.close * priceChange) / 100,
        changePercent: priceChange
      };
    }

    if (data.length > lookbackPeriods) {
      const previousPrice = data[data.length - lookbackPeriods]?.close;
      if (previousPrice !== undefined) {
        const change = latest.close - previousPrice;
        const changePercent = (change / previousPrice) * 100;
        return { change, changePercent };
      }
    }
    
    return null;
  };

  const changeData = get24hChange();

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h3 className="text-xl font-semibold mb-4 text-white">Technical Analysis - {timeframe}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Current Price */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">Current Price</h4>
          <p className="text-2xl font-bold text-blue-400">
            ${formatNumber(latest.close, 2)}
          </p>
        </div>

        {/* Trend */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">Market Trend</h4>
          <p className={`text-xl font-semibold ${getTrendColor(trend)}`}>
            {trend}
          </p>
        </div>

        {/* EMA 20 */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">EMA 20</h4>
          {latest.ema_20 !== undefined && latest.ema_20 !== 0 ? (
            <>
              <p className="text-xl font-semibold text-white">
                ${formatNumber(latest.ema_20, 2)}
              </p>
              <p className={`text-sm ${latest.close > latest.ema_20 ? 'text-green-400' : 'text-red-400'}`}>
                {latest.close > latest.ema_20 ? '↗ Above EMA' : '↘ Below EMA'}
              </p>
            </>
          ) : (
            <p className="text-xl font-semibold text-gray-400">N/A</p>
          )}
        </div>

        {/* RSI */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">RSI (14)</h4>
          {latest.rsi_14 !== undefined && latest.rsi_14 !== 50 ? (
            <>
              <p className={`text-xl font-semibold ${getRSIColor(latest.rsi_14)}`}>
                {latest.rsi_14.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                {getRSIStatus(latest.rsi_14)}
              </p>
            </>
          ) : (
            <p className="text-xl font-semibold text-gray-400">N/A</p>
          )}
        </div>

        {/* Bollinger Bands */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">Bollinger Bands</h4>
          <p className={`text-lg font-semibold ${bbPosition.color}`}>
            {bbPosition.text}
          </p>
          {latest.bb_upper !== undefined && latest.bb_lower !== undefined && 
           latest.bb_upper !== 0 && latest.bb_lower !== 0 ? (
            <>
              <p className="text-sm text-gray-400">
                Upper: ${latest.bb_upper.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                Lower: ${latest.bb_lower.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Data not available</p>
          )}
        </div>

        {/* Price Change */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">
            {timeframe === '15m' || timeframe === '30m' || timeframe === '1h' || timeframe === '12h' 
              ? '24h Change' 
              : 'Period Change'}
          </h4>
          {changeData ? (
            <>
              <p className={`text-xl font-semibold ${changeData.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {changeData.change >= 0 ? '+' : ''}${changeData.change.toFixed(2)}
              </p>
              <p className={`text-sm ${changeData.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {changeData.changePercent >= 0 ? '+' : ''}{changeData.changePercent.toFixed(2)}%
              </p>
            </>
          ) : (
            <p className="text-gray-400">Insufficient data</p>
          )}
        </div>

        {/* Volatility */}
        <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
          <h4 className="font-medium text-gray-300">Volatility</h4>
          <p className={`text-xl font-semibold ${getVolatilityColor(volatility)}`}>
            {getVolatilityStatus(volatility)}
          </p>
          <p className="text-sm text-gray-400">
            {(volatility * 100).toFixed(2)}%
          </p>
        </div>

        {/* Volume (if available) */}
        {latest.volume !== undefined && latest.volume > 0 && (
          <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
            <h4 className="font-medium text-gray-300">Volume</h4>
            <p className="text-xl font-semibold text-purple-400">
              {latest.volume > 1000000 
                ? `${(latest.volume / 1000000).toFixed(2)}M`
                : latest.volume > 1000
                  ? `${(latest.volume / 1000).toFixed(2)}K`
                  : latest.volume.toFixed(0)
              }
            </p>
          </div>
        )}

        {/* MACD (if available and not default) */}
        {latest.macd !== undefined && latest.macd !== 0 && (
          <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
            <h4 className="font-medium text-gray-300">MACD</h4>
            <p className={`text-xl font-semibold ${latest.macd > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {latest.macd.toFixed(4)}
            </p>
            {latest.macd_signal !== undefined && latest.macd_signal !== 0 && (
              <p className="text-sm text-gray-400">
                Signal: {latest.macd_signal.toFixed(4)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Warning message if some indicators are missing */}
      {(latest.ema_20 === undefined || latest.ema_20 === 0 || 
        latest.rsi_14 === undefined || latest.rsi_14 === 50 ||
        latest.bb_upper === undefined || latest.bb_upper === 0 || 
        latest.bb_lower === undefined || latest.bb_lower === 0) && (
        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-md">
          <p className="text-sm text-yellow-400">
            ⚠️ Some technical indicators may not be available due to insufficient historical data or default values being used.
          </p>
        </div>
      )}

      {/* Timeframe specific information */}
      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded-md">
        <p className="text-sm text-blue-400">
          ℹ️ Analysis based on {timeframe} timeframe. 
          {timeframe === '15m' || timeframe === '30m' 
            ? ' Short-term signals - suitable for scalping and day trading.'
            : timeframe === '1h' || timeframe === '12h'
              ? ' Medium-term signals - suitable for day and swing trading.'
              : ' Long-term signals - suitable for position trading and investment decisions.'
          }
        </p>
      </div>
    </div>
  );
}