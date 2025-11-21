import React, { useEffect, useMemo, useState, useCallback } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { PlayerPanel } from "./PlayerPanel";
import { ModelDisplay } from "./ModelDisplay";
import { BaseConsumptionEditor } from "./BaseConsumptionEditor";
import { AccessControlPanel } from "./AccessControlPanel";
import type { CellType, Weather, SolveRequest } from "../types";
import {
  solve,
  getAdjacency,
  getConfig,
  updateConfig,
  fetchLeaderboard,
  startTimer,
  pauseTimer,
  resetTimer,
  controllerCheck
} from "../api";

declare global {
  interface Window {
    __ADJ?: Record<number, number[]>;
  }
}

const MODES: CellType[] = ["Desert", "Village", "Mine"];
const clickSound = new Audio("data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdQAAACAgICAf39/f4CAgH9/f39/gICAf39/f4CAgH9/f39/gICA");

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { primaryColor?: string }) {
  const { primaryColor = "#1976d2", style, onClick, children, disabled, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={(e) => {
        if (!disabled) {
          try { clickSound.currentTime = 0; clickSound.play().catch(() => {}); } catch {}
          onClick && onClick(e);
        }
      }}
      style={{
        padding: "8px 16px",
        border: "none",
        borderRadius: 8,
        background: disabled ? "#9e9e9e" : primaryColor,
        color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
        transition: "transform .12s, box-shadow .2s",
        ...style
      }}
      onMouseDown={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)"; } }}
      onMouseUp={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; } }}
      onMouseLeave={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; } }}
    >
      {children}
    </button>
  );
}

function getControllerToken(): string | null { try { return localStorage.getItem("controller_token"); } catch { return null; } }
function setControllerToken(tok: string | null) { try { if (!tok) localStorage.removeItem("controller_token"); else localStorage.setItem("controller_token", tok); } catch {} }

