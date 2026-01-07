import React, { useState, useEffect } from 'react';
import { Dumbbell, TrendingUp, Calendar, Plus, Trash2, Edit2, X, ArrowLeft, Zap } from 'lucide-react';

export default function GymTracker() {
  const [screen, setScreen] = useState('home');
  const [workouts, setWorkouts] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [exercises, setExercises] = useState({
    pull: ['Lat Pulldowns', 'T-Bar Row', 'Row', 'Assisted Pull Ups', 'Pec Rear Delts', 'Bicep Curls', 'Preacher Curls'],
    push: ['Smith Machine', 'Chest Press Machine', 'Cable Chest Exercise', 'Chest Press (Hands Touch)', 'Flys', 'Lat Raises', 'Shoulder Press', 'Barbell Skull Crushers', 'Tricep Extensions', 'Seatbelts'],
  });

  useEffect(() => {
    const savedWorkouts = localStorage.getItem('gymWorkouts');
    const savedExercises = localStorage.getItem('gymExercises');
    if (savedWorkouts) setWorkouts(JSON.parse(savedWorkouts));
    if (savedExercises) setExercises(JSON.parse(savedExercises));
  }, []);

  useEffect(() => {
    if (workouts.length > 0) localStorage.setItem('gymWorkouts', JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem('gymExercises', JSON.stringify(exercises));
  }, [exercises]);

  const getLastWorkoutData = (workoutType, exerciseName) => {
    const lastWorkout = workouts.filter(w => w.type === workoutType).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!lastWorkout) return null;
    const lastExercise = lastWorkout.exercises.find(e => e.name === exerciseName);
    return lastExercise?.sets[0] || null;
  };

  const startWorkout = (type) => {
    const workoutExercises = exercises[type].map(exerciseName => {
      const lastData = getLastWorkoutData(type, exerciseName);
      return {
        id: Date.now() + Math.random(),
        name: exerciseName,
        sets: [
          { weight: lastData?.weight || 0, reps: lastData?.reps || 0 },
          { weight: lastData?.weight || 0, reps: lastData?.reps || 0 },
          { weight: lastData?.weight || 0, reps: lastData?.reps || 0 },
        ],
        lastWeight: lastData?.weight || null,
        lastReps: lastData?.reps || null,
      };
    });
    setActiveWorkout({ id: Date.now(), type: type, date: new Date().toISOString(), exercises: workoutExercises });
    setScreen('workout');
  };

  const updateSet = (exerciseId, setIndex, field, value) => {
    setActiveWorkout({
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id === exerciseId) {
          const newSets = [...ex.sets];
          newSets[setIndex] = { ...newSets[setIndex], [field]: parseFloat(value) || 0 };
          return { ...ex, sets: newSets };
        }
        return ex;
      }),
    });
  };

  const finishWorkout = () => {
    setWorkouts([activeWorkout, ...workouts]);
    setActiveWorkout(null);
    setScreen('home');
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
    setShowCancelModal(false);
    setScreen('home');
  };

  const deleteWorkout = (id) => setWorkouts(workouts.filter(w => w.id !== id));

  const addExercise = (type) => {
    if (newExerciseName.trim()) {
      setExercises({ ...exercises, [type]: [...exercises[type], newExerciseName.trim()] });
      setNewExerciseName('');
      setShowExerciseModal(false);
      setEditingType(null);
    }
  };

  const deleteExercise = (type, exerciseName) => {
    setExercises({ ...exercises, [type]: exercises[type].filter(e => e !== exerciseName) });
    setExerciseToDelete(null);
  };

  const getPerformanceColor = (current, last) => {
    if (!last && last !== 0) return '#6B7280';
    const currentVal = parseFloat(current) || 0;
    const lastVal = parseFloat(last) || 0;
    if (currentVal > lastVal) return '#10B981';
    if (currentVal < lastVal) return '#EF4444';
    return '#6B7280';
  };

  const getCalendarData = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const workoutDates = workouts.reduce((acc, workout) => {
      const date = new Date(workout.date).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(workout.type);
      return acc;
    }, {});
    return { daysInMonth, startingDayOfWeek, workoutDates, currentMonth, currentYear };
  };

  const getInsights = () => {
    const last4Weeks = workouts.filter(w => {
      const workoutDate = new Date(w.date);
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      return workoutDate >= fourWeeksAgo;
    });
    const pushCount = last4Weeks.filter(w => w.type === 'push').length;
    const pullCount = last4Weeks.filter(w => w.type === 'pull').length;
    return { pushCount, pullCount, total: last4Weeks.length };
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, workoutDates, currentMonth, currentYear } = getCalendarData();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">{monthNames[currentMonth]} {currentYear}</h2>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-400 py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(currentYear, currentMonth, day);
              const dateString = date.toDateString();
              const dayWorkouts = workoutDates[dateString] || [];
              const isToday = dateString === new Date().toDateString();
              return (
                <div key={day} className={`aspect-square flex flex-col items-center justify-center rounded-lg border ${isToday ? 'border-blue-500 bg-blue-500 bg-opacity-10' : 'border-gray-800'} ${dayWorkouts.length > 0 ? 'bg-gray-800' : ''}`}>
                  <div className="text-sm font-semibold">{day}</div>
                  {dayWorkouts.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {dayWorkouts.includes('push') && <div className="w-2 h-2 rounded-full bg-red-500" />}
                      {dayWorkouts.includes('pull') && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-6 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-400">Push Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-400">Pull Day</span>
          </div>
        </div>
        <div className="mt-6 bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="font-semibold mb-2">This Month</h3>
          <div className="text-2xl font-bold text-blue-500">
            {workouts.filter(w => {
              const workoutDate = new Date(w.date);
              return workoutDate.getMonth() === currentMonth && workoutDate.getFullYear() === currentYear;
            }).length} workouts
          </div>
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    const { pushCount, pullCount, total } = getInsights();
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Training Insights</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Last 4 Weeks</div>
            <div className="text-3xl font-bold text-blue-500">{total}</div>
            <div className="text-gray-500 text-sm mt-1">Total Workouts</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Average</div>
            <div className="text-3xl font-bold text-green-500">{total > 0 ? (total / 4).toFixed(1) : 0}</div>
            <div className="text-gray-500 text-sm mt-1">Per Week</div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
          <h3 className="font-semibold mb-4">Workout Split (Last 4 Weeks)</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-red-400">Push Days</span>
                <span className="font-bold">{pushCount}</span>
              </div>
              <div className="bg-gray-800 rounded-full h-3">
                <div className="bg-red-500 h-3 rounded-full transition-all" style={{ width: `${total > 0 ? (pushCount / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-blue-400">Pull Days</span>
                <span className="font-bold">{pullCount}</span>
              </div>
              <div className="bg-gray-800 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${total > 0 ? (pullCount / total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Zap size={20} className="text-yellow-500" />
            Progressive Overload Tips
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• <strong>Weight:</strong> When you can do 12+ reps easily, increase weight by 2.5-5kg</li>
            <li>• <strong>Reps:</strong> Start at 8 reps, work up to 12, then add weight and drop back to 8</li>
            <li>• <strong>Rest:</strong> Track rest time between sets (60-90s for muscle growth)</li>
            <li>• <strong>Tempo:</strong> Try 3 seconds down, 1 second up for more challenge</li>
            <li>• <strong>Deload:</strong> Every 4-6 weeks, reduce weight by 20% to recover</li>
            <li>• <strong>Frequency:</strong> Aim for 3-5 workouts per week for best results</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            {screen === 'workout' ? (
              <button onClick={() => setShowCancelModal(true)} className="text-gray-400 hover:text-white">
                <ArrowLeft size={24} />
              </button>
            ) : (
              <Dumbbell className="text-blue-500" size={28} />
            )}
            <h1 className="text-xl font-bold">Gym Tracker</h1>
          </div>
        </div>
      </div>

      {screen !== 'workout' && (
        <div className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-4xl mx-auto flex">
            {['home', 'calendar', 'insights', 'history', 'manage'].map(s => (
              <button key={s} onClick={() => setScreen(s)} className={`flex-1 py-3 text-sm font-medium ${screen === s ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400'}`}>
                {s === 'home' && <><Dumbbell className="inline mr-1" size={16} />Workouts</>}
                {s === 'calendar' && <><Calendar className="inline mr-1" size={16} />Calendar</>}
                {s === 'insights' && <><Zap className="inline mr-1" size={16} />Insights</>}
                {s === 'history' && <><TrendingUp className="inline mr-1" size={16} />History</>}
                {s === 'manage' && <><Edit2 className="inline mr-1" size={16} />Manage</>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4">
        {screen === 'home' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Start Workout</h2>
            <button onClick={() => startWorkout('push')} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6 rounded-xl mb-4 text-xl">
              🔥 PUSH DAY
              <div className="text-sm font-normal opacity-80 mt-1">Chest, Shoulders & Triceps • {exercises.push.length} exercises</div>
            </button>
            <button onClick={() => startWorkout('pull')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl text-xl">
              💪 PULL DAY
              <div className="text-sm font-normal opacity-80 mt-1">Back & Biceps • {exercises.pull.length} exercises</div>
            </button>
            {workouts.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Recent Workouts</h3>
                <div className="space-y-3">
                  {workouts.slice(0, 5).map(workout => (
                    <div key={workout.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`font-semibold ${workout.type === 'push' ? 'text-red-400' : 'text-blue-400'}`}>{workout.type.toUpperCase()} DAY</span>
                          <div className="text-sm text-gray-400 mt-1">{new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="text-right text-sm text-gray-400">{workout.exercises.length} exercises</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {screen === 'calendar' && renderCalendar()}
        {screen === 'insights' && renderInsights()}

        {screen === 'history' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Workout History</h2>
            {workouts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Dumbbell size={48} className="mx-auto mb-4 opacity-50" />
                <p>No workouts yet. Start your first one!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workouts.map(workout => (
                  <div key={workout.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`font-semibold text-lg ${workout.type === 'push' ? 'text-red-400' : 'text-blue-400'}`}>{workout.type.toUpperCase()} DAY</span>
                        <div className="text-sm text-gray-400 mt-1">{new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button onClick={() => deleteWorkout(workout.id)} className="text-gray-500 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {workout.exercises.map((ex, i) => (
                        <div key={i} className="text-sm flex justify-between">
                          <span className="font-medium text-gray-300">{ex.name}</span>
                          <span className="text-gray-500">{ex.sets[0].weight}kg × {ex.sets[0].reps}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {screen === 'manage' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Manage Exercises</h2>
            {['push', 'pull'].map(type => (
              <div key={type} className={type === 'push' ? 'mb-8' : ''}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-xl font-semibold ${type === 'push' ? 'text-red-400' : 'text-blue-400'}`}>{type === 'push' ? 'Push' : 'Pull'} Day</h3>
                  <button onClick={() => { setEditingType(type); setShowExerciseModal(true); }} className={`${type === 'push' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} px-3 py-1 rounded text-sm flex items-center gap-1`}>
                    <Plus size={16} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {exercises[type].map((ex, i) => (
                    <div key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-800 flex justify-between items-center">
                      <span>{ex}</span>
                      <button onClick={() => setExerciseToDelete({ type, name: ex })} className="text-gray-500 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === 'workout' && activeWorkout && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${activeWorkout.type === 'push' ? 'text-red-400' : 'text-blue-400'}`}>{activeWorkout.type.toUpperCase()} DAY</h2>
              <button onClick={finishWorkout} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold">Finish Workout</button>
            </div>
            {activeWorkout.exercises.map((exercise, index) => (
              <div key={exercise.id} className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-500 font-bold text-lg">{index + 1}</span>
                    <div>
                      <h3 className="font-semibold text-lg">{exercise.name}</h3>
                      {exercise.lastWeight !== null && (
                        <div className="text-xs text-blue-400 mt-1">Last: {exercise.lastWeight}kg × {exercise.lastReps} reps</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {exercise.sets.map((set, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm w-12">Set {idx + 1}</span>
                      <input type="number" step="0.5" value={set.weight || ''} onChange={(e) => updateSet(exercise.id, idx, 'weight', e.target.value)} className="bg-gray-800 text-center rounded px-3 py-2 w-20" placeholder="0" style={{ borderWidth: '2px', borderColor: getPerformanceColor(set.weight, exercise.lastWeight) }} />
                      <span className="text-gray-500">kg ×</span>
                      <input type="number" value={set.reps || ''} onChange={(e) => updateSet(exercise.id, idx, 'reps', e.target.value)} className="bg-gray-800 text-center rounded px-3 py-2 w-16" placeholder="0" style={{ borderWidth: '2px', borderColor: getPerformanceColor(set.reps, exercise.lastReps) }} />
                      <span className="text-gray-500">reps</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Cancel Workout?</h3>
            <p className="text-gray-400 mb-6">Your progress won't be saved. Are you sure you want to cancel this workout?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg">Keep Going</button>
              <button onClick={cancelWorkout} className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold">Cancel Workout</button>
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" onClick={() => setShowExerciseModal(false)}>
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add Exercise</h3>
              <button onClick={() => setShowExerciseModal(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <input type="text" value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} placeholder="Exercise name" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mb-4" onKeyPress={(e) => e.key === 'Enter' && addExercise(editingType)} />
            <div className="flex gap-2">
              <button onClick={() => { setShowExerciseModal(false); setNewExerciseName(''); }} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg">Cancel</button>
              <button onClick={() => addExercise(editingType)} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold">Add</button>
            </div>
          </div>
        </div>
      )}

      {exerciseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" onClick={() => setExerciseToDelete(null)}>
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Delete Exercise?</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to delete "{exerciseToDelete.name}"? This won't delete your workout history.</p>
            <div className="flex gap-2">
              <button onClick={() => setExerciseToDelete(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded-lg">Cancel</button>
              <button onClick={() => deleteExercise(exerciseToDelete.type, exerciseToDelete.name)} className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}