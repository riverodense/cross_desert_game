import React, { useMemo, useState } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { solve } from "../api";
import type { CellType, SolveRequest, Weather, SolveResponse } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

export const App: React.FC = () => {
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const [showModel, setShowModel] = useState(false);
  const path = useMemo(()=>[], []);
  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [params, setParams] = useState<SolveRequest | null>(null);

  function setLabel(id:number, next:CellType){ setLabels(prev => ({...prev, [id]: next})); }

  async function onSolve(){
    setBusy(true); setResult(null);
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
    setParams(req);
    try{ const res = await solve(req); setResult(res); }
    catch(err:any){ alert(err.message); }
    finally{ setBusy(false); }
  }

  // Compute solution overlay data when result is optimal
  const solutionPath = result?.status === "Optimal" ? result.path : [];
  const solutionDays = useMemo(() => {
    if (result?.status !== "Optimal") return {};
    const days: Record<number, number> = {};
    result.path.forEach((node, day) => {
      if (!days[node] || days[node] > day) days[node] = day;
    });
    return days;
  }, [result]);

  return (
    <div className="app">
      <div className="card">
        <h2>地图设置</h2>
        <div className="legend">
          <span className="desert">沙漠</span>
          <span className="village">村庄</span>
          <span className="mine">矿山</span>
        </div>
        <HexGrid 
          labels={labels} 
          setLabel={setLabel} 
          path={result?.path ?? []} 
          solutionPath={solutionPath}
          solutionDays={solutionDays}
        />
        <div className="flex" style={{marginTop:8}}>
          <div>当前：村庄 {villages.length} 个；矿山 {mines.length} 个</div>
          <button className="btn" onClick={()=>setLabels({})}>清空标注</button>
        </div>

        {result?.status === "Optimal" && (
          <div style={{marginTop:16}}>
            <h3>最优解路径表</h3>
            <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
              <thead>
                <tr style={{background:"#f5f5f5"}}>
                  <th style={{border:"1px solid #ddd", padding:6}}>日</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>天气</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>位置</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>行动</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>买水(Bottle)</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>买食物(Unit)</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>库存水(Bottle)</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>库存食物(Unit)</th>
                  <th style={{border:"1px solid #ddd", padding:6}}>现金(￥)</th>
                </tr>
              </thead>
              <tbody>
                {/* Day 0 row for start purchases */}
                <tr>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>0</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>-</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>1</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>START</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{result.purchases.start.water}</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{result.purchases.start.food}</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{result.purchases.start.water}</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{result.purchases.start.food}</td>
                  <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{(10000 - result.purchases.start.cost).toFixed(2)}</td>
                </tr>
                {result.daily.map(d => (
                  <tr key={d.day}>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.day}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.weather}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.location}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.action}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.buyW}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.buyF}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.invW}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.invF}</td>
                    <td style={{border:"1px solid #ddd", padding:6, textAlign:"center"}}>{d.cash.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        </>)}

        <div style={{marginTop:16}}>
          <button className="btn" onClick={()=>setShowModel(!showModel)}>
            {showModel ? "隐藏数学模型" : "显示数学模型"}
          </button>
        </div>

        {showModel && params && (
          <div style={{marginTop:8}}>
            <h3>数学模型参数</h3>
            <pre>{JSON.stringify(params, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
