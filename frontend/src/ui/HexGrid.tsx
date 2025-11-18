import React, { useMemo } from "react";
import type { CellType } from "../types";

const SIZE = 26;

function toPixel(q:number,r:number,size:number){
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3)/2) * r);
  const y = size * (1.5 * r);
  return {x,y};
}
function polygonPoints(cx:number, cy:number, size:number){
  const pts:string[] = [];
  for (let i=0;i<6;i++){
    const ang = Math.PI/180 * (60*i - 30);
    const x = cx + size * Math.cos(ang);
    const y = cy + size * Math.sin(ang);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
}

export const HexGrid: React.FC<{
  labels: Record<number, CellType>;
  setLabel: (id:number, next:CellType)=>void;
  path?: number[];
}> = ({ labels, setLabel, path = [] }) => {
  const hexes = useMemo(()=>{
    const arr:{id:number,q:number,r:number}[] = [];
    for (let r=0;r<8;r++) for (let q=0;q<8;q++) arr.push({id:r*8+q+1,q,r});
    return arr;
  },[]);
  const pathSet = new Set(path);

  function nextLabel(current:CellType, ev:React.MouseEvent){
    if ((ev as any).altKey || (ev as any).metaKey) return "Mine";
    if ((ev as any).shiftKey) return "Village";
    return current==="Desert" ? "Village" : current==="Village" ? "Mine" : "Desert";
  }

  return (
    <svg width={760} height={620} style={{ background:"#fafafa", border:"1px solid #e0e0e0", borderRadius:10 }}>
      {hexes.map(h=>{
        const {x,y} = toPixel(h.q, h.r, SIZE);
        const pts = polygonPoints(x,y,SIZE);
        const isStart = h.id===1, isEnd = h.id===64;
        const inPath = pathSet.has(h.id);
        const type = labels[h.id] || "Desert";
        const fill = isStart? "#dcedc8" : isEnd? "#ffcdd2" : inPath? "#fff3cd" : "#fff";
        const stroke = type==="Mine" ? "#6a1b9a" : type==="Village" ? "#1e88e5" : "#2c3e50";
        return (
          <g key={h.id}>
            <polygon
              points={pts}
              fill={fill}
              stroke={stroke}
              strokeWidth={type==="Desert"?1.2:2}
              onClick={(e)=>{
                if (h.id===1 || h.id===64) return;
                const nl = nextLabel(type, e);
                setLabel(h.id, nl);
              }}
            />
            <text x={x} y={y+5} fontSize={11} textAnchor="middle" fill="#333">{h.id}</text>
            {type==="Mine" && <circle cx={x-12} cy={y-14} r={6} fill="#6a1b9a" />}
            {type==="Village" && <rect x={x+6} y={y-20} width={10} height={10} fill="#1e88e5" />}
          </g>
        );
      })}
      <text x={10} y={18} fontSize={12} fill="#555">点击：沙漠→村庄→矿山→沙漠（Shift=村庄，Alt=矿山）</text>
    </svg>
  );
};
