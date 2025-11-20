import React, { useMemo, useState } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { AccessControlPanel } from "./AccessControlPanel";
import { PlayerPanel } from "./PlayerPanel";
import { solve, initAccess, setToken, getToken } from "../api";
import type { CellType, SolveRequest, Weather } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

export const App: React.FC = () => {
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const path = useMemo(()=>[], []);
  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"map" | "controller" | "player">("map");
  const [hasToken, setHasToken] = useState(!!getToken());

  React.useEffect(() => {
    // Check if user has a token, if not, prompt for master token setup
    if (!getToken()) {
      initAccess().then(data => {
        const masterToken = data.master_token;
        if (masterToken && confirm(`New master token generated. Would you like to use it as controller?\n\nToken: ${masterToken}\n\nClick OK to save it.`)) {
          setToken(masterToken);
          setHasToken(true);
        }
      }).catch(err => {
        console.error("Failed to init access:", err);
      });
    }
  }, []);

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
    try{ const res = await solve(req); setResult(res); }
    catch(err:any){ alert(err.message); }
    finally{ setBusy(false); }
  }

  return (
    <div className="app">
      <div style={{ marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button
          onClick={() => setActiveTab("map")}
          style={{
            padding: "10px 20px",
            background: activeTab === "map" ? "#007bff" : "#f0f0f0",
            color: activeTab === "map" ? "white" : "black",
            border: "none",
            cursor: "pointer"
          }}
        >
          地图设置 / Map Setup
        </button>
        <button
          onClick={() => setActiveTab("controller")}
          style={{
            padding: "10px 20px",
            background: activeTab === "controller" ? "#007bff" : "#f0f0f0",
            color: activeTab === "controller" ? "white" : "black",
            border: "none",
            cursor: "pointer"
          }}
        >
          控制器管理 / Controller
        </button>
        <button
          onClick={() => setActiveTab("player")}
          style={{
            padding: "10px 20px",
            background: activeTab === "player" ? "#007bff" : "#f0f0f0",
            color: activeTab === "player" ? "white" : "black",
            border: "none",
            cursor: "pointer"
          }}
        >
          玩家视图 / Player View
        </button>
      </div>

      {activeTab === "map" && (
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
            {!hasToken && (
              <div style={{ padding: "10px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "5px", marginBottom: "10px" }}>
                ⚠️ 需要控制器令牌才能求解。请前往"控制器管理"标签页设置令牌。
              </div>
            )}
            <WeatherEditor weather={weather} setWeather={setWeather}/>
            <div className="flex" style={{marginTop:8}}>
              <button className="btn" onClick={onSolve} disabled={busy || mines.length===0 || !hasToken}>求解（MILP）</button>
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
                weight_peak: result.weight_peak,
                generated_at: result.generated_at
              }, null, 2)}</pre>
              <h3>每日行动</h3>
              <pre>{JSON.stringify(result.daily, null, 2)}</pre>
            </>)}
          </div>
        </>
      )}

      {activeTab === "controller" && (
        <div className="card">
          <h2>Controller Access Management</h2>
          <p>Manage controller tokens and access control settings.</p>
          <AccessControlPanel />
        </div>
      )}

      {activeTab === "player" && (
        <div className="card">
          <h2>Player View</h2>
          <p>View optimal solution and compare with player performance.</p>
          <PlayerPanel playerSolution={result?.daily} />
        </div>
      )}
    </div>
  );
};
