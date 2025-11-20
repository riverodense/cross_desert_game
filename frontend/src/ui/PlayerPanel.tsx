import React, { useState, useMemo, useEffect } from "react";
import type { Weather, SolutionResponse } from "../types";
import { ADJ } from "../data/adjacency";

interface PlayerPanelProps {
  weather: Weather[];
  baseConsumption: Record<Weather, { water: number; food: number }>;
  prices: { water: number; food: number };
  mass: { water: number; food: number };
  moveMultiplier: number;
  mineMultiplier: number;
  initialCash: number;
  weightLimit: number;
  startNode: number;
  endNode: number;
  mines: number[];
  villages: number[];
  solution?: SolutionResponse | null;
}

interface DayAction {
  day: number;
  position: number;
  action: "STAY" | "MOVE" | "MINE";
  moveTo?: number;
  buyW: number;
  buyF: number;
  mine: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  weather,
  baseConsumption,
  prices,
  mass,
  moveMultiplier,
  mineMultiplier,
  initialCash,
  weightLimit,
  startNode,
  endNode,
  mines,
  villages,
  solution
}) => {
  const [startBuyW, setStartBuyW] = useState(0);
  const [startBuyF, setStartBuyF] = useState(0);
  const [actions, setActions] = useState<DayAction[]>([]);

  // Initialize actions based on deadline
  useEffect(() => {
    if (actions.length === 0) {
      const initial: DayAction[] = [];
      for (let d = 1; d <= weather.length; d++) {
        initial.push({
          day: d,
          position: startNode,
          action: "STAY",
          buyW: 0,
          buyF: 0,
          mine: false
        });
      }
      setActions(initial);
    }
  }, [weather.length, startNode, actions.length]);

  const importOptimalSolution = () => {
    if (!solution) return;
    
    // Import start purchases
    setStartBuyW(solution.purchases.start.water);
    setStartBuyF(solution.purchases.start.food);

    // Import daily actions
    const newActions: DayAction[] = [];
    for (let d = 1; d <= weather.length; d++) {
      const daily = solution.daily.find(x => x.day === d);
      if (!daily) {
        newActions.push({
          day: d,
          position: startNode,
          action: "STAY",
          buyW: 0,
          buyF: 0,
          mine: false
        });
        continue;
      }

      // Find village purchases for this day
      const villagePurchase = solution.purchases.villages.find(v => v.day === d);

      newActions.push({
        day: d,
        position: daily.location,
        action: daily.action,
        moveTo: daily.moved_to,
        buyW: villagePurchase?.water || 0,
        buyF: villagePurchase?.food || 0,
        mine: daily.action === "MINE"
      });
    }
    setActions(newActions);
  };

  // Compute daily status with inventory and cash
  const dailyStatus = useMemo(() => {
    const result: Array<{
      day: number;
      position: number;
      action: string;
      invW: number;
      invF: number;
      cash: number;
      weight: number;
      error?: string;
    }> = [];

    // Day 0
    const startCost = startBuyW * prices.water + startBuyF * prices.food;
    const startCash = initialCash - startCost;
    const startWeight = startBuyW * mass.water + startBuyF * mass.food;
    
    if (startCash < 0) {
      result.push({
        day: 0,
        position: startNode,
        action: "购买",
        invW: startBuyW,
        invF: startBuyF,
        cash: startCash,
        weight: startWeight,
        error: "现金不足"
      });
      return result;
    }
    if (startWeight > weightLimit) {
      result.push({
        day: 0,
        position: startNode,
        action: "购买",
        invW: startBuyW,
        invF: startBuyF,
        cash: startCash,
        weight: startWeight,
        error: "超重"
      });
      return result;
    }

    result.push({
      day: 0,
      position: startNode,
      action: "购买",
      invW: startBuyW,
      invF: startBuyF,
      cash: startCash,
      weight: startWeight
    });

    let invW = startBuyW;
    let invF = startBuyF;
    let cash = startCash;
    let currentPos = startNode;

    for (const act of actions) {
      const w = weather[act.day - 1];
      const baseW = baseConsumption[w].water;
      const baseF = baseConsumption[w].food;

      // Validate move
      let error: string | undefined;
      if (act.action === "MOVE") {
        if (w === "Storm") {
          error = "沙暴日禁止移动";
        } else if (!act.moveTo) {
          error = "未指定移动目标";
        } else if (!ADJ[currentPos].includes(act.moveTo)) {
          error = "非法移动：不相邻";
        } else {
          currentPos = act.moveTo;
        }
      } else {
        // Stay at current position or update from path
        if (act.position !== currentPos && act.action !== "MOVE") {
          currentPos = act.position;
        }
      }

      // Calculate consumption using the same formula as solver
      let consW = baseW;
      let consF = baseF;
      
      if (act.action === "MOVE") {
        consW = moveMultiplier * baseW;
        consF = moveMultiplier * baseF;
      } else if (act.action === "MINE" || act.mine) {
        // Mining adds extra consumption on top of base (stay)
        consW = baseW + (mineMultiplier - 1.0) * baseW;
        consF = baseF + (mineMultiplier - 1.0) * baseF;
      }

      // Village purchases (applied before consumption in solver, but let's apply after for display consistency)
      const villageCost = act.buyW * (2 * prices.water) + act.buyF * (2 * prices.food);
      
      // Check if current position is village for purchase validation
      if ((act.buyW > 0 || act.buyF > 0) && !villages.includes(currentPos)) {
        error = error || "只能在村庄购买";
      }

      // Apply consumption first
      invW -= consW;
      invF -= consF;

      // Then add purchases
      invW += act.buyW;
      invF += act.buyF;

      // Update cash: subtract purchase cost, add mining income
      cash -= villageCost;
      if (act.mine && mines.includes(currentPos)) {
        cash += 1000;
      }

      const weight = invW * mass.water + invF * mass.food;

      if (invW < 0 || invF < 0) {
        error = error || "资源不足";
      }
      if (cash < 0) {
        error = error || "现金不足";
      }
      if (weight > weightLimit) {
        error = error || "超重";
      }

      result.push({
        day: act.day,
        position: currentPos,
        action: act.action + (act.mine ? " (挖矿)" : ""),
        invW: Math.round(invW * 10) / 10,
        invF: Math.round(invF * 10) / 10,
        cash: Math.round(cash * 10) / 10,
        weight: Math.round(weight * 10) / 10,
        error
      });
    }

    return result;
  }, [actions, startBuyW, startBuyF, weather, baseConsumption, prices, mass, moveMultiplier, mineMultiplier, initialCash, weightLimit, startNode, villages, mines]);

  const updateAction = (index: number, updates: Partial<DayAction>) => {
    setActions(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  return (
    <div className="card">
      <h2>玩家模拟面板</h2>
      
      {solution && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn" onClick={importOptimalSolution}>
            导入最优解
          </button>
          <span style={{ marginLeft: 8, color: "var(--ok)" }}>
            （控制者已发布最优解）
          </span>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h3>第 0 天初始购买（起点 {startNode}）</h3>
        <label>
          水（箱）：
          <input 
            type="number" 
            value={startBuyW} 
            onChange={e => setStartBuyW(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
        <label style={{ marginLeft: 16 }}>
          食物（箱）：
          <input 
            type="number" 
            value={startBuyF} 
            onChange={e => setStartBuyF(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
      </div>

      <div style={{ overflowX: "auto", maxHeight: 500 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>天</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>天气</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>位置</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>行动</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>移至</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>购水</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>购食</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>挖矿</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>水库存</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>食库存</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>现金￥</th>
              <th style={{ padding: 8, border: "1px solid #ddd" }}>负重kg</th>
            </tr>
          </thead>
          <tbody>
            {dailyStatus.map((status, idx) => (
              <tr 
                key={status.day}
                style={{ 
                  backgroundColor: status.error ? "#ffe0e0" : status.day === 0 ? "#f0f0f0" : undefined 
                }}
              >
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{status.day}</td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day > 0 ? weather[status.day - 1] : "-"}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{status.position}</td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day === 0 ? (
                    status.action
                  ) : (
                    <select 
                      value={actions[idx - 1]?.action || "STAY"}
                      onChange={e => updateAction(idx - 1, { action: e.target.value as any })}
                      style={{ width: "100%" }}
                    >
                      <option value="STAY">STAY</option>
                      <option value="MOVE">MOVE</option>
                      <option value="MINE">MINE</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day === 0 ? "-" : (
                    actions[idx - 1]?.action === "MOVE" ? (
                      <input 
                        type="number"
                        value={actions[idx - 1]?.moveTo || ""}
                        onChange={e => updateAction(idx - 1, { moveTo: parseInt(e.target.value) || undefined })}
                        style={{ width: 60 }}
                        min={1}
                        max={64}
                      />
                    ) : "-"
                  )}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day === 0 ? "-" : (
                    <input 
                      type="number"
                      value={actions[idx - 1]?.buyW || 0}
                      onChange={e => updateAction(idx - 1, { buyW: Math.max(0, parseInt(e.target.value) || 0) })}
                      style={{ width: 50 }}
                      min={0}
                    />
                  )}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day === 0 ? "-" : (
                    <input 
                      type="number"
                      value={actions[idx - 1]?.buyF || 0}
                      onChange={e => updateAction(idx - 1, { buyF: Math.max(0, parseInt(e.target.value) || 0) })}
                      style={{ width: 50 }}
                      min={0}
                    />
                  )}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>
                  {status.day === 0 ? "-" : (
                    <input 
                      type="checkbox"
                      checked={actions[idx - 1]?.mine || false}
                      onChange={e => updateAction(idx - 1, { mine: e.target.checked })}
                    />
                  )}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{status.invW}</td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{status.invF}</td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{status.cash}</td>
                <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{status.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dailyStatus.some(s => s.error) && (
        <div style={{ marginTop: 16, color: "var(--bad)" }}>
          <strong>错误：</strong>
          <ul>
            {dailyStatus.filter(s => s.error).map(s => (
              <li key={s.day}>第 {s.day} 天：{s.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
