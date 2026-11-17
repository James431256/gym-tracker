import React, { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { MUSCLES } from "./muscles";
import { parsePlanList } from "./planList";

const EXAMPLE = `Bench Press, Chest, 3, 60
Shoulder Press, Shoulders
Lat Raises, Shoulders, 3
Tricep Pushdowns, Triceps`;

// Paste or upload a list of exercises, check the preview, then save it as a plan.
// `askName` shows a name field for a new plan.
export default function PlanListSheet({
  Sheet,
  title,
  askName = false,
  initialText = "",
  partOf,
  isKnown,
  onSave,
  onClose,
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState(initialText);
  const [fileNote, setFileNote] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const rows = useMemo(() => parsePlanList(text, { partOf, isKnown }), [text, partOf, isKnown]);
  const problems = rows.filter((r) => r.problem);

  const readFile = (file) => {
    if (!file) return;
    if (file.size > 200 * 1024) return setFileNote("That file is too big for a plan list.");
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ""));
      setFileNote(`Loaded ${file.name}`);
      setError("");
    };
    reader.onerror = () => setFileNote("Couldn't read that file.");
    reader.readAsText(file);
  };

  const save = () => {
    if (askName && !name.trim()) return setError("Give the plan a name.");
    if (!rows.length) return setError("Add at least one exercise.");
    if (problems.length) return setError("Fix the highlighted lines first.");
    onSave({ name: name.trim(), rows });
  };

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save plan
          </button>
        </>
      }
    >
      <div className="stack">
        {askName && (
          <div>
            <label className="label" htmlFor="list-plan-name">
              Name
            </label>
            <input
              id="list-plan-name"
              className="field"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Push"
              autoFocus
            />
          </div>
        )}

        <div>
          <div className="list-head">
            <label className="label" htmlFor="plan-list-text">
              Exercises
            </label>
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              <Upload size={14} aria-hidden="true" /> Upload a file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              hidden
              data-testid="plan-file"
              onChange={(e) => {
                readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <textarea
            id="plan-list-text"
            className="field list-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            placeholder={EXAMPLE}
            rows={7}
            spellCheck={false}
          />
          <p className="hint list-help">
            One exercise per line: <strong>exercise, body part, sets, starting kg</strong>. Only the
            name is needed for exercises the app knows. Sets and starting kg are optional.
          </p>
          {fileNote && <p className="field-note">{fileNote}</p>}
        </div>

        {rows.length > 0 && (
          <div>
            <span className="label">
              Preview · {rows.length} {rows.length === 1 ? "exercise" : "exercises"}
              {problems.length > 0 && ` · ${problems.length} to fix`}
            </span>
            <ol className="list list-preview">
              {rows.map((r) => (
                <li key={r.line} className={`row${r.problem ? " list-bad" : ""}`}>
                  <div className="row-main">
                    <div className="row-title">
                      {r.name || r.raw}
                      {r.isNew && !r.problem && <span className="tag list-new">New</span>}
                    </div>
                    <div className={`row-sub${r.problem ? " field-error" : ""}`}>
                      {r.problem
                        ? `Line ${r.line}: ${r.problem}`
                        : [
                            MUSCLES.find((m) => m.id === r.part)?.name,
                            r.sets && `${r.sets} sets`,
                            r.weight != null && `starts at ${r.weight} kg`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && <p className="field-error">{error}</p>}
      </div>
    </Sheet>
  );
}
