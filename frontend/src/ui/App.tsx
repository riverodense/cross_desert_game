import React, { useMemo, useState, useEffect } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { PlayerPanel } from "./PlayerPanel";
import { ModelDisplay } from "./ModelDisplay";
import { solve, getConfig, updateConfig, getSolution } from "../api";
import type { CellType, SolveRequest, Weather, SolutionResponse } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

const baseConsumption = { 
  Sunny: {water: 5, food: 7}, 
  Hot: {water: 8, food: 6}, 
  Storm: {water: 10, food: 10} 
};
const prices = { water: 5, food: 10 };
const mass = { water: 3, food: 2 };

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<"controller" | "player">("controller");
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const [showSolutionToPlayers, setShowSolutionToPlayers] = useState(false);
  const [solution, setSolution] = useState<SolutionResponse | null>(null);

  // Load config on mount
  useEffect(() => {
    getConfig()
      .then(cfg => setShowSolutionToPlayers(cfg.show_solution_to_players))
      .catch(err => console.error("Failed to load config:", err));
  }, []);

  // Poll for solution when in player mode and show_solution_to_players is true
  useEffect(() => {
    if (viewMode !== "player") return;
    
    let interval: any;
    const pollSolution = () => {
      getConfig()
        .then(cfg => {
          if (cfg.show_solution_to_players) {
            return getSolution()
              .then(sol => setSolution(sol))
              .catch(err => {
                if (!err.message.includes("403") && !err.message.includes("404")) {
                  console.error("Failed to get solution:", err);
                }
              });
          } else {
            setSolution(null);
          }
        })
        .catch(err => console.error("Failed to poll config:", err));
    };

    // Initial poll
    pollSolution();
    
    // Poll every 5 seconds
    interval = setInterval(pollSolution, 5000);
    
    return () => clearInterval(interval);
  }, [viewMode]);

  function setLabel(id:number, next:CellType){ 
    setLabels(prev => ({...prev, [id]: next})); 
  }

  async function onSolve(){
    setBusy(true); setResult(null);
    const req: SolveRequest = {
      deadline: 30,
      initial_cash: 10000,
      weight_limit_kg: 1200,
      start_node: 1,
      end_node: 64,
      prices,
      mass,
      refund_factor: 0.5,
      base_consumption: baseConsumption,
      move_multiplier: 2.0,
      mine_multiplier: 2.5,
      allow_storm_mining: true,
      mines,
      villages,
      weather
    };
    try{ 
      const res = await solve(req); 
      setResult(res); 
    }
    catch(err:any){ alert(err.message); }
    finally{ setBusy(false); }
  }

  async function toggleSolutionSharing() {
    try {
      const newValue = !showSolutionToPlayers;
      await updateConfig({ show_solution_to_players: newValue });
      setShowSolutionToPlayers(newValue);
    } catch (err: any) {
      alert("Failed to update config: " + err.message);
    }
  }

  // Build solution edges for overlay
  const solutionEdges = useMemo(() => {
    if (viewMode !== "player" || !solution) return [];
    const edges: Array<[number, number]> = [];
    for (let i = 1; i < solution.path.length; i++) {
      edges.push([solution.path[i-1], solution.path[i]]);
    }
    return edges;
  }, [viewMode, solution]);

  return (
    <div className="app">
      {/* View mode toggle */}
      <div className="card">
        <h2>视图模式</h2>
        <div style={{ display: "flex", gap: 16 }}>
          <label>
            <input 
              type="radio" 
              checked={viewMode === "controller"} 
              onChange={() => setViewMode("controller")}
            />
            <span style={{ marginLeft: 4 }}>控制者视图</span>
          </label>
          <label>
            <input 
              type="radio" 
              checked={viewMode === "player"} 
              onChange={() => setViewMode("player")}
            />
            <span style={{ marginLeft: 4 }}>玩家视图</span>
          </label>
        </div>
      </div>

      {/* Controller view */}
      {viewMode === "controller" && (
        <>
          <div className="card">
            <h2>地图设置</h2>
            <div className="legend">
              <span className="desert">沙漠</span>
              <span className="village">村庄</span>
              <span className="mine">矿山</span>
            </div>
            <HexGrid labels={labels} setLabel={setLabel} path={result?.path ?? []} />
            <div className="flex" style={{marginTop:8}}>
              <div>当前：村庄 {villages.length} 个；矿山 {mines.length} 个</div>
              <button className="btn" onClick={()=>setLabels({})}>清空标注</button>
            </div>
          </div>

          <div className="card">
            <h2>天气与求解</h2>
            <WeatherEditor weather={weather} setWeather={setWeather}/>
            <div className="flex" style={{marginTop:8}}>
              <button className="btn" onClick={onSolve} disabled={busy || mines.length===0}>求解（MILP）</button>
              {mines.length===0 && <span style={{color:"var(--bad)"}}>至少标注1个矿山才可求解</span>}
              {busy && <span>正在求解，请稍候…</span>}
            </div>
            {result && (<>
              <h3>结果摘要</h3>
              <pre>{JSON.stringify({
                status: result.status,
                objective: result.objective,
                final_cash: result.final_cash,
                arrive_day: result.arrive_day,
                weight_peak: result.weight_peak
              }, null, 2)}</pre>
              <h3>每日行动</h3>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>天</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>天气</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>位置</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>行动</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>购水</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>购食</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>水库存</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>食库存</th>
                      <th style={{ padding: 8, border: "1px solid #ddd" }}>现金￥</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.daily.map((d: any) => (
                      <tr key={d.day}>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{d.day}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{d.weather}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{d.location}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "center" }}>{d.action}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{d.buyW}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{d.buyF}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{d.invW}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{d.invF}</td>
                        <td style={{ padding: 8, border: "1px solid #ddd", textAlign: "right" }}>{d.cash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>)}
          </div>

          <div className="card">
            <h2>解决方案分享</h2>
            <label>
              <input 
                type="checkbox" 
                checked={showSolutionToPlayers} 
                onChange={toggleSolutionSharing}
              />
              <span style={{ marginLeft: 8 }}>向玩家显示最优解</span>
            </label>
            {showSolutionToPlayers && result && (
              <div style={{ marginTop: 8, color: "var(--ok)" }}>
                ✓ 玩家现在可以查看和导入最优解
              </div>
            )}
          </div>

          <ModelDisplay 
            weather={weather} 
            baseConsumption={baseConsumption}
            prices={prices}
            mass={mass}
          />
        </>
      )}

      {/* Player view */}
      {viewMode === "player" && (
        <>
          <div className="card">
            <h2>地图（只读）</h2>
            <HexGrid 
              labels={labels} 
              setLabel={()=>{}} 
              path={solution?.path ?? []} 
              solutionEdges={solutionEdges}
            />
            {solution && (
              <div style={{ marginTop: 8, color: "var(--ok)" }}>
                ✓ 显示控制者发布的最优路径
              </div>
            )}
          </div>

          <PlayerPanel 
            weather={weather}
            baseConsumption={baseConsumption}
            prices={prices}
            mass={mass}
            moveMultiplier={2.0}
            mineMultiplier={2.5}
            initialCash={10000}
            weightLimit={1200}
            startNode={1}
            endNode={64}
            mines={mines}
            villages={villages}
            solution={solution}
          />

          <ModelDisplay 
            weather={weather} 
            baseConsumption={baseConsumption}
            prices={prices}
            mass={mass}
          />
        </>
      )}
    </div>
  );
};
