import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { useState } from "react";

import ChatInterface from "~/components/ChatInterface";
import CandlestickChart from "~/components/CandlestickChart";
import TechnicalIndicators from "~/components/TechnicalIndicators";
import { 
  getCoinId, 
  getMarketData, 
  applyIndicators, 
  detectTrend, 
  analyzeWithAI,
  type CoinData 
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
  
  if (!symbolMatch) {
    return json<ActionErrorResponse>({ 
      error: "Please specify a cryptocurrency symbol (e.g., 'Analyze BTC' or 'Check ETH')",
      analysis: "❌ No cryptocurrency symbol found in your message. Please try something like 'Analyze BTC' or 'Check ETH trends'."
    });
  }

  const symbol = symbolMatch[1].toUpperCase();

  try {
    const coinId = await getCoinId(symbol);
    const marketData = await getMarketData(coinId);
    const dataWithIndicators = applyIndicators(marketData);
    const trend = detectTrend(dataWithIndicators);
    
    const analysis = await analyzeWithAI(dataWithIndicators, symbol);

    return json<ActionSuccessResponse>({
      symbol,
      data: dataWithIndicators,
      trend,
      analysis,
      success: true
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return json<ActionErrorResponse>({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      analysis: `❌ Sorry, I couldn't analyze ${symbol}. ${error instanceof Error ? error.message : 'Please try again with a valid cryptocurrency symbol.'}`
    });
  }
}

function isSuccessResponse(data: ActionResponse | undefined): data is ActionSuccessResponse {
  return data !== undefined && 'success' in data && data.success === true;
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionResponse | undefined;
  const [showChart, setShowChart] = useState(false);

  const hasData = isSuccessResponse(actionData);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-56">

        </div>

        <div className="mb-8">
          <ChatInterface />
        </div>

        {hasData && (
          <div className="space-y-6 mt-8">
            <div className="text-center">
              <button
                onClick={() => setShowChart(!showChart)}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {showChart ? '📊 Hide Analysis' : '📈 Show Detailed Analysis'}
              </button>
            </div>

            {showChart && (
              <div className="space-y-6">
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30 p-6">
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
          <footer className="mt-56 text-center">
            
          </footer>
        )}
      </div>
    </div>
  );
}