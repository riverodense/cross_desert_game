import React, { useEffect, useRef, useState, useCallback } from "react";

export interface DataSeries {
  name: string;
  color: string;
  data: number[];
  style?: "solid" | "dashed";
  visible: boolean;
}

interface LineChartProps {
  series: DataSeries[];
  width: number;
  height: number;
  onExport?: () => void;
}

interface TooltipData {
  day: number;
  x: number;
  y: number;
  values: { name: string; value: number; color: string }[];
}

export const LineChart: React.FC<LineChartProps> = ({ series, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  // Responsive resize with throttle
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: newWidth } = entry.contentRect;
        setDimensions({ width: newWidth, height });
      }
    });
    
    let timeoutId: NodeJS.Timeout;
    const throttledObserver = new ResizeObserver((entries) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => observer.observe(svgRef.current!), 200);
    });

    const container = svgRef.current.parentElement;
    if (container) {
      throttledObserver.observe(container);
    }

    return () => {
      clearTimeout(timeoutId);
      throttledObserver.disconnect();
    };
  }, [height]);

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  // Calculate scales
  const visibleSeries = series.filter(s => s.visible);
  const allData = visibleSeries.flatMap(s => s.data);
  const maxDay = Math.max(...visibleSeries.flatMap(s => s.data.length)) - 1;
  const minValue = Math.min(0, ...allData);
  const maxValue = Math.max(...allData);
  const valueRange = maxValue - minValue || 1;

  const xScale = (day: number) => padding.left + (day / maxDay) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartX = mouseX - padding.left;
    
    if (chartX < 0 || chartX > chartWidth) {
      setTooltip(null);
      return;
    }

    // Map to nearest day
    const day = Math.round((chartX / chartWidth) * maxDay);
    const x = xScale(day);
    
    // Get values for all visible series at this day
    const values = visibleSeries
      .map(s => ({
        name: s.name,
        value: s.data[day] ?? 0,
        color: s.color
      }))
      .filter(v => v.value !== undefined);

    if (values.length > 0) {
      setTooltip({
        day,
        x,
        y: e.clientY - rect.top,
        values
      });
    }
  }, [visibleSeries, maxDay, chartWidth, padding.left, xScale]);

  const handleMouseLeave = () => setTooltip(null);

  // Mobile tap handling
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tooltip) {
      setTooltip(null);
    } else {
      handleMouseMove(e);
    }
  }, [tooltip, handleMouseMove]);

  // Generate path for a series
  const generatePath = (data: number[]) => {
    if (data.length === 0) return "";
    return data
      .map((value, day) => {
        const x = xScale(day);
        const y = yScale(value);
        return day === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(" ");
  };

  return (
    <div style={{ position: "relative", width: "100%" }} aria-label="Interactive difference chart">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ border: "1px solid #e0e0e0", background: "#fafafa" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#999"
          strokeWidth="1"
        />
        
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke="#999"
          strokeWidth="1"
        />

        {/* Zero line */}
        {minValue < 0 && (
          <line
            x1={padding.left}
            y1={yScale(0)}
            x2={padding.left + chartWidth}
            y2={yScale(0)}
            stroke="#ccc"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + chartHeight * t;
          const value = maxValue - t * valueRange;
          return (
            <g key={t}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#eee"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#666"
              >
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {[0, Math.floor(maxDay / 4), Math.floor(maxDay / 2), Math.floor(3 * maxDay / 4), maxDay].map((day) => (
          <text
            key={day}
            x={xScale(day)}
            y={padding.top + chartHeight + 20}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
          >
            {day}
          </text>
        ))}

        {/* Day label */}
        <text
          x={padding.left + chartWidth / 2}
          y={dimensions.height - 5}
          textAnchor="middle"
          fontSize="12"
          fill="#333"
        >
          天数 (Day)
        </text>

        {/* Plot lines */}
        {visibleSeries.map((s, i) => (
          <path
            key={i}
            d={generatePath(s.data)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeDasharray={s.style === "dashed" ? "5,5" : "none"}
          />
        ))}

        {/* Tooltip indicator */}
        {tooltip && (
          <line
            x1={tooltip.x}
            y1={padding.top}
            x2={tooltip.x}
            y2={padding.top + chartHeight}
            stroke="#666"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 10,
            top: tooltip.y,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
            zIndex: 1000,
            minWidth: "120px"
          }}
          aria-live="polite"
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>第 {tooltip.day} 天</div>
          {tooltip.values.map((v, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ color: v.color }}>●</span>
              <span>{v.name}:</span>
              <span style={{ fontWeight: "bold" }}>{v.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
