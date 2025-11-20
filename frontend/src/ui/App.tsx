import React, { useMemo, useState, useEffect } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { AccessControlPanel } from "./AccessControlPanel";
import { solve, getToken, setToken, checkToken, initAccess } from "../api";
import type { CellType, SolveRequest, Weather } from "../types";

const defaultWeather: Weather[] = Array.from({length:30},()=> "Sunny");

type Role = "player" | "controller";

export const App: React.FC = () => {
  // Game state
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const path = useMemo(()=>[], []);
  const mines = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Mine").map(([k])=>+k), [labels]);
  const villages = useMemo(()=>Object.entries(labels).filter(([,t])=>t==="Village").map(([k])=>+k), [labels]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Role and authentication state
  const [role, setRole] = useState<Role>("player");
  const [authorized, setAuthorized] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "solve" | "access">("map");

  // Check URL for role parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    if (roleParam === "controller") {
      setRole("controller");
      // Check if we have a token in localStorage
      const savedToken = getToken();
      if (savedToken) {
        verifyToken(savedToken);
      }
    } else {
      setRole("player");
    }
  }, []);

  const verifyToken = async (token: string) => {
    setCheckingAuth(true);
    setAuthError("");
    try {
      const result = await checkToken(token);
      if (result.authorized) {
        setToken(token);
        setAuthorized(true);
        setTokenInput("");
      } else {
        setAuthorized(false);
        setAuthError("Token is not authorized");
      }
    } catch (err: any) {
      setAuthorized(false);
      setAuthError(err.message);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setAuthError("Please enter a token");
      return;
    }
    await verifyToken(tokenInput.trim());
  };

  const handleGetMasterToken = async () => {
    try {
      const result = await initAccess();
      alert(`Master Token: ${result.master_token}\n\nPlease save this token securely. You will need it to manage access control.`);
      setTokenInput(result.master_token);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleAuthLost = () => {
    setAuthorized(false);
    setAuthError("Authorization lost. Please enter your token again.");
  };

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
    }
    catch(err:any){ 
      alert(err.message);
      if (err.message.includes("403") || err.message.includes("Unauthorized")) {
        handleAuthLost();
      }
    }
    finally{ setBusy(false); }
  }

  // Controller role requires authentication
  if (role === "controller" && !authorized) {
    return (
      <div className="app" style={{maxWidth: 600, margin: "0 auto", padding: 20}}>
        <div className="card">
          <h2>Controller Access Required</h2>
          <p>Please enter your controller token to access the controller interface.</p>
          
          {authError && (
            <div style={{color: "var(--bad)", marginBottom: 16, padding: 8, backgroundColor: "#fee"}}>
              {authError}
            </div>
          )}

          <form onSubmit={handleTokenSubmit}>
            <div style={{marginBottom: 16}}>
              <input
                type="password"
                placeholder="Enter controller token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{width: "100%", padding: 8, fontSize: "1em"}}
                disabled={checkingAuth}
              />
            </div>
            <div className="flex" style={{gap: 8}}>
              <button type="submit" className="btn" disabled={checkingAuth}>
                {checkingAuth ? "Verifying..." : "Access Controller"}
              </button>
              <button type="button" className="btn" onClick={handleGetMasterToken}>
                Show Master Token
              </button>
            </div>
          </form>

          <div style={{marginTop: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 4}}>
            <p style={{fontSize: "0.9em", margin: 0}}>
              <strong>First time setup:</strong> Click "Show Master Token" to see the auto-generated master token. 
              This token has full access to all controller features.
            </p>
          </div>

          <div style={{marginTop: 16}}>
            <a href="?role=player" style={{color: "#0066cc"}}>
              Switch to Player View →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Controller interface (authorized)
  if (role === "controller" && authorized) {
    return (
      <div className="app">
        <div style={{
          backgroundColor: "#e8f5e9",
          padding: "8px 16px",
          marginBottom: 16,
          borderRadius: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{color: "#2e7d32", fontWeight: "bold"}}>
            ✓ Controller Mode - Authorized
          </span>
          <a href="?role=player" style={{color: "#0066cc", textDecoration: "none"}}>
            Switch to Player View
          </a>
        </div>

        <div style={{marginBottom: 16}}>
          <div className="flex" style={{gap: 8}}>
            <button 
              className="btn" 
              onClick={() => setActiveTab("map")}
              style={{backgroundColor: activeTab === "map" ? "#4a90e2" : undefined}}
            >
              地图设置
            </button>
            <button 
              className="btn" 
              onClick={() => setActiveTab("solve")}
              style={{backgroundColor: activeTab === "solve" ? "#4a90e2" : undefined}}
            >
              天气与求解
            </button>
            <button 
              className="btn" 
              onClick={() => setActiveTab("access")}
              style={{backgroundColor: activeTab === "access" ? "#4a90e2" : undefined}}
            >
              访问控制
            </button>
          </div>
        </div>

        {activeTab === "map" && (
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
        )}

        {activeTab === "solve" && (
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
            </>)}
          </div>
        )}

        {activeTab === "access" && (
          <AccessControlPanel onAuthLost={handleAuthLost} />
        )}
      </div>
    );
  }

  // Player interface (no authentication required)
  return (
    <div className="app">
      <div style={{
        backgroundColor: "#f5f5f5",
        padding: "8px 16px",
        marginBottom: 16,
        borderRadius: 4,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span>Player Mode - View Only</span>
        <a href="?role=controller" style={{color: "#0066cc", textDecoration: "none"}}>
          Switch to Controller Mode
        </a>
      </div>

      <div className="card">
        <h2>地图</h2>
        <div className="legend">
          <span className="desert">沙漠</span>
          <span className="village">村庄</span>
          <span className="mine">矿山</span>
        </div>
        <HexGrid labels={labels} setLabel={() => {}} path={result?.path ?? []} />
        <div style={{marginTop:8}}>
          <div>当前：村庄 {villages.length} 个；矿山 {mines.length} 个</div>
        </div>
      </div>

      <div className="card">
        <h2>天气</h2>
        <WeatherEditor weather={weather} setWeather={() => {}}/>
        <p style={{color: "#666", marginTop: 8}}>
          玩家模式只能查看，不能修改。请切换到控制器模式进行编辑。
        </p>
      </div>
    </div>
  );
};
