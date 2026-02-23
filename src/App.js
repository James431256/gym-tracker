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

export default function GymTracker() {
  const [screen, setScreen] = useState("home");
  const [workouts, setWorkouts] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
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
  const [customPlans, setCustomPlans] = useState([]);

  const [exercises, setExercises] = useState({
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
  });

  useEffect(() => {
    const sw = localStorage.getItem("gymWorkouts");
    const se = localStorage.getItem("gymExercises");
    const sc = localStorage.getItem("gymCustomPlans");
    if (sw) setWorkouts(JSON.parse(sw));
    if (se) setExercises(JSON.parse(se));
    if (sc) setCustomPlans(JSON.parse(sc));
  }, []);

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

  // Restore active workout on load
  useEffect(() => {
    const savedActive = localStorage.getItem("activeWorkout");
    if (savedActive) {
      setActiveWorkout(JSON.parse(savedActive));
      setScreen("workout");
    }
  }, []);

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
    if (avgReps >= 10)
      return {
        msg: `${Math.round(avgReps)} reps — try ${lastWeight + 2.5}kg`,
        color: "text-emerald-400",
      };
    if (avgReps <= 6)
      return {
        msg: `${Math.round(avgReps)} reps — drop to ${Math.max(
          0,
          lastWeight - 2.5
        )}kg`,
        color: "text-rose-400",
      };
    return {
      msg: `${Math.round(avgReps)} reps — push for ${Math.round(avgReps) + 2}`,
      color: "text-amber-400",
    };
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
    if (last == null) return "#52525b";
    const c = parseFloat(cur) || 0,
      l = parseFloat(last) || 0;
    return c > l ? "#10b981" : c < l ? "#ef4444" : "#52525b";
  };

  const getWorkoutLabel = (type) => {
    if (type === "push") return "Push";
    if (type === "pull") return "Pull";
    return customPlans.find((p) => p.id === type)?.name || "Custom";
  };

  const getWorkoutColor = (type) => {
    if (type === "push")
      return "bg-rose-500/10 border-rose-500/20 text-rose-400";
    if (type === "pull")
      return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    return "bg-purple-500/10 border-purple-500/20 text-purple-400";
  };

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
    return {
      push: last4.filter((w) => w.type === "push").length,
      pull: last4.filter((w) => w.type === "pull").length,
      total: last4.length,
    };
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

            <button
              onClick={() => handleWorkoutStart("push")}
              className="w-full mb-3 text-left"
            >
              <div className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl p-6 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-semibold text-rose-400 mb-0.5">
                      Push
                    </div>
                    <div className="text-sm text-zinc-400">
                      Chest, Shoulders, Triceps • {exercises.push.length}{" "}
                      exercises
                    </div>
                  </div>
                  <ArrowLeft className="rotate-180 text-rose-500" size={20} />
                </div>
              </div>
            </button>

            <button
              onClick={() => handleWorkoutStart("pull")}
              className="w-full mb-3 text-left"
            >
              <div className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl p-6 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-semibold text-blue-400 mb-0.5">
                      Pull
                    </div>
                    <div className="text-sm text-zinc-400">
                      Back, Biceps • {exercises.pull.length} exercises
                    </div>
                  </div>
                  <ArrowLeft className="rotate-180 text-blue-500" size={20} />
                </div>
              </div>
            </button>

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
                              {dw.includes("push") && (
                                <div className="w-1 h-1 rounded-full bg-rose-500" />
                              )}
                              {dw.includes("pull") && (
                                <div className="w-1 h-1 rounded-full bg-blue-500" />
                              )}
                              {dw.some((t) => t !== "push" && t !== "pull") && (
                                <div className="w-1 h-1 rounded-full bg-purple-500" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 flex gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-zinc-500">Push</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-zinc-500">Pull</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-zinc-500">Custom</span>
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
            const { push, pull, total } = getInsights();
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
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="text-rose-400">Push Days</span>
                        <span className="font-medium">{push}</span>
                      </div>
                      <div className="bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-rose-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${total > 0 ? (push / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="text-blue-400">Pull Days</span>
                        <span className="font-medium">{pull}</span>
                      </div>
                      <div className="bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${total > 0 ? (pull / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-5">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-cyan-400">
                    <Zap size={16} /> Progressive Overload Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>
                      • <strong>10-12 reps:</strong> Increase weight by 2.5-5kg
                    </li>
                    <li>
                      • <strong>7-9 reps:</strong> Push for 1-2 more reps
                    </li>
                    <li>
                      • <strong>6 or less:</strong> Drop weight by 2.5kg
                    </li>
                    <li>
                      • <strong>Deload:</strong> Every 4-6 weeks, reduce 20%
                    </li>
                    <li>
                      • <strong>Rest:</strong> 60-90s between sets
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

            {["push", "pull"].map((type) => (
              <div key={type} className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3
                    className={`text-sm font-medium ${
                      type === "push" ? "text-rose-400" : "text-blue-400"
                    }`}
                  >
                    {type === "push" ? "Push" : "Pull"} Day Exercises
                  </h3>
                  <button
                    onClick={() => {
                      setEditingType(type);
                      setShowExerciseModal(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      type === "push"
                        ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    }`}
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {exercises[type].map((ex, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex justify-between items-center"
                    >
                      <span className="text-sm">{ex}</span>
                      <button
                        onClick={() => setExerciseToDelete({ type, name: ex })}
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
              const rec = getRecommendation(exercise.name, activeWorkout.type);
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

                    {rec && (
                      <div className="mb-4 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                        <div className={`text-xs ${rec.color}`}>{rec.msg}</div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {exercise.sets.map((set, idx) => (
                        <div key={idx}>
                          {exercise.lastSets?.[idx] && (
                            <div className="text-xs text-cyan-400 mb-1.5 ml-2">
                              Last: {exercise.lastSets[idx].weight}kg ×{" "}
                              {exercise.lastSets[idx].reps}
                            </div>
                          )}
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
                                  exercise.lastSets?.[idx]?.weight
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
                                  exercise.lastSets?.[idx]?.reps
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
