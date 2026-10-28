import React, { useState, useEffect, useCallback } from "react";
import {
  Dumbbell,
  CalendarDays,
  ChartColumn,
  History,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  X,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Check,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import "./App.css";
import {
  MUSCLES,
  MUSCLE_TYPE_PREFIX,
  getMuscle,
  muscleFromType,
  musclesFor,
  exercisesForMuscle,
} from "./muscles";
import { useCloudSync } from "./sync";

const loadSaved = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

// Target rep range for double progression: build reps up to the top, then add weight
const REP_MIN = 8;
const REP_MAX = 10;

// Each day is a bumper plate colour (see DESIGN.md)
const DAYS = [
  { id: "back", name: "Back", desc: "Lats, upper back, rear delts", tone: "back" },
  { id: "chest", name: "Chest", desc: "Presses, flys", tone: "chest" },
  {
    id: "shoulders_arms",
    name: "Shoulders & Arms",
    desc: "Delts, biceps, triceps",
    tone: "arms",
  },
];

const DEFAULT_EXERCISES = {
  back: [
    "Lat Pulldowns",
    "T-Bar Row",
    "Row",
    "Assisted Pull Ups",
    "Pec Rear Delts",
  ],
  chest: [
    "Smith Machine",
    "Chest Press Machine",
    "Cable Chest Exercise",
    "Chest Press (Hands Touch)",
    "Flys",
  ],
  shoulders_arms: [
    "Shoulder Press",
    "Lat Raises",
    "Seatbelts",
    "Bicep Curls",
    "Preacher Curls",
    "Barbell Skull Crushers",
    "Tricep Extensions",
  ],
};

const ADD_PLACEHOLDERS = {
  back: "Face Pulls",
  chest: "Incline Dumbbell Press",
  shoulders_arms: "Hammer Curls",
};

// Move exercise lists saved under the old push/pull split onto the new days
const migrateExercises = (saved) => {
  if (!saved) return DEFAULT_EXERCISES;
  if (!saved.push && !saved.pull) return { ...DEFAULT_EXERCISES, ...saved };
  const result = { back: [], chest: [], shoulders_arms: [] };
  const old = [
    ...(saved.pull || []).map((name) => [name, "back"]),
    ...(saved.push || []).map((name) => [name, "chest"]),
  ];
  old.forEach(([name, fallback]) => {
    const known = Object.keys(DEFAULT_EXERCISES).find((d) =>
      DEFAULT_EXERCISES[d].includes(name)
    );
    const looksLikeArmsOrShoulders =
      /curl|bicep|tricep|skull|pushdown|extension|shoulder|lateral|raise|arnold/i.test(
        name
      );
    const day =
      known || (looksLikeArmsOrShoulders ? "shoulders_arms" : fallback);
    if (!result[day].includes(name)) result[day].push(name);
  });
  // Keep the default ordering for known exercises, anything new goes last
  Object.keys(result).forEach((d) => {
    const order = (n) => {
      const i = DEFAULT_EXERCISES[d].indexOf(n);
      return i === -1 ? Infinity : i;
    };
    result[d].sort((a, b) => order(a) - order(b));
  });
  return result;
};

const completedSets = (sets) =>
  (sets || []).filter((s) => (s.reps || 0) > 0);

const roundWeight = (w) => Math.max(0, Math.round(w * 100) / 100);

// Double progression on an 8-10 rep range:
// - every set at the same weight hit 10+ reps -> add the smallest weight jump
// - every set within 8-10 -> same weight, chase 10 on every set
// - fell short of 8 -> same weight, unless it's well short or the second
//   session in a row below 8, then drop the weight
const recommend = (exerciseName, history, jump) => {
  const sets = completedSets(history[0]?.sets);
  if (!sets.length) return null;
  const weight = sets[0].weight || 0;
  const sameWeight = sets.every((s) => (s.weight || 0) === weight);
  const minReps = Math.min(...sets.map((s) => s.reps));
  // On assisted machines less assistance is harder
  const assisted = /assist/i.test(exerciseName);
  const harder = roundWeight(assisted ? weight - jump : weight + jump);
  const easier = roundWeight(assisted ? weight + jump : weight - jump);

  if (sameWeight && minReps >= REP_MAX)
    return {
      action: "up",
      weight: harder,
      assisted,
      reason: `Hit ${REP_MAX}+ reps on every set`,
    };

  if (minReps < REP_MIN) {
    const prev = completedSets(history[1]?.sets);
    const shortTwiceInARow =
      prev.length &&
      (prev[0].weight || 0) === weight &&
      Math.min(...prev.map((s) => s.reps)) < REP_MIN;
    if (minReps <= REP_MIN - 3 || shortTwiceInARow)
      return {
        action: "down",
        weight: easier,
        assisted,
        reason: shortTwiceInARow
          ? `Under ${REP_MIN} reps two sessions running`
          : `Only ${minReps} reps, too heavy for now`,
      };
    return {
      action: "stay",
      weight,
      reason: `Get every set to ${REP_MIN}+ reps`,
    };
  }

  return {
    action: "stay",
    weight,
    reason: sameWeight
      ? `Aim for ${REP_MAX} reps on every set`
      : `Get every set to ${REP_MAX} at ${weight} kg`,
  };
};

const REC_STYLE = {
  up: { Icon: ArrowUp, label: (r) => (r.assisted ? "Less assistance:" : "Go up to") },
  stay: { Icon: ArrowRight, label: () => "Stay at" },
  down: { Icon: ArrowDown, label: (r) => (r.assisted ? "More assistance:" : "Drop to") },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TABS = [
  ["home", "Train", Dumbbell],
  ["calendar", "Calendar", CalendarDays],
  ["insights", "Stats", ChartColumn],
  ["history", "History", History],
  ["manage", "Plans", ClipboardList],
];

const DEFAULT_SETTINGS = { defaultSets: 2, weightJump: 2.5 };

// Muscle workouts take their muscle's plate; custom plans and old push/pull
// sessions share the white plate
const toneFor = (type) =>
  DAYS.find((d) => d.id === type)?.tone || muscleFromType(type)?.tone || "other";

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const relativeDay = (iso) => {
  const days = Math.round((startOfDay(new Date()) - startOfDay(iso)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
};

// A set counts once it has reps; weight decides first, then reps
const compareSet = (set, last) => {
  if (!set.reps) return "todo";
  if (!last) return "new";
  const w = set.weight || 0,
    lw = last.weight || 0,
    r = set.reps || 0,
    lr = last.reps || 0;
  if (w !== lw) return w > lw ? "up" : "down";
  if (r !== lr) return r > lr ? "up" : "down";
  return "same";
};

// "20×10, 20×9"
const formatSets = (sets) => sets.map((s) => `${s.weight}×${s.reps}`).join(", ");

const STATE_LABEL = {
  todo: "Not logged yet",
  new: "Logged, no previous set",
  up: "Up on last time",
  same: "Same as last time",
  down: "Below last time",
};

// A bumper plate seen face-on, coloured by day
function Disc({ type, size = 32 }) {
  return (
    <svg
      className={`disc tone-${toneFor(type)}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="15.5" className="disc-face" />
      <circle cx="16" cy="16" r="11" className="disc-ring" />
      <circle cx="16" cy="16" r="3.6" className="disc-hub" />
    </svg>
  );
}

function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmSheet({ title, body, confirmLabel, cancelLabel, onConfirm, onClose }) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelLabel || "Cancel"}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="hint">{body}</p>
    </Sheet>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function GymTracker() {
  // Read saved data during the first render so nothing can overwrite it before it loads
  const [activeWorkout, setActiveWorkout] = useState(() =>
    loadSaved("activeWorkout", null)
  );
  const [screen, setScreen] = useState(() =>
    loadSaved("activeWorkout", null) ? "workout" : "home"
  );
  const [workouts, setWorkouts] = useState(() => loadSaved("gymWorkouts", []));
  const [addDrafts, setAddDrafts] = useState({});
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [pendingWorkoutType, setPendingWorkoutType] = useState(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customExercises, setCustomExercises] = useState([]);
  const [customExerciseInput, setCustomExerciseInput] = useState("");
  const [customError, setCustomError] = useState("");
  const [editingCustom, setEditingCustom] = useState(null);
  const [addExerciseAt, setAddExerciseAt] = useState(null);
  const [addExerciseSearch, setAddExerciseSearch] = useState("");
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [customPlans, setCustomPlans] = useState(() =>
    loadSaved("gymCustomPlans", [])
  );

  const [exercises, setExercises] = useState(() =>
    migrateExercises(loadSaved("gymExercises", null))
  );
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadSaved("gymSettings", {}),
  }));
  // Exercises you've added to a muscle, by muscle id
  const [muscleExercises, setMuscleExercises] = useState(() =>
    loadSaved("gymMuscleExercises", {})
  );
  const [muscleId, setMuscleId] = useState(null);
  const [muscleSelection, setMuscleSelection] = useState([]);
  const [muscleDraft, setMuscleDraft] = useState("");
  const [pendingList, setPendingList] = useState(null);
  const [pickerMuscle, setPickerMuscle] = useState("all");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  // Plans and settings as they come back from the account
  const applyPrefs = useCallback((remote) => {
    const next = {
      exercises: migrateExercises(remote.exercises || null),
      customPlans: remote.customPlans || [],
      settings: { ...DEFAULT_SETTINGS, ...(remote.settings || {}) },
      muscleExercises: remote.muscleExercises || {},
    };
    setExercises(next.exercises);
    setCustomPlans(next.customPlans);
    setSettings(next.settings);
    setMuscleExercises(next.muscleExercises);
    return next;
  }, []);

  const clearLocal = useCallback(() => {
    setWorkouts([]);
    applyPrefs({});
  }, [applyPrefs]);

  const cloud = useCloudSync({
    workouts,
    setWorkouts,
    prefs: { exercises, customPlans, settings, muscleExercises },
    setPrefs: applyPrefs,
    clearLocal,
  });

  useEffect(() => {
    localStorage.setItem("gymWorkouts", JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem("gymExercises", JSON.stringify(exercises));
  }, [exercises]);
  useEffect(() => {
    localStorage.setItem("gymCustomPlans", JSON.stringify(customPlans));
  }, [customPlans]);
  useEffect(() => {
    localStorage.setItem("gymSettings", JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem("gymMuscleExercises", JSON.stringify(muscleExercises));
  }, [muscleExercises]);

  // Save active workout to localStorage
  useEffect(() => {
    if (activeWorkout) {
      localStorage.setItem("activeWorkout", JSON.stringify(activeWorkout));
    } else {
      localStorage.removeItem("activeWorkout");
    }
  }, [activeWorkout]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, muscleId]);

  // Exercises you've used yourself, in plans or in past workouts
  const getYourExercises = () => {
    const fromPlans = Object.values(exercises).flat();
    const fromHistory = workouts.flatMap((w) => w.exercises.map((e) => e.name));
    const fromCustom = customPlans.flatMap((p) => p.exercises);
    return [...new Set([...fromPlans, ...fromHistory, ...fromCustom])];
  };

  const getAllKnownExercises = () => {
    const fromMuscles = MUSCLES.flatMap((m) => [
      ...m.exercises,
      ...(muscleExercises[m.id] || []),
    ]);
    return [...new Set([...getYourExercises(), ...fromMuscles])].sort();
  };

  // Past sessions of an exercise on any day, newest first
  const getExerciseHistory = (exerciseName) =>
    workouts
      .filter((w) => w.exercises.some((e) => e.name === exerciseName))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((w) => ({
        date: w.date,
        sets: w.exercises.find((e) => e.name === exerciseName).sets,
      }))
      .filter((h) => completedSets(h.sets).length);

  // A muscle workout passes the exercises picked for it
  const handleWorkoutStart = (type, list = null) => {
    setPendingWorkoutType(type);
    setPendingList(list);
    const now = new Date();
    setSelectedDate(now.toISOString().split("T")[0]);
    setSelectedTime(now.toTimeString().slice(0, 5));
    setShowDatePicker(true);
  };

  const buildExerciseEntry = (exerciseName) => {
    const history = getExerciseHistory(exerciseName);
    const last = history[0] || null;
    const rec = recommend(exerciseName, history, settings.weightJump);
    const lastSets = last ? completedSets(last.sets) : null;
    // Pre-fill the recommended weight; keep last reps only when the weight is unchanged
    const sets = Array.from({ length: settings.defaultSets }, (_, i) => {
      const prev = lastSets?.[i] || lastSets?.[lastSets.length - 1];
      const weight = rec ? rec.weight : prev?.weight || 0;
      return {
        weight,
        reps: prev && prev.weight === weight ? prev.reps : 0,
      };
    });
    return {
      id: Date.now() + Math.random(),
      name: exerciseName,
      sets,
      lastSets,
      lastDate: last?.date || null,
      rec,
    };
  };

  const startWorkout = (type) => {
    const list =
      pendingList ||
      exercises[type] ||
      customPlans.find((p) => p.id === type)?.exercises ||
      [];
    const workoutExercises = list.map((n) => buildExerciseEntry(n));
    const workoutDate =
      selectedDate && selectedTime
        ? new Date(`${selectedDate}T${selectedTime}`).toISOString()
        : new Date().toISOString();
    setActiveWorkout({
      id: Date.now(),
      type,
      date: workoutDate,
      exercises: workoutExercises,
    });
    setScreen("workout");
    setPickerMuscle(muscleFromType(type)?.id || "all");
    setPendingList(null);
    setMuscleSelection([]);
    setShowDatePicker(false);
    setSelectedDate("");
    setSelectedTime("");
  };

  const updateSet = (exId, setIdx, field, value) => {
    setActiveWorkout((aw) => ({
      ...aw,
      exercises: aw.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        const ns = [...ex.sets];
        ns[setIdx] = { ...ns[setIdx], [field]: parseFloat(value) || 0 };
        return { ...ex, sets: ns };
      }),
    }));
  };

  const addSet = (exId) => {
    setActiveWorkout((aw) => ({
      ...aw,
      exercises: aw.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            { weight: last?.weight || 0, reps: last?.reps || 0 },
          ],
        };
      }),
    }));
  };

  const removeSet = (exId, setIdx) => {
    setActiveWorkout((aw) => ({
      ...aw,
      exercises: aw.exercises.map((ex) => {
        if (ex.id !== exId || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) };
      }),
    }));
  };

  const removeExercise = (exId) => {
    setActiveWorkout((aw) => ({
      ...aw,
      exercises: aw.exercises.filter((ex) => ex.id !== exId),
    }));
  };

  const openExercisePicker = (at) => {
    setAddExerciseAt(at);
    setAddExerciseSearch("");
    setShowAddExerciseModal(true);
  };

  const insertExercise = (name) => {
    const entry = buildExerciseEntry(name);
    // A new exercise typed while a muscle is picked joins that muscle
    if (
      pickerMuscle !== "all" &&
      !exercisesForMuscle(pickerMuscle, muscleExercises, getYourExercises()).some(
        (e) => e.toLowerCase() === name.toLowerCase()
      )
    )
      setMuscleExercises({
        ...muscleExercises,
        [pickerMuscle]: [...(muscleExercises[pickerMuscle] || []), name],
      });
    setActiveWorkout((aw) => {
      const exs = [...aw.exercises];
      if (addExerciseAt === "end") {
        exs.push(entry);
      } else {
        exs.splice(addExerciseAt, 0, entry);
      }
      return { ...aw, exercises: exs };
    });
    setShowAddExerciseModal(false);
    setAddExerciseSearch("");
    setAddExerciseAt(null);
  };

  const finishWorkout = () => {
    // Advice and last-time figures are worked out fresh each session, so only keep the sets
    const done = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(({ id, name, sets }) => ({ id, name, sets })),
    };
    setWorkouts([done, ...workouts]);
    cloud.saveWorkout(done);
    setActiveWorkout(null);
    setScreen(muscleFromType(done.type) ? "muscle" : "home");
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setShowCancelModal(false);
    setScreen("home");
  };

  const deleteWorkout = (id) => {
    setWorkouts(workouts.filter((w) => w.id !== id));
    cloud.removeWorkout(id);
    setWorkoutToDelete(null);
  };

  const openMuscle = (id) => {
    setMuscleId(id);
    setMuscleSelection([]);
    setMuscleDraft("");
    setScreen("muscle");
  };

  const toggleMuscleExercise = (name) =>
    setMuscleSelection((sel) =>
      sel.includes(name) ? sel.filter((n) => n !== name) : [...sel, name]
    );

  const addMuscleExercise = () => {
    const name = muscleDraft.trim();
    if (!name) return;
    const list = exercisesForMuscle(muscleId, muscleExercises, getYourExercises());
    const existing = list.find((e) => e.toLowerCase() === name.toLowerCase());
    if (!existing)
      setMuscleExercises({
        ...muscleExercises,
        [muscleId]: [...(muscleExercises[muscleId] || []), name],
      });
    setMuscleSelection((sel) => (sel.includes(existing || name) ? sel : [...sel, existing || name]));
    setMuscleDraft("");
  };

  const removeMuscleExercise = (id, name) => {
    setMuscleExercises({
      ...muscleExercises,
      [id]: (muscleExercises[id] || []).filter((e) => e !== name),
    });
    setMuscleSelection((sel) => sel.filter((n) => n !== name));
  };

  // Completed sets per muscle since a date, and when each was last trained
  const getMuscleStats = (since) => {
    const stats = Object.fromEntries(
      MUSCLES.map((m) => [m.id, { sets: 0, sessions: 0, last: null }])
    );
    workouts.forEach((w) => {
      const hit = new Set();
      w.exercises.forEach((ex) => {
        const n = completedSets(ex.sets).length;
        if (!n) return;
        musclesFor(ex.name, muscleExercises).forEach((id) => {
          if (!stats[id]) return;
          if (!stats[id].last || new Date(w.date) > new Date(stats[id].last))
            stats[id].last = w.date;
          if (new Date(w.date) >= since) {
            stats[id].sets += n;
            hit.add(id);
          }
        });
      });
      hit.forEach((id) => stats[id].sessions++);
    });
    return stats;
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    const email = authEmail.trim();
    if (!email || !authPassword)
      return setAuthMessage({ error: "Enter your email and a password." });
    setAuthBusy(true);
    setAuthMessage(null);
    if (authMode === "signin") {
      const error = await cloud.signIn(email, authPassword);
      if (error) setAuthMessage({ error });
      else closeAuth();
    } else {
      const result = await cloud.signUp(email, authPassword);
      if (result.error || result.notice) {
        setAuthMessage(result);
        if (result.notice) setAuthMode("signin");
      } else closeAuth();
    }
    setAuthBusy(false);
  };

  const closeAuth = () => {
    setShowAuth(false);
    setAuthPassword("");
    setAuthMessage(null);
  };

  const addExerciseToList = (type) => {
    const name = (addDrafts[type] || "").trim();
    if (!name) return;
    setExercises({ ...exercises, [type]: [...(exercises[type] || []), name] });
    setAddDrafts({ ...addDrafts, [type]: "" });
  };

  const deleteExercise = (type, name) => {
    setExercises({
      ...exercises,
      [type]: exercises[type].filter((e) => e !== name),
    });
    setExerciseToDelete(null);
  };

  const openCustomModal = (idx = null) => {
    setEditingCustom(idx);
    setCustomName(idx !== null ? customPlans[idx].name : "");
    setCustomExercises(idx !== null ? [...customPlans[idx].exercises] : []);
    setCustomExerciseInput("");
    setCustomError("");
    setShowCustomModal(true);
  };

  const closeCustomModal = () => {
    setShowCustomModal(false);
    setEditingCustom(null);
  };

  const addCustomExercise = () => {
    if (!customExerciseInput.trim()) return;
    setCustomExercises([...customExercises, customExerciseInput.trim()]);
    setCustomExerciseInput("");
    setCustomError("");
  };

  const saveCustomPlan = () => {
    if (!customName.trim()) return setCustomError("Give the plan a name.");
    if (!customExercises.length)
      return setCustomError("Add at least one exercise.");
    if (editingCustom !== null) {
      const u = [...customPlans];
      u[editingCustom] = {
        ...u[editingCustom],
        name: customName.trim(),
        exercises: customExercises,
      };
      setCustomPlans(u);
    } else {
      setCustomPlans([
        ...customPlans,
        {
          id: `custom_${Date.now()}`,
          name: customName.trim(),
          exercises: customExercises,
        },
      ]);
    }
    setCustomName("");
    setCustomExercises([]);
    setCustomExerciseInput("");
    closeCustomModal();
  };

  const deleteCustomPlan = (id) => {
    setCustomPlans(customPlans.filter((p) => p.id !== id));
    setPlanToDelete(null);
  };

  const getDay = (type) => DAYS.find((d) => d.id === type);

  const getWorkoutLabel = (type) => {
    if (getDay(type)) return getDay(type).name;
    if (muscleFromType(type)) return muscleFromType(type).name;
    if (type === "push") return "Push";
    if (type === "pull") return "Pull";
    return customPlans.find((p) => p.id === type)?.name || "Custom";
  };

  const getLastDone = (type) => {
    const last = workouts
      .filter((w) => w.type === type)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return last ? relativeDay(last.date) : null;
  };

  const getCalendarData = () => {
    const base = new Date();
    const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const cm = view.getMonth(),
      cy = view.getFullYear();
    const daysInMonth = new Date(cy, cm + 1, 0).getDate();
    // Weeks start on Monday
    const startDow = (view.getDay() + 6) % 7;
    const wDates = workouts.reduce((acc, w) => {
      const d = new Date(w.date).toDateString();
      if (!acc[d]) acc[d] = [];
      acc[d].push(w.type);
      return acc;
    }, {});
    return { daysInMonth, startDow, wDates, cm, cy };
  };

  // Training split by plate colour: the three days, then everything else
  const SPLIT = [
    ...DAYS.map((d) => ({ tone: d.tone, name: d.name })),
    { tone: "other", name: "Other" },
  ];

  const countByTone = (list) =>
    SPLIT.map((s) => ({
      ...s,
      count: list.filter((w) => toneFor(w.type) === s.tone).length,
    }));

  const getInsights = () => {
    const ago = new Date();
    ago.setDate(ago.getDate() - 28);
    const last4 = workouts.filter((w) => new Date(w.date) >= ago);
    return { split: countByTone(last4), total: last4.length };
  };

  const getWeeks = (n = 8) => {
    const monday = startOfDay(new Date());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: n }, (_, i) => {
      const start = new Date(monday);
      start.setDate(start.getDate() - (n - 1 - i) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const ws = workouts.filter((w) => {
        const d = new Date(w.date);
        return d >= start && d < end;
      });
      return { start, split: countByTone(ws), total: ws.length };
    });
  };

  const filteredKnown = (
    pickerMuscle === "all"
      ? getAllKnownExercises()
      : exercisesForMuscle(pickerMuscle, muscleExercises, getYourExercises())
  ).filter((e) => e.toLowerCase().includes(addExerciseSearch.toLowerCase()));

  const plans = [
    ...DAYS.map((d) => ({
      id: d.id,
      name: d.name,
      sub: d.desc,
      exercises: exercises[d.id] || [],
    })),
    ...customPlans.map((p) => ({ id: p.id, name: p.name, sub: null, exercises: p.exercises })),
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {screen === "workout" ? (
            <>
              <button
                className="icon-btn"
                onClick={() => setShowCancelModal(true)}
                aria-label="Leave workout"
              >
                <ArrowLeft size={22} />
              </button>
              {activeWorkout && (
                <div className="workout-title">
                  <Disc type={activeWorkout.type} size={24} />
                  <span>{getWorkoutLabel(activeWorkout.type)}</span>
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={finishWorkout}>
                Finish
              </button>
            </>
          ) : (
            <>
              <div className="brand">
                <Disc type="chest" size={22} />
                Gym Tracker
              </div>
              <nav className="tabs" aria-label="Main">
                {TABS.map(([s, label, Icon]) => (
                  <button
                    key={s}
                    className="tab"
                    onClick={() => setScreen(s)}
                    aria-current={
                      screen === s || (s === "home" && screen === "muscle") ? "page" : undefined
                    }
                  >
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </div>
      </header>

      <main className="page">
        {screen === "home" && (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">Train</h1>
                <p className="page-meta">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
            </div>

            {workouts.length === 0 && (
              <p className="hint" style={{ marginBottom: 14 }}>
                Pick a muscle or a day to log your first session. Next time, the
                app suggests your weights from the last one.
              </p>
            )}

            {(() => {
              const ago = startOfDay(new Date());
              ago.setDate(ago.getDate() - 6);
              const stats = getMuscleStats(ago);
              return (
                <section aria-labelledby="muscles-title">
                  <div className="section-head">
                    <h2 className="section-title" id="muscles-title">
                      Pick a muscle
                    </h2>
                  </div>
                  <div className="muscle-grid">
                    {MUSCLES.map((m) => {
                      const st = stats[m.id];
                      return (
                        <button key={m.id} className="muscle-tile" onClick={() => openMuscle(m.id)}>
                          <Disc type={MUSCLE_TYPE_PREFIX + m.id} size={26} />
                          <span className="muscle-name">{m.name}</span>
                          <span className="muscle-sub">
                            {st.last ? relativeDay(st.last) : "Not trained yet"}
                          </span>
                          {st.sets > 0 && (
                            <span className="muscle-sub num">
                              {plural(st.sets, "set")} this week
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            <div className="section-head section">
              <h2 className="section-title">Your days</h2>
            </div>
            <div className="list">
              {plans.map((plan) => {
                const lastDone = getLastDone(plan.id);
                return (
                  <button
                    key={plan.id}
                    className="row"
                    onClick={() => handleWorkoutStart(plan.id)}
                  >
                    <Disc type={plan.id} />
                    <div className="row-main">
                      <div className="row-title">{plan.name}</div>
                      {plan.sub && <div className="row-sub">{plan.sub}</div>}
                      <div className="row-sub row-sub-quiet">
                        {plural(plan.exercises.length, "exercise")}
                        {lastDone ? ` · ${lastDone}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="row-chevron" size={18} aria-hidden="true" />
                  </button>
                );
              })}
              <button className="row row-new" onClick={() => openCustomModal()}>
                <span className="new-icon">
                  <Plus size={16} aria-hidden="true" />
                </span>
                New plan
              </button>
            </div>

            {workouts.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <h2 className="section-title">Recent</h2>
                  <button className="btn btn-secondary btn-sm" onClick={() => setScreen("history")}>
                    All history
                  </button>
                </div>
                <div className="list">
                  {workouts.slice(0, 5).map((w) => (
                    <div key={w.id} className="row">
                      <Disc type={w.type} size={24} />
                      <div className="row-main">
                        <div className="row-title">{getWorkoutLabel(w.type)}</div>
                        <div className="row-sub">
                          {plural(w.exercises.length, "exercise")} ·{" "}
                          {w.exercises.reduce((n, e) => n + completedSets(e.sets).length, 0)}{" "}
                          sets
                        </div>
                      </div>
                      <div className="row-aside">{relativeDay(w.date)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {screen === "muscle" &&
          getMuscle(muscleId) &&
          (() => {
            const muscle = getMuscle(muscleId);
            const weekAgo = startOfDay(new Date());
            weekAgo.setDate(weekAgo.getDate() - 6);
            const monthAgo = startOfDay(new Date());
            monthAgo.setDate(monthAgo.getDate() - 27);
            const week = getMuscleStats(weekAgo)[muscle.id];
            const month = getMuscleStats(monthAgo)[muscle.id];
            const list = exercisesForMuscle(muscle.id, muscleExercises, getYourExercises());
            const added = muscleExercises[muscle.id] || [];
            // Ones you've done come first, most recent at the top
            const rows = list
              .map((name, i) => {
                const history = getExerciseHistory(name);
                const sets = history.flatMap((h) => completedSets(h.sets));
                const best = sets.reduce(
                  (b, st) =>
                    !b || st.weight > b.weight || (st.weight === b.weight && st.reps > b.reps)
                      ? st
                      : b,
                  null
                );
                return {
                  name,
                  i,
                  last: history[0] || null,
                  best,
                  rec: recommend(name, history, settings.weightJump),
                };
              })
              .sort((a, b) =>
                a.last && b.last
                  ? new Date(b.last.date) - new Date(a.last.date)
                  : a.last
                  ? -1
                  : b.last
                  ? 1
                  : a.i - b.i
              );
            return (
              <>
                <div className="page-head">
                  <div className="muscle-head">
                    <button
                      className="icon-btn"
                      onClick={() => setScreen("home")}
                      aria-label="Back to Train"
                    >
                      <ArrowLeft size={22} />
                    </button>
                    <Disc type={MUSCLE_TYPE_PREFIX + muscle.id} size={30} />
                    <h1 className="page-title">{muscle.name}</h1>
                  </div>
                </div>

                <div className="panel stat-row">
                  <div>
                    <span className="stat-value num">
                      {week.last ? relativeDay(week.last) : "–"}
                    </span>
                    <span className="stat-label">Last trained</span>
                  </div>
                  <div>
                    <span className="stat-value num">{week.sets}</span>
                    <span className="stat-label">Sets this week</span>
                  </div>
                  <div>
                    <span className="stat-value num">{month.sessions}</span>
                    <span className="stat-label">Sessions in 4 weeks</span>
                  </div>
                </div>

                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Exercises</h2>
                    {muscleSelection.length > 0 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setMuscleSelection([])}>
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="hint" style={{ marginBottom: 10 }}>
                    Tick the ones you want to do, then start.
                  </p>
                  <div className="list">
                    {rows.map(({ name, last, best, rec }) => {
                      const on = muscleSelection.includes(name);
                      const style = rec && REC_STYLE[rec.action];
                      return (
                        <div key={name} className="row pick-row">
                          <button
                            className="pick-toggle"
                            aria-pressed={on}
                            onClick={() => toggleMuscleExercise(name)}
                          >
                            <span className={`tick tone-${muscle.tone}`} aria-hidden="true">
                              {on && <Check size={16} strokeWidth={3} />}
                            </span>
                            <span className="row-main">
                              <span className="row-title">{name}</span>
                              <span className="row-sub">
                                {last ? (
                                  <>
                                    <span className="num">{formatSets(completedSets(last.sets))}</span>
                                    {" · "}
                                    {relativeDay(last.date)}
                                  </>
                                ) : (
                                  "Not done yet"
                                )}
                              </span>
                              {(rec || best) && (
                                <span className="row-sub row-sub-quiet">
                                  {rec && (
                                    <span className={`next next-${rec.action}`}>
                                      <style.Icon size={13} aria-hidden="true" />
                                      {style.label(rec)} <span className="num">{rec.weight} kg</span>
                                    </span>
                                  )}
                                  {rec && best && " · "}
                                  {best && (
                                    <>
                                      Best <span className="num">{best.weight}×{best.reps}</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                          {added.includes(name) && (
                            <button
                              className="icon-btn danger"
                              onClick={() => removeMuscleExercise(muscle.id, name)}
                              aria-label={`Remove ${name} from ${muscle.name}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <form
                      className="inline-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addMuscleExercise();
                      }}
                    >
                      <input
                        className="field"
                        value={muscleDraft}
                        onChange={(e) => setMuscleDraft(e.target.value)}
                        placeholder="Add your own exercise"
                        aria-label={`New ${muscle.name} exercise`}
                      />
                      <button type="submit" className="btn btn-secondary">
                        Add
                      </button>
                    </form>
                  </div>
                </section>

                <div className="start-bar">
                  <button
                    className="btn btn-primary btn-block"
                    disabled={!muscleSelection.length}
                    onClick={() =>
                      handleWorkoutStart(
                        MUSCLE_TYPE_PREFIX + muscle.id,
                        // Keep the order they're listed in
                        rows.map((r) => r.name).filter((n) => muscleSelection.includes(n))
                      )
                    }
                  >
                    {muscleSelection.length
                      ? `Start ${muscle.name} · ${plural(muscleSelection.length, "exercise")}`
                      : "Tick exercises to start"}
                  </button>
                </div>
              </>
            );
          })()}

        {screen === "calendar" &&
          (() => {
            const { daysInMonth, startDow, wDates, cm, cy } = getCalendarData();
            const monthCount = workouts.filter((w) => {
              const d = new Date(w.date);
              return d.getMonth() === cm && d.getFullYear() === cy;
            }).length;
            return (
              <>
                <div className="page-head">
                  <div>
                    <h1 className="page-title">
                      {MONTHS[cm]} {cy !== new Date().getFullYear() ? cy : ""}
                    </h1>
                    <p className="page-meta">
                      {monthCount} {monthCount === 1 ? "workout" : "workouts"}
                    </p>
                  </div>
                  <div className="month-nav">
                    <button
                      className="icon-btn"
                      onClick={() => setMonthOffset(monthOffset - 1)}
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setMonthOffset(monthOffset + 1)}
                      aria-label="Next month"
                      disabled={monthOffset >= 0}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
                <div className="cal">
                  <div className="cal-grid">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <div key={d} className="cal-dow">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: startDow }).map((_, i) => (
                      <div key={`e${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const ds = new Date(cy, cm, day).toDateString();
                      const dw = wDates[ds] || [];
                      const isToday = ds === new Date().toDateString();
                      const tones = [...new Set(dw.map(toneFor))];
                      return (
                        <div
                          key={day}
                          className={`day${dw.length ? " has" : ""}${isToday ? " today" : ""}`}
                        >
                          {day}
                          <div className="day-dots">
                            {tones.map((t) => (
                              <span key={t} className={`dot tone-${t}`} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="legend">
                  {DAYS.map((d) => (
                    <span key={d.id}>
                      <span className={`dot tone-${d.tone}`} /> {d.name}
                    </span>
                  ))}
                  <span>
                    <span className="dot tone-other" /> Other
                  </span>
                </div>
              </>
            );
          })()}

        {screen === "insights" &&
          (() => {
            const { split, total } = getInsights();
            const weeks = getWeeks();
            const peak = Math.max(3, ...weeks.map((w) => w.total));
            return (
              <>
                <div className="page-head">
                  <h1 className="page-title">Stats</h1>
                </div>

                {workouts.length === 0 ? (
                  <div className="empty">
                    <h2>Nothing to chart yet</h2>
                    <p>Log a few sessions and your weekly training shows up here.</p>
                    <button className="btn btn-primary" onClick={() => setScreen("home")}>
                      Start a workout
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="panel">
                      <p className="summary">
                        <strong>{total}</strong> {total === 1 ? "workout" : "workouts"} in
                        the last 4 weeks, about{" "}
                        <strong>{(total / 4).toFixed(1)}</strong> a week.
                      </p>
                      {total > 0 && (
                        <>
                          <div className="split-bar" aria-hidden="true">
                            {split
                              .filter((s) => s.count > 0)
                              .map((s) => (
                                <span
                                  key={s.tone}
                                  className={`tone-${s.tone}`}
                                  style={{ flex: s.count }}
                                />
                              ))}
                          </div>
                          <div className="legend" style={{ marginTop: 8 }}>
                            {split
                              .filter((s) => s.count > 0 || s.tone !== "other")
                              .map((s) => (
                                <span key={s.tone}>
                                  <span className={`dot tone-${s.tone}`} /> {s.name}{" "}
                                  {s.count}
                                </span>
                              ))}
                          </div>
                        </>
                      )}
                    </div>

                    <section className="section">
                      <div className="section-head">
                        <h2 className="section-title">Last 8 weeks</h2>
                      </div>
                      <div className="panel">
                        <div
                          className="weeks"
                          role="img"
                          aria-label={`Workouts per week: ${weeks
                            .map((w) => w.total)
                            .join(", ")}`}
                        >
                          {weeks.map((w, i) => (
                            <div key={i} className="week">
                              {w.total === 0 ? (
                                <span className="week-empty" />
                              ) : (
                                w.split
                                  .filter((s) => s.count > 0)
                                  .map((s) => (
                                    <span
                                      key={s.tone}
                                      className={`week-seg tone-${s.tone}`}
                                      style={{ height: `${(s.count / peak) * 100}%` }}
                                    />
                                  ))
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="week-labels">
                          {weeks.map((w, i) => (
                            <span key={i} className={i === weeks.length - 1 ? "current" : ""}>
                              {i === weeks.length - 1 ? "Now" : w.start.getDate()}
                              <br />
                              {(i === 0 ||
                                w.start.getMonth() !== weeks[i - 1].start.getMonth()) &&
                                MONTHS[w.start.getMonth()].slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </section>

                    {(() => {
                      const ago = startOfDay(new Date());
                      ago.setDate(ago.getDate() - 6);
                      const stats = getMuscleStats(ago);
                      const top = Math.max(1, ...MUSCLES.map((m) => stats[m.id].sets));
                      return (
                        <section className="section">
                          <div className="section-head">
                            <h2 className="section-title">Sets by muscle, last 7 days</h2>
                          </div>
                          <div className="list">
                            {MUSCLES.map((m) => (
                              <button
                                key={m.id}
                                className="row muscle-bar-row"
                                onClick={() => openMuscle(m.id)}
                              >
                                <span className="muscle-bar-name">{m.name}</span>
                                <span className="muscle-bar" aria-hidden="true">
                                  <span
                                    className={`tone-${m.tone}`}
                                    style={{ width: `${(stats[m.id].sets / top) * 100}%` }}
                                  />
                                </span>
                                <span className="muscle-bar-count num">{stats[m.id].sets}</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })()}
                  </>
                )}

                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Progression rules</h2>
                  </div>
                  <div className="panel">
                    <dl className="rules">
                      <dt>Rep range</dt>
                      <dd>
                        {REP_MIN}–{REP_MAX} reps on every working set.
                      </dd>
                      <dt>{REP_MAX}+ every set</dt>
                      <dd>Go up by the smallest jump ({settings.weightJump} kg).</dd>
                      <dt>
                        {REP_MIN}–{REP_MAX - 1} reps
                      </dt>
                      <dd>Same weight, add a rep where you can.</dd>
                      <dt>Under {REP_MIN} twice</dt>
                      <dd>Drop the weight a step.</dd>
                      <dt>Rest</dt>
                      <dd>2–3 minutes between sets so reps don't drop off.</dd>
                    </dl>
                  </div>
                </section>
              </>
            );
          })()}

        {screen === "history" && (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">History</h1>
                {workouts.length > 0 && (
                  <p className="page-meta">
                    {workouts.length} {workouts.length === 1 ? "session" : "sessions"}
                  </p>
                )}
              </div>
            </div>
            {workouts.length === 0 ? (
              <div className="empty">
                <h2>No sessions yet</h2>
                <p>Finished workouts land here with every set you logged.</p>
                <button className="btn btn-primary" onClick={() => setScreen("home")}>
                  Start a workout
                </button>
              </div>
            ) : (
              workouts.map((w) => (
                <article key={w.id} className="list session">
                  <div className="session-head">
                    <Disc type={w.type} size={28} />
                    <div className="row-main">
                      <div className="row-title">{getWorkoutLabel(w.type)}</div>
                      <div className="row-sub">
                        {new Date(w.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        {" · "}
                        {new Date(w.date).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <button
                      className="icon-btn danger"
                      onClick={() => setWorkoutToDelete(w)}
                      aria-label={`Delete ${getWorkoutLabel(w.type)} workout`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="session-lines">
                    {w.exercises.length === 0 && (
                      <p className="hint">No exercises logged.</p>
                    )}
                    {w.exercises.map((ex, i) => {
                      const done = completedSets(ex.sets);
                      const top = done.reduce(
                        (best, s) => ((s.weight || 0) > (best.weight || 0) ? s : best),
                        done[0] || { weight: 0, reps: 0 }
                      );
                      return (
                        <div key={i} className="session-line">
                          <span>{ex.name}</span>
                          {done.length ? (
                            <span>
                              {top.weight} × {top.reps}
                              <span style={{ color: "var(--text-3)" }}>
                                {" "}· {done.length} {done.length === 1 ? "set" : "sets"}
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-3)" }}>Skipped</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))
            )}
          </>
        )}

        {screen === "manage" && (
          <>
            <div className="page-head">
              <h1 className="page-title">Plans</h1>
            </div>

            <div className="list account">
              {!cloud.enabled ? (
                <div className="setting-row">
                  <CloudOff size={20} className="account-icon" aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">Saved on this device only</div>
                    <div className="row-sub">
                      Connect a Supabase project to back up and sync your workouts. See
                      SUPABASE.md.
                    </div>
                  </div>
                </div>
              ) : !cloud.ready ? (
                <div className="setting-row">
                  <Cloud size={20} className="account-icon" aria-hidden="true" />
                  <div className="row-main row-sub">Checking your account…</div>
                </div>
              ) : !cloud.user ? (
                <div className="setting-row">
                  <CloudOff size={20} className="account-icon" aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">Back up your workouts</div>
                    <div className="row-sub">Sign in to save them to the cloud and use more than one device.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAuth(true)}>
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="setting-row">
                  <Cloud size={20} className="account-icon" aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">{cloud.user.email}</div>
                    <div className={`row-sub sync-${cloud.status}`} role="status">
                      {cloud.status === "offline"
                        ? `Offline · ${plural(cloud.pending, "change")} waiting to upload`
                        : cloud.status === "error"
                        ? `Couldn't sync: ${cloud.error}`
                        : cloud.status === "synced" && !cloud.pending
                        ? "Synced"
                        : "Syncing…"}
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={cloud.syncNow}
                    disabled={cloud.status === "syncing"}
                    aria-label="Sync now"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSignOut(true)}>
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <div className="list section">
              <div className="setting-row">
                <div className="row-main">
                  <div className="row-title">Sets per exercise</div>
                  <div className="row-sub">You can still add a set during a workout.</div>
                </div>
                <Segmented
                  label="Sets per exercise"
                  options={[2, 3]}
                  value={settings.defaultSets}
                  onChange={(n) => setSettings({ ...settings, defaultSets: n })}
                />
              </div>
              <div className="setting-row">
                <div className="row-main">
                  <div className="row-title">Weight jump</div>
                  <div className="row-sub">How much to go up or down by, in kg.</div>
                </div>
                <Segmented
                  label="Weight jump in kg"
                  options={[1, 2, 2.5, 5]}
                  value={settings.weightJump}
                  onChange={(n) => setSettings({ ...settings, weightJump: n })}
                />
              </div>
            </div>

            {DAYS.map((day) => (
              <section key={day.id} className="section">
                <div className="section-head">
                  <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Disc type={day.id} size={20} />
                    {day.name}
                  </h2>
                </div>
                <div className="list">
                  {(exercises[day.id] || []).map((ex, i) => (
                    <div key={i} className="row" style={{ padding: "6px 6px 6px 16px" }}>
                      <div className="row-main">{ex}</div>
                      <button
                        className="icon-btn danger"
                        onClick={() => setExerciseToDelete({ type: day.id, name: ex })}
                        aria-label={`Remove ${ex}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                  <form
                    className="inline-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addExerciseToList(day.id);
                    }}
                  >
                    <input
                      className="field"
                      value={addDrafts[day.id] || ""}
                      onChange={(e) => setAddDrafts({ ...addDrafts, [day.id]: e.target.value })}
                      placeholder={ADD_PLACEHOLDERS[day.id]}
                      aria-label={`New ${day.name} exercise`}
                    />
                    <button type="submit" className="btn btn-secondary">
                      Add
                    </button>
                  </form>
                </div>
              </section>
            ))}

            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Custom plans</h2>
              </div>
              <div className="list">
                {customPlans.map((plan, idx) => (
                  <div key={plan.id} className="row" style={{ padding: "8px 6px 8px 16px" }}>
                    <Disc type={plan.id} size={24} />
                    <div className="row-main">
                      <div className="row-title">{plan.name}</div>
                      <div className="row-sub">{plural(plan.exercises.length, "exercise")}</div>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => openCustomModal(idx)}
                      aria-label={`Edit ${plan.name}`}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => setPlanToDelete(plan)}
                      aria-label={`Delete ${plan.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <button className="row row-new" onClick={() => openCustomModal()}>
                  <span className="new-icon">
                    <Plus size={16} aria-hidden="true" />
                  </span>
                  New plan
                </button>
              </div>
            </section>
          </>
        )}

        {screen === "workout" &&
          activeWorkout &&
          (() => {
            // Workouts started before progression advice don't carry these yet
            const withHistory = activeWorkout.exercises.map((exercise) => {
              if (exercise.lastDate !== undefined) return exercise;
              const history = getExerciseHistory(exercise.name);
              return {
                ...exercise,
                rec: recommend(exercise.name, history, settings.weightJump),
                lastSets: history[0] ? completedSets(history[0].sets) : null,
                lastDate: history[0]?.date || null,
              };
            });
            let upCount = 0,
              doneCount = 0,
              setCount = 0;
            withHistory.forEach((ex) =>
              ex.sets.forEach((s, i) => {
                setCount++;
                const state = compareSet(s, ex.lastSets?.[i]);
                if (state !== "todo") doneCount++;
                if (state === "up") upCount++;
              })
            );
            return (
              <>
                <div className="workout-meta">
                  <span>
                    {new Date(activeWorkout.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {", "}
                    {new Date(activeWorkout.date).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    {doneCount} of {setCount} sets logged
                  </span>
                  {upCount > 0 && (
                    <span className="up-count">
                      Up on {upCount} {upCount === 1 ? "set" : "sets"}
                    </span>
                  )}
                </div>

                {withHistory.length === 0 && (
                  <div className="empty" style={{ marginTop: 12 }}>
                    <h2>This workout is empty</h2>
                    <p>Add an exercise to start logging sets.</p>
                  </div>
                )}

                {withHistory.map((exercise, index) => {
                  const { rec, lastSets, lastDate } = exercise;
                  const style = rec && REC_STYLE[rec.action];
                  return (
                    <div key={exercise.id}>
                      <button
                        className="insert"
                        onClick={() => openExercisePicker(index)}
                        aria-label={`Insert exercise before ${exercise.name}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>

                      <section className="exercise" aria-label={exercise.name}>
                        <div className="exercise-head">
                          <div className="exercise-name">
                            <h2>{exercise.name}</h2>
                            {lastDate && (
                              <p className="exercise-meta">
                                Last done {relativeDay(lastDate).toLowerCase()}
                              </p>
                            )}
                          </div>
                          <button
                            className="icon-btn danger"
                            onClick={() => removeExercise(exercise.id)}
                            aria-label={`Remove ${exercise.name}`}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {rec ? (
                          <p className={`rec rec-${rec.action}`}>
                            <style.Icon size={15} aria-hidden="true" />
                            <span>
                              <strong>
                                {style.label(rec)} {rec.weight} kg
                              </strong>{" "}
                              · {rec.reason}
                            </span>
                          </p>
                        ) : (
                          !lastSets?.length && (
                            <p className="rec">
                              <span>
                                First time: pick a weight you can do for {REP_MIN}–{REP_MAX}{" "}
                                reps.
                              </span>
                            </p>
                          )
                        )}

                        <div className="sets">
                          <div className="set-head" aria-hidden="true">
                            <span />
                            <span>Set</span>
                            <span>Last</span>
                            <span>kg</span>
                            <span>Reps</span>
                            <span />
                          </div>
                          {exercise.sets.map((set, idx) => {
                            const last = lastSets?.[idx];
                            const state = compareSet(set, last);
                            return (
                              <div key={idx} className="set-row">
                                <span
                                  key={state}
                                  className="plate"
                                  data-state={state}
                                  title={STATE_LABEL[state]}
                                >
                                  <span className="sr-only">{STATE_LABEL[state]}</span>
                                </span>
                                <span className="set-no">{idx + 1}</span>
                                <span className="set-last">
                                  {last ? `${last.weight}×${last.reps}` : "–"}
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  className="num-input"
                                  value={set.weight || ""}
                                  placeholder="0"
                                  aria-label={`Set ${idx + 1} weight in kg`}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    updateSet(exercise.id, idx, "weight", e.target.value)
                                  }
                                />
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  className="num-input"
                                  value={set.reps || ""}
                                  placeholder="0"
                                  aria-label={`Set ${idx + 1} reps`}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    updateSet(exercise.id, idx, "reps", e.target.value)
                                  }
                                />
                                {exercise.sets.length > 1 ? (
                                  <button
                                    className="icon-btn danger"
                                    style={{ width: 32 }}
                                    onClick={() => removeSet(exercise.id, idx)}
                                    aria-label={`Remove set ${idx + 1}`}
                                  >
                                    <X size={16} />
                                  </button>
                                ) : (
                                  <span />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <button className="add-set" onClick={() => addSet(exercise.id)}>
                          <Plus size={16} aria-hidden="true" />
                          Add set
                        </button>
                      </section>
                    </div>
                  );
                })}

                <button className="add-exercise" onClick={() => openExercisePicker("end")}>
                  <Plus size={18} aria-hidden="true" />
                  Add exercise
                </button>
              </>
            );
          })()}
      </main>

      {showAddExerciseModal && (
        <Sheet title="Add exercise" onClose={() => setShowAddExerciseModal(false)}>
          <input
            type="search"
            className="field"
            value={addExerciseSearch}
            onChange={(e) => setAddExerciseSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addExerciseSearch.trim())
                insertExercise(filteredKnown[0] || addExerciseSearch.trim());
            }}
            placeholder="Search or type a new exercise"
            aria-label="Search exercises"
            autoFocus
          />
          <div className="filter-chips" role="group" aria-label="Filter by muscle">
            {[{ id: "all", name: "All" }, ...MUSCLES].map((m) => (
              <button
                key={m.id}
                aria-pressed={pickerMuscle === m.id}
                onClick={() => setPickerMuscle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="pick-list" style={{ marginTop: 10 }}>
            {addExerciseSearch.trim() &&
              !filteredKnown.some(
                (e) => e.toLowerCase() === addExerciseSearch.trim().toLowerCase()
              ) && (
                <button
                  className="pick pick-new"
                  onClick={() => insertExercise(addExerciseSearch.trim())}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add “{addExerciseSearch.trim()}”
                </button>
              )}
            {filteredKnown.map((ex) => (
              <button key={ex} className="pick" onClick={() => insertExercise(ex)}>
                {ex}
              </button>
            ))}
            {!addExerciseSearch.trim() && filteredKnown.length === 0 && (
              <p className="hint" style={{ padding: "8px 12px" }}>
                Type an exercise name to add it.
              </p>
            )}
          </div>
        </Sheet>
      )}

      {showCancelModal && (
        <ConfirmSheet
          title="Discard this workout?"
          body="Nothing you've logged in this session will be saved."
          cancelLabel="Keep training"
          confirmLabel="Discard"
          onConfirm={cancelWorkout}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showDatePicker && (
        <Sheet
          title={`Start ${getWorkoutLabel(pendingWorkoutType)}`}
          onClose={() => setShowDatePicker(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowDatePicker(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => startWorkout(pendingWorkoutType)}>
                Start workout
              </button>
            </>
          }
        >
          <div className="stack">
            <p className="hint">Change the date and time if you're logging a past session.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
              <div>
                <label className="label" htmlFor="start-date">
                  Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  className="field"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="start-time">
                  Time
                </label>
                <input
                  id="start-time"
                  type="time"
                  className="field"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {showCustomModal && (
        <Sheet
          title={editingCustom !== null ? "Edit plan" : "New plan"}
          onClose={closeCustomModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeCustomModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveCustomPlan}>
                Save plan
              </button>
            </>
          }
        >
          <div className="stack">
            <div>
              <label className="label" htmlFor="plan-name">
                Name
              </label>
              <input
                id="plan-name"
                className="field"
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                  setCustomError("");
                }}
                placeholder="Leg day"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="plan-exercise">
                Exercises
              </label>
              {customExercises.length > 0 && (
                <div className="chip-list">
                  {customExercises.map((ex, i) => (
                    <div key={i} className="chip">
                      <span className="num">{i + 1}</span>
                      <span>{ex}</span>
                      <button
                        className="icon-btn danger"
                        onClick={() =>
                          setCustomExercises(customExercises.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Remove ${ex}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form
                style={{ display: "flex", gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  addCustomExercise();
                }}
              >
                <input
                  id="plan-exercise"
                  className="field"
                  value={customExerciseInput}
                  onChange={(e) => setCustomExerciseInput(e.target.value)}
                  placeholder="Romanian Deadlift"
                />
                <button type="submit" className="btn btn-secondary" aria-label="Add exercise to plan">
                  <Plus size={18} />
                </button>
              </form>
              {customError && <p className="field-error">{customError}</p>}
            </div>
          </div>
        </Sheet>
      )}

      {exerciseToDelete && (
        <ConfirmSheet
          title="Remove exercise?"
          body={`“${exerciseToDelete.name}” comes off your ${getWorkoutLabel(
            exerciseToDelete.type
          )} day. Past workouts keep it.`}
          confirmLabel="Remove"
          onConfirm={() => deleteExercise(exerciseToDelete.type, exerciseToDelete.name)}
          onClose={() => setExerciseToDelete(null)}
        />
      )}

      {planToDelete && (
        <ConfirmSheet
          title={`Delete ${planToDelete.name}?`}
          body="The plan goes, but workouts you've already logged with it stay in your history."
          confirmLabel="Delete plan"
          onConfirm={() => deleteCustomPlan(planToDelete.id)}
          onClose={() => setPlanToDelete(null)}
        />
      )}

      {showAuth && (
        <Sheet
          title={authMode === "signin" ? "Sign in" : "Create account"}
          onClose={closeAuth}
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeAuth}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="auth-form" disabled={authBusy}>
                {authBusy ? "One sec…" : authMode === "signin" ? "Sign in" : "Create account"}
              </button>
            </>
          }
        >
          <form id="auth-form" className="stack" onSubmit={submitAuth}>
            <p className="hint">
              {authMode === "signin"
                ? "Your workouts, plans and settings sync to your account."
                : "Workouts already on this device upload to the new account."}
            </p>
            <div>
              <label className="label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                className="field"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                className="field"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
              {authMessage?.error && <p className="field-error">{authMessage.error}</p>}
              {authMessage?.notice && <p className="field-note">{authMessage.notice}</p>}
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthMessage(null);
              }}
            >
              {authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        </Sheet>
      )}

      {showSignOut && (
        <ConfirmSheet
          title="Sign out?"
          body={
            cloud.pending
              ? `${cloud.pending === 1 ? "1 change hasn't" : `${cloud.pending} changes haven't`} uploaded yet and will be lost. Workouts already synced stay in your account.`
              : "Your workouts stay in your account. This device's copy is cleared until you sign in again."
          }
          confirmLabel="Sign out"
          onConfirm={() => {
            setShowSignOut(false);
            cloud.signOut();
          }}
          onClose={() => setShowSignOut(false)}
        />
      )}

      {workoutToDelete && (
        <ConfirmSheet
          title="Delete this workout?"
          body={`${getWorkoutLabel(workoutToDelete.type)} on ${new Date(
            workoutToDelete.date
          ).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })} will be removed for good.`}
          confirmLabel="Delete"
          onConfirm={() => deleteWorkout(workoutToDelete.id)}
          onClose={() => setWorkoutToDelete(null)}
        />
      )}
    </div>
  );
}
