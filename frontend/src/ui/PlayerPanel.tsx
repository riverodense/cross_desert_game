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
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
};

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
  textAlign: "center"
};
