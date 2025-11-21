import React, { useState, useEffect } from "react";
import * as api from "../api";
import type { OptimalSolution, DailyRecord } from "../types";

interface PlayerPanelProps {
  playerSolution?: DailyRecord[];
}

export function PlayerPanel({ playerSolution }: PlayerPanelProps) {
  const [optimalSolution, setOptimalSolution] = useState<OptimalSolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    loadOptimalSolution();
  }, []);

  async function loadOptimalSolution() {
    try {
      const solution = await api.getSolution();
      setOptimalSolution(solution);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function exportToCSV() {
    if (!optimalSolution || !playerSolution) return;

    const headers = [
      "Day", "Weather", "Optimal_Location", "Player_Location",
      "Optimal_Action", "Player_Action", "Optimal_Mine", "Player_Mine",
      "Optimal_Cash", "Player_Cash", "Cash_Diff",
      "Optimal_Water", "Player_Water", "Water_Diff",
      "Optimal_Food", "Player_Food", "Food_Diff",
      "Cumulative_Cash_Diff"
    ];

    let cumulativeCashDiff = 0;
    const rows = optimalSolution.daily.map((opt, i) => {
      const player = playerSolution[i];
      if (!player) return null;

      const cashDiff = player.cash - opt.cash;
      const waterDiff = player.invW - opt.invW;
      const foodDiff = player.invF - opt.invF;
      cumulativeCashDiff += cashDiff;

      return [
        opt.day,
        opt.weather,
        opt.location,
        player.location,
        opt.action,
        player.action,
        opt.action === "MINE" ? 1 : 0,
        player.action === "MINE" ? 1 : 0,
        opt.cash.toFixed(2),
        player.cash.toFixed(2),
        cashDiff.toFixed(2),
        opt.invW.toFixed(2),
        player.invW.toFixed(2),
        waterDiff.toFixed(2),
        opt.invF.toFixed(2),
        player.invF.toFixed(2),
        foodDiff.toFixed(2),
        cumulativeCashDiff.toFixed(2)
      ].join(",");
    }).filter(row => row !== null);

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desert_crossing_comparison_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div style={{ padding: "20px", border: "1px solid #fdd", background: "#fef", borderRadius: "5px" }}>
        <h3>Player Panel</h3>
        <p style={{ color: "#c00" }}>{error}</p>
      </div>
    );
  }

  if (!optimalSolution) {
    return (
      <div style={{ padding: "20px", border: "1px solid #ddd", background: "#f9f9f9", borderRadius: "5px" }}>
        <h3>Player Panel</h3>
        <p>Loading optimal solution...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", border: "1px solid #4caf50", background: "#f0f8f0", borderRadius: "5px", marginTop: "20px" }}>
      <h3>Player Panel</h3>
      <div style={{ marginBottom: "10px" }}>
        <p><strong>Optimal Solution Generated:</strong> {optimalSolution.generated_at}</p>
        <p><strong>Status:</strong> {optimalSolution.status}</p>
        <p><strong>Final Cash:</strong> ${optimalSolution.final_cash.toFixed(2)}</p>
        <p><strong>Arrival Day:</strong> {optimalSolution.arrive_day}</p>
      </div>

      {playerSolution && (
        <>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
              />
              <span>Show difference charts</span>
            </label>
            <button onClick={exportToCSV} style={{ marginTop: "10px" }}>
              Export Comparison to CSV (18 columns)
            </button>
          </div>

          {showDiff && (
            <>
              <DifferenceCharts optimal={optimalSolution.daily} player={playerSolution} />
              <MiningComparison optimal={optimalSolution.daily} player={playerSolution} />
            </>
          )}
        </>
      )}

      <div style={{ marginTop: "20px" }}>
        <h4>Optimal Path</h4>
        <p>{optimalSolution.path.join(" → ")}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h4>Daily Schedule</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
          <thead>
            <tr style={{ background: "#ddd" }}>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Day</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Weather</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Location</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Action</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Cash</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Water</th>
              <th style={{ border: "1px solid #999", padding: "5px" }}>Food</th>
            </tr>
          </thead>
          <tbody>
            {optimalSolution.daily.map((day) => (
              <tr key={day.day}>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{day.day}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{day.weather}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{day.location}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{day.action}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>${day.cash.toFixed(2)}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>{day.invW.toFixed(2)}</td>
                <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>{day.invF.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DifferenceCharts({ optimal, player }: { optimal: DailyRecord[]; player: DailyRecord[] }) {
  const maxDays = Math.min(optimal.length, player.length);

  let cumulativeCash = 0;
  let cumulativeWater = 0;
  let cumulativeFood = 0;

  const chartData = [];
  for (let i = 0; i < maxDays; i++) {
    const cashDiff = player[i].cash - optimal[i].cash;
    const waterDiff = player[i].invW - optimal[i].invW;
    const foodDiff = player[i].invF - optimal[i].invF;

    cumulativeCash += cashDiff;
    cumulativeWater += waterDiff;
    cumulativeFood += foodDiff;

    chartData.push({
      day: optimal[i].day,
      cashDiff,
      waterDiff,
      foodDiff,
      cumulativeCash,
      cumulativeWater,
      cumulativeFood
    });
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h4>Difference Charts (Player - Optimal)</h4>
      <div style={{ marginBottom: "15px" }}>
        <h5>Cash Difference</h5>
        <SimpleBarChart data={chartData.map(d => ({ label: `Day ${d.day}`, value: d.cumulativeCash }))} color="#ff9800" />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <h5>Water Difference</h5>
        <SimpleBarChart data={chartData.map(d => ({ label: `Day ${d.day}`, value: d.cumulativeWater }))} color="#2196f3" />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <h5>Food Difference</h5>
        <SimpleBarChart data={chartData.map(d => ({ label: `Day ${d.day}`, value: d.cumulativeFood }))} color="#4caf50" />
      </div>
    </div>
  );
}

function SimpleBarChart({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.8em" }}>
      {data.map((item, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "60px", textAlign: "right" }}>{item.label}:</span>
          <div style={{ flex: 1, height: "20px", background: "#eee", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                width: `${(Math.abs(item.value) / maxValue) * 50}%`,
                height: "100%",
                background: color,
                transform: item.value < 0 ? "translateX(-100%)" : "none"
              }}
            />
            <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", lineHeight: "20px" }}>
              {item.value.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiningComparison({ optimal, player }: { optimal: DailyRecord[]; player: DailyRecord[] }) {
  const optimalMining = optimal.filter(d => d.action === "MINE");
  const playerMining = player.filter(d => d.action === "MINE");

  return (
    <div style={{ marginTop: "20px" }}>
      <h4>Mining Comparison</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
        <thead>
          <tr style={{ background: "#ddd" }}>
            <th style={{ border: "1px solid #999", padding: "5px" }}>Category</th>
            <th style={{ border: "1px solid #999", padding: "5px" }}>Optimal</th>
            <th style={{ border: "1px solid #999", padding: "5px" }}>Player</th>
            <th style={{ border: "1px solid #999", padding: "5px" }}>Difference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #ccc", padding: "5px" }}>Total Mining Days</td>
            <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{optimalMining.length}</td>
            <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{playerMining.length}</td>
            <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "center" }}>{playerMining.length - optimalMining.length}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #ccc", padding: "5px" }}>Mining Days</td>
            <td style={{ border: "1px solid #ccc", padding: "5px" }}>{optimalMining.map(d => d.day).join(", ")}</td>
            <td style={{ border: "1px solid #ccc", padding: "5px" }}>{playerMining.map(d => d.day).join(", ")}</td>
            <td style={{ border: "1px solid #ccc", padding: "5px" }}>-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
