import React, { useMemo, useState } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { PlayerPanel } from "./PlayerPanel";
import { solve } from "../api";
import type { CellType, SolveRequest, Weather, SolveResponse, OptimalSolution } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

export const App: React.FC = () => {
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const path = useMemo(()=>[], []);
  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [optimalSolution, setOptimalSolution] = useState<OptimalSolution | null>(null);
  const [playerSolution, setPlayerSolution] = useState<SolveResponse | null>(null);

  function setLabel(id:number, next:CellType){ setLabels(prev => ({...prev, [id]: next})); }

  async function onSolve(){
    setBusy(true); setResult(null); setOptimalSolution(null);
    const req: SolveRequest = {
      deadline: 30,
      initial_cash: 10000,
      weight_limit_kg: 1200,
      start_node: 1,
      end_node: 64,
      prices: { water:5, food:10 },
      mass: { water:3, food:2 },
      refund_factor: 0.5,
      base_consumption: { Sunny:{water:5,food:7}, Hot:{water:8,food:6}, Storm:{water:10,food:10} },
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
      // Store as optimal solution for comparison
      setOptimalSolution({
        daily: res.daily,
        purchases: res.purchases,
        path: res.path,
        final_cash: res.final_cash,
        generated_at: Date.now()
      });
    }
    catch(err:any){ alert(err.message); }
    finally{ setBusy(false); }
  }

  return (
    <div className="app">
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
          <pre>{JSON.stringify(result.daily, null, 2)}</pre>
          <div className="flex" style={{marginTop:8}}>
            <button className="btn" onClick={() => {
              // Simulate a player solution with slightly different values for demo
              const mockPlayer: SolveResponse = {
                ...result,
                daily: result.daily.map(d => ({
                  ...d,
                  cash: d.cash * 0.95,
                  invW: Math.max(0, d.invW - 2),
                  invF: Math.max(0, d.invF - 1)
                }))
              };
              setPlayerSolution(mockPlayer);
            }}>生成模拟玩家方案</button>
          </div>
        </>)}
      </div>

      {/* Player Panel - shows when optimal solution is available */}
      {optimalSolution && result && (
        <PlayerPanel
          optimalSolution={optimalSolution}
          playerDaily={result.daily}
          playerSolution={playerSolution}
          weather={weather}
        />
      )}
    </div>
  );
};
