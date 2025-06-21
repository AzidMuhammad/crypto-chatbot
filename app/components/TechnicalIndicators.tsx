import type { CoinData } from '~/services/crypto.server';

interface TechnicalIndicatorsProps {
  data: CoinData[];
  trend: string;
}

export default function TechnicalIndicators({ data, trend }: TechnicalIndicatorsProps) {
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
    
    if (!upper || !lower) {
      return { text: 'BB Data Unavailable', color: 'text-gray-400' };
    }
    
    if (price > upper) return { text: 'Above Upper Band', color: 'text-red-400' };
    if (price < lower) return { text: 'Below Lower Band', color: 'text-green-400' };
    return { text: 'Within Bands', color: 'text-blue-400' };
  };

  const bbPosition = getBBPosition();

  const formatNumber = (value?: number, decimals = 2) => {
    if (value === undefined || value === null) return 'N/A';
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

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h3 className="text-xl font-semibold mb-4 text-white">Technical Analysis</h3>
      
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
          {latest.ema_20 !== undefined ? (
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
          {latest.rsi_14 !== undefined ? (
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
          {latest.bb_upper !== undefined && latest.bb_lower !== undefined ? (
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
          <h4 className="font-medium text-gray-300">24h Change</h4>
          {data.length > 24 ? (
            (() => {
              const previousPrice = data[data.length - 24]?.close;
              if (previousPrice !== undefined) {
                const change = latest.close - previousPrice;
                const changePercent = (change / previousPrice) * 100;
                return (
                  <>
                    <p className={`text-xl font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}${change.toFixed(2)}
                    </p>
                    <p className={`text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </p>
                  </>
                );
              } else {
                return <p className="text-gray-400">Price data unavailable</p>;
              }
            })()
          ) : (
            <p className="text-gray-400">Insufficient data</p>
          )}
        </div>
      </div>

      {/* Warning message if some indicators are missing */}
      {(latest.ema_20 === undefined || latest.rsi_14 === undefined || 
        latest.bb_upper === undefined || latest.bb_lower === undefined) && (
        <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-md">
          <p className="text-sm text-yellow-400">
            ⚠️ Some technical indicators may not be available due to insufficient historical data.
          </p>
        </div>
      )}
    </div>
  );
}