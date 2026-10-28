import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import "./App.css";

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

const DEFAULT_EXERCISES = {
  pull: [
    "Lat Pulldowns",
    "T-Bar Row",
    "Row",
    "Assisted Pull Ups",
    "Pec Rear Delts",
    "Bicep Curls",
    "Preacher Curls",
  ],
  push: [
    "Smith Machine",
    "Chest Press Machine",
    "Cable Chest Exercise",
    "Chest Press (Hands Touch)",
    "Flys",
    "Lat Raises",
    "Shoulder Press",
    "Barbell Skull Crushers",
    "Tricep Extensions",
    "Seatbelts",
  ],
};

// Read saved data during the first render, so the save effects never
// overwrite storage with empty defaults before it has been loaded
const loadStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const toneFor = (type) =>
  type === "push" ? "push" : type === "pull" ? "pull" : "custom";

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

const compareSet = (set, last) => {
  if (!last) return "new";
  const w = set.weight || 0,
    lw = last.weight || 0,
    r = set.reps || 0,
    lr = last.reps || 0;
  if (w !== lw) return w > lw ? "up" : "down";
  if (r !== lr) return r > lr ? "up" : "down";
  return "same";
};

const STATE_LABEL = {
  new: "No previous set",
  up: "Up on last time",
  same: "Same as last time",
  down: "Below last time",
};

// A bumper plate seen face-on, coloured by plan
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

