import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Grip } from "lucide-react";

type ChartWidgetProps = { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string; resizable?: boolean };

export function ChartWidget({ title, subtitle, action, children, className = "", resizable = false }: ChartWidgetProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ axis: "x" | "y" | "both"; x: number; y: number; width: number; height: number } | null>(null);
  const onResizeStart = (axis: "x" | "y" | "both", event: PointerEvent<HTMLButtonElement>) => {
    const card = event.currentTarget.closest(".chart-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    drag.current = { axis, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    setSize({
      width: drag.current.axis === "y" ? drag.current.width : Math.max(420, drag.current.width + event.clientX - drag.current.x),
      height: drag.current.axis === "x" ? drag.current.height : Math.max(280, drag.current.height + event.clientY - drag.current.y)
    });
  };
  const onResizeEnd = () => { drag.current = null; };
  const resizeHandle = (axis: "x" | "y" | "both", className: string, label: string, icon = false) => <button type="button" className={`chart-card__resize-handle ${className}`} aria-label={label} title={label} onPointerDown={(event) => onResizeStart(axis, event)} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}>{icon ? <Grip size={14} aria-hidden="true" /> : null}</button>;
  return <section className={`chart-card ${className}${resizable ? " chart-card--resizable" : ""}`} style={size ? { width: size.width, height: size.height } : undefined}><div className="chart-card__header"><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div><div className="chart-card__body">{children}</div>{resizable ? <>{resizeHandle("x", "chart-card__resize-handle--right", "Resize chart width")}{resizeHandle("y", "chart-card__resize-handle--bottom", "Resize chart height")}{resizeHandle("both", "chart-card__resize-handle--corner", "Resize chart", true)}</> : null}</section>;
}

export const chartTooltipStyle = { border: "1px solid #dfe5ec", borderRadius: 7, background: "#ffffff", boxShadow: "0 12px 24px rgba(16, 36, 58, 0.12)", fontSize: 11 };
