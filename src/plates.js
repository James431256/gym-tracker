import React from "react";

// Colours a plan's plate can be. `tone` is the CSS class suffix (tone-*) the
// rest of the app colours plates, dots and bars with.
export const PLATE_COLOURS = [
  { id: "red", name: "Red", tone: "chest" },
  { id: "blue", name: "Blue", tone: "back" },
  { id: "yellow", name: "Yellow", tone: "arms" },
  { id: "green", name: "Green", tone: "green" },
  { id: "orange", name: "Orange", tone: "orange" },
  { id: "purple", name: "Purple", tone: "purple" },
  { id: "pink", name: "Pink", tone: "pink" },
  { id: "white", name: "White", tone: "other" },
];

export const toneOfColour = (id) => PLATE_COLOURS.find((c) => c.id === id)?.tone || null;

// A colour no other plan uses yet, so new plans stand apart on the calendar.
// Red, blue and yellow come last because the built-in days already use them.
export const nextFreeColour = (used) =>
  ["green", "orange", "purple", "pink", "white", "red", "blue", "yellow"].find(
    (id) => !used.includes(id)
  ) || "white";

export function ColourPicker({ value, onChange, Disc }) {
  return (
    <div className="colour-picker" role="radiogroup" aria-label="Plate colour">
      {PLATE_COLOURS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          aria-label={c.name}
          title={c.name}
          onClick={() => onChange(c.id)}
        >
          <Disc tone={c.tone} size={30} />
        </button>
      ))}
    </div>
  );
}
