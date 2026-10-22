import React, { useState, useEffect } from "react";
import {
  Dumbbell,
  TrendingUp,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
  ArrowLeft,
  Zap,
} from "lucide-react";

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

const DAYS = [
  {
    id: "back",
    name: "Back",
    desc: "Lats, Upper Back, Rear Delts",
    card: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
    tag: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    btn: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
    text: "text-blue-400",
    icon: "text-blue-500",
    dot: "bg-blue-500",
  },
  {
    id: "chest",
    name: "Chest",
    desc: "Presses, Flys",
    card: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20",
    tag: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    btn: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
    text: "text-rose-400",
    icon: "text-rose-500",
    dot: "bg-rose-500",
  },
  {
    id: "shoulders_arms",
    name: "Shoulders & Arms",
    desc: "Delts, Biceps, Triceps",
    card: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
    tag: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    btn: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    text: "text-amber-400",
    icon: "text-amber-500",
    dot: "bg-amber-500",
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
      : `Get every set to ${REP_MAX} at ${weight}kg`,
  };
};

export default function GymTracker() {
  // Read saved data during the first render so nothing can overwrite it before it loads
  const [activeWorkout, setActiveWorkout] = useState(() =>
    loadSaved("activeWorkout", null)
  );
  const [screen, setScreen] = useState(() =>
    loadSaved("activeWorkout", null) ? "workout" : "home"
  );
  const [workouts, setWorkouts] = useState(() => loadSaved("gymWorkouts", []));
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [pendingWorkoutType, setPendingWorkoutType] = useState(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customExercises, setCustomExercises] = useState([]);
  const [customExerciseInput, setCustomExerciseInput] = useState("");
  const [editingCustom, setEditingCustom] = useState(null);
  const [addExerciseAt, setAddExerciseAt] = useState(null);
  const [addExerciseSearch, setAddExerciseSearch] = useState("");
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [customPlans, setCustomPlans] = useState(() =>
    loadSaved("gymCustomPlans", [])
  );

  const [exercises, setExercises] = useState(() =>
    migrateExercises(loadSaved("gymExercises", null))
  );
  const [settings, setSettings] = useState(() => ({
    defaultSets: 2,
    weightJump: 2.5,
    ...loadSaved("gymSettings", {}),
  }));

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

  // Save active workout to localStorage
  useEffect(() => {
    if (activeWorkout) {
      localStorage.setItem("activeWorkout", JSON.stringify(activeWorkout));
    } else {
      localStorage.removeItem("activeWorkout");
    }
  }, [activeWorkout]);

  const getAllKnownExercises = () => {
    const fromPlans = Object.values(exercises).flat();
    const fromHistory = workouts.flatMap((w) => w.exercises.map((e) => e.name));
    const fromCustom = customPlans.flatMap((p) => p.exercises);
    return [...new Set([...fromPlans, ...fromHistory, ...fromCustom])].sort();
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

  const handleWorkoutStart = (type) => {
    setPendingWorkoutType(type);
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

  const insertExercise = (name) => {
    const entry = buildExerciseEntry(name);
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
    const updated = [activeWorkout, ...workouts];
    setWorkouts(updated);
    localStorage.setItem("gymWorkouts", JSON.stringify(updated));
    setActiveWorkout(null);
    setScreen("home");
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setShowCancelModal(false);
    setScreen("home");
  };
  const deleteWorkout = (id) =>
    setWorkouts(workouts.filter((w) => w.id !== id));

  const addExerciseToList = (type) => {
    if (newExerciseName.trim()) {
      setExercises({
        ...exercises,
        [type]: [...exercises[type], newExerciseName.trim()],
      });
      setNewExerciseName("");
      setShowExerciseModal(false);
      setEditingType(null);
    }
  };

  const deleteExercise = (type, name) => {
    setExercises({
      ...exercises,
      [type]: exercises[type].filter((e) => e !== name),
    });
    setExerciseToDelete(null);
  };

  const saveCustomPlan = () => {
    if (!customName.trim() || !customExercises.length) return;
    if (editingCustom !== null) {
      const u = [...customPlans];
      u[editingCustom] = {
        ...u[editingCustom],
        name: customName,
        exercises: customExercises,
      };
      setCustomPlans(u);
    } else {
      setCustomPlans([
        ...customPlans,
        {
          id: `custom_${Date.now()}`,
          name: customName,
          exercises: customExercises,
        },
      ]);
    }
    setCustomName("");
    setCustomExercises([]);
    setCustomExerciseInput("");
    setShowCustomModal(false);
    setEditingCustom(null);
  };

  const deleteCustomPlan = (id) =>
    setCustomPlans(customPlans.filter((p) => p.id !== id));

  const editCustomPlan = (idx) => {
    setEditingCustom(idx);
    setCustomName(customPlans[idx].name);
    setCustomExercises([...customPlans[idx].exercises]);
    setShowCustomModal(true);
  };

  const getColor = (cur, last) => {
    if (last == null || !cur) return "#52525b";
    const c = parseFloat(cur) || 0,
      l = parseFloat(last) || 0;
    return c > l ? "#10b981" : c < l ? "#ef4444" : "#52525b";
  };

  const getDay = (type) => DAYS.find((d) => d.id === type);

  const getWorkoutLabel = (type) => {
    if (getDay(type)) return getDay(type).name;
    if (type === "push") return "Push";
    if (type === "pull") return "Pull";
    return customPlans.find((p) => p.id === type)?.name || "Custom";
  };

  const getWorkoutColor = (type) =>
    getDay(type)?.tag ||
    "bg-purple-500/10 border-purple-500/20 text-purple-400";

  const getCalendarData = () => {
    const today = new Date();
    const cm = today.getMonth(),
      cy = today.getFullYear();
    const firstDay = new Date(cy, cm, 1);
    const daysInMonth = new Date(cy, cm + 1, 0).getDate();
    const startDow = firstDay.getDay();
    const wDates = workouts.reduce((acc, w) => {
      const d = new Date(w.date).toDateString();
      if (!acc[d]) acc[d] = [];
      acc[d].push(w.type);
      return acc;
    }, {});
    return { daysInMonth, startDow, wDates, cm, cy };
  };

  const getInsights = () => {
    const ago = new Date();
    ago.setDate(ago.getDate() - 28);
    const last4 = workouts.filter((w) => new Date(w.date) >= ago);
    const byDay = DAYS.map((d) => ({
      ...d,
      count: last4.filter((w) => w.type === d.id).length,
    }));
    const other = last4.length - byDay.reduce((s, d) => s + d.count, 0);
    if (other > 0)
      byDay.push({
        id: "other",
        name: "Custom / Old Push & Pull",
        text: "text-purple-400",
        dot: "bg-purple-500",
        count: other,
      });
    return { byDay, total: last4.length };
  };

  const filteredKnown = getAllKnownExercises().filter((e) =>
    e.toLowerCase().includes(addExerciseSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          {screen === "workout" ? (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Dumbbell size={20} />
            </div>
          )}
          <h1 className="text-lg font-semibold">Gym Tracker</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Nav */}
      {screen !== "workout" && (
        <div className="bg-zinc-900/50 border-b border-zinc-800/50 sticky top-[65px] z-40">
          <div className="max-w-3xl mx-auto px-5 flex gap-6">
            {[
              ["home", "Workouts"],
              ["calendar", "Calendar"],
              ["insights", "Stats"],
              ["history", "History"],
              ["manage", "Settings"],
            ].map(([s, label]) => (
              <button
                key={s}
                onClick={() => setScreen(s)}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  screen === s
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-5 py-6">
        {screen === "home" && (
          <div>
            {customPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleWorkoutStart(plan.id)}
                className="w-full mb-3 text-left"
              >
                <div className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-2xl p-6 transition">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-lg font-semibold text-purple-400 mb-0.5">
                        {plan.name}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {plan.exercises.length} exercises
                      </div>
                    </div>
                    <ArrowLeft
                      className="rotate-180 text-purple-500"
                      size={20}
                    />
                  </div>
                </div>
              </button>
            ))}

            {DAYS.map((day) => (
              <button
                key={day.id}
                onClick={() => handleWorkoutStart(day.id)}
                className="w-full mb-3 text-left"
              >
                <div
                  className={`${day.card} border rounded-2xl p-6 transition`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div
                        className={`text-lg font-semibold ${day.text} mb-0.5`}
                      >
                        {day.name}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {day.desc} • {exercises[day.id]?.length || 0}{" "}
                        exercises
                      </div>
                    </div>
                    <ArrowLeft className={`rotate-180 ${day.icon}`} size={20} />
                  </div>
                </div>
              </button>
            ))}

            <button
              onClick={() => {
                setEditingCustom(null);
                setCustomName("");
                setCustomExercises([]);
                setShowCustomModal(true);
              }}
              className="w-full mb-6"
            >
              <div className="bg-zinc-900/50 hover:bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-6 transition">
                <div className="text-center text-sm font-medium text-zinc-500">
                  + Create Custom Workout
                </div>
              </div>
            </button>

            {workouts.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">
                  Recent
                </h3>
                <div className="space-y-2">
                  {workouts.slice(0, 5).map((w) => (
                    <div
                      key={w.id}
                      className={`border rounded-xl p-4 ${getWorkoutColor(
                        w.type
                      )}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium">
                            {getWorkoutLabel(w.type)}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {new Date(w.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {w.exercises.length} exercises
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "calendar" &&
          (() => {
            const { daysInMonth, startDow, wDates, cm, cy } = getCalendarData();
            const months = [
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
            return (
              <div>
                <h2 className="text-2xl font-semibold mb-6">
                  <Calendar size={24} className="inline mr-2 mb-1" />
                  {months[cm]} {cy}
                </h2>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                  <div className="grid grid-cols-7 gap-2 mb-3">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <div
                          key={d}
                          className="text-center text-xs font-medium text-zinc-500 py-2"
                        >
                          {d}
                        </div>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: startDow }).map((_, i) => (
                      <div key={`e${i}`} className="aspect-square" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const ds = new Date(cy, cm, day).toDateString();
                      const dw = wDates[ds] || [];
                      const isToday = ds === new Date().toDateString();
                      return (
                        <div
                          key={day}
                          className={`aspect-square flex flex-col items-center justify-center rounded-xl border transition ${
                            isToday
                              ? "border-cyan-500 bg-cyan-500/10"
                              : dw.length
                              ? "border-zinc-700 bg-zinc-800/50"
                              : "border-zinc-800/50"
                          }`}
                        >
                          <span className="text-sm font-medium">{day}</span>
                          {dw.length > 0 && (
                            <div className="flex gap-0.5 mt-1">
                              {DAYS.filter((d) => dw.includes(d.id)).map((d) => (
                                <div
                                  key={d.id}
                                  className={`w-1 h-1 rounded-full ${d.dot}`}
                                />
                              ))}
                              {dw.some((t) => !getDay(t)) && (
                                <div className="w-1 h-1 rounded-full bg-purple-500" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-4 text-xs">
                  {DAYS.map((d) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${d.dot}`} />
                      <span className="text-zinc-500">{d.name}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-zinc-500">Other</span>
                  </div>
                </div>
                <div className="mt-5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <div className="text-sm text-zinc-500 mb-1">This Month</div>
                  <div className="text-3xl font-bold text-cyan-400">
                    {
                      workouts.filter((w) => {
                        const d = new Date(w.date);
                        return d.getMonth() === cm && d.getFullYear() === cy;
                      }).length
                    }
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">
                    workouts completed
                  </div>
                </div>
              </div>
            );
          })()}

        {screen === "insights" &&
          (() => {
            const { byDay, total } = getInsights();
            return (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Training Stats</h2>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                    <div className="text-xs text-zinc-500 mb-1">
                      Last 4 Weeks
                    </div>
                    <div className="text-3xl font-bold text-cyan-400">
                      {total}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">workouts</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
                    <div className="text-xs text-zinc-500 mb-1">Weekly Avg</div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {total > 0 ? (total / 4).toFixed(1) : 0}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">per week</div>
                  </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 mb-5">
                  <h3 className="text-sm font-medium mb-4">Workout Split</h3>
                  <div className="space-y-4">
                    {byDay.map((d) => (
                      <div key={d.id}>
                        <div className="flex justify-between mb-2 text-sm">
                          <span className={d.text}>{d.name}</span>
                          <span className="font-medium">{d.count}</span>
                        </div>
                        <div className="bg-zinc-800 rounded-full h-2">
                          <div
                            className={`${d.dot} h-2 rounded-full transition-all`}
                            style={{
                              width: `${
                                total > 0 ? (d.count / total) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-5">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-cyan-400">
                    <Zap size={16} /> Progressive Overload Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>
                      • <strong>Rep range:</strong> {REP_MIN}-{REP_MAX} reps
                      on every working set
                    </li>
                    <li>
                      • <strong>{REP_MAX}+ on every set:</strong> go up by the
                      smallest jump ({settings.weightJump}kg)
                    </li>
                    <li>
                      • <strong>{REP_MIN}-{REP_MAX - 1} reps:</strong> same
                      weight, add a rep where you can
                    </li>
                    <li>
                      • <strong>Under {REP_MIN} twice in a row:</strong> drop
                      the weight a step
                    </li>
                    <li>
                      • <strong>Rest:</strong> 2-3 min between sets so reps
                      don't drop off
                    </li>
                  </ul>
                </div>
              </div>
            );
          })()}

        {screen === "history" && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Workout History</h2>
            {workouts.length === 0 ? (
              <div className="text-center py-20 text-zinc-600">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
                <p>No workouts yet!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.map((w) => (
                  <div
                    key={w.id}
                    className={`border rounded-2xl p-5 ${getWorkoutColor(
                      w.type
                    )}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-lg font-semibold">
                          {getWorkoutLabel(w.type)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {new Date(w.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteWorkout(w.id)}
                        className="text-zinc-600 hover:text-rose-400 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {w.exercises.map((ex, i) => (
                        <div
                          key={i}
                          className="text-sm flex justify-between text-zinc-400"
                        >
                          <span>{ex.name}</span>
                          <span>
                            {ex.sets[0].weight}kg × {ex.sets[0].reps} (
                            {ex.sets.length} sets)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {screen === "manage" && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Settings</h2>

            {customPlans.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Custom Workouts
                </h3>
                <div className="space-y-2">
                  {customPlans.map((plan, idx) => (
                    <div
                      key={plan.id}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-medium">{plan.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {plan.exercises.length} exercises
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editCustomPlan(idx)}
                          className="text-zinc-500 hover:text-cyan-400 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteCustomPlan(plan.id)}
                          className="text-zinc-500 hover:text-rose-400 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">Sets per exercise</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    You can still add a set during a workout
                  </div>
                </div>
                <div className="flex gap-1">
                  {[2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        setSettings({ ...settings, defaultSets: n })
                      }
                      className={`w-10 py-1.5 rounded-lg text-sm font-medium transition ${
                        settings.defaultSets === n
                          ? "bg-cyan-500 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">Weight jump</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    How much to go up or down by
                  </div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 2.5, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        setSettings({ ...settings, weightJump: n })
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition ${
                        settings.weightJump === n
                          ? "bg-cyan-500 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {DAYS.map((day) => (
              <div key={day.id} className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`text-sm font-medium ${day.text}`}>
                    {day.name} Exercises
                  </h3>
                  <button
                    onClick={() => {
                      setEditingType(day.id);
                      setShowExerciseModal(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${day.btn}`}
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(exercises[day.id] || []).map((ex, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex justify-between items-center"
                    >
                      <span className="text-sm">{ex}</span>
                      <button
                        onClick={() =>
                          setExerciseToDelete({ type: day.id, name: ex })
                        }
                        className="text-zinc-500 hover:text-rose-400 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === "workout" && activeWorkout && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">
                {getWorkoutLabel(activeWorkout.type)}
              </h2>
              <button
                onClick={finishWorkout}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-blue-500 transition shadow-lg shadow-cyan-500/20"
              >
                Finish
              </button>
            </div>

            {activeWorkout.exercises.map((exercise, index) => {
              // Workouts started before this feature don't carry these yet
              const history =
                exercise.rec === undefined
                  ? getExerciseHistory(exercise.name)
                  : null;
              const rec =
                exercise.rec !== undefined
                  ? exercise.rec
                  : recommend(exercise.name, history, settings.weightJump);
              const lastSets =
                exercise.lastDate !== undefined
                  ? exercise.lastSets
                  : history[0]
                  ? completedSets(history[0].sets)
                  : null;
              const lastDate =
                exercise.lastDate !== undefined
                  ? exercise.lastDate
                  : history[0]?.date;
              const recStyle = rec && {
                up: {
                  arrow: "↑",
                  label: rec.assisted ? "Less assistance:" : "Go up to",
                  color: "text-emerald-400",
                },
                stay: { arrow: "→", label: "Stay at", color: "text-amber-400" },
                down: {
                  arrow: "↓",
                  label: rec.assisted ? "More assistance:" : "Drop to",
                  color: "text-rose-400",
                },
              }[rec.action];
              return (
                <div key={exercise.id}>
                  <button
                    onClick={() => {
                      setAddExerciseAt(index);
                      setAddExerciseSearch("");
                      setShowAddExerciseModal(true);
                    }}
                    className="w-full text-xs text-zinc-600 hover:text-cyan-400 py-2 transition"
                  >
                    + insert exercise
                  </button>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 mb-3">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">
                          #{index + 1}
                        </div>
                        <h3 className="text-lg font-medium">{exercise.name}</h3>
                      </div>
                      <button
                        onClick={() => removeExercise(exercise.id)}
                        className="text-zinc-600 hover:text-rose-400 transition"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {lastSets?.length > 0 ? (
                      <div className="mb-4 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
                        <div className="text-xs text-zinc-400">
                          Last session
                          {lastDate &&
                            ` (${new Date(lastDate).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" }
                            )})`}
                          :{" "}
                          <span className="text-cyan-400">
                            {lastSets
                              .map((st) => `${st.weight}kg × ${st.reps}`)
                              .join(", ")}
                          </span>
                        </div>
                        {rec && (
                          <div className={`text-sm font-medium ${recStyle.color}`}>
                            {recStyle.arrow} {recStyle.label} {rec.weight}kg
                            <span className="text-xs font-normal text-zinc-500">
                              {" "}
                              · {rec.reason}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 text-xs text-zinc-500">
                        First time: pick a weight you can do for {REP_MIN}-
                        {REP_MAX} reps
                      </div>
                    )}

                    <div className="space-y-3">
                      {exercise.sets.map((set, idx) => (
                        <div key={idx}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 text-xs text-zinc-500 text-right shrink-0">
                              S{idx + 1}
                            </div>
                            <input
                              type="number"
                              step="0.5"
                              value={set.weight || ""}
                              onChange={(e) =>
                                updateSet(
                                  exercise.id,
                                  idx,
                                  "weight",
                                  e.target.value
                                )
                              }
                              className="w-20 bg-zinc-900 border-2 rounded-lg px-2 py-2.5 text-center text-sm font-medium focus:outline-none focus:border-cyan-500 transition"
                              placeholder="0"
                              style={{
                                borderColor: getColor(
                                  set.weight,
                                  lastSets?.[idx]?.weight
                                ),
                              }}
                            />
                            <span className="text-xs text-zinc-600 shrink-0">
                              kg
                            </span>
                            <input
                              type="number"
                              value={set.reps || ""}
                              onChange={(e) =>
                                updateSet(
                                  exercise.id,
                                  idx,
                                  "reps",
                                  e.target.value
                                )
                              }
                              className="w-16 bg-zinc-900 border-2 rounded-lg px-2 py-2.5 text-center text-sm font-medium focus:outline-none focus:border-cyan-500 transition"
                              placeholder="0"
                              style={{
                                borderColor: getColor(
                                  set.reps,
                                  lastSets?.[idx]?.reps
                                ),
                              }}
                            />
                            <span className="text-xs text-zinc-600 shrink-0">
                              rep
                            </span>
                            {exercise.sets.length > 1 && (
                              <button
                                onClick={() => removeSet(exercise.id, idx)}
                                className="text-zinc-600 hover:text-rose-400 transition shrink-0"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addSet(exercise.id)}
                      className="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-cyan-400 transition"
                    >
                      + add set
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => {
                setAddExerciseAt("end");
                setAddExerciseSearch("");
                setShowAddExerciseModal(true);
              }}
              className="w-full bg-zinc-900/50 border border-dashed border-zinc-700 rounded-2xl py-6 hover:border-cyan-500/50 hover:bg-zinc-900 transition"
            >
              <div className="text-sm text-zinc-500 hover:text-cyan-400">
                + Add Exercise
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Modals - keeping same as before */}
      {showAddExerciseModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-4 z-50"
          onClick={() => setShowAddExerciseModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-96 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-medium">Add Exercise</h3>
              <button
                onClick={() => setShowAddExerciseModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={addExerciseSearch}
                onChange={(e) => setAddExerciseSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-2">
              {addExerciseSearch.trim() &&
                !filteredKnown.some(
                  (e) => e.toLowerCase() === addExerciseSearch.toLowerCase()
                ) && (
                  <button
                    onClick={() => insertExercise(addExerciseSearch.trim())}
                    className="w-full text-left p-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 mb-2 text-sm font-medium transition"
                  >
                    + Add "{addExerciseSearch.trim()}"
                  </button>
                )}
              {filteredKnown.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => insertExercise(ex)}
                  className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 text-sm transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-2">Cancel Workout?</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Your progress won't be saved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Keep Going
              </button>
              <button
                onClick={cancelWorkout}
                className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDatePicker && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowDatePicker(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-5">When did you work out?</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => startWorkout(pendingWorkoutType)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-4 z-50"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full max-h-screen overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium">
                {editingCustom !== null ? "Edit" : "Create"} Workout
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-xs text-zinc-500 block mb-1.5">Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Leg Day..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-zinc-500 block mb-1.5">
                Exercises
              </label>
              <div className="space-y-2 mb-3">
                {customExercises.map((ex, i) => (
                  <div
                    key={i}
                    className="bg-zinc-800 rounded-lg px-3 py-2 flex justify-between items-center"
                  >
                    <span className="text-sm">{ex}</span>
                    <button
                      onClick={() =>
                        setCustomExercises(
                          customExercises.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-zinc-500 hover:text-rose-400 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customExerciseInput}
                  onChange={(e) => setCustomExerciseInput(e.target.value)}
                  placeholder="Add..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && customExerciseInput.trim()) {
                      setCustomExercises([
                        ...customExercises,
                        customExerciseInput.trim(),
                      ]);
                      setCustomExerciseInput("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (customExerciseInput.trim()) {
                      setCustomExercises([
                        ...customExercises,
                        customExerciseInput.trim(),
                      ]);
                      setCustomExerciseInput("");
                    }
                  }}
                  className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg flex items-center justify-center transition"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCustomModal(false);
                  setEditingCustom(null);
                }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={saveCustomPlan}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowExerciseModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Exercise</h3>
              <button
                onClick={() => setShowExerciseModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              placeholder="Exercise name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 mb-5 text-sm focus:outline-none focus:border-cyan-500 transition"
              onKeyPress={(e) =>
                e.key === "Enter" && addExerciseToList(editingType)
              }
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowExerciseModal(false);
                  setNewExerciseName("");
                }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => addExerciseToList(editingType)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {exerciseToDelete && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setExerciseToDelete(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-2">Delete Exercise?</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Remove "{exerciseToDelete.name}" from your list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setExerciseToDelete(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteExercise(exerciseToDelete.type, exerciseToDelete.name)
                }
                className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
