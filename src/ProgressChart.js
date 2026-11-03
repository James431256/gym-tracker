import React, { useEffect, useRef, useState } from "react";

const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

// Round steps (1, 2, 2.5, 5 × 10ⁿ) so the axis reads like plate weights
const niceStep = (span, count) => {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return step || 10 * mag;
};

const shortDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

// Heaviest set each session, as a line over time. Tap or hover a point for its sets.
export default function ProgressChart({ points, tone }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 320);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setActive(null), [points]);

  const times = points.map((p) => new Date(p.date).getTime());
  const weights = points.map((p) => p.weight);
  let lo = Math.min(...weights);
  let hi = Math.max(...weights);
  if (hi - lo < 5) {
    lo -= 2.5;
    hi += 2.5;
  }
  const step = niceStep(hi - lo, 3);
  lo = Math.max(0, Math.floor(lo / step) * step);
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);

  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
  const y = (w) => PAD.top + plotH - ((w - lo) / (hi - lo || 1)) * plotH;

  const xy = points.map((p, i) => [x(times[i]), y(p.weight)]);
  const path = xy.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");

  // First, middle and last dates, skipping any that would collide
  const xTicks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
    .filter((i, k, arr) => k === 0 || xy[i][0] - xy[arr[k - 1]][0] > 56);

  const pick = (clientX) => {
    const box = wrap.current.getBoundingClientRect();
    const px = clientX - box.left;
    let best = 0;
    xy.forEach(([cx], i) => {
      if (Math.abs(cx - px) < Math.abs(xy[best][0] - px)) best = i;
    });
    setActive(best);
  };

  const last = points.length - 1;
  const a = active !== null ? points[active] : null;

  return (
    <div className={`progress-chart tone-${tone}`} ref={wrap}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Heaviest set each session: ${points
          .map((p) => `${shortDate(p.date)} ${p.weight} kg`)
          .join(", ")}`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.pointerType === "mouse" && pick(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="pc-grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="pc-axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            className="pc-axis"
            x={xy[i][0]}
            y={HEIGHT - 8}
            textAnchor={i === 0 && points.length > 1 ? "start" : i === last && points.length > 1 ? "end" : "middle"}
          >
            {shortDate(points[i].date)}
          </text>
        ))}
        {a && (
          <line
            className="pc-cross"
            x1={xy[active][0]}
            x2={xy[active][0]}
            y1={PAD.top}
            y2={PAD.top + plotH}
          />
        )}
        {points.length > 1 && <path className="pc-line" d={path} />}
        {xy.map(([px, py], i) => (
          <circle
            key={i}
            className="pc-dot"
            cx={px}
            cy={py}
            r={i === active ? 6 : 4}
          />
        ))}
        {/* Label the latest point unless a tooltip is open */}
        {!a && (
          <text
            className="pc-value"
            x={xy[last][0]}
            y={xy[last][1] - 12}
            textAnchor={points.length > 1 ? "end" : "middle"}
          >
            {points[last].weight} kg
          </text>
        )}
      </svg>
      <p className="pc-readout" aria-live="polite">
        {a ? (
          <>
            <span className="pc-tip-date">{shortDate(a.date)}</span>{" "}
            <span className="num">{a.sets.map((s) => `${s.weight}×${s.reps}`).join(", ")}</span>
          </>
        ) : (
          "Tap a point to see its sets."
        )}
      </p>
    </div>
  );
}
