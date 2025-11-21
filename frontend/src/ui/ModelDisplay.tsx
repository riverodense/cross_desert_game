import React, { useEffect, useState } from "react";
import { getLatex } from "../api";
import type { Weather } from "../types";

interface ModelDisplayProps {
  weather: Weather[];
  baseConsumption: Record<Weather, { water: number; food: number }>;
  prices: { water: number; food: number };
  mass: { water: number; food: number };
}

export const ModelDisplay: React.FC<ModelDisplayProps> = ({ 
  weather, 
  baseConsumption, 
  prices, 
  mass 
}) => {
  const [latex, setLatex] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLatex({
      weather: weather,
      base_consumption: baseConsumption,
      prices: prices,
      mass: mass
    })
      .then(res => setLatex(res.latex))
      .catch(err => console.error("Failed to load LaTeX:", err))
      .finally(() => setLoading(false));
  }, [weather, baseConsumption, prices, mass]);

  return (
    <div className="card">
      <h2>MILP 模型公式</h2>
      {loading && <p>加载中...</p>}
      {latex && (
        <div style={{ 
          fontSize: "0.85em", 
          overflowX: "auto", 
          backgroundColor: "#f5f5f5", 
          padding: "12px", 
          borderRadius: "4px",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
          {latex}
        </div>
      )}
    </div>
  );
};
