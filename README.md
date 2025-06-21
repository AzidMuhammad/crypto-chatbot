# Crypto AI Analyzer Chatbot

Sebuah chatbot cryptocurrency analyzer yang dibangun dengan Remix.js dan diintegrasikan dengan AI untuk analisis teknikal yang mendalam.

## Fitur Utama

🤖 **AI-Powered Analysis** - Analisis mendalam menggunakan DeepSeek AI
📊 **Technical Indicators** - RSI, EMA, Bollinger Bands, MACD
📈 **Interactive Charts** - Candlestick charts dengan indikator
💬 **Chat Interface** - Interface chatbot yang user-friendly  
🔄 **Real-time Data** - Data cryptocurrency terbaru dari CoinCap API
📱 **Responsive Design** - Optimized untuk desktop dan mobile

## Tech Stack

- **Frontend**: Remix.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Lightweight Charts (TradingView)
- **APIs**: 
  - CoinCap API untuk data cryptocurrency
  - OpenRouter AI API untuk analisis AI
- **Deployment**: Vercel/Netlify ready

## Setup & Installation

### Prerequisites
- Node.js 18+
- npm atau yarn

### Installation Steps

1. **Clone dan Install Dependencies**
```bash
git clone <repository-url>
cd crypto-ai-chatbot
npm install
```

2. **Setup Environment Variables**
Buat file `.env` di root directory:
```env
# CoinCap API Key (opsional, sudah ada default)
COINCAP_API_KEY=your_coincap_api_key

# OpenRouter AI API Key
OPENROUTER_API_KEY=your_openrouter_api_key
```

3. **Install Tailwind Typography Plugin**
```bash
npm install @tailwindcss/typography
```

4. **Run Development Server**
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## Struktur Folder

```
crypto-ai-chatbot/
├── app/
│   ├── components/
│   │   ├── ChatInterface.tsx      # Komponen chat utama
│   │   ├── CandlestickChart.tsx   # Komponen chart
│   │   └── TechnicalIndicators.tsx # Display indikator teknikal
│   ├── routes/
│   │   └── _index.tsx             # Route utama
│   ├── services/
│   │   └── crypto.server.ts       # Service untuk API crypto & AI
│   ├── root.tsx                   # Root component
│   └── tailwind.css              # Tailwind styles
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

## Cara Menggunakan

1. **Start Conversation**: Ketik pesan seperti:
   - "Analyze BTC"
   - "Check ETH trends" 
   - "What about DOGE?"

2. **View Analysis**: AI akan memberikan:
   - Penjelasan trend pasar
   - Sinyal entry/exit
   - Interpretasi indikator teknikal
   - Saran stop-loss/take-profit
   - Prediksi 24-48 jam

3. **View Charts**: Klik tombol "Show Charts & Analysis" untuk melihat:
   - Candlestick chart interaktif
   - Technical indicators dashboard
   - Real-time price data

## API Integration

### CoinCap API
- Mengambil data harga cryptocurrency real-time
- Mendukung 2000+ cryptocurrency
- Rate limit: 1000 requests/minute

### OpenRouter AI API  
- Menggunakan DeepSeek R1 model
- Analisis mendalam data teknikal
- Response dalam format conversational

## Features Detail

### Technical Indicators
- **EMA (Exponential Moving Average)**: Trend following indicator
- **RSI (Relative Strength Index)**: Momentum oscillator (0-100)
- **Bollinger Bands**: Volatility indicator
- **MACD**: Trend dan momentum analysis
- **OBV (On Balance Volume)**: Volume-based indicator

### Chart Features
- Interactive candlestick charts
- Zoom dan pan functionality
- EMA overlay
- Responsive design
- Export chart capabilities

### AI Analysis Features
- Market trend explanation
- Entry/exit opportunities
- Risk management suggestions
- Price predictions
- Market sentiment analysis

## Deployment

### Vercel
```bash
npm run build
# Deploy ke Vercel
```

### Netlify
```bash
npm run build
# Deploy ke Netlify
```

## Customization

### Menambah Cryptocurrency Baru
Edit `suggestedQueries` di `ChatInterface.tsx`:
```typescript
const suggestedQueries = [
  'Analyze BTC',
  'Check ETH trends', 
  'What about NEW_COIN?', // Tambah coin baru
];
```

### Menambah Technical Indicators
Implementasikan di `crypto.server.ts`:
```typescript
export function calculateNewIndicator(data: number[]) {
  // Implementasi indikator baru
}
```

### Styling Customization
Edit `tailwind.config.ts` untuk mengubah tema:
```typescript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
    }
  }
}
```

## Troubleshooting

### API Issues
- Pastikan API key valid
- Check rate limits
- Verify internet connection

### Chart Not Loading
- Pastikan lightweight-charts terinstall
- Check console untuk error
- Verify data format

### AI Analysis Failed
- Check OpenRouter API key
- Verify model availability
- Check request timeout

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch  
5. Create Pull Request

## License

MIT License - feel free to use for personal and commercial projects.

## Disclaimer

⚠️ **PENTING**: Aplikasi ini hanya untuk tujuan edukasi dan penelitian. Bukan nasihat keuangan. Selalu lakukan riset sendiri sebelum trading cryptocurrency.

## Support

Jika ada pertanyaan atau issue, silakan buat GitHub issue atau hubungi developer.

---

**Happy Trading! 🚀📈**