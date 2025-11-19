import React, { useMemo, useState, useEffect } from "react";
import { HexGrid } from "./HexGrid";
import { WeatherEditor } from "./WeatherEditor";
import { BaseConsumptionEditor } from "./BaseConsumptionEditor";
import { ModelDisplay } from "./ModelDisplay";
import { PlayerPanel } from "./PlayerPanel";
import { solve } from "../api";
import type { CellType, SolveRequest, Weather } from "../types";

const defaultWeather: Weather[] = Array.from({ length: 30 }, () => "Sunny");
const defaultBaseConsumption = {
  Sunny: { water: 5, food: 7 },
  Hot: { water: 8, food: 6 },
  Storm: { water: 10, food: 10 },
};

interface AppProps {
  role?: "controller" | "player";
}

export const App: React.FC<AppProps> = ({ role = "controller" }) => {
  const [activeTab, setActiveTab] = useState<"controller" | "player" | "model">(
    role === "player" ? "player" : "controller"
  );
  const [labels, setLabels] = useState<Record<number, CellType>>({});
  const [weather, setWeather] = useState<Weather[]>(defaultWeather);
  const [baseConsumption, setBaseConsumption] = useState(defaultBaseConsumption);
  const [baseIncome, setBaseIncome] = useState(1000);

  const mines = useMemo(
    () => Object.entries(labels).filter(([, t]) => t === "Mine").map(([k]) => +k),
    [labels]
  );
  const villages = useMemo(
    () => Object.entries(labels).filter(([, t]) => t === "Village").map(([k]) => +k),
    [labels]
  );

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [params, setParams] = useState<SolveRequest>({
    deadline: 30,
    initial_cash: 10000,
    weight_limit_kg: 1200,
    start_node: 1,
    end_node: 64,
    prices: { water: 5, food: 10 },
    mass: { water: 3, food: 2 },
    refund_factor: 0.5,
    base_income: 1000,
    base_consumption: defaultBaseConsumption,
    move_multiplier: 2.0,
    mine_multiplier: 2.5,
    allow_storm_mining: true,
    mines: [],
    villages: [],
    weather: defaultWeather,
  });

  function setLabel(id: number, next: CellType) {
    setLabels((prev) => ({ ...prev, [id]: next }));
  }

  const generateRandomWeather = async () => {
    try {
      const res = await fetch("/api/weather/random", { method: "POST" });
      const data = await res.json();
      setWeather(data.weather);
    } catch (err) {
      alert("Failed to generate random weather");
    }
  };

  const saveParameters = () => {
    const newParams: SolveRequest = {
      deadline: 30,
      initial_cash: 10000,
      weight_limit_kg: 1200,
      start_node: 1,
      end_node: 64,
      prices: { water: 5, food: 10 },
      mass: { water: 3, food: 2 },
      refund_factor: 0.5,
      base_income: baseIncome,
      base_consumption: baseConsumption,
      move_multiplier: 2.0,
      mine_multiplier: 2.5,
      allow_storm_mining: true,
      mines,
      villages,
      weather,
    };
    setParams(newParams);
    
    // Also save to backend config
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels,
        params_default: {
          base_income: baseIncome,
          base_consumption: baseConsumption,
          weather,
        },
      }),
    }).catch(console.error);
    
    alert("Parameters saved!");
  };

  async function onSolve() {
    setBusy(true);
    setResult(null);
    const req: SolveRequest = {
      ...params,
      base_income: baseIncome,
      base_consumption: baseConsumption,
      mines,
      villages,
      weather,
    };
    try {
      const res = await solve(req);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      {role === "controller" && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, borderBottom: "2px solid #ddd", paddingBottom: 8 }}>
          <button
            className={`btn ${activeTab === "controller" ? "primary" : ""}`}
            onClick={() => setActiveTab("controller")}
          >
            Controller
          </button>
          <button
            className={`btn ${activeTab === "player" ? "primary" : ""}`}
            onClick={() => setActiveTab("player")}
          >
            Player View
          </button>
          <button
            className={`btn ${activeTab === "model" ? "primary" : ""}`}
            onClick={() => setActiveTab("model")}
          >
            Model
          </button>
        </div>
      )}

      {activeTab === "controller" && (
        <>
          <div className="card">
            <h2>Map Setup (地图设置)</h2>
            <div className="legend">
              <span className="desert">Desert (沙漠)</span>
              <span className="village">Village (村庄)</span>
              <span className="mine">Mine (矿山)</span>
            </div>
            <HexGrid labels={labels} setLabel={setLabel} path={result?.path ?? []} />
            <div className="flex" style={{ marginTop: 8 }}>
              <div>
                Current: Villages {villages.length}, Mines {mines.length}
              </div>
              <button className="btn" onClick={() => setLabels({})}>
                Clear All
              </button>
            </div>
          </div>

          <BaseConsumptionEditor
            baseConsumption={baseConsumption}
            baseIncome={baseIncome}
            onChange={(bc, bi) => {
              setBaseConsumption(bc);
              setBaseIncome(bi);
            }}
          />

          <div className="card">
            <h2>Weather Setup (天气设置)</h2>
            <WeatherEditor weather={weather} setWeather={setWeather} />
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={generateRandomWeather}>
                Generate Random Weather
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Actions</h2>
            <div className="flex" style={{ gap: 8 }}>
              <button className="btn primary" onClick={saveParameters}>
                Save Parameters
              </button>
              <button className="btn" onClick={onSolve} disabled={busy || mines.length === 0}>
                {busy ? "Solving..." : "Solve (MILP)"}
              </button>
              {mines.length === 0 && <span style={{ color: "var(--bad)" }}>Need at least 1 mine</span>}
            </div>
          </div>

          {result && (
            <div className="card">
              <h3>Solution Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div>
                  <strong>Status:</strong> {result.status}
                </div>
                <div>
                  <strong>Objective:</strong> {result.objective?.toFixed(2) || 0} ￥
                </div>
                <div>
                  <strong>Final Cash:</strong> {result.final_cash?.toFixed(2) || 0} ￥
                </div>
                <div>
                  <strong>Arrival Day:</strong> {result.arrive_day}
                </div>
                <div>
                  <strong>Peak Weight:</strong> {result.weight_peak?.toFixed(1) || 0} kg
                </div>
                <div>
                  <strong>Refund:</strong> {result.refund?.toFixed(2) || 0} ￥
                </div>
              </div>
              <h4>Daily Actions</h4>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Day</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Weather</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Location</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Action</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Buy W (Bottle)</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Buy F (Unit)</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Inv W (Bottle)</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Inv F (Unit)</th>
                      <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>Cash (￥)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.daily?.map((d: any) => (
                      <tr key={d.day}>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.day}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>
                          <span className={`badge ${d.weather.toLowerCase()}`}>{d.weather}</span>
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.location}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.action}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.buyW}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.buyF}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.invW?.toFixed(1)}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.invF?.toFixed(1)}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{d.cash?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "player" && (
        <PlayerPanel
          params={{
            ...params,
            base_income: baseIncome,
            base_consumption: baseConsumption,
            mines,
            villages,
            weather,
          }}
          labels={labels}
        />
      )}

      {activeTab === "model" && (
        <ModelDisplay
          params={{
            ...params,
            base_income: baseIncome,
            base_consumption: baseConsumption,
            mines,
            villages,
            weather,
          }}
          showInstance={true}
        />
      )}
    </div>
  );
};
