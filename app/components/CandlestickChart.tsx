import { useEffect, useRef, useState } from 'react';

interface CandlestickData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ema_20: number;
}

interface CandlestickChartProps {
  data: CandlestickData[];
  symbol: string;
}

// Generate sample Bitcoin data for demonstration
const generateSampleData = (): CandlestickData[] => {
  const data: CandlestickData[] = [];
  const basePrice = 101613.70;
  let currentPrice = basePrice;
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Random price movement
    const volatility = 0.03;
    const change = (Math.random() - 0.5) * volatility;
    currentPrice = currentPrice * (1 + change);
    
    const open = currentPrice;
    const high = open * (1 + Math.random() * 0.02);
    const low = open * (1 - Math.random() * 0.02);
    const close = low + Math.random() * (high - low);
    const ema_20 = close * 1.02; // Slightly above close for EMA
    
    data.push({
      timestamp: date.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      ema_20: Number(ema_20.toFixed(2))
    });
    
    currentPrice = close;
  }
  
  return data;
};

export default function CandlestickChart({ data = generateSampleData(), symbol = "BTC" }: CandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 60, bottom: 40, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate price range
    const prices = data.flatMap(d => [d.open, d.high, d.low, d.close, d.ema_20]);
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;

    // Helper functions
    const priceToY = (price: number) => padding.top + (maxPrice - price) / priceRange * chartHeight;
    const indexToX = (index: number) => padding.left + (index + 0.5) * (chartWidth / data.length);

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i / 5);
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Price labels
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, width - padding.right + 5, y + 4);
    }

    // Draw EMA line first (behind candles)
    ctx.strokeStyle = '#60A5FA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = indexToX(i);
      const y = priceToY(d.ema_20);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw candlesticks
    const candleWidth = Math.max(8, chartWidth / data.length * 0.6);
    
    data.forEach((d, i) => {
      const x = indexToX(i);
      const openY = priceToY(d.open);
      const highY = priceToY(d.high);
      const lowY = priceToY(d.low);
      const closeY = priceToY(d.close);
      
      const isUp = d.close > d.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      
      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = color;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY);
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, Math.max(bodyHeight, 1));
      
      // Highlight hovered candle
      if (hoveredIndex === i) {
        ctx.strokeStyle = '#F3F4F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, Math.max(bodyHeight, 1));
      }
    });

    // Draw dates
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (i % Math.ceil(data.length / 4) === 0) {
        const x = indexToX(i);
        const date = new Date(d.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(dateStr, x, height - 10);
      }
    });

  }, [data, hoveredIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const padding = { top: 20, right: 60, bottom: 40, left: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    
    if (x > padding.left && x < rect.width - padding.right && y > padding.top && y < rect.height - padding.bottom) {
      const index = Math.floor((x - padding.left) / (chartWidth / data.length));
      setHoveredIndex(Math.max(0, Math.min(index, data.length - 1)));
    } else {
      setHoveredIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const currentData = hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
      <h3 className="text-xl font-bold mb-6 text-center text-gray-300">
        {symbol.toUpperCase()} Price Chart (7 Days)
      </h3>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-96 border border-gray-700/50 rounded cursor-crosshair bg-gray-900/20"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ height: '400px' }}
        />
        
        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div 
            className="absolute bg-gray-900/95 backdrop-blur-sm text-gray-200 p-3 rounded-lg shadow-xl border border-gray-700/50 pointer-events-none z-10 text-sm"
            style={{
              left: mousePos.x + 10,
              top: mousePos.y - 100,
              transform: 'translate(-50%, 0)'
            }}
          >
            <div className="font-semibold text-white">{new Date(currentData.timestamp).toLocaleDateString()}</div>
            <div>Open: <span className="text-gray-300">${currentData.open.toLocaleString()}</span></div>
            <div>High: <span className="text-green-400">${currentData.high.toLocaleString()}</span></div>
            <div>Low: <span className="text-red-400">${currentData.low.toLocaleString()}</span></div>
            <div>Close: <span className="text-gray-300">${currentData.close.toLocaleString()}</span></div>
            <div>EMA 20: <span className="text-blue-400">${currentData.ema_20.toLocaleString()}</span></div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex justify-center items-center space-x-6 text-sm text-gray-400">
        <div className="flex items-center">
          <div className="w-4 h-3 bg-blue-500 mr-2 rounded"></div>
          <span>EMA 20</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-3 bg-green-500 mr-2 rounded"></div>
          <span>Price Up</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-3 bg-red-500 mr-2 rounded"></div>
          <span>Price Down</span>
        </div>
      </div>

      {/* Current Price Info */}
      <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-gray-900/30 rounded-lg border border-gray-700/30">
        <div className="text-center">
          <div className="text-sm text-gray-400">Current Price</div>
          <div className="text-lg font-bold text-blue-400">
            ${currentData.close.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-400">24h Change</div>
          <div className={`text-lg font-bold ${data.length > 1 && currentData.close > data[data.length - 2].close ? 'text-green-400' : 'text-red-400'}`}>
            {data.length > 1 ? 
              `${((currentData.close - data[data.length - 2].close) / data[data.length - 2].close * 100).toFixed(2)}%` : 
              '0.00%'
            }
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-400">EMA 20</div>
          <div className="text-lg font-bold text-purple-400">
            ${currentData.ema_20.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}