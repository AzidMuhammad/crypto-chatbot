import { useEffect, useRef, useState } from 'react';

interface CoinData {
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

interface CandlestickChartProps {
  data: CoinData[];
  symbol: string;
  timeframe?: string;
}

interface FibonacciLevel {
  level: number;
  label: string;
  color: string;
}

interface FibonacciRetracement {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  isUptrend: boolean;
}

const FIBONACCI_LEVELS: FibonacciLevel[] = [
  { level: 0, label: '0.0%', color: '#10B981' },
  { level: 0.236, label: '23.6%', color: '#F59E0B' },
  { level: 0.382, label: '38.2%', color: '#EF4444' },
  { level: 0.5, label: '50.0%', color: '#8B5CF6' },
  { level: 0.618, label: '61.8%', color: '#06B6D4' },
  { level: 0.786, label: '78.6%', color: '#F97316' },
  { level: 1, label: '100.0%', color: '#EF4444' },
];

// Generate sample data that matches the CoinData interface
const generateSampleData = (): CoinData[] => {
  const data: CoinData[] = [];
  const basePrice = 101613.70;
  let currentPrice = basePrice;
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Random price movement with more realistic volatility
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * 2;
    currentPrice = currentPrice * (1 + change);
    
    const open = currentPrice;
    const high = open * (1 + Math.random() * 0.015);
    const low = open * (1 - Math.random() * 0.015);
    const close = low + Math.random() * (high - low);
    
    // Calculate technical indicators
    const ema_20 = close * (0.98 + Math.random() * 0.04);
    const rsi_14 = 30 + Math.random() * 40; // RSI between 30-70
    const bb_middle = close;
    const bb_deviation = close * 0.02;
    
    data.push({
      timestamp: date.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 500000,
      ema_20: Number(ema_20.toFixed(2)),
      rsi_14: Number(rsi_14.toFixed(2)),
      bb_upper: Number((bb_middle + bb_deviation).toFixed(2)),
      bb_lower: Number((bb_middle - bb_deviation).toFixed(2)),
      macd: Number((Math.random() - 0.5) * 100),
      macd_signal: Number((Math.random() - 0.5) * 100),
      obv: Math.floor(Math.random() * 10000000)
    });
    
    currentPrice = close;
  }
  
  return data;
};

