import { MUSCLES } from "./muscles";

// Plans written as a list, one exercise per line:
//   Bench Press, Chest, 3, 60
//   exercise, body part (optional for ones the app knows), sets (optional), starting kg (optional)
// Commas, tabs or semicolons all work, so a CSV from a spreadsheet reads the same way.

const PART_ALIASES = {
  chest: "chest",
  pecs: "chest",
  back: "back",
  lats: "back",
  shoulder: "shoulders",
  shoulders: "shoulders",
  delts: "shoulders",
  bicep: "biceps",
  biceps: "biceps",
  tricep: "triceps",
  triceps: "triceps",
  quad: "quads",
  quads: "quads",
  legs: "quads",
  hamstring: "hamstrings",
  hamstrings: "hamstrings",
  glutes: "hamstrings",
  calf: "calves",
  calves: "calves",
  abs: "core",
  core: "core",
};

// "Shoulders", "shoulder", "Abs & Core" and so on to a muscle id
export const findPart = (text) => {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  const byName = MUSCLES.find((m) => m.name.toLowerCase() === t || m.id === t);
  if (byName) return byName.id;
  if (PART_ALIASES[t]) return PART_ALIASES[t];
  const first = t.split(/[\s&/]+/)[0];
  return PART_ALIASES[first] || null;
};

// Split one line on commas, tabs or semicolons, respecting "quoted, values"
const splitLine = (line) => {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\t" || ch === ";")) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
};

const looksLikeHeader = (cells) =>
  /exercise|name/i.test(cells[0] || "") &&
  cells.slice(1).some((c) => /body|part|muscle|sets|weight|kg/i.test(c));

// partOf(name) gives a known exercise's body part (or ""); isKnown(name) says whether
// the app already has it, and canonical(name) gives its existing spelling.
// Returns every line with what was read and any problem.
export const parsePlanList = (text, { partOf, isKnown, canonical = (n) => n }) => {
  const rows = [];
  const seen = new Set();
  (text || "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) return;
    const cells = splitLine(line);
    if (rows.length === 0 && looksLikeHeader(cells)) return;
    const [name = "", partText = "", setsText = "", weightText = ""] = cells;
    // Known exercises keep their existing spelling so history stays together
    const typed = name.replace(/\s+/g, " ");
    const row = {
      line: i + 1,
      raw: raw.trim(),
      name: typed && isKnown(typed) ? canonical(typed) : typed,
    };
    const problems = [];

    if (!row.name) problems.push("No exercise name");

    if (partText) {
      row.part = findPart(partText);
      if (!row.part) problems.push(`Don't know the body part "${partText}"`);
    } else if (row.name) {
      row.part = partOf(row.name) || null;
      if (!row.part) problems.push("New exercise: add its body part");
    }
    row.isNew = !!row.name && !isKnown(row.name);

    if (setsText) {
      const sets = Number(setsText);
      if (Number.isInteger(sets) && sets >= 1 && sets <= 10) row.sets = sets;
      else problems.push(`Sets should be a whole number from 1 to 10, not "${setsText}"`);
    }

    if (weightText) {
      const weight = Number(weightText.replace(/\s*kgs?$/i, ""));
      if (Number.isFinite(weight) && weight >= 0 && weight <= 1000) row.weight = weight;
      else problems.push(`Starting weight should be a number of kg, not "${weightText}"`);
    }

    const key = row.name.toLowerCase();
    if (row.name && seen.has(key)) problems.push("Already in this list");
    seen.add(key);

    row.problem = problems[0] || null;
    rows.push(row);
  });
  return rows;
};

// The other way round: a plan's exercises as a list you can copy, edit and paste back
export const planToText = (names, targets = {}, partOf) =>
  names
    .map((name) => {
      const part = MUSCLES.find((m) => m.id === partOf(name))?.name || "";
      const t = targets[name] || {};
      const cells = [name, part];
      if (t.sets || t.weight != null) cells.push(t.sets ? String(t.sets) : "");
      if (t.weight != null) cells.push(String(t.weight));
      return cells.map((c) => (/[,;\t"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(", ");
    })
    .join("\n");
