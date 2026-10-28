# Design

The look is built from competition bumper plates on a rubber gym floor. Use it when you change or add screens.

## Ground and colour

- Dark ground (`--floor` #121211), with panels one step lighter (`--panel`, `--panel-2`). People use the app between sets at arm's length, in mixed gym lighting.
- Colour comes from the plates and means something every time:
  - Back = blue plate (`--plate-blue`)
  - Chest = red plate (`--plate-red`)
  - Shoulders & Arms = yellow plate (`--plate-yellow`)
  - Custom plans, old Push/Pull sessions, and leg and core muscles = white plate (`--plate-white`)
  - A muscle takes the plate of the day it's trained on: Chest red, Back blue, Shoulders, Biceps and Triceps yellow
  - Beat last time = green plate (`--plate-green`)
- The primary button is the white 5 kg plate (`--plate-white`) with dark text. Use one per view.
- Focus rings, the caret and text selection use yellow.
- All tokens are in `src/index.css`.

## Type

- Barlow for UI text. Barlow Condensed for numbers and the uppercase page titles.
- Weights, reps and dates use tabular numerals (`.num`, `.num-input`).
- Sentence case everywhere except page titles.

## Signature

- **Disc** (`<Disc type>`): a plate seen face-on. It marks a plan everywhere: plan rows, history, calendar dots and charts.
- **Loaded plate** (`.plate[data-state]`): a plate seen edge-on, next to each set in a workout. Outline = not logged yet, white = logged with no previous set, green = up on last time, steel = same, dark red = below. It springs in when the state changes.

## Components

- Lists are bordered rows inside one panel, not separate cards. The muscle picker on Train is the one grid of tiles.
- Pop-ups are sheets (`<Sheet>`, `<ConfirmSheet>`). They slide up from the bottom on phones and appear centred from 640px. Every delete asks first.
- Tabs sit in a bottom bar on phones and move into the top bar from 768px.
- Hover styles only apply on devices with a real pointer (`@media (hover: hover) and (pointer: fine)`). Pressing a button scales it to 0.97.
- Motion: 150–250 ms ease-out for state changes, the drawer curve for sheets, and a fade only when the user prefers reduced motion.
