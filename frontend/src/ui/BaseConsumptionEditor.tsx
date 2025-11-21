import React from "react";
import type { Weather, SolveRequest } from "../types";

interface BaseConsumptionEditorProps {
  baseConsumption: Record<Weather, { water: number; food: number }>;
  baseIncome: number;
  onChange: (baseConsumption: Record<Weather, { water: number; food: number }>, baseIncome: number) => void;
}

export const BaseConsumptionEditor: React.FC<BaseConsumptionEditorProps> = ({
  baseConsumption,
  baseIncome,
  onChange,
}) => {
  const weathers: Weather[] = ["Sunny", "Hot", "Storm"];

  const updateConsumption = (weather: Weather, resource: "water" | "food", value: number) => {
    const newConsumption = {
      ...baseConsumption,
      [weather]: {
        ...baseConsumption[weather],
        [resource]: value,
      },
    };
    onChange(newConsumption, baseIncome);
  };

  const updateIncome = (value: number) => {
    onChange(baseConsumption, value);
  };

  return (
    <div className="card" style={{ padding: 12 }}>
      <h3>Base Consumption & Income</h3>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
          Mining Base Income (￥/day):
        </label>
        <input
          type="number"
          value={baseIncome}
          onChange={(e) => updateIncome(Number(e.target.value))}
          style={{ width: "120px", padding: 4 }}
          min={0}
        />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: 8, background: "#f5f5f5" }}>Weather</th>
            <th style={{ border: "1px solid #ddd", padding: 8, background: "#f5f5f5" }}>Water (Bottle)</th>
            <th style={{ border: "1px solid #ddd", padding: 8, background: "#f5f5f5" }}>Food (Unit)</th>
          </tr>
        </thead>
        <tbody>
          {weathers.map((w) => (
            <tr key={w}>
              <td style={{ border: "1px solid #ddd", padding: 8, fontWeight: "bold" }}>
                <span className={`badge ${w.toLowerCase()}`}>{w}</span>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <input
                  type="number"
                  value={baseConsumption[w].water}
                  onChange={(e) => updateConsumption(w, "water", Number(e.target.value))}
                  style={{ width: "80px", padding: 4 }}
                  min={0}
                />
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <input
                  type="number"
                  value={baseConsumption[w].food}
                  onChange={(e) => updateConsumption(w, "food", Number(e.target.value))}
                  style={{ width: "80px", padding: 4 }}
                  min={0}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        <p>• Move consumption = base × move_multiplier (default 2.0)</p>
        <p>• Mine consumption = base × mine_multiplier (default 2.5)</p>
      </div>
    </div>
  );
};