export default function CandlestickChart({ 
  data = generateSampleData(), 
  symbol = "BTC", 
  timeframe = "24h" 
}: CandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showIndicators, setShowIndicators] = useState({
    ema: true,
    bb: false,
    rsi: false,
    fibonacci: false
  });
  
  // Fibonacci drawing states
  const [fibonacciMode, setFibonacciMode] = useState(false);
  const [fibonacciRetracements, setFibonacciRetracements] = useState<FibonacciRetracement[]>([]);
  const [drawingFibonacci, setDrawingFibonacci] = useState<{
    startIndex: number;
    startPrice: number;
    currentIndex?: number;
    currentPrice?: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with high DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 80, bottom: 60, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas with dark background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    // Calculate price range including indicators
    const prices = data.flatMap(d => {
      const values = [d.open, d.high, d.low, d.close];
      if (showIndicators.ema && d.ema_20) values.push(d.ema_20);
      if (showIndicators.bb && d.bb_upper && d.bb_lower) {
        values.push(d.bb_upper, d.bb_lower);
      }
      return values;
    });
    
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;

    // Helper functions
    const priceToY = (price: number) => padding.top + (maxPrice - price) / priceRange * chartHeight;
    const indexToX = (index: number) => padding.left + (index + 0.5) * (chartWidth / data.length);
    const xToIndex = (x: number) => Math.floor((x - padding.left) / (chartWidth / data.length));
    const yToPrice = (y: number) => maxPrice - ((y - padding.top) / chartHeight) * priceRange;

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 6; i++) {
      const price = minPrice + (priceRange * i / 6);
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Price labels
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        price.toLocaleString(undefined, { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 2 
        }), 
        width - padding.right + 5, 
        y + 4
      );
    }

    // Vertical grid lines
    const maxLabels = Math.min(6, data.length);
    const labelStep = Math.max(1, Math.floor(data.length / maxLabels));
    
    for (let i = 0; i < data.length; i += labelStep) {
      const x = indexToX(i);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw Bollinger Bands first (if enabled)
    if (showIndicators.bb) {
      const upperBandData = data.filter(d => d.bb_upper !== undefined);
      const lowerBandData = data.filter(d => d.bb_lower !== undefined);
      
      if (upperBandData.length > 1 && lowerBandData.length > 1) {
        // Fill area between bands
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.beginPath();
        
        // Upper band
        upperBandData.forEach((d, i) => {
          const originalIndex = data.indexOf(d);
          const x = indexToX(originalIndex);
          const y = priceToY(d.bb_upper!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        
        // Lower band (reverse order)
        for (let i = lowerBandData.length - 1; i >= 0; i--) {
          const d = lowerBandData[i];
          const originalIndex = data.indexOf(d);
          const x = indexToX(originalIndex);
          const y = priceToY(d.bb_lower!);
          ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Draw band lines
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        // Upper band line
        ctx.beginPath();
        upperBandData.forEach((d, i) => {
          const originalIndex = data.indexOf(d);
          const x = indexToX(originalIndex);
          const y = priceToY(d.bb_upper!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Lower band line
        ctx.beginPath();
        lowerBandData.forEach((d, i) => {
          const originalIndex = data.indexOf(d);
          const x = indexToX(originalIndex);
          const y = priceToY(d.bb_lower!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        ctx.setLineDash([]);
      }
    }

    // Draw Fibonacci retracements
    if (showIndicators.fibonacci) {
      fibonacciRetracements.forEach((fib) => {
        const startX = indexToX(fib.startIndex);
        const endX = indexToX(fib.endIndex);
        const priceRange = Math.abs(fib.endPrice - fib.startPrice);
        
        FIBONACCI_LEVELS.forEach((level) => {
          let fibPrice: number;
          if (fib.isUptrend) {
            fibPrice = fib.endPrice - (priceRange * level.level);
          } else {
            fibPrice = fib.startPrice + (priceRange * level.level);
          }
          
          const y = priceToY(fibPrice);
          
          // Draw horizontal line
          ctx.strokeStyle = level.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(Math.min(startX, endX), y);
          ctx.lineTo(Math.max(startX, endX), y);
          ctx.stroke();
          
          // Draw price label
          ctx.fillStyle = level.color;
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(
            `${level.label} (${fibPrice.toFixed(2)})`,
            Math.max(startX, endX) - 5,
            y - 3
          );
        });
        
        // Draw trend line
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(startX, priceToY(fib.startPrice));
        ctx.lineTo(endX, priceToY(fib.endPrice));
        ctx.stroke();
      });
    }

    // Draw current fibonacci drawing
    if (drawingFibonacci && drawingFibonacci.currentIndex !== undefined && drawingFibonacci.currentPrice !== undefined) {
      const startX = indexToX(drawingFibonacci.startIndex);
      const currentX = indexToX(drawingFibonacci.currentIndex);
      const startY = priceToY(drawingFibonacci.startPrice);
      const currentY = priceToY(drawingFibonacci.currentPrice);
      
      // Draw temporary trend line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw temporary fibonacci levels
      const priceRange = Math.abs(drawingFibonacci.currentPrice - drawingFibonacci.startPrice);
      const isUptrend = drawingFibonacci.currentPrice > drawingFibonacci.startPrice;
      
      FIBONACCI_LEVELS.forEach((level) => {
        let fibPrice: number;
        if (isUptrend) {
          fibPrice = drawingFibonacci.currentPrice! - (priceRange * level.level);
        } else {
          fibPrice = drawingFibonacci.startPrice + (priceRange * level.level);
        }
        
        const y = priceToY(fibPrice);
        
        // Draw horizontal line
        ctx.strokeStyle = level.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.min(startX, currentX), y);
        ctx.lineTo(Math.max(startX, currentX), y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });
    }

    // Draw EMA line (if enabled)
    if (showIndicators.ema) {
      const emaData = data.filter(d => d.ema_20 !== undefined);
      if (emaData.length > 1) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        emaData.forEach((d, i) => {
          const originalIndex = data.indexOf(d);
          const x = indexToX(originalIndex);
          const y = priceToY(d.ema_20!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }

    // Draw candlesticks
    const candleWidth = Math.max(4, Math.min(20, chartWidth / data.length * 0.7));
    
    data.forEach((d, i) => {
      const x = indexToX(i);
      const openY = priceToY(d.open);
      const highY = priceToY(d.high);
      const lowY = priceToY(d.low);
      const closeY = priceToY(d.close);
      
      const isUp = d.close >= d.open;
      const bodyColor = isUp ? '#10B981' : '#EF4444';
      const wickColor = isUp ? '#10B981' : '#EF4444';
      
      // Draw wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
      
      if (isUp) {
        // Bullish candle - hollow body
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      } else {
        // Bearish candle - filled body
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      }
      
      // Highlight hovered candle
      if (hoveredIndex === i) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleWidth / 2 - 1, bodyTop - 1, candleWidth + 2, bodyHeight + 2);
      }
    });

    // Draw time labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < data.length; i += labelStep) {
      const x = indexToX(i);
      const date = new Date(data[i].timestamp);
      let dateStr: string;
      
      // Format date based on timeframe
      switch (timeframe) {
        case '15m':
        case '30m':
        case '1h':
          dateStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          break;
        case '12h':
        case '24h':
          dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          break;
        default:
          dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
      }
      
      ctx.fillText(dateStr, x, height - 15);
    }

  }, [data, hoveredIndex, showIndicators, timeframe, fibonacciRetracements, drawingFibonacci]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const padding = { top: 20, right: 80, bottom: 60, left: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;
    
    if (x > padding.left && x < rect.width - padding.right && 
        y > padding.top && y < rect.height - padding.bottom) {
      const index = Math.floor((x - padding.left) / (chartWidth / data.length));
      const validIndex = Math.max(0, Math.min(index, data.length - 1));
      setHoveredIndex(validIndex);
      
      // Update drawing fibonacci if in progress
      if (drawingFibonacci && fibonacciMode) {
        const prices = [data[validIndex].open, data[validIndex].high, data[validIndex].low, data[validIndex].close];
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const yRatio = (y - padding.top) / chartHeight;
        const currentPrice = maxPrice - (yRatio * (maxPrice - minPrice));
        
        setDrawingFibonacci(prev => prev ? {
          ...prev,
          currentIndex: validIndex,
          currentPrice: currentPrice
        } : null);
      }
    } else {
      setHoveredIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!fibonacciMode || !data || data.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = { top: 20, right: 80, bottom: 60, left: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;
    
    if (x > padding.left && x < rect.width - padding.right && 
        y > padding.top && y < rect.height - padding.bottom) {
      
      const index = Math.floor((x - padding.left) / (chartWidth / data.length));
      const validIndex = Math.max(0, Math.min(index, data.length - 1));
      
      // Calculate price based on y position
      const prices = [data[validIndex].open, data[validIndex].high, data[validIndex].low, data[validIndex].close];
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const yRatio = (y - padding.top) / chartHeight;
      const currentPrice = maxPrice - (yRatio * (maxPrice - minPrice));
      
      if (!drawingFibonacci) {
        // Start drawing
        setDrawingFibonacci({
          startIndex: validIndex,
          startPrice: currentPrice,
          currentIndex: validIndex,
          currentPrice: currentPrice
        });
      } else {
        // Complete drawing
        const isUptrend = currentPrice > drawingFibonacci.startPrice;
        const newRetracement: FibonacciRetracement = {
          startIndex: drawingFibonacci.startIndex,
          endIndex: validIndex,
          startPrice: drawingFibonacci.startPrice,
          endPrice: currentPrice,
          isUptrend: isUptrend
        };
        
        setFibonacciRetracements(prev => [...prev, newRetracement]);
        setDrawingFibonacci(null);
        setFibonacciMode(false);
      }
    }
  };

  const clearFibonacci = () => {
    setFibonacciRetracements([]);
    setDrawingFibonacci(null);
    setFibonacciMode(false);
  };

  const toggleFibonacciMode = () => {
    setFibonacciMode(prev => !prev);
    setDrawingFibonacci(null);
    if (!fibonacciMode) {
      setShowIndicators(prev => ({ ...prev, fibonacci: true }));
    }
  };

  const currentData = hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];
  const previousData = data.length > 1 ? data[data.length - 2] : currentData;

  // Calculate price change
  const priceChange = currentData.close - previousData.close;
  const priceChangePercent = (priceChange / previousData.close) * 100;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700/50 p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-white">
          {symbol.toUpperCase()} Price Chart ({timeframe})
        </h3>
        
        {/* Indicator toggles */}
        <div className="flex space-x-3">
          <button
            onClick={() => setShowIndicators(prev => ({ ...prev, ema: !prev.ema }))}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              showIndicators.ema 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            EMA 20
          </button>
          <button
            onClick={() => setShowIndicators(prev => ({ ...prev, bb: !prev.bb }))}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              showIndicators.bb 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Bollinger Bands
          </button>
          <button
            onClick={toggleFibonacciMode}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              fibonacciMode 
                ? 'bg-yellow-500 text-white' 
                : showIndicators.fibonacci
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {fibonacciMode ? 'Drawing Fib...' : 'Fibonacci'}
          </button>
          {(fibonacciRetracements.length > 0 || drawingFibonacci) && (
            <button
              onClick={clearFibonacci}
              className="px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Clear Fib
            </button>
          )}
        </div>
      </div>
      
      {fibonacciMode && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <div className="text-yellow-300 text-sm">
            <strong>Fibonacci Drawing Mode:</strong> 
            {!drawingFibonacci 
              ? ' Click on the chart to start drawing your Fibonacci retracement line.' 
              : ' Click again to complete the Fibonacci retracement.'
            }
          </div>
        </div>
      )}
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`w-full h-96 border border-gray-600/50 rounded-lg ${
            fibonacciMode ? 'cursor-crosshair' : 'cursor-crosshair'
          } bg-gray-900/50`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          style={{ height: '400px' }}
        />
        
        {/* Enhanced Tooltip */}
        {hoveredIndex !== null && (
          <div 
            className="absolute bg-gray-900/95 backdrop-blur-sm text-gray-200 p-4 rounded-lg shadow-2xl border border-gray-600/50 pointer-events-none z-10 text-sm min-w-48"
            style={{
              left: Math.min(mousePos.x + 10, window.innerWidth - 200),
              top: Math.max(mousePos.y - 150, 10),
            }}
          >
            <div className="font-bold text-white text-base mb-2">
              {new Date(currentData.timestamp).toLocaleString()}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Open: <span className="text-blue-300">${currentData.open.toLocaleString()}</span></div>
              <div>Close: <span className="text-blue-300">${currentData.close.toLocaleString()}</span></div>
              <div>High: <span className="text-green-400">${currentData.high.toLocaleString()}</span></div>
              <div>Low: <span className="text-red-400">${currentData.low.toLocaleString()}</span></div>
            </div>
            
            {currentData.volume && (
              <div className="mt-2 text-xs">
                Volume: <span className="text-gray-300">{currentData.volume.toLocaleString()}</span>
              </div>
            )}
            
            {showIndicators.ema && currentData.ema_20 && (
              <div className="mt-2 text-xs">
                EMA 20: <span className="text-blue-400">${currentData.ema_20.toLocaleString()}</span>
              </div>
            )}
            
            {currentData.rsi_14 && (
              <div className="mt-1 text-xs">
                RSI: <span className={`${
                  currentData.rsi_14 > 70 ? 'text-red-400' : 
                  currentData.rsi_14 < 30 ? 'text-green-400' : 'text-yellow-400'
                }`}>{currentData.rsi_14.toFixed(2)}</span>
              </div>
            )}
            
            {showIndicators.bb && currentData.bb_upper && currentData.bb_lower && (
              <div className="mt-2 text-xs">
                <div>BB Upper: <span className="text-purple-400">${currentData.bb_upper.toFixed(2)}</span></div>
                <div>BB Lower: <span className="text-purple-400">${currentData.bb_lower.toFixed(2)}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Legend */}
      <div className="mt-4 flex flex-wrap justify-center items-center gap-4 text-sm text-gray-400">
        <div className="flex items-center">
          <div className="w-4 h-3 bg-green-500 mr-2 rounded border border-green-400"></div>
          <span>Bullish</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-3 bg-red-500 mr-2 rounded"></div>
          <span>Bearish</span>
        </div>
        {showIndicators.ema && (
          <div className="flex items-center">
            <div className="w-4 h-1 bg-blue-500 mr-2 rounded"></div>
            <span>EMA 20</span>
          </div>
        )}
        {showIndicators.bb && (
          <div className="flex items-center">
            <div className="w-4 h-1 bg-purple-500 mr-2 rounded border-dashed border border-purple-400"></div>
            <span>Bollinger Bands</span>
          </div>
        )}
        {showIndicators.fibonacci && (
          <div className="flex items-center">
            <div className="w-4 h-1 bg-yellow-500 mr-2 rounded"></div>
            <span>Fibonacci Levels</span>
          </div>
        )}
      </div>

      {/* Fibonacci Levels Info */}
      {showIndicators.fibonacci && fibonacciRetracements.length > 0 && (
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600/30">
          <h4 className="text-white font-semibold mb-3">Active Fibonacci Retracements</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fibonacciRetracements.map((fib, index) => (
              <div key={index} className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-sm text-gray-300 mb-2">
                  Retracement #{index + 1} ({fib.isUptrend ? 'Uptrend' : 'Downtrend'})
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Start: <span className="text-blue-300">${fib.startPrice.toFixed(2)}</span></div>
                  <div>End: <span className="text-blue-300">${fib.endPrice.toFixed(2)}</span></div>
                </div>
                <div className="mt-2 text-xs">
                  <div className="grid grid-cols-4 gap-1">
                    {FIBONACCI_LEVELS.slice(1, -1).map((level) => {
                      const priceRange = Math.abs(fib.endPrice - fib.startPrice);
                      let fibPrice: number;
                      if (fib.isUptrend) {
                        fibPrice = fib.endPrice - (priceRange * level.level);
                      } else {
                        fibPrice = fib.startPrice + (priceRange * level.level);
                      }
                      return (
                        <div key={level.level} style={{ color: level.color }}>
                          {level.label}: ${fibPrice.toFixed(0)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Current Price Info */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600/30">
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">Current Price</div>
          <div className="text-xl font-bold text-white">
            ${currentData.close.toLocaleString()}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">Change</div>
          <div className={`text-lg font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}
            <div className="text-sm">
              ({priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        
        {currentData.ema_20 && (
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">EMA 20</div>
            <div className="text-lg font-bold text-blue-400">
              ${currentData.ema_20.toLocaleString()}
            </div>
          </div>
        )}
        
        {currentData.rsi_14 && (
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">RSI (14)</div>
            <div className={`text-lg font-bold ${
              currentData.rsi_14 > 70 ? 'text-red-400' : 
              currentData.rsi_14 < 30 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {currentData.rsi_14.toFixed(2)}
            </div>
          </div>
        )}
        
        {currentData.volume && (
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Volume</div>
            <div className="text-lg font-bold text-purple-400">
              {(currentData.volume / 1000000).toFixed(2)}M
            </div>
          </div>
        )}
      </div>
    </div>
  );
}