export const App: React.FC = () => {
  const [role, setRole] = useState<"controller" | "player">("controller");
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [currentMode, setCurrentMode] = useState<CellType>("Village");
  const [weather, setWeather] = useState<Weather[]>(Array.from({ length: 30 }, () => "Sunny"));
  const [params, setParams] = useState<SolveRequest>({
    deadline: 30, initial_cash: 10000, weight_limit_kg: 1200,
    start_node: 1, end_node: 64,
    prices: { water: 5, food: 10 }, mass: { water: 3, food: 2 },
    refund_factor: 0.5, base_income: 1000,
    base_consumption: { Sunny:{water:5,food:7}, Hot:{water:8,food:6}, Storm:{water:10,food:10} },
    move_multiplier: 2.0, mine_multiplier: 3.0, allow_storm_mining: true,
    mines: [], villages: [], weather: Array.from({ length: 30 }, () => "Sunny")
  });
  const [instructions, setInstructions] = useState("");
  const [reveal, setReveal] = useState(false);
  const [showModelToPlayers, setShowModelToPlayers] = useState(false);
  const [showSolutionToPlayers, setShowSolutionToPlayers] = useState(false);
  const [timerInput, setTimerInput] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"controller" | "player" | "model">("controller");

  // Controller access
  const [controllerAuthorized, setControllerAuthorized] = useState<boolean>(false);
  const [controllerIsMaster, setControllerIsMaster] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>("");

  useEffect(() => {
    const urlRole = new URLSearchParams(window.location.search).get("role");
    if (urlRole === "player") { setRole("player"); setActiveTab("player"); } else { setRole("controller"); }
    (async () => {
      const adj = await getAdjacency();
      window.__ADJ = adj.adjacency || {};
      await loadConfigFromServer();
      refreshLeaderboard();
    })();

    // Check controller token
    if (urlRole !== "player") {
      const tok = getControllerToken();
      if (tok) {
        controllerCheck().then(res => {
          setControllerAuthorized(!!res.authorized);
          setControllerIsMaster(!!res.master);
          if (!res.authorized) setTokenInput(tok);
        }).catch(() => setControllerAuthorized(false));
      }
    }
  }, []);

  async function loadConfigFromServer() {
    const cfg = await getConfig();
    setInstructions(cfg.instructions || "");
    setReveal(!!cfg.reveal_leaderboard);
    setShowModelToPlayers(!!cfg.show_model_to_players);
    setShowSolutionToPlayers(!!cfg.show_solution_to_players);
    if (cfg.labels) setLabels(cfg.labels);
    if (cfg.params_default) {
      const pd = cfg.params_default;
      const wArr: Weather[] = Array.isArray(pd.weather) && pd.weather.length
        ? (pd.weather as Weather[])
        : Array.from({ length: pd.deadline || params.deadline }, () => "Sunny");
      setWeather(wArr);
      setParams(p => ({
        ...p, ...pd,
        base_income: pd.base_income ?? p.base_income,
        base_consumption: pd.base_consumption ?? p.base_consumption,
        mines: Object.entries(cfg.labels || {}).filter(([, t]) => t === "Mine").map(([id]) => +id),
        villages: Object.entries(cfg.labels || {}).filter(([, t]) => t === "Village").map(([id]) => +id),
        weather: wArr
      }));
    }
    setRemainingSeconds(cfg.remaining_seconds || 0);
  }

  function refreshLeaderboard() {
    fetchLeaderboard().then(r => setLeaderboard(r.leaderboard || []));
  }

  const mines = useMemo(() => Object.entries(labels).filter(([, t]) => t === "Mine").map(([id]) => +id), [labels]);
  const villages = useMemo(() => Object.entries(labels).filter(([, t]) => t === "Village").map(([id]) => +id), [labels]);
  useEffect(() => { setParams(prev => ({ ...prev, mines, villages, weather })); }, [mines, villages, weather]);

  const setLabel = useCallback((id: number, next: CellType) => { setLabels(prev => ({ ...prev, [id]: next })); }, []);
  const clearLabels = useCallback(() => { setLabels({}); setResult(null); setErrorMsg(null); }, []);

  function randomWeatherArray(n: number): Weather[] {
    const pool: Weather[] = ["Sunny", "Hot", "Storm"]; const probs = [0.6, 0.25, 0.15]; const arr: Weather[] = [];
    for (let i = 0; i < n; i++) { const r = Math.random(); let acc = 0; for (let k = 0; k < pool.length; k++) { acc += probs[k]; if (r <= acc) { arr.push(pool[k]); break; } } }
    return arr;
  }

  async function onSolve() {
    setBusy(true); setErrorMsg(null); setResult(null);
    try {
      const res = await solve(params);
      setResult(res);
      if (res.status !== "Optimal") setErrorMsg(`求解状态：${res.status}。可能不可行或被中止。`);
    } catch (e: any) { setErrorMsg(`调用后端失败：${e?.message || e}`); }
    finally { setBusy(false); }
  }

  async function publishMap() { await updateConfig({ labels }); await loadConfigFromServer(); }
  async function publishParams() {
    await updateConfig({
      params_default: {
        deadline: params.deadline, initial_cash: params.initial_cash, weight_limit_kg: params.weight_limit_kg,
        start_node: params.start_node, end_node: params.end_node,
        prices: params.prices, mass: params.mass, refund_factor: params.refund_factor,
        base_income: params.base_income, base_consumption: params.base_consumption,
        move_multiplier: params.move_multiplier, mine_multiplier: params.mine_multiplier,
        allow_storm_mining: params.allow_storm_mining, weather: weather
      }
    });
    await loadConfigFromServer();
  }
  async function publishInstructions() { await updateConfig({ instructions }); await loadConfigFromServer(); }
  async function publishVisibility() { await updateConfig({ reveal_leaderboard: reveal, show_model_to_players: showModelToPlayers, show_solution_to_players: showSolutionToPlayers }); await loadConfigFromServer(); }

  async function handleStartTimer() { if (timerInput <= 0) return; await startTimer(timerInput); await loadConfigFromServer(); }
  async function handlePauseTimer() { await pauseTimer(); await loadConfigFromServer(); }
  async function handleResetTimer() { await resetTimer(timerInput); await loadConfigFromServer(); }

  const mm = Math.floor(remainingSeconds / 60);
  const ss = remainingSeconds % 60;
  const timeStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  function controllerLoginPanel() {
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16 }}>
        <h2>控制面板访问</h2>
        <p>请输入控制令牌（由主持人分发）。</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Controller Token"
                 style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8, minWidth: 260 }} />
          <Button onClick={async () => {
            if (!tokenInput || tokenInput.length < 6) { alert("请输入有效的控制令牌（至少6位）。"); return; }
            setControllerToken(tokenInput);
            try { const res = await controllerCheck(); setControllerAuthorized(!!res.authorized); setControllerIsMaster(!!res.master); if (!res.authorized) alert("令牌无效或已锁定。"); }
            catch { alert("校验失败，请稍后重试。"); }
          }}>登录</Button>
        </div>
      </div>
    );
  }

  function renderOptimalOverlays() {
    const solutionDayList: Record<number, number[]> = {};
    if (result?.daily?.length) {
      for (const d of result.daily) {
        const loc = d.location; if (!loc) continue;
        if (!solutionDayList[loc]) solutionDayList[loc] = [];
        solutionDayList[loc].push(d.day);
      }
    }
    return { solutionDayList, solutionPath: result?.path || [] };
  }

  function renderSolutionTable() {
    if (!result || result.status !== "Optimal") return null;
    const startBuyW = result?.purchases?.start?.water || 0;
    const startBuyF = result?.purchases?.start?.food || 0;
    const startCost = result?.purchases?.start?.cost || 0;
    const cash0 = params.initial_cash - startCost;
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>最优解每日决策（主持人已允许查看）</h3>
        <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#eee" }}>
                <th>日</th><th>天气</th><th>位置</th><th>行动</th>
                <th>买水(Bottle)</th><th>买食物(Unit)</th>
                <th>库存水(Bottle)</th><th>库存食物(Unit)</th><th>现金(￥)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdRow}>0</td><td style={tdRow}>-</td><td style={tdRow}>{params.start_node}</td><td style={tdRow}>START_BUY</td>
                <td style={tdRow}>{startBuyW}</td><td style={tdRow}>{startBuyF}</td>
                <td style={tdRow}>{startBuyW}</td><td style={tdRow}>{startBuyF}</td><td style={tdRow}>￥{cash0}</td>
              </tr>
              {result.daily.map((d: any) => (
                <tr key={d.day}>
                  <td style={tdRow}>{d.day}</td><td style={tdRow}>{d.weather}</td><td style={tdRow}>{d.location}</td><td style={tdRow}>{d.action}</td>
                  <td style={tdRow}>{d.buyW}</td><td style={tdRow}>{d.buyF}</td>
                  <td style={tdRow}>{Number(d.invW).toFixed(2)}</td><td style={tdRow}>{Number(d.invF).toFixed(2)}</td>
                  <td style={tdRow}>￥{Number(d.cash).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderController() {
    const { solutionDayList, solutionPath } = renderOptimalOverlays();
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 430px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 12 }}>
            <h2 style={{ margin: "0 0 12px" }}>地图设置 (控制面板)</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              {MODES.map(m => {
                const active = m === currentMode;
                return (
                  <Button key={m} onClick={() => setCurrentMode(m)} primaryColor={active ? "#1976d2" : "#90a4ae"}>
                    {m === "Desert" ? "沙漠" : m === "Village" ? "村庄" : "矿山"}
                  </Button>
                );
              })}
              <Button onClick={clearLabels} primaryColor="#455a64">清空标注</Button>
              <Button onClick={publishMap} primaryColor="#2e7d32">发布地图到玩家</Button>
            </div>
            <HexGrid
              labels={labels}
              setLabel={setLabel}
              currentMode={currentMode}
              title="地图设置（含最优路径叠加）"
              interactive
              solutionDayList={result?.status === "Optimal" ? solutionDayList : {}}
              showSolutionEdges={result?.status === "Optimal"}
              solutionPath={result?.status === "Optimal" ? solutionPath : []}
            />
            <div style={{ marginTop: 8, fontSize: 14 }}>
              当前：村庄 {villages.length} 个；矿山 {mines.length} 个；模式：{currentMode}
            </div>
          </div>

          {result?.status === "Optimal" && renderSolutionTable()}

          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>排行榜 / 可见性</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={reveal} onChange={e => setReveal(e.target.checked)} /> 揭榜
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={showModelToPlayers} onChange={e => setShowModelToPlayers(e.target.checked)} /> 玩家可看模型
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={showSolutionToPlayers} onChange={e => setShowSolutionToPlayers(e.target.checked)} /> 玩家可看最优解
              </label>
              <Button onClick={publishVisibility}>保存可见性</Button>
              <Button onClick={refreshLeaderboard} primaryColor="#607d8b">刷新排行榜</Button>
            </div>
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ background: "#eee" }}>
                    <th>排名</th><th>昵称</th><th>得分(￥)</th><th>最终现金(￥)</th><th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((e: any, i: number) => (
                    <tr key={e.id}>
                      <td style={lbCell}>{i + 1}</td>
                      <td style={lbCell}>{e.nickname}</td>
                      <td style={lbCell}>￥{e.score}</td>
                      <td style={lbCell}>￥{e.final_cash}</td>
                      <td style={lbCell}>{e.submitted_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 12 }}>
            <ModelDisplay
              key={`model-${params.deadline}-${params.start_node}-${params.end_node}-${params.move_multiplier}-${params.mine_multiplier}-${params.base_income}-${params.prices.water}-${params.prices.food}-${params.mass.water}-${params.mass.food}-${params.weight_limit_kg}-${params.refund_factor}-${params.allow_storm_mining}-${JSON.stringify(params.base_consumption)}-${(params.weather || []).join(",")}`}
              params={params}
              role="controller"
              show={true}
              playersCanSee={showModelToPlayers}
            />
          </div>

          {/* Access control panel (only visible to controller) */}
          <AccessControlPanel />
        </div>

        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 12 }}>
          <h2 style={{ margin: "0 0 12px" }}>参数 / 天气 / 说明 / 求解 / 倒计时</h2>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Button onClick={() => setWeather(randomWeatherArray(params.deadline))}>随机生成天气</Button>
          </div>
          <WeatherEditor weather={weather} setWeather={setWeather} />

          <h3 style={{ margin: "16px 0 6px" }}>比赛说明</h3>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5}
                    style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }} />
          <div style={{ marginTop: 8 }}>
            <Button onClick={publishInstructions} primaryColor="#6a1b9a">更新说明</Button>
          </div>

          <h3 style={{ margin: "16px 0 6px" }}>参数编辑</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            <ParamNumber label="截止天数" value={params.deadline} onChange={v => setParams(p => ({ ...p, deadline: v, weather: Array.from({ length: v }, () => "Sunny") }))} />
            <ParamNumber label="初始现金(￥)" value={params.initial_cash} onChange={v => setParams(p => ({ ...p, initial_cash: v }))} />
            <ParamNumber label="重量上限(kg)" value={params.weight_limit_kg} onChange={v => setParams(p => ({ ...p, weight_limit_kg: v }))} />
            <ParamNumber label="起点" value={params.start_node} onChange={v => setParams(p => ({ ...p, start_node: v }))} />
            <ParamNumber label="终点" value={params.end_node} onChange={v => setParams(p => ({ ...p, end_node: v }))} />
            <ParamNumber label="水基准价(￥/Bottle)" value={params.prices.water} onChange={v => setParams(p => ({ ...p, prices: { ...p.prices, water: v } }))} />
            <ParamNumber label="食物基准价(￥/Unit)" value={params.prices.food} onChange={v => setParams(p => ({ ...p, prices: { ...p.prices, food: v } }))} />
            <ParamNumber label="水质量(kg/Bottle)" value={params.mass.water} onChange={v => setParams(p => ({ ...p, mass: { ...p.mass, water: v } }))} />
            <ParamNumber label="食物质量(kg/Unit)" value={params.mass.food} onChange={v => setParams(p => ({ ...p, mass: { ...p.mass, food: v } }))} />
            <ParamNumber label="退款比例" value={params.refund_factor} step={0.1} onChange={v => setParams(p => ({ ...p, refund_factor: v }))} />
            <ParamNumber label="移动消耗倍率" value={params.move_multiplier} step={0.1} onChange={v => setParams(p => ({ ...p, move_multiplier: v }))} />
            <ParamNumber label="挖矿消耗倍率" value={params.mine_multiplier} step={0.1} onChange={v => setParams(p => ({ ...p, mine_multiplier: v }))} />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={params.allow_storm_mining} onChange={e => setParams(p => ({ ...p, allow_storm_mining: e.target.checked }))} /> 沙暴可挖矿
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <BaseConsumptionEditor params={params} setParams={setParams} />
          </div>

          <div style={{ marginTop: 10 }}>
            <Button onClick={publishParams} primaryColor="#2e7d32">保存参数</Button>
          </div>

          <h3 style={{ margin: "16px 0 6px" }}>倒计时控制</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label>秒数: <input type="number" value={timerInput} onChange={e => setTimerInput(+e.target.value)} style={{ width: 90, marginLeft: 6 }} /></label>
            <div>剩余: <strong>{timeStr}</strong></div>
            <Button onClick={handleStartTimer}>启动</Button>
            <Button onClick={handlePauseTimer} primaryColor="#ff9800">暂停</Button>
            <Button onClick={handleResetTimer} primaryColor="#9c27b0">重置</Button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button onClick={onSolve} primaryColor={busy ? "#90caf9" : "#1976d2"} disabled={busy}>{busy ? "求解中…" : "求解 (MILP)"}</Button>
          </div>

          {errorMsg && <div style={{ color: "#c62828", fontWeight: 600, marginTop: 10 }}>{errorMsg}</div>}

          {result && (
            <>
              <h3 style={{ margin: "16px 0 6px" }}>结果摘要</h3>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                <tbody>
                  <tr><td style={tdLabel}>状态</td><td style={tdVal}>{result.status}</td></tr>
                  <tr><td style={tdLabel}>目标值(￥)</td><td style={tdVal}>{result.objective ?? "-"}</td></tr>
                  <tr><td style={tdLabel}>最终现金(￥)</td><td style={tdVal}>{result.final_cash}</td></tr>
                  <tr><td style={tdLabel}>到达日</td><td style={tdVal}>{result.arrive_day ?? "-"}</td></tr>
                  <tr><td style={tdLabel}>峰值重量(kg)</td><td style={tdVal}>{Number(result.weight_peak || 0).toFixed(2)}</td></tr>
                  <tr><td style={tdLabel}>起始购(水/食)</td><td style={tdVal}>{result.purchases?.start?.water} Bottle / {result.purchases?.start?.food} Unit</td></tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderPlayer() {
    const adjacency: Record<number, number[]> = (window.__ADJ || {});
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16 }}>
        <PlayerPanel
          adjacency={adjacency}
          role={role}
          showSolution={showSolutionToPlayers && result?.status === "Optimal"}
          solutionPath={[]}
          solutionDaily={result?.daily || []}
        />
        <ModelDisplay
          key={`model-player-${params.deadline}-${(params.weather || []).join(",")}-${JSON.stringify(params.base_consumption)}`}
          params={params}
          role="player"
          show={true}
          playersCanSee={showModelToPlayers}
        />
      </div>
    );
  }

  function renderModel() {
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 16 }}>
        <ModelDisplay
          key={`model-tab-${params.deadline}-${(params.weather || []).join(",")}-${JSON.stringify(params.base_consumption)}`}
          params={params}
          role={role}
          show={true}
          playersCanSee={showModelToPlayers}
        />
      </div>
    );
  }

  const showTabs = role === "controller";
  const shouldGate = (role === "controller");

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial' }}>
      {showTabs && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Button onClick={() => setActiveTab("controller")} primaryColor={activeTab === "controller" ? "#1976d2" : "#90a4ae"}>控制面板</Button>
          <Button onClick={() => setActiveTab("player")} primaryColor={activeTab === "player" ? "#1976d2" : "#90a4ae"}>玩家面板</Button>
          <Button onClick={() => setActiveTab("model")} primaryColor={activeTab === "model" ? "#1976d2" : "#90a4ae"}>模型说明</Button>
        </div>
      )}

      {shouldGate && !controllerAuthorized && controllerLoginPanel()}
      {(!shouldGate || controllerAuthorized) && (
        <>
          {role === "controller" && activeTab === "controller" && (
            <>
              <div style={{ marginBottom: 8, color: "#555" }}>
                <strong>访问状态:</strong> {controllerIsMaster ? "主控令牌" : "普通令牌"} | <code>{getControllerToken() || "(未设置)"}</code>
              </div>
              {renderController()}
            </>
          )}
          {((role === "controller" && activeTab === "player") || role === "player") && renderPlayer()}
          {role === "controller" && activeTab === "model" && renderModel()}
        </>
      )}
    </div>
  );
};

interface ParamNumberProps { label: string; value: number; onChange: (v: number) => void; step?: number; }
const ParamNumber: React.FC<ParamNumberProps> = ({ label, value, onChange, step }) => (
  <label>
    {label}
    <input type="number" value={value} step={step || 1} onChange={e => onChange(+e.target.value)} style={{ marginLeft: 4, width: 120 }} />
  </label>
);
const tdLabel: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, width: 200 };
const tdVal: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid #e0e0e0" };
const lbCell: React.CSSProperties = { borderBottom: "1px solid #e0e0e0", padding: "4px 6px", textAlign: "center" };
const tdRow: React.CSSProperties = { borderBottom: "1px solid #e0e0e0", padding: "3px 6px", textAlign: "center" };

export default App;