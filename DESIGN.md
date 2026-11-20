# Design

The look is built from competition bumper plates on a rubber gym floor. Use it when you change or add screens.

## Ground and colour

- Dark ground (`--floor` #121211), with panels one step lighter (`--panel`, `--panel-2`). People use the app between sets at arm's length, in mixed gym lighting.
- Colour comes from the plates and means something every time:
  - Back = blue plate (`--plate-blue`)
  - Chest & Shoulders = red plate (`--plate-red`)
  - Arms = yellow plate (`--plate-yellow`)
  - Custom plans pick their own plate (`src/plates.js`): red, blue, yellow, green, orange (`--plate-orange`), purple (`--plate-purple`), pink (`--plate-pink`) or white. A new plan starts on a colour no other plan uses. Plans saved before colours existed stay white.
  - Old Push/Pull sessions, and leg and core muscles = white plate (`--plate-white`)
  - A muscle takes the plate of the day it's trained on: Chest and Shoulders red, Back blue, Biceps and Triceps yellow
  - Beat last time = green plate (`--plate-green`)
- The primary button is the white 5 kg plate (`--plate-white`) with dark text. Use one per view.
- Focus rings, the caret and text selection use yellow.
- All tokens are in `src/index.css`.

## Type

- Barlow for UI text. Barlow Condensed for numbers and the uppercase page titles.
- Weights, reps and dates use tabular numerals (`.num`, `.num-input`).
- Sentence case everywhere except page titles.

## Signature

- **Disc** (`<Disc type>`): a plate seen face-on. It marks a plan everywhere: plan rows, history, calendar dots and charts. It reads a plan's own colour through `ToneContext`. The calendar legend names every plan done that month by its colour, rather than lumping them into "Other".
- **Loaded plate** (`.plate[data-state]`): a plate seen edge-on, next to each set in a workout. Outline = not logged yet, white = logged with no previous set, green = up on last time, steel = same, dark red = below. It springs in when the state changes.

## Components

- Lists are bordered rows inside one panel, not separate cards. The muscle picker on Train is the one grid of tiles.
- Pop-ups are sheets (`<Sheet>`, `<ConfirmSheet>`). They slide up from the bottom on phones and appear centred from 640px. Every delete asks first.
- Tabs sit in a bottom bar on phones and move into the top bar from 768px.
- Hover styles only apply on devices with a real pointer (`@media (hover: hover) and (pointer: fine)`). Pressing a button scales it to 0.97.
- Motion: 150–250 ms ease-out for state changes, the drawer curve for sheets, and a fade only when the user prefers reduced motion.

## Friends

- Plate colours mean workout days, so people get their own colours on the Friends calendar. You are always the white plate (`.person-me`). Friends take `--person-1` to `--person-5` (orange, violet, cyan, pink, sand) in the order you linked up, oldest first, so a friend keeps their colour when you add more. A sixth friend starts the list again.
- A person is a plain dot, never a disc: discs are for plans.
- The Friends calendar shows up to four dots in a day, then a `+`. Tapping the day opens a sheet with everyone who trained.
- Friends see a session as its name and three counts ("6 exercises · 14 sets · 3 up on last time"). Never show a friend's weights or gym, and don't guess why nothing is showing: say "Nothing shared yet".
