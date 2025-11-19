import React, { useMemo, useState, useEffect } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { PlayerPanel } from "./PlayerPanel";
import { solve, getConfig, updateConfig, getAdjacency } from "../api";
import type { CellType, SolveRequest, Weather, Config } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

export const App: React.FC = () => {
  const [mode, setMode] = useState<"controller" | "player">("controller");
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const [instructions, setInstructions] = useState<string>("比赛说明：请参考题目文档。");
  const [config, setConfig] = useState<Config | null>(null);
  const [adjacency, setAdjacency] = useState<Record<number, number[]>>({});
  
  // Controller state
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showSolutionToPlayer, setShowSolutionToPlayer] = useState(false);
  
  // Parameters
  const [params, setParams] = useState({
    deadline: 30,
    initial_cash: 10000,
    weight_limit_kg: 1200,
    move_multiplier: 2.0,
    mine_multiplier: 2.5,
  });

  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);

  // Load config and adjacency on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [configData, adjData] = await Promise.all([getConfig(), getAdjacency()]);
        setConfig(configData);
        setInstructions(configData.instructions);
        setWeather(configData.params_default.weather);
        setParams({
          deadline: configData.params_default.deadline,
          initial_cash: configData.params_default.initial_cash,
          weight_limit_kg: configData.params_default.weight_limit_kg,
          move_multiplier: configData.params_default.move_multiplier,
          mine_multiplier: configData.params_default.mine_multiplier,
        });
        setAdjacency(adjData);
      } catch (err: any) {
        console.error("Failed to load config:", err);
      }
    };
    loadData();
  }, []);

  function setLabel(id:number, next:CellType){ 
    setLabels(prev => ({...prev, [id]: next})); 
  }

  async function onSolve(){
    setBusy(true); setResult(null);
    const req: SolveRequest = {
      deadline: params.deadline,
      initial_cash: params.initial_cash,
      weight_limit_kg: params.weight_limit_kg,
      start_node: 1,
      end_node: 64,
      prices: { water:5, food:10 },
      mass: { water:3, food:2 },
      refund_factor: 0.5,
      base_consumption: { 
        Sunny:{water:5,food:7}, 
        Hot:{water:8,food:6}, 
        Storm:{water:10,food:10} 
      },
      move_multiplier: params.move_multiplier,
      mine_multiplier: params.mine_multiplier,
      allow_storm_mining: true,
      mines,
      villages,
      weather
    };
    try{ 
      const res = await solve(req); 
      setResult(res); 
    }
    catch(err:any){ 
      alert(err.message); 
    }
    finally{ 
      setBusy(false); 
    }
  }

  async function onSaveParameters(){
    try {
      await updateConfig({
        instructions,
        params_default: {
          deadline: params.deadline,
          initial_cash: params.initial_cash,
          weight_limit_kg: params.weight_limit_kg,
          start_node: 1,
          end_node: 64,
          prices: { water:5, food:10 },
          mass: { water:3, food:2 },
          refund_factor: 0.5,
          base_consumption: { 
            Sunny:{water:5,food:7}, 
            Hot:{water:8,food:6}, 
            Storm:{water:10,food:10} 
          },
          move_multiplier: params.move_multiplier,
          mine_multiplier: params.mine_multiplier,
          allow_storm_mining: true,
          weather
        }
      });
      alert("参数已保存!");
    } catch(err: any) {
      alert("保存失败: " + err.message);
    }
  }

  if (mode === "player") {
    return (
      <div style={{padding: 16}}>
        <div className="flex" style={{marginBottom: 16}}>
          <button className="btn" onClick={() => setMode("controller")}>
            切换到控制器视图
          </button>
        </div>
        {config && (
          <PlayerPanel
            params={{
              start_node: 1,
              weather: config.params_default.weather,
              deadline: config.params_default.deadline
            }}
            adjacency={adjacency}
            instructions={config.instructions}
            solution={result}
            showSolution={showSolutionToPlayer}
          />
        )}
      </div>
    );
  }

  // Controller view
  return (
    <div className="app">
      <div className="card">
        <div className="flex" style={{marginBottom: 12}}>
          <button className="btn" onClick={() => setMode("player")}>
            切换到玩家视图
          </button>
        </div>

        <h2>比赛说明编辑</h2>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{width: "100%", minHeight: 80, padding: 8, fontFamily: "inherit"}}
          placeholder="输入比赛说明..."
        />

        <h2 style={{marginTop: 16}}>地图设置</h2>
        <div className="legend">
          <span className="desert">沙漠</span>
          <span className="village">村庄</span>
          <span className="mine">矿山</span>
        </div>
        <HexGrid 
          labels={labels} 
          setLabel={setLabel} 
          path={result?.path ?? []}
          overlays={result ? { path: result.path, daily: result.daily } : undefined}
        />
        <div className="flex" style={{marginTop:8}}>
          <div>当前：村庄 {villages.length} 个；矿山 {mines.length} 个</div>
          <button className="btn" onClick={()=>setLabels({})}>清空标注</button>
        </div>
      </div>

      <div className="card">
        <h2>参数设置</h2>
        <div style={{display: "grid", gap: 8, gridTemplateColumns: "auto 1fr", alignItems: "center"}}>
          <label>截止日期:</label>
          <input type="number" value={params.deadline} onChange={e => setParams({...params, deadline: parseInt(e.target.value) || 30})} style={{padding: 4}} />
          
          <label>初始资金:</label>
          <input type="number" value={params.initial_cash} onChange={e => setParams({...params, initial_cash: parseInt(e.target.value) || 10000})} style={{padding: 4}} />
          
          <label>负重上限(kg):</label>
          <input type="number" value={params.weight_limit_kg} onChange={e => setParams({...params, weight_limit_kg: parseInt(e.target.value) || 1200})} style={{padding: 4}} />
          
          <label>移动消耗倍率:</label>
          <input type="number" step="0.1" value={params.move_multiplier} onChange={e => setParams({...params, move_multiplier: parseFloat(e.target.value) || 2.0})} style={{padding: 4}} />
          
          <label>挖矿消耗倍率:</label>
          <input type="number" step="0.1" value={params.mine_multiplier} onChange={e => setParams({...params, mine_multiplier: parseFloat(e.target.value) || 2.5})} style={{padding: 4}} />
        </div>

        <h2 style={{marginTop: 16}}>天气与求解</h2>
        <WeatherEditor weather={weather} setWeather={setWeather}/>
        
        <div className="flex" style={{marginTop:16}}>
          <button className="btn" onClick={onSaveParameters}>保存参数</button>
          <button className="btn" onClick={onSolve} disabled={busy || mines.length===0}>求解（MILP）</button>
          {mines.length===0 && <span style={{color:"var(--bad)"}}>至少标注1个矿山才可求解</span>}
          {busy && <span>正在求解，请稍候…</span>}
        </div>

        {result && (
          <div style={{marginTop: 16}}>
            <div className="flex">
              <label>
                <input 
                  type="checkbox" 
                  checked={showSolutionToPlayer}
                  onChange={(e) => setShowSolutionToPlayer(e.target.checked)}
                />
                玩家可看最优解
              </label>
            </div>
          </div>
        )}

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
          <div style={{maxHeight: 400, overflow: "auto"}}>
            <pre>{JSON.stringify(result.daily, null, 2)}</pre>
          </div>
        </>)}
      </div>
    </div>
  );
};
