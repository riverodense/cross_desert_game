import React, { useEffect, useState } from "react";
import { getModel } from "../api";
import type { SolveRequest } from "../types";

declare global {
  interface Window { MathJax?: any }
}

interface ModelDisplayProps {
  params: Partial<SolveRequest>;
  show?: boolean;
  playersCanSee?: boolean;
  role: "controller" | "player";
}

export const ModelDisplay: React.FC<ModelDisplayProps> = ({ params, show = true, playersCanSee = false, role }) => {
  const [data, setData] = useState<{ latex_general: string; latex_instantiated: string } | null>(null);
  const [view, setView] = useState<"general" | "instance">("general");

  // Force-refresh model when any param changes (including weather/base consumption)
  useEffect(() => {
    if (!show) return;
    getModel(params as any).then(setData);
  }, [
    show,
    params.deadline,
    params.start_node,
    params.end_node,
    params.initial_cash,
    params.weight_limit_kg,
    params.prices?.water,
    params.prices?.food,
    params.mass?.water,
    params.mass?.food,
    params.refund_factor,
    params.base_income,
    params.move_multiplier,
    params.mine_multiplier,
    params.allow_storm_mining,
    JSON.stringify(params.base_consumption || {}),
    (params.weather || []).join(",")
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((window as any).MathJax?.typesetPromise) {
        (window as any).MathJax.typesetPromise();
      }
    }, 80);
    return () => clearTimeout(t);
  }, [data, view]);

  if (!show) return null;
  if (role === "player" && !playersCanSee) return null;

  // Parameter summary table for instance view (players can see too)
  const p = params as any;
  const paramTable = (
    <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12, marginTop:12 }}>
      <thead>
        <tr style={{ background:"#eee" }}>
          <th style={th}>参数</th><th style={th}>数值</th><th style={th}>单位</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style={td}>截止天数 T</td><td style={td}>{p.deadline}</td><td style={td}>天</td></tr>
        <tr><td style={td}>起点</td><td style={td}>{p.start_node}</td><td style={td}></td></tr>
        <tr><td style={td}>终点</td><td style={td}>{p.end_node}</td><td style={td}></td></tr>
        <tr><td style={td}>初始现金</td><td style={td}>￥{p.initial_cash}</td><td style={td}>￥</td></tr>
        <tr><td style={td}>挖矿基础收益</td><td style={td}>￥{p.base_income}</td><td style={td}>￥/天</td></tr>
        <tr><td style={td}>退款比例</td><td style={td}>{p.refund_factor}</td><td style={td}></td></tr>
        <tr><td style={td}>水价格</td><td style={td}>￥{p.prices?.water}</td><td style={td}>￥/Bottle</td></tr>
        <tr><td style={td}>食物价格</td><td style={td}>￥{p.prices?.food}</td><td style={td}>￥/Unit</td></tr>
        <tr><td style={td}>水质量</td><td style={td}>{p.mass?.water}</td><td style={td}>kg/Bottle</td></tr>
        <tr><td style={td}>食物质量</td><td style={td}>{p.mass?.food}</td><td style={td}>kg/Unit</td></tr>
        <tr><td style={td}>重量上限</td><td style={td}>{p.weight_limit_kg}</td><td style={td}>kg</td></tr>
        <tr><td style={td}>移动消耗倍率</td><td style={td}>{p.move_multiplier}</td><td style={td}>倍</td></tr>
        <tr><td style={td}>挖矿消耗倍率</td><td style={td}>{p.mine_multiplier}</td><td style={td}>倍</td></tr>
        <tr><td style={td}>沙暴可挖矿</td><td style={td}>{p.allow_storm_mining ? "是" : "否"}</td><td style={td}></td></tr>
      </tbody>
    </table>
  );

  return (
    <div style={{ fontSize: 15 }}>
      <h3>数学模型（MILP）</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setView("general")} style={btn(view === "general")}>通用形式</button>
        <button onClick={() => setView("instance")} style={btn(view === "instance")}>实例参数</button>
      </div>
      <div
        style={{ overflowX: "auto" }}
        dangerouslySetInnerHTML={{
          __html: view === "general"
            ? (data?.latex_general || "")
            : (data?.latex_instantiated || "")
        }}
      />
      {view === "instance" && paramTable}
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        若公式未渲染，请确认已加载 MathJax (index.html / player.html)。
      </div>
    </div>
  );
};

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    marginRight: 8,
    border: "none",
    background: active ? "#1976d2" : "#90a4ae",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: active ? "0 0 0 3px rgba(25,118,210,.35)" : "0 2px 4px rgba(0,0,0,0.2)"
  };
}

const th: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: 600
};
const td: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "4px 6px",
  textAlign: "center"
};