import React, { useState, useMemo, useCallback, useEffect } from "react";
import { LineChart, DataSeries } from "./LineChart";
import type { SolveResponse, Weather } from "../types";

interface PlayerPanelProps {
  playerSolution: SolveResponse | null;
  optimalSolution: SolveResponse | null;
  weather: Weather[];
}

interface AnalyticsData {
  cashDiff: number[];
  waterDiff: number[];
  foodDiff: number[];
  cumulativeCashDiff: number[];
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  playerSolution,
  optimalSolution,
  weather
}) => {
  const [showCashDiff, setShowCashDiff] = useState(true);
  const [showWaterDiff, setShowWaterDiff] = useState(true);
  const [showFoodDiff, setShowFoodDiff] = useState(true);
  const [showCumulativeCash, setShowCumulativeCash] = useState(false);
  const [debouncedToggles, setDebouncedToggles] = useState({
    cashDiff: true,
    waterDiff: true,
    foodDiff: true,
    cumulativeCash: false
  });

  // Debounce toggle updates to avoid recalculating too frequently
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedToggles({
        cashDiff: showCashDiff,
        waterDiff: showWaterDiff,
        foodDiff: showFoodDiff,
        cumulativeCash: showCumulativeCash
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [showCashDiff, showWaterDiff, showFoodDiff, showCumulativeCash]);

  // Calculate analytics data
  const analyticsData = useMemo<AnalyticsData | null>(() => {
    if (!playerSolution || !optimalSolution) return null;

    const minLength = Math.min(playerSolution.daily.length, optimalSolution.daily.length);
    const cashDiff: number[] = [];
    const waterDiff: number[] = [];
    const foodDiff: number[] = [];
    const cumulativeCashDiff: number[] = [];
    let cumulativeSum = 0;

    for (let i = 0; i < minLength; i++) {
      const pDay = playerSolution.daily[i];
      const oDay = optimalSolution.daily[i];

      const cDiff = pDay.cash - oDay.cash;
      const wDiff = pDay.invW - oDay.invW;
      const fDiff = pDay.invF - oDay.invF;

      cashDiff.push(cDiff);
      waterDiff.push(wDiff);
      foodDiff.push(fDiff);

      cumulativeSum += cDiff;
      cumulativeCashDiff.push(cumulativeSum);
    }

    return { cashDiff, waterDiff, foodDiff, cumulativeCashDiff };
  }, [playerSolution, optimalSolution]);

  // Prepare chart series
  const chartSeries = useMemo<DataSeries[]>(() => {
    if (!analyticsData) return [];

    return [
      {
        name: "现金差",
        color: "#1976d2",
        data: analyticsData.cashDiff,
        style: "solid" as const,
        visible: debouncedToggles.cashDiff
      },
      {
        name: "水差",
        color: "#2e7d32",
        data: analyticsData.waterDiff,
        style: "solid" as const,
        visible: debouncedToggles.waterDiff
      },
      {
        name: "食物差",
        color: "#ef6c00",
        data: analyticsData.foodDiff,
        style: "solid" as const,
        visible: debouncedToggles.foodDiff
      },
      {
        name: "累计现金差",
        color: "#6a1b9a",
        data: analyticsData.cumulativeCashDiff,
        style: "dashed" as const,
        visible: debouncedToggles.cumulativeCash
      }
    ];
  }, [analyticsData, debouncedToggles]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (!playerSolution || !optimalSolution || !analyticsData) return;

    const minLength = Math.min(playerSolution.daily.length, optimalSolution.daily.length);
    const lines: string[] = [];

    // Add metadata as first line
    const timestamp = new Date().toISOString();
    lines.push(`# optimal_generated_at=${timestamp}`);

    // Add header
    lines.push([
      "day",
      "weather",
      "player_location",
      "optimal_location",
      "player_action",
      "optimal_action",
      "player_cash",
      "optimal_cash",
      "diff_cash",
      "cumulative_diff_cash",
      "player_invW",
      "optimal_invW",
      "diff_invW",
      "player_invF",
      "optimal_invF",
      "diff_invF",
      "player_mine",
      "optimal_mine"
    ].join(","));

    // Add data rows
    for (let i = 0; i < minLength; i++) {
      const pDay = playerSolution.daily[i];
      const oDay = optimalSolution.daily[i];

      lines.push([
        pDay.day,
        pDay.weather,
        pDay.location,
        oDay.location,
        pDay.action,
        oDay.action,
        pDay.cash.toFixed(2),
        oDay.cash.toFixed(2),
        analyticsData.cashDiff[i].toFixed(2),
        analyticsData.cumulativeCashDiff[i].toFixed(2),
        pDay.invW,
        oDay.invW,
        analyticsData.waterDiff[i],
        pDay.invF,
        oDay.invF,
        analyticsData.foodDiff[i],
        pDay.action === "MINE" ? "1" : "0",
        oDay.action === "MINE" ? "1" : "0"
      ].join(","));
    }

    // Create download
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics_${timestamp.slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [playerSolution, optimalSolution, analyticsData]);

  // Mining comparison
  const miningComparison = useMemo(() => {
    if (!playerSolution || !optimalSolution) return null;

    const playerMiningDays = playerSolution.daily.filter(d => d.action === "MINE").length;
    const optimalMiningDays = optimalSolution.daily.filter(d => d.action === "MINE").length;

    return {
      playerMiningDays,
      optimalMiningDays,
      difference: playerMiningDays - optimalMiningDays
    };
  }, [playerSolution, optimalSolution]);

  // Don't show panel if no optimal solution
  if (!optimalSolution) return null;

  return (
    <div className="card" style={{ marginTop: "16px" }}>
      <h2>高级分析 (Advanced Analytics)</h2>

      {!playerSolution && (
        <p style={{ color: "#666" }}>请先输入玩家方案以查看对比分析。</p>
      )}

      {playerSolution && analyticsData && (
        <>
          {/* Toggle controls */}
          <div className="flex" style={{ marginBottom: "12px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showCashDiff}
                onChange={(e) => setShowCashDiff(e.target.checked)}
              />
              <span style={{ color: "#1976d2" }}>●</span>
              <span>现金差</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showWaterDiff}
                onChange={(e) => setShowWaterDiff(e.target.checked)}
              />
              <span style={{ color: "#2e7d32" }}>●</span>
              <span>水差</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showFoodDiff}
                onChange={(e) => setShowFoodDiff(e.target.checked)}
              />
              <span style={{ color: "#ef6c00" }}>●</span>
              <span>食物差</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showCumulativeCash}
                onChange={(e) => setShowCumulativeCash(e.target.checked)}
              />
              <span style={{ color: "#6a1b9a" }}>━━</span>
              <span>累计现金差</span>
            </label>
          </div>

          {/* Chart */}
          <div style={{ marginBottom: "16px" }}>
            <LineChart series={chartSeries} width={700} height={300} />
          </div>

          {/* Legend */}
          <div style={{ marginBottom: "12px", fontSize: "12px", color: "#666" }}>
            <div><span style={{ color: "#1976d2" }}>━━</span> 实线: 每日差值 (player - optimal)</div>
            <div><span style={{ color: "#6a1b9a" }}>━━</span> 虚线: 累计差值</div>
            <div>提示: 悬停查看详细数值 (移动端: 点击固定)</div>
          </div>

          {/* Mining comparison */}
          {miningComparison && (
            <div style={{ marginBottom: "12px", padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>挖矿对比</h4>
              <div>玩家挖矿天数: {miningComparison.playerMiningDays}</div>
              <div>最优挖矿天数: {miningComparison.optimalMiningDays}</div>
              <div style={{ 
                color: miningComparison.difference > 0 ? "var(--ok)" : miningComparison.difference < 0 ? "var(--bad)" : "#666"
              }}>
                差异: {miningComparison.difference > 0 ? "+" : ""}{miningComparison.difference} 天
              </div>
            </div>
          )}

          {/* Export button */}
          <button 
            className="btn" 
            onClick={handleExportCSV}
            aria-label="导出CSV分析数据"
          >
            📊 导出CSV分析
          </button>
        </>
      )}
    </div>
  );
};
