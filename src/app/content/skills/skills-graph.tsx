"use client";

// Interactive knowledge-graph view of the skill tree. Skills are laid out in
// rows by grade and coloured by topic; prerequisite edges are drawn between
// them. Click a skill to light up its prerequisite chain (upstream) and the
// skills that depend on it (downstream); zoom and pan by scrolling.

import { useMemo, useState } from "react";
import { Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";

export interface GraphSkill {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
  topicArea: string | null;
  prerequisiteSkillIds: string;
  questionCount: number;
}

const TOPIC: Record<string, { fill: string; stroke: string; text: string }> = {
  Arithmetic: { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#075985" },
  Algebra: { fill: "#eef2ff", stroke: "#6366f1", text: "#3730a3" },
  Geometry: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  Statistics: { fill: "#d1fae5", stroke: "#10b981", text: "#065f46" },
  _: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
};
const topicColor = (t: string | null) => TOPIC[t ?? "_"] ?? TOPIC._;

function baseGrade(g: string | null): number {
  const m = String(g ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
const trunc = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const NODE_W = 152;
const NODE_H = 54;
const COL_GAP = 30;
const ROW_H = 132;
const PAD = 48;

interface GNode extends GraphSkill {
  x: number;
  y: number;
  grade: number;
  prereqs: string[];
}

export function SkillsGraph({
  skills,
  onEdit,
}: {
  skills: GraphSkill[];
  onEdit: (skillId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const { nodes, edges, width, height } = useMemo(() => {
    const grades = [...new Set(skills.map((s) => baseGrade(s.gradeLevel)))].sort((a, b) => a - b);
    const rowIndex = new Map(grades.map((g, i) => [g, i]));
    const byGrade = new Map<number, GraphSkill[]>();
    for (const s of skills) {
      const g = baseGrade(s.gradeLevel);
      if (!byGrade.has(g)) byGrade.set(g, []);
      byGrade.get(g)!.push(s);
    }
    const maxCols = Math.max(1, ...[...byGrade.values()].map((l) => l.length));
    const rowW = maxCols * (NODE_W + COL_GAP) - COL_GAP;

    const nodes: GNode[] = [];
    for (const g of grades) {
      const list = (byGrade.get(g) ?? [])
        .slice()
        .sort(
          (a, b) =>
            (a.topicArea ?? "").localeCompare(b.topicArea ?? "") ||
            a.skillName.localeCompare(b.skillName)
        );
      // Centre each grade row within the widest row.
      const thisW = list.length * (NODE_W + COL_GAP) - COL_GAP;
      const offset = (rowW - thisW) / 2;
      list.forEach((s, j) => {
        nodes.push({
          ...s,
          grade: g,
          x: PAD + offset + j * (NODE_W + COL_GAP),
          y: PAD + (rowIndex.get(g) ?? 0) * ROW_H,
          prereqs: s.prerequisiteSkillIds
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        });
      });
    }
    const idset = new Set(nodes.map((n) => n.skillId));
    const edges: { from: string; to: string }[] = [];
    for (const n of nodes) for (const p of n.prereqs) if (idset.has(p)) edges.push({ from: p, to: n.skillId });

    return {
      nodes,
      edges,
      width: PAD * 2 + rowW,
      height: PAD * 2 + (grades.length - 1) * ROW_H + NODE_H,
    };
  }, [skills]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.skillId, n])), [nodes]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of edges) {
      if (!m.has(e.from)) m.set(e.from, []);
      m.get(e.from)!.push(e.to);
    }
    return m;
  }, [edges]);

  // Upstream (prerequisites) + downstream (dependents) of the selected node.
  const highlight = useMemo(() => {
    if (!selected) return null;
    const up = new Set<string>();
    const down = new Set<string>();
    const us = [selected];
    while (us.length) {
      const cur = us.pop()!;
      for (const p of byId.get(cur)?.prereqs ?? []) if (!up.has(p) && byId.has(p)) (up.add(p), us.push(p));
    }
    const ds = [selected];
    while (ds.length) {
      const cur = ds.pop()!;
      for (const c of childrenOf.get(cur) ?? []) if (!down.has(c)) (down.add(c), ds.push(c));
    }
    return new Set<string>([selected, ...up, ...down]);
  }, [selected, byId, childrenOf]);

  const sel = selected ? byId.get(selected) : null;
  const selDeps = selected ? childrenOf.get(selected) ?? [] : [];

  const nodeOpacity = (id: string) => (!highlight || highlight.has(id) ? 1 : 0.22);
  const edgeState = (e: { from: string; to: string }) =>
    !highlight ? "base" : highlight.has(e.from) && highlight.has(e.to) ? "on" : "off";

  if (skills.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
        No skills to graph yet.
      </div>
    );
  }

  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {["Arithmetic", "Algebra", "Geometry", "Statistics"].map((t) => (
            <span key={t} className="flex items-center gap-1.5 font-medium text-slate-500">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: topicColor(t).fill, border: `2px solid ${topicColor(t).stroke}` }}
              />
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="mr-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs font-semibold tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-dot-grid max-h-[68vh] overflow-auto">
        <svg
          width={width * zoom}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y + NODE_H;
            const x2 = b.x + NODE_W / 2;
            const y2 = b.y;
            const my = (y1 + y2) / 2;
            const st = edgeState(e);
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                fill="none"
                stroke={st === "on" ? "#6366f1" : "#cbd5e1"}
                strokeWidth={st === "on" ? 2.4 : 1.4}
                markerEnd={st === "on" ? "url(#arrow-on)" : "url(#arrow)"}
                opacity={st === "off" ? 0.15 : 1}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const c = topicColor(n.topicArea);
            const isSel = n.skillId === selected;
            return (
              <g
                key={n.skillId}
                transform={`translate(${n.x},${n.y})`}
                opacity={nodeOpacity(n.skillId)}
                onClick={() => setSelected(isSel ? null : n.skillId)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={c.fill}
                  stroke={isSel ? "#4f46e5" : c.stroke}
                  strokeWidth={isSel ? 3 : 1.5}
                />
                <text x={12} y={22} fontSize={12.5} fontWeight={700} fill={c.text}>
                  {trunc(n.skillName)}
                </text>
                <text x={12} y={40} fontSize={10} fill={c.text} opacity={0.7} fontFamily="ui-monospace, monospace">
                  {n.skillId} · G{n.grade}
                </text>
                <text x={NODE_W - 12} y={40} fontSize={10} fontWeight={700} textAnchor="end" fill={c.text} opacity={0.8}>
                  {n.questionCount}Q
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {sel && (
        <div className="animate-pop absolute top-16 right-4 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-mono text-slate-400">{sel.skillId} · Grade {sel.grade}</p>
              <h3 className="font-bold text-slate-900">{sel.skillName}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              style={{ background: topicColor(sel.topicArea).fill, color: topicColor(sel.topicArea).text }}
            >
              {sel.topicArea ?? "—"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              {sel.questionCount} questions
            </span>
          </div>
          <Rel label="Prerequisites" ids={sel.prereqs} byId={byId} empty="none — root skill" />
          <Rel label="Unlocks" ids={selDeps} byId={byId} empty="nothing yet" />
          <button
            onClick={() => onEdit(sel.skillId)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit skill
          </button>
        </div>
      )}
    </div>
  );
}

function Rel({
  label,
  ids,
  byId,
  empty,
}: {
  label: string;
  ids: string[];
  byId: Map<string, GNode>;
  empty: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {ids.length === 0 ? (
        <p className="mt-1 text-xs italic text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {ids.map((id) => (
            <li
              key={id}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
              title={id}
            >
              {byId.get(id)?.skillName ?? id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
