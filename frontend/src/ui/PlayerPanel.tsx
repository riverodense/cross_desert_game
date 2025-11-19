import React, { useState } from "react";
import type { SolveRequest, PlayerAction, Weather } from "../types";

interface PlayerPanelProps {
  params: SolveRequest;
  labels: Record<number, string>;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ params, labels }) => {
  const [nickname, setNickname] = useState("");
  const [path, setPath] = useState<number[]>([1]);
  const [actions, setActions] = useState<PlayerAction[]>([]);
  const [startBuyW, setStartBuyW] = useState(0);
  const [startBuyF, setStartBuyF] = useState(0);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  const deadline = params.deadline;

  // Initialize path with all days if needed
  const initializePath = () => {
    const newPath = [params.start_node];
    for (let d = 1; d <= deadline; d++) {
      newPath.push(params.start_node);
    }
    setPath(newPath);

    const newActions: PlayerAction[] = [];
    for (let d = 1; d <= deadline; d++) {
      newActions.push({ day: d, buyW: 0, buyF: 0, mine: false });
    }
    setActions(newActions);
  };

  const updatePath = (day: number, node: number) => {
    const newPath = [...path];
    while (newPath.length <= day) {
      newPath.push(params.start_node);
    }
    newPath[day] = node;
    setPath(newPath);
  };

  const updateAction = (day: number, field: keyof PlayerAction, value: any) => {
    const newActions = [...actions];
    const idx = newActions.findIndex((a) => a.day === day);
    if (idx >= 0) {
      newActions[idx] = { ...newActions[idx], [field]: value };
    } else {
      newActions.push({ day, buyW: 0, buyF: 0, mine: false, [field]: value });
    }
    setActions(newActions);
  };

  const evaluatePlan = async () => {
    setEvaluating(true);
    setEvaluation(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          path,
          actions,
          start_buyW: startBuyW,
          start_buyF: startBuyF,
          params,
        }),
      });
      const data = await res.json();
      setEvaluation(data);
    } catch (err) {
      alert("Evaluation failed: " + (err as Error).message);
    } finally {
      setEvaluating(false);
    }
  };

  const submitToLeaderboard = async () => {
    if (!evaluation || !evaluation.valid) {
      alert("Cannot submit invalid plan");
      return;
    }
    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          score: evaluation.score,
          final_cash: evaluation.final_cash,
          valid: evaluation.valid,
        }),
      });
      alert("Submitted to leaderboard!");
    } catch (err) {
      alert("Submission failed: " + (err as Error).message);
    }
  };

  // Calculate consumption table
  const consumptionTable = () => {
    const baseConsumption = params.base_consumption;
    const moveMultiplier = params.move_multiplier;
    const mineMultiplier = params.mine_multiplier;

    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>Weather</th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>
              Base Water (Bottle)
            </th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>
              Base Food (Unit)
            </th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>
              Move Water
            </th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>Move Food</th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>
              Mine Water
            </th>
            <th style={{ border: "1px solid #ddd", padding: 6, background: "#f5f5f5" }}>Mine Food</th>
          </tr>
        </thead>
        <tbody>
          {(["Sunny", "Hot", "Storm"] as Weather[]).map((w) => {
            const baseW = baseConsumption[w].water;
            const baseF = baseConsumption[w].food;
            return (
              <tr key={w}>
                <td style={{ border: "1px solid #ddd", padding: 6 }}>
                  <span className={`badge ${w.toLowerCase()}`}>{w}</span>
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>{baseW}</td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>{baseF}</td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                  {(baseW * moveMultiplier).toFixed(1)}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                  {(baseF * moveMultiplier).toFixed(1)}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                  {(baseW * mineMultiplier).toFixed(1)}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                  {(baseF * mineMultiplier).toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="card">
      <h2>Player Panel</h2>

      <div style={{ marginBottom: 16 }}>
        <h3>Parameter Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
          <div>
            <strong>Deadline:</strong> {params.deadline} days
          </div>
          <div>
            <strong>Initial Cash:</strong> {params.initial_cash} ￥
          </div>
          <div>
            <strong>Weight Limit:</strong> {params.weight_limit_kg} kg
          </div>
          <div>
            <strong>Mining Income:</strong> {params.base_income} ￥/day
          </div>
          <div>
            <strong>Water:</strong> {params.prices.water} ￥/Bottle, {params.mass.water} kg/Bottle
          </div>
          <div>
            <strong>Food:</strong> {params.prices.food} ￥/Unit, {params.mass.food} kg/Unit
          </div>
          <div>
            <strong>Village Price:</strong> 2× base
          </div>
          <div>
            <strong>Refund:</strong> {(params.refund_factor * 100).toFixed(0)}% of base
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3>Consumption Table</h3>
        {consumptionTable()}
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3>Plan Entry</h3>
        <div style={{ marginBottom: 8 }}>
          <label>Nickname: </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
            style={{ padding: 4, width: 200 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Day 0 Purchase (at start): </label>
          <input
            type="number"
            value={startBuyW}
            onChange={(e) => setStartBuyW(Number(e.target.value))}
            placeholder="Water (Bottle)"
            style={{ padding: 4, width: 80, marginRight: 8 }}
            min={0}
          />
          <input
            type="number"
            value={startBuyF}
            onChange={(e) => setStartBuyF(Number(e.target.value))}
            placeholder="Food (Unit)"
            style={{ padding: 4, width: 80 }}
            min={0}
          />
        </div>
        <button className="btn" onClick={initializePath} style={{ marginBottom: 8 }}>
          Initialize Plan (30 days)
        </button>
      </div>

      {path.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <h3>Daily Plan</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Day
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Weather
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Node
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Buy Water
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Buy Food
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 4, position: "sticky", top: 0, background: "#f5f5f5" }}>
                    Mine?
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: deadline }, (_, i) => i + 1).map((d) => {
                  const action = actions.find((a) => a.day === d) || {
                    day: d,
                    buyW: 0,
                    buyF: 0,
                    mine: false,
                  };
                  const weather = params.weather[d - 1] || "Sunny";
                  return (
                    <tr key={d}>
                      <td style={{ border: "1px solid #ddd", padding: 4 }}>{d}</td>
                      <td style={{ border: "1px solid #ddd", padding: 4 }}>
                        <span className={`badge ${weather.toLowerCase()}`}>{weather}</span>
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 4 }}>
                        <input
                          type="number"
                          value={path[d] || 1}
                          onChange={(e) => updatePath(d, Number(e.target.value))}
                          style={{ width: "50px", padding: 2 }}
                          min={1}
                          max={64}
                        />
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 4 }}>
                        <input
                          type="number"
                          value={action.buyW}
                          onChange={(e) => updateAction(d, "buyW", Number(e.target.value))}
                          style={{ width: "50px", padding: 2 }}
                          min={0}
                        />
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 4 }}>
                        <input
                          type="number"
                          value={action.buyF}
                          onChange={(e) => updateAction(d, "buyF", Number(e.target.value))}
                          style={{ width: "50px", padding: 2 }}
                          min={0}
                        />
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 4, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={action.mine}
                          onChange={(e) => updateAction(d, "mine", e.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn primary" onClick={evaluatePlan} disabled={evaluating}>
          {evaluating ? "Evaluating..." : "Evaluate Plan"}
        </button>
        {evaluation && evaluation.valid && (
          <button className="btn" onClick={submitToLeaderboard}>
            Submit to Leaderboard
          </button>
        )}
      </div>

      {evaluation && (
        <div style={{ marginTop: 16 }}>
          <h3>Evaluation Result</h3>
          <div style={{ marginBottom: 8 }}>
            <strong>Valid:</strong>{" "}
            <span style={{ color: evaluation.valid ? "green" : "red" }}>
              {evaluation.valid ? "✓ Yes" : "✗ No"}
            </span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Final Cash:</strong> {evaluation.final_cash?.toFixed(2) || 0} ￥
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Cash before refund:</strong> {evaluation.cash_before_refund?.toFixed(2) || 0} ￥
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Refund:</strong> {evaluation.refund?.toFixed(2) || 0} ￥
          </div>

          {evaluation.violations && evaluation.violations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <h4 style={{ color: "red" }}>Violations:</h4>
              <ul style={{ color: "red", fontSize: 12 }}>
                {evaluation.violations.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.daily_state && evaluation.daily_state.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Per-Day Inventory & Balance</h4>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Day
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Location
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Water (Bottle)
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Food (Unit)
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Cash (￥)
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Weight (kg)
                      </th>
                      <th
                        style={{
                          border: "1px solid #ddd",
                          padding: 4,
                          position: "sticky",
                          top: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        Violations
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.daily_state.map((state: any) => (
                      <tr key={state.day} style={{ background: state.violations?.length > 0 ? "#ffebee" : "white" }}>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{state.day}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{state.location}</td>
                        <td style={{ border: "1px solid #ddd", padding: 4, textAlign: "right" }}>
                          {state.invW?.toFixed(1) || 0}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: 4, textAlign: "right" }}>
                          {state.invF?.toFixed(1) || 0}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: 4, textAlign: "right" }}>
                          {state.cash?.toFixed(2) || 0}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: 4, textAlign: "right" }}>
                          {state.weight?.toFixed(1) || 0}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: 4, fontSize: 11, color: "red" }}>
                          {state.violations && state.violations.length > 0
                            ? state.violations.join("; ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
