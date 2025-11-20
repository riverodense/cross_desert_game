<<<<<<< HEAD
import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { OptimalSolution, DailyRecord } from "../types";

interface PlayerPanelProps {
  optimalSolution: OptimalSolution | null;
  playerDaily: DailyRecord[];
  onPlayerDailyChange?: (daily: DailyRecord[]) => void;
}

interface DiffData {
  day: number;
  diff_cash: number;
  diff_invW: number;
  diff_invF: number;
  player_mine: boolean;
  optimal_mine: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  optimalSolution,
  playerDaily,
  onPlayerDailyChange
}) => {
  const [showCashChart, setShowCashChart] = useState(true);
  const [showWaterChart, setShowWaterChart] = useState(true);
  const [showFoodChart, setShowFoodChart] = useState(true);

  // Compute differences with debouncing
  const diffData = useMemo(() => {
    if (!optimalSolution || playerDaily.length === 0) return [];

    const minLen = Math.min(playerDaily.length, optimalSolution.daily.length);
    const diffs: DiffData[] = [];

    for (let i = 0; i < minLen; i++) {
      const player = playerDaily[i];
      const optimal = optimalSolution.daily[i];
      
      diffs.push({
        day: player.day,
        diff_cash: player.cash - optimal.cash,
        diff_invW: player.invW - optimal.invW,
        diff_invF: player.invF - optimal.invF,
        player_mine: player.action === "MINE",
        optimal_mine: optimal.action === "MINE"
      });
    }

    return diffs;
  }, [optimalSolution, playerDaily]);

  // Calculate mining statistics
  const miningStats = useMemo(() => {
    const playerMineDays = diffData.filter(d => d.player_mine).length;
    const optimalMineDays = diffData.filter(d => d.optimal_mine).length;
    return {
      playerMineDays,
      optimalMineDays,
      difference: playerMineDays - optimalMineDays
    };
  }, [diffData]);

  // Calculate gap percentage
  const gapPercentage = useMemo(() => {
    if (!optimalSolution || playerDaily.length === 0) return null;
    
    const playerFinalCash = playerDaily[playerDaily.length - 1]?.cash ?? 0;
    const optimalFinalCash = optimalSolution.final_cash;
    
    if (optimalFinalCash === 0) return null;
    
    const gap = ((optimalFinalCash - playerFinalCash) / optimalFinalCash) * 100;
    return gap;
  }, [optimalSolution, playerDaily]);

  // CSV Export
  const handleExportCSV = useCallback(() => {
    if (!optimalSolution || playerDaily.length === 0) return;

    const headers = [
      "day",
      "player_cash",
      "optimal_cash",
      "diff_cash",
      "player_invW",
      "optimal_invW",
      "diff_invW",
      "player_invF",
      "optimal_invF",
      "diff_invF",
      "player_mine",
      "optimal_mine"
    ];

    const rows = diffData.map((d, i) => {
      const player = playerDaily[i];
      const optimal = optimalSolution.daily[i];
      return [
        d.day,
        player.cash,
        optimal.cash,
        d.diff_cash,
        player.invW,
        optimal.invW,
        d.diff_invW,
        player.invF,
        optimal.invF,
        d.diff_invF,
        d.player_mine ? "Y" : "N",
        d.optimal_mine ? "Y" : "N"
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diff_vs_optimal_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [optimalSolution, playerDaily, diffData]);

  // Don't render if no optimal solution
  if (!optimalSolution || playerDaily.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2>玩家对比分析</h2>
      
      {/* Gap Percentage */}
      {gapPercentage !== null && (
        <div className="flex" style={{ marginBottom: 12 }}>
          <strong>最终资金差距:</strong>
          <span style={{ color: gapPercentage > 0 ? "var(--bad)" : "var(--ok)" }}>
            {gapPercentage > 0 ? `落后 ${gapPercentage.toFixed(1)}%` : `超过 ${Math.abs(gapPercentage).toFixed(1)}%`}
          </span>
        </div>
      )}

      {/* Mining Comparison */}
      <div style={{ marginBottom: 16 }}>
        <h3>挖矿对比</h3>
        <div className="flex" style={{ marginBottom: 8 }}>
          <span>玩家挖矿天数: {miningStats.playerMineDays}</span>
          <span>最优挖矿天数: {miningStats.optimalMineDays}</span>
          <span>差异: {miningStats.difference > 0 ? `+${miningStats.difference}` : miningStats.difference}</span>
        </div>
        <div style={{ maxHeight: 200, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.9em", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", position: "sticky", top: 0 }}>
                <th style={{ padding: "4px 8px", border: "1px solid #e0e0e0" }}>日</th>
                <th style={{ padding: "4px 8px", border: "1px solid #e0e0e0" }}>玩家挖矿</th>
                <th style={{ padding: "4px 8px", border: "1px solid #e0e0e0" }}>最优挖矿</th>
                <th style={{ padding: "4px 8px", border: "1px solid #e0e0e0" }}>差异</th>
              </tr>
            </thead>
            <tbody>
              {diffData.map(d => (
                <tr key={d.day}>
                  <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0", textAlign: "center" }}>{d.day}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0", textAlign: "center" }}>
                    {d.player_mine ? "✔" : "✘"}
                  </td>
                  <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0", textAlign: "center" }}>
                    {d.optimal_mine ? "✔" : "✘"}
                  </td>
                  <td style={{ padding: "4px 8px", border: "1px solid #e0e0e0", textAlign: "center" }}>
                    {d.player_mine === d.optimal_mine ? "✔" : "✘"}
                  </td>
                </tr>
              ))}
=======
import React, { useState, useEffect, useMemo } from "react";
import type { Weather, SolveResponse } from "../types";

interface PlayerDecision {
  day: number;
  startNode: number;
  endNode: number;
}

interface PlayerPanelProps {
  params: {
    start_node: number;
    weather: Weather[];
    deadline: number;
  };
  adjacency: Record<number, number[]>;
  instructions: string;
  solution?: SolveResponse | null;
  showSolution: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  params,
  adjacency,
  instructions,
  solution,
  showSolution
}) => {
  const [decisions, setDecisions] = useState<PlayerDecision[]>([]);

  // Initialize decisions with start node
  useEffect(() => {
    const initialDecisions: PlayerDecision[] = [];
    for (let day = 1; day <= params.deadline; day++) {
      const prevEnd = day === 1 ? params.start_node : initialDecisions[day - 2]?.endNode || params.start_node;
      initialDecisions.push({
        day,
        startNode: prevEnd,
        endNode: prevEnd // Default to staying in place
      });
    }
    setDecisions(initialDecisions);
  }, [params.start_node, params.deadline]);

  // Update start nodes when end nodes change
  const updateEndNode = (day: number, newEndNode: number) => {
    setDecisions(prev => {
      const updated = prev.map((d, idx) => {
        if (d.day === day) {
          return { ...d, endNode: newEndNode };
        }
        // Update subsequent start nodes
        if (d.day === day + 1) {
          return { ...d, startNode: newEndNode };
        }
        return d;
      });

      // Cascade updates to subsequent days
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].day > day + 1) {
          updated[i].startNode = updated[i - 1].endNode;
        }
      }

      return updated;
    });
  };

  // Get valid neighbors for a node (including the node itself for staying)
  const getNeighbors = (nodeId: number): number[] => {
    const neighbors = adjacency[nodeId] || [];
    return [nodeId, ...neighbors].sort((a, b) => a - b);
  };

  return (
    <div className="player-panel">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>比赛说明</h2>
        <div style={{ whiteSpace: "pre-wrap" }}>{instructions}</div>
      </div>

      <div className="card">
        <h2>玩家决策表</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle}>Day</th>
                <th style={cellStyle}>天气</th>
                <th style={cellStyle}>起始位置</th>
                <th style={cellStyle}>结束位置</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((decision, idx) => {
                const weather = params.weather[decision.day - 1] || "Sunny";
                const isStorm = weather === "Storm";
                const neighbors = getNeighbors(decision.startNode);

                return (
                  <tr key={decision.day}>
                    <td style={cellStyle}>{decision.day}</td>
                    <td style={cellStyle}>
                      <span className={`badge ${weather.toLowerCase()}`}>
                        {weather}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <input
                        type="number"
                        value={decision.startNode}
                        readOnly
                        style={{ width: 60, padding: 4, background: "#f5f5f5" }}
                      />
                    </td>
                    <td style={cellStyle}>
                      {isStorm ? (
                        <input
                          type="number"
                          value={decision.endNode}
                          readOnly
                          style={{ width: 60, padding: 4, background: "#f5f5f5" }}
                          title="Storm: Cannot move"
                        />
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            value={decision.endNode}
                            onChange={(e) => updateEndNode(decision.day, parseInt(e.target.value))}
                            style={{ padding: 4 }}
                          >
                            {neighbors.map((n) => (
                              <option key={n} value={n}>
                                {n} {n === decision.startNode ? "(stay)" : ""}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={64}
                            value={decision.endNode}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && neighbors.includes(val)) {
                                updateEndNode(decision.day, val);
                              }
                            }}
                            style={{ width: 60, padding: 4 }}
                            title="Manual entry (must be a valid neighbor)"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
>>>>>>> origin/copilot/implement-polish-updates-gameplay
            </tbody>
          </table>
        </div>
      </div>

<<<<<<< HEAD
      {/* Chart Toggles */}
      <div className="flex" style={{ marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showCashChart} onChange={e => setShowCashChart(e.target.checked)} />
          资金差异
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showWaterChart} onChange={e => setShowWaterChart(e.target.checked)} />
          水库存差异
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showFoodChart} onChange={e => setShowFoodChart(e.target.checked)} />
          食物库存差异
        </label>
      </div>

      {/* Difference Charts */}
      <div style={{ marginBottom: 16 }}>
        <h3>每日差异图表 (玩家 - 最优)</h3>
        {showCashChart && (
          <DifferenceChart
            data={diffData.map(d => ({ day: d.day, value: d.diff_cash }))}
            label="资金差异"
            color="#1976d2"
          />
        )}
        {showWaterChart && (
          <DifferenceChart
            data={diffData.map(d => ({ day: d.day, value: d.diff_invW }))}
            label="水库存差异"
            color="#0288d1"
          />
        )}
        {showFoodChart && (
          <DifferenceChart
            data={diffData.map(d => ({ day: d.day, value: d.diff_invF }))}
            label="食物库存差异"
            color="#00796b"
          />
        )}
      </div>

      {/* Export Button */}
      <div className="flex">
        <button className="btn" onClick={handleExportCSV}>
          导出CSV
        </button>
      </div>
=======
      {showSolution && solution && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>最优解决方案</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Day</th>
                  <th style={cellStyle}>天气</th>
                  <th style={cellStyle}>位置</th>
                  <th style={cellStyle}>行动</th>
                  <th style={cellStyle}>水(箱)</th>
                  <th style={cellStyle}>食物(箱)</th>
                  <th style={cellStyle}>现金(元)</th>
                </tr>
              </thead>
              <tbody>
                {solution.daily.map((day) => (
                  <tr key={day.day}>
                    <td style={cellStyle}>{day.day}</td>
                    <td style={cellStyle}>
                      <span className={`badge ${day.weather.toLowerCase()}`}>
                        {day.weather}
                      </span>
                    </td>
                    <td style={cellStyle}>{day.location}</td>
                    <td style={cellStyle}>
                      {day.action === "MOVE" && day.moved_from && day.moved_to
                        ? `移动: ${day.moved_from}→${day.moved_to}`
                        : day.action === "MINE"
                        ? "挖矿"
                        : "停留"}
                    </td>
                    <td style={cellStyle}>{Math.round(day.invW)}</td>
                    <td style={cellStyle}>{Math.round(day.invF)}</td>
                    <td style={cellStyle}>{Math.round(day.cash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>最终资金:</strong> {Math.round(solution.final_cash)} 元
            <br />
            <strong>到达日:</strong> {solution.arrive_day}
          </div>
        </div>
      )}
>>>>>>> origin/copilot/implement-polish-updates-gameplay
    </div>
  );
};

<<<<<<< HEAD
// Simple SVG line chart component
interface DifferenceChartProps {
  data: Array<{ day: number; value: number }>;
  label: string;
  color: string;
}

const DifferenceChart: React.FC<DifferenceChartProps> = ({ data, label, color }) => {
  if (data.length === 0) return null;

  const width = 100; // percentage
  const height = 120;
  const padding = { top: 20, right: 10, bottom: 25, left: 50 };
  const chartWidth = 600 - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;

  const xStep = chartWidth / (data.length - 1 || 1);
  
  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  const zeroY = getY(0);

  // Create path for line
  const pathData = data.map((d, i) => {
    const x = padding.left + i * xStep;
    const y = getY(d.value);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "0.9em", marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <svg width="100%" height={height} viewBox={`0 0 600 ${height}`} style={{ border: "1px solid #e0e0e0" }}>
        {/* Zero line */}
        <line
          x1={padding.left}
          y1={zeroY}
          x2={600 - padding.right}
          y2={zeroY}
          stroke="#999"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {/* Line chart */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />

        {/* Data points colored by positive/negative */}
        {data.map((d, i) => {
          const x = padding.left + i * xStep;
          const y = getY(d.value);
          const pointColor = d.value >= 0 ? "#2e7d32" : "#b71c1c";
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={pointColor}
            />
          );
        })}

        {/* Y-axis labels */}
        <text x={padding.left - 5} y={padding.top} textAnchor="end" fontSize="10" fill="#666">
          {maxVal.toFixed(0)}
        </text>
        <text x={padding.left - 5} y={zeroY} textAnchor="end" fontSize="10" fill="#666">
          0
        </text>
        <text x={padding.left - 5} y={padding.top + chartHeight} textAnchor="end" fontSize="10" fill="#666">
          {minVal.toFixed(0)}
        </text>

        {/* X-axis labels (first, middle, last) */}
        {data.length > 0 && (
          <>
            <text x={padding.left} y={height - 5} textAnchor="middle" fontSize="10" fill="#666">
              Day {data[0].day}
            </text>
            {data.length > 2 && (
              <text x={padding.left + chartWidth / 2} y={height - 5} textAnchor="middle" fontSize="10" fill="#666">
                Day {data[Math.floor(data.length / 2)].day}
              </text>
            )}
            {data.length > 1 && (
              <text x={padding.left + chartWidth} y={height - 5} textAnchor="middle" fontSize="10" fill="#666">
                Day {data[data.length - 1].day}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
=======
const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
  textAlign: "center"
>>>>>>> origin/copilot/implement-polish-updates-gameplay
};
