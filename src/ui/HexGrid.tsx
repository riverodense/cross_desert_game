import React, { useMemo } from "react";
import type { CellType } from "../types";

const SIZE = 38;
const HEX_WIDTH = Math.sqrt(3) * SIZE;

function polygonPoints(cx: number, cy: number, size: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(ang)},${cy + size * Math.sin(ang)}`);
  }
  return pts.join(" ");
}

interface HexGridProps {
  labels: Record<number, CellType>;
  setLabel?: (id: number, next: CellType) => void;
  path?: number[];
  currentMode?: CellType;
  title?: string;
  interactive?: boolean;
  solutionDayList?: Record<number, number[]>;
  showSolutionEdges?: boolean;
  solutionPath?: number[];
}

export const HexGrid: React.FC<HexGridProps> = ({
  labels,
  setLabel,
  path = [],
  currentMode = "Desert",
  title = "地图",
  interactive = false,
  solutionDayList = {},
  showSolutionEdges = false,
  solutionPath = []
}) => {
  const COLS = 8;
  const ROWS = 8;
  const stepX = HEX_WIDTH;
  const stepY = 1.5 * SIZE;

  const hexes = useMemo(() => {
    const arr: { id: number; r: number; c: number; x: number; y: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = r * COLS + c + 1;
        const x = c * stepX + (r % 2 === 1 ? stepX / 2 : 0);
        const y = r * stepY;
        arr.push({ id, r, c, x, y });
      }
    }
    return arr;
  }, []);

  const centerMap = useMemo(() => {
    const m: Record<number, { x: number; y: number }> = {};
    for (const h of hexes) m[h.id] = { x: h.x, y: h.y };
    return m;
  }, [hexes]);

  const solutionEdges = useMemo(() => {
    if (!showSolutionEdges || solutionPath.length < 2) return [];
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i + 1 < solutionPath.length; i++) {
      const a = centerMap[solutionPath[i]];
      const b = centerMap[solutionPath[i + 1]];
      if (!a || !b) continue;
      if (a.x === b.x && a.y === b.y) continue;
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return segs;
  }, [showSolutionEdges, solutionPath, centerMap]);

  return (
    <div>
      <h3 style={{ margin:"8px 0" }}>{title}</h3>
      <svg width={940} height={640} style={{ background:"#fafafa", border:"1px solid #e0e0e0", borderRadius:12 }}>
        <g transform="translate(40,40)">
          {solutionEdges.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#d32f2f" strokeWidth={5} strokeLinecap="round" opacity={0.95}/>
          ))}
          {hexes.map(h => {
            const pts = polygonPoints(h.x,h.y,SIZE);
            const type = labels[h.id] || "Desert";
            const isStart = h.id === 1;
            const isEnd = h.id === 64;
            const inSolution = solutionPath.includes(h.id);
            const dayList = solutionDayList[h.id] || [];

            const fill = isStart ? "#1d3d91"
              : isEnd ? "#ffb6c1"
              : type==="Village" ? "#7dc84a"
              : type==="Mine" ? "#9ea0a6"
              : "#efcf96";

            const stroke = inSolution ? "#d32f2f"
              : type==="Village" ? "#4a8e2c"
              : type==="Mine" ? "#5a5c60"
              : "#b28544";

            return (
              <g key={h.id}>
                <polygon
                  points={pts}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={inSolution || type!=="Desert"?3:2}
                  style={{ cursor: interactive ? "pointer":"default", transition:"stroke .2s" }}
                  onClick={(e)=>{
                    if (!interactive || !setLabel) return;
                    if (isStart || isEnd) return;
                    let next = currentMode;
                    if ((e as any).altKey || (e as any).metaKey) next="Mine";
                    if ((e as any).shiftKey) next="Village";
                    setLabel(h.id, next);
                  }}
                />
                <text x={h.x} y={h.y+6} fontSize={isStart||isEnd?20:16} fontWeight={600} textAnchor="middle" fill={isStart?"#fff":"#222"}>
                  {h.id}
                </text>
                {isStart && <text x={h.x} y={h.y+26} fontSize={14} textAnchor="middle" fill="#fff">起点</text>}
                {isEnd && <text x={h.x} y={h.y+26} fontSize={14} textAnchor="middle" fill="#333">终点</text>}
                {type==="Mine" && !isStart && !isEnd && <text x={h.x} y={h.y-14} fontSize={18} textAnchor="middle">⛏</text>}
                {type==="Village" && !isStart && !isEnd && <text x={h.x} y={h.y-14} fontSize={18} textAnchor="middle">🏠</text>}
                {/* Controller can enable day markers; players pass empty lists */}
                {dayList.length > 0 && (
                  <text x={h.x + SIZE*0.65} y={h.y + SIZE*0.65} fontSize={12} fontWeight={700} fill="#d32f2f" textAnchor="middle">
                    {dayList.join(",")}
                  </text>
                )}
                {inSolution && <circle cx={h.x} cy={h.y} r={5} fill="#d32f2f" opacity={0.9} />}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};