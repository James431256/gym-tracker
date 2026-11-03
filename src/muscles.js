// Muscle groups you can pick to train. Each one takes the plate colour of the
// day it's trained on (see DESIGN.md); legs and core use the white plate.
export const MUSCLES = [
  {
    id: "chest",
    name: "Chest",
    tone: "chest",
    exercises: [
      "Smith Machine",
      "Chest Press Machine",
      "Cable Chest Exercise",
      "Chest Press (Hands Touch)",
      "Bench Press",
      "Incline Dumbbell Press",
      "Dips",
      "Push Ups",
    ],
  },
  {
    id: "back",
    name: "Back",
    tone: "back",
    exercises: [
      "Lat Pulldowns",
      "T-Bar Row",
      "Row",
      "Assisted Pull Ups",
      "Pull Ups",
      "Seated Cable Row",
      "Single Arm Dumbbell Row",
      "Straight Arm Pulldown",
      "Deadlift",
      "Pec Rear Delts",
    ],
  },
  {
    id: "shoulders",
    name: "Shoulders",
    tone: "chest",
    exercises: [
      "Shoulder Press",
      "Lat Raises",
      "Seatbelts",
      "Flys",
      "Face Pulls",
      "Arnold Press",
      "Front Raises",
      "Upright Row",
    ],
  },
  {
    id: "biceps",
    name: "Biceps",
    tone: "arms",
    exercises: [
      "Bicep Curls",
      "Preacher Curls",
      "Hammer Curls",
      "Cable Curls",
      "Incline Dumbbell Curls",
      "Concentration Curls",
    ],
  },
  {
    id: "triceps",
    name: "Triceps",
    tone: "arms",
    exercises: [
      "Barbell Skull Crushers",
      "Tricep Extensions",
      "Tricep Pushdowns",
      "Overhead Cable Extension",
      "Close Grip Bench Press",
    ],
  },
  {
    id: "quads",
    name: "Quads",
    tone: "other",
    exercises: ["Squat", "Leg Press", "Leg Extensions", "Hack Squat", "Lunges", "Bulgarian Split Squat"],
  },
  {
    id: "hamstrings",
    name: "Hamstrings & Glutes",
    tone: "other",
    exercises: ["Romanian Deadlift", "Leg Curls", "Hip Thrust", "Glute Kickbacks", "Good Mornings"],
  },
  {
    id: "calves",
    name: "Calves",
    tone: "other",
    exercises: ["Standing Calf Raises", "Seated Calf Raises", "Calf Press"],
  },
  {
    id: "core",
    name: "Abs & Core",
    tone: "other",
    exercises: ["Cable Crunches", "Hanging Leg Raises", "Plank", "Ab Wheel", "Russian Twists"],
  },
];

// Guesses for exercises the library doesn't know, checked in order
const PATTERNS = [
  ["back", /reverse pec|pec rear|rear delt/i],
  ["hamstrings", /hamstring|glute|hip thrust|rdl|romanian|leg curl/i],
  ["biceps", /curl|bicep/i],
  ["triceps", /tricep|skull|pushdown|\bdips?\b/i],
  ["shoulders", /shoulder|lateral|lat raise|delt|arnold|military|overhead press|face pull/i],
  ["chest", /chest|bench|pec|fly|flye|push ?up/i],
  ["back", /\blat\b|\blats\b|row|pull ?up|chin ?up|pulldown|\bback\b/i],
  ["calves", /calf|calves/i],
  ["quads", /squat|leg press|leg extension|lunge|quad/i],
  ["core", /\babs?\b|crunch|plank|core|oblique|sit ?up/i],
];

export const MUSCLE_TYPE_PREFIX = "muscle:";

export const getMuscle = (id) => MUSCLES.find((m) => m.id === id);

// Workouts started from the muscle picker are saved with a "muscle:<id>" type
export const muscleFromType = (type) =>
  typeof type === "string" && type.startsWith(MUSCLE_TYPE_PREFIX)
    ? getMuscle(type.slice(MUSCLE_TYPE_PREFIX.length))
    : null;

// Which muscles an exercise works: your own pick, then the library, then a guess
export const musclesFor = (name, added = {}) => {
  const lower = name.toLowerCase();
  const matches = (list) => (list || []).some((e) => e.toLowerCase() === lower);
  const picked = MUSCLES.filter((m) => matches(added[m.id])).map((m) => m.id);
  if (picked.length) return picked;
  const known = MUSCLES.filter((m) => matches(m.exercises)).map((m) => m.id);
  if (known.length) return known;
  const guess = PATTERNS.find(([, re]) => re.test(name));
  return guess ? [guess[0]] : [];
};

// Every exercise for a muscle: the library, ones you added, and ones you've logged
export const exercisesForMuscle = (muscleId, added = {}, known = []) => {
  const muscle = getMuscle(muscleId);
  if (!muscle) return [];
  const list = [...muscle.exercises, ...(added[muscleId] || [])];
  known.forEach((name) => {
    if (musclesFor(name, added).includes(muscleId)) list.push(name);
  });
  const seen = new Set();
  return list.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    // Moving a library exercise to another muscle takes it off this one
    return musclesFor(name, added).includes(muscleId);
  });
};

// Put an exercise on one muscle only, replacing any earlier pick
export const assignMuscle = (added, name, muscleId) => {
  const lower = name.toLowerCase();
  const next = Object.fromEntries(
    Object.entries(added).map(([id, list]) => [
      id,
      (list || []).filter((e) => e.toLowerCase() !== lower),
    ])
  );
  next[muscleId] = [...(next[muscleId] || []), name];
  return next;
};
