import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// localStorage stays the working copy so the app keeps going on bad gym wifi.
// When signed in, finished and deleted workouts go into a queue that uploads
// to Supabase as soon as it can; plans and settings upload as one row.
const QUEUE_KEY = "gymSyncQueue";
const OWNER_KEY = "gymSyncUser";
const PREFS_DIRTY_KEY = "gymPrefsDirty";

const read = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const toRow = (userId, w) => ({
  user_id: userId,
  id: String(w.id),
  type: w.type,
  date: w.date,
  exercises: w.exercises,
  gym_id: w.gymId ?? null,
});

// Ids were made with Date.now(), so turn them back into numbers
const fromRow = (r) => ({
  id: /^\d+$/.test(r.id) ? Number(r.id) : r.id,
  type: r.type,
  date: r.date,
  exercises: r.exercises || [],
  ...(r.gym_id ? { gymId: r.gym_id } : {}),
});

const authMessage = (err) =>
  /fetch|network/i.test(err.message)
    ? "Couldn't reach the server. Check your connection and try again."
    : err.message;

const prefsFromRow = (r) => ({
  exercises: r.exercises,
  customPlans: r.custom_plans,
  settings: r.settings,
  muscleExercises: r.muscle_exercises,
});

// setPrefs takes the account's plans and settings, applies them and returns
// them as the app now holds them, so the upload check can ignore the echo.
export function useCloudSync({ workouts, setWorkouts, prefs, setPrefs, clearLocal }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  // True after opening a password reset link, until a new password is set
  const [recovering, setRecovering] = useState(false);

  const queue = useRef(read(QUEUE_KEY, []));
  const prefsDirty = useRef(read(PREFS_DIRTY_KEY, false));
  const lastPrefs = useRef(null);
  const running = useRef(false);
  const again = useRef(null);
  const latest = useRef({ workouts, prefs });
  latest.current = { workouts, prefs };

  const saveQueue = useCallback(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.current));
    localStorage.setItem(PREFS_DIRTY_KEY, JSON.stringify(prefsDirty.current));
    setPending(queue.current.length + (prefsDirty.current ? 1 : 0));
  }, []);

  const fail = (err) => {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    setStatus(offline ? "offline" : "error");
    setError(offline ? "" : err?.message || "Couldn't reach Supabase.");
  };

  const pushPrefs = async (userId) => {
    const p = latest.current.prefs;
    const { error: err } = await supabase.from("user_data").upsert({
      user_id: userId,
      exercises: p.exercises,
      custom_plans: p.customPlans,
      settings: p.settings,
      muscle_exercises: p.muscleExercises,
      updated_at: new Date().toISOString(),
    });
    if (err) throw err;
    lastPrefs.current = JSON.stringify(p);
    prefsDirty.current = false;
    saveQueue();
  };

  // Upload everything waiting, then pull the account's copy down
  const sync = useCallback(
    async (userId, { pull = true } = {}) => {
      if (!supabase || !userId) return;
      if (running.current) {
        // Go again after this pass so nothing queued meanwhile is missed
        again.current = { pull: pull || !!again.current?.pull };
        return;
      }
      running.current = true;
      setStatus("syncing");
      try {
        while (queue.current.length) {
          const op = queue.current[0];
          const { error: err } =
            op.op === "upsert"
              ? await supabase
                  .from("workouts")
                  .upsert(toRow(userId, op.workout), { onConflict: "user_id,id" })
              : await supabase.from("workouts").delete().eq("id", String(op.id));
          if (err) throw err;
          queue.current = queue.current.slice(1);
          saveQueue();
        }

        if (pull) {
          const [{ data: rows, error: wErr }, { data: prefRow, error: pErr }] =
            await Promise.all([
              supabase.from("workouts").select("id, type, date, exercises, gym_id"),
              supabase.from("user_data").select("*").maybeSingle(),
            ]);
          if (wErr) throw wErr;
          if (pErr) throw pErr;

          // Keep anything still waiting to upload on top of the account's copy
          const byId = new Map(rows.map((r) => [String(r.id), fromRow(r)]));
          queue.current.forEach((op) => {
            if (op.op === "upsert") byId.set(String(op.workout.id), op.workout);
            else byId.delete(String(op.id));
          });
          setWorkouts([...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date)));

          if (prefRow && !prefsDirty.current) {
            lastPrefs.current = JSON.stringify(setPrefs(prefsFromRow(prefRow)));
          } else {
            await pushPrefs(userId);
          }
        } else if (prefsDirty.current) {
          await pushPrefs(userId);
        }
        setStatus("synced");
        setError("");
      } catch (err) {
        fail(err);
      } finally {
        running.current = false;
      }
      if (again.current) {
        const next = again.current;
        again.current = null;
        await sync(userId, next);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveQueue, setWorkouts, setPrefs]
  );

  // Follow the signed-in user
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;

  // Link this device to the account, then sync
  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    const owner = read(OWNER_KEY, null);
    if (owner !== userId) {
      // Workouts logged before signing in upload to the new account
      queue.current = owner
        ? []
        : [
            ...latest.current.workouts.map((workout) => ({ op: "upsert", workout })),
            ...queue.current,
          ];
      prefsDirty.current = false;
      saveQueue();
      localStorage.setItem(OWNER_KEY, JSON.stringify(userId));
    }
    sync(userId);
  }, [userId, sync, saveQueue]);

  // Retry when the connection comes back, and pick up other devices' changes
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => sync(userId);
    const onVisible = () => document.visibilityState === "visible" && sync(userId);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, sync]);

  // Upload plan and setting changes a moment after they stop
  const prefsJson = JSON.stringify(prefs);
  useEffect(() => {
    if (!userId || lastPrefs.current === null || prefsJson === lastPrefs.current) return;
    prefsDirty.current = true;
    saveQueue();
    const t = setTimeout(() => sync(userId, { pull: false }), 800);
    return () => clearTimeout(t);
  }, [prefsJson, userId, sync, saveQueue]);

  const enqueue = (op) => {
    if (!userId) return;
    queue.current = [...queue.current, op];
    saveQueue();
    sync(userId, { pull: false });
  };

  const signIn = async (email, password) => {
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    return err ? authMessage(err) : null;
  };

  // Returns a message when the project asks people to confirm their email first
  const signUp = async (email, password) => {
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) return { error: authMessage(err) };
    return data.session ? {} : { notice: "Check your inbox to confirm your email, then sign in." };
  };

  // The email links back to this page, which then asks for a new password
  const resetPassword = async (email) => {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return err
      ? { error: authMessage(err) }
      : { notice: "Check your inbox for a link to set a new password." };
  };

  const setNewPassword = async (password) => {
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return authMessage(err);
    setRecovering(false);
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    queue.current = [];
    prefsDirty.current = false;
    lastPrefs.current = null;
    saveQueue();
    localStorage.removeItem(OWNER_KEY);
    clearLocal();
  };

  return {
    enabled: !!supabase,
    ready,
    user,
    status,
    error,
    pending,
    syncNow: () => sync(userId),
    saveWorkout: (workout) => enqueue({ op: "upsert", workout }),
    removeWorkout: (id) => enqueue({ op: "delete", id }),
    signIn,
    signUp,
    signOut,
    resetPassword,
    setNewPassword,
    recovering,
    cancelRecovery: () => setRecovering(false),
  };
}