export default function GymTracker() {
  const [activeWorkout, setActiveWorkout] = useState(() => loadStored("activeWorkout", null));
  const [screen, setScreen] = useState(() => (activeWorkout ? "workout" : "home"));
  const [workouts, setWorkouts] = useState(() => loadStored("gymWorkouts", []));
  const [addDrafts, setAddDrafts] = useState({ push: "", pull: "" });
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
  const [customPlans, setCustomPlans] = useState(() => loadStored("gymCustomPlans", []));
  const [monthOffset, setMonthOffset] = useState(0);

  const [exercises, setExercises] = useState(() => loadStored("gymExercises", DEFAULT_EXERCISES));

  useEffect(() => {
    if (workouts.length > 0)
      localStorage.setItem("gymWorkouts", JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem("gymExercises", JSON.stringify(exercises));
  }, [exercises]);
  useEffect(() => {
    localStorage.setItem("gymCustomPlans", JSON.stringify(customPlans));
  }, [customPlans]);

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
  }, [screen]);

  const getAllKnownExercises = () => {
    const fromPlans = [...exercises.push, ...exercises.pull];
    const fromHistory = workouts.flatMap((w) => w.exercises.map((e) => e.name));
    const fromCustom = customPlans.flatMap((p) => p.exercises);
    return [...new Set([...fromPlans, ...fromHistory, ...fromCustom])].sort();
  };

  const getLastWorkoutData = (workoutType, exerciseName) => {
    const last = workouts
      .filter((w) => w.type === workoutType)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!last) return null;
    const ex = last.exercises.find((e) => e.name === exerciseName);
    return ex?.sets || null;
  };

  const getLastWorkoutDataAny = (exerciseName) => {
    const last = workouts
      .filter((w) => w.exercises.some((e) => e.name === exerciseName))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!last) return null;
    const ex = last.exercises.find((e) => e.name === exerciseName);
    return ex?.sets || null;
  };

  const getRecommendation = (exerciseName, workoutType) => {
    const relevant = workouts
      .filter(
        (w) =>
          w.type === workoutType &&
          w.exercises.some((e) => e.name === exerciseName)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    if (!relevant.length) return null;
    const lastSession = relevant[0].exercises.find(
      (e) => e.name === exerciseName
    );
    if (!lastSession) return null;
    const avgReps =
      lastSession.sets.reduce((s, r) => s + (r.reps || 0), 0) /
      lastSession.sets.length;
    const lastWeight = lastSession.sets[0]?.weight || 0;
    const reps = Math.round(avgReps);
    if (avgReps >= 10)
      return { tone: "up", lead: `Averaged ${reps} reps.`, action: `Try ${lastWeight + 2.5} kg` };
    if (avgReps <= 6)
      return {
        tone: "down",
        lead: `Averaged ${reps} reps.`,
        action: `Drop to ${Math.max(0, lastWeight - 2.5)} kg`,
      };
    return { tone: "hold", lead: `Averaged ${reps} reps.`, action: `Push for ${reps + 2}` };
  };

  const handleWorkoutStart = (type) => {
    setPendingWorkoutType(type);
    const now = new Date();
    setSelectedDate(now.toISOString().split("T")[0]);
    setSelectedTime(now.toTimeString().slice(0, 5));
    setShowDatePicker(true);
  };

  const buildExerciseEntry = (exerciseName, type) => {
    const lastSets = type
      ? getLastWorkoutData(type, exerciseName)
      : getLastWorkoutDataAny(exerciseName);
    return {
      id: Date.now() + Math.random(),
      name: exerciseName,
      sets: [
        { weight: lastSets?.[0]?.weight || 0, reps: lastSets?.[0]?.reps || 0 },
        { weight: lastSets?.[1]?.weight || 0, reps: lastSets?.[1]?.reps || 0 },
        { weight: lastSets?.[2]?.weight || 0, reps: lastSets?.[2]?.reps || 0 },
      ],
      lastSets: lastSets || null,
    };
  };

  const startWorkout = (type) => {
    let list =
      type === "push"
        ? exercises.push
        : type === "pull"
        ? exercises.pull
        : customPlans.find((p) => p.id === type)?.exercises || [];
    const workoutExercises = list.map((n) => buildExerciseEntry(n, type));
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

  const openExercisePicker = (at) => {
    setAddExerciseAt(at);
    setAddExerciseSearch("");
    setShowAddExerciseModal(true);
  };

  const insertExercise = (name) => {
    const entry = buildExerciseEntry(name, activeWorkout?.type);
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

  const deleteWorkout = (id) => {
    const updated = workouts.filter((w) => w.id !== id);
    setWorkouts(updated);
    localStorage.setItem("gymWorkouts", JSON.stringify(updated));
    setWorkoutToDelete(null);
  };

  const addExerciseToList = (type) => {
    const name = addDrafts[type].trim();
    if (!name) return;
    setExercises({ ...exercises, [type]: [...exercises[type], name] });
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

  const getWorkoutLabel = (type) => {
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

  const getInsights = () => {
    const ago = new Date();
    ago.setDate(ago.getDate() - 28);
    const last4 = workouts.filter((w) => new Date(w.date) >= ago);
    const push = last4.filter((w) => w.type === "push").length;
    const pull = last4.filter((w) => w.type === "pull").length;
    return { push, pull, custom: last4.length - push - pull, total: last4.length };
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
      const push = ws.filter((w) => w.type === "push").length;
      const pull = ws.filter((w) => w.type === "pull").length;
      return { start, push, pull, custom: ws.length - push - pull, total: ws.length };
    });
  };

  const filteredKnown = getAllKnownExercises().filter((e) =>
    e.toLowerCase().includes(addExerciseSearch.toLowerCase())
  );

  const plans = [
    { id: "push", name: "Push", sub: "Chest, shoulders, triceps", exercises: exercises.push },
    { id: "pull", name: "Pull", sub: "Back, biceps", exercises: exercises.pull },
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
                <Disc type="push" size={22} />
                Gym Tracker
              </div>
              <nav className="tabs" aria-label="Main">
                {TABS.map(([s, label, Icon]) => (
                  <button
                    key={s}
                    className="tab"
                    onClick={() => setScreen(s)}
                    aria-current={screen === s ? "page" : undefined}
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
                Pick a plan to log your first session. Next time, your weights
                fill in from the last one.
              </p>
            )}

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
                        {plan.exercises.length} exercises
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
                          {w.exercises.length} exercises ·{" "}
                          {w.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
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
                      style={monthOffset >= 0 ? { opacity: 0.35, cursor: "default" } : undefined}
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
                  <span>
                    <span className="dot tone-push" /> Push
                  </span>
                  <span>
                    <span className="dot tone-pull" /> Pull
                  </span>
                  <span>
                    <span className="dot tone-custom" /> Custom
                  </span>
                </div>
              </>
            );
          })()}

        {screen === "insights" &&
          (() => {
            const { push, pull, custom, total } = getInsights();
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
                            {push > 0 && <span className="tone-push" style={{ flex: push }} />}
                            {pull > 0 && <span className="tone-pull" style={{ flex: pull }} />}
                            {custom > 0 && (
                              <span className="tone-custom" style={{ flex: custom }} />
                            )}
                          </div>
                          <div className="legend" style={{ marginTop: 8 }}>
                            <span>
                              <span className="dot tone-push" /> Push {push}
                            </span>
                            <span>
                              <span className="dot tone-pull" /> Pull {pull}
                            </span>
                            {custom > 0 && (
                              <span>
                                <span className="dot tone-custom" /> Custom {custom}
                              </span>
                            )}
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
                                [
                                  ["push", w.push],
                                  ["pull", w.pull],
                                  ["custom", w.custom],
                                ]
                                  .filter(([, n]) => n > 0)
                                  .map(([t, n]) => (
                                    <span
                                      key={t}
                                      className={`week-seg tone-${t}`}
                                      style={{ height: `${(n / peak) * 100}%` }}
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
                  </>
                )}

                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">Progression rules</h2>
                  </div>
                  <div className="panel">
                    <dl className="rules">
                      <dt>10–12 reps</dt>
                      <dd>Add 2.5–5 kg next session.</dd>
                      <dt>7–9 reps</dt>
                      <dd>Same weight, push for 1–2 more reps.</dd>
                      <dt>6 or fewer</dt>
                      <dd>Drop 2.5 kg and build back up.</dd>
                      <dt>Deload</dt>
                      <dd>Every 4–6 weeks, cut the weight by 20%.</dd>
                      <dt>Rest</dt>
                      <dd>60–90 seconds between sets.</dd>
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
                      const top = ex.sets.reduce(
                        (best, s) => ((s.weight || 0) > (best.weight || 0) ? s : best),
                        ex.sets[0] || { weight: 0, reps: 0 }
                      );
                      return (
                        <div key={i} className="session-line">
                          <span>{ex.name}</span>
                          <span>
                            {top.weight} × {top.reps}
                            <span style={{ color: "var(--text-3)" }}>
                              {" "}· {ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"}
                            </span>
                          </span>
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

            {["push", "pull"].map((type) => (
              <section key={type} className="section" style={type === "push" ? { marginTop: 0 } : undefined}>
                <div className="section-head">
                  <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Disc type={type} size={20} />
                    {type === "push" ? "Push" : "Pull"} exercises
                  </h2>
                </div>
                <div className="list">
                  {exercises[type].map((ex, i) => (
                    <div key={i} className="row" style={{ padding: "6px 6px 6px 16px" }}>
                      <div className="row-main">{ex}</div>
                      <button
                        className="icon-btn danger"
                        onClick={() => setExerciseToDelete({ type, name: ex })}
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
                      addExerciseToList(type);
                    }}
                  >
                    <input
                      className="field"
                      value={addDrafts[type]}
                      onChange={(e) => setAddDrafts({ ...addDrafts, [type]: e.target.value })}
                      placeholder={type === "push" ? "Incline Dumbbell Press" : "Face Pulls"}
                      aria-label={`New ${type} exercise`}
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
                      <div className="row-sub">{plan.exercises.length} exercises</div>
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
            let upCount = 0,
              setCount = 0;
            activeWorkout.exercises.forEach((ex) =>
              ex.sets.forEach((s, i) => {
                setCount++;
                if (compareSet(s, ex.lastSets?.[i]) === "up") upCount++;
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
                    {activeWorkout.exercises.length} exercises · {setCount} sets
                  </span>
                  {upCount > 0 && (
                    <span className="up-count">
                      Up on {upCount} {upCount === 1 ? "set" : "sets"}
                    </span>
                  )}
                </div>

                {activeWorkout.exercises.length === 0 && (
                  <div className="empty" style={{ marginTop: 12 }}>
                    <h2>This workout is empty</h2>
                    <p>Add an exercise to start logging sets.</p>
                  </div>
                )}

                {activeWorkout.exercises.map((exercise, index) => {
                  const rec = getRecommendation(exercise.name, activeWorkout.type);
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
                          <h2 className="exercise-name">{exercise.name}</h2>
                          <button
                            className="icon-btn danger"
                            onClick={() => removeExercise(exercise.id)}
                            aria-label={`Remove ${exercise.name}`}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {rec && (
                          <p className={`rec rec-${rec.tone}`}>
                            {rec.lead} <strong>{rec.action}</strong>
                          </p>
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
                            const last = exercise.lastSets?.[idx];
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
          body={`“${exerciseToDelete.name}” comes off your ${exerciseToDelete.type} plan. Past workouts keep it.`}
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
