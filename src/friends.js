import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

// Friends only ever see a summary of each workout (label, date and three
// counts). Weights and gym names stay in the private workouts table.

const WEEKS_SHOWN = 52;
const PUBLISH_DELAY = 1500;
const SUMMARY_COLUMNS = "user_id, workout_id, label, date, exercise_count, set_count, sets_up";

// You are always the white plate; friends take these in the order they linked
export const FRIEND_COLOURS = 5;
export const personClass = (index) =>
  index < 0 ? "person-me" : `person-${(index % FRIEND_COLOURS) + 1}`;

// Monday 00:00, local time
export const weekStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const weeksBefore = (monday, n) => {
  const d = new Date(monday);
  d.setDate(d.getDate() - 7 * n);
  return d;
};

// Weeks in a row (Monday to Sunday) with at least one workout. A week that
// has only just started doesn't break the run: with nothing logged yet this
// week, counting starts from last week.
export const streakWeeks = (dates, now = new Date()) => {
  const weeks = new Set(dates.map((d) => weekStart(d).getTime()));
  const thisWeek = weekStart(now);
  let back = weeks.has(thisWeek.getTime()) ? 0 : 1;
  let streak = 0;
  while (weeks.has(weeksBefore(thisWeek, back).getTime())) {
    streak++;
    back++;
  }
  return streak;
};

// Workouts since the Monday `weeks` weeks back: 1 is this week, 4 the last four
export const workoutsInWeeks = (dates, weeks, now = new Date()) => {
  const from = weeksBefore(weekStart(now), weeks - 1);
  return dates.filter((d) => new Date(d) >= from).length;
};

export const streakLabel = (weeks) => (weeks ? `${weeks}-week streak` : "No streak");

export const dayKey = (date) => new Date(date).toDateString();

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

// "6 exercises · 14 sets · 3 up on last time"
export const sessionLine = (s) =>
  [
    plural(s.exercise_count, "exercise"),
    plural(s.set_count, "set"),
    s.sets_up ? `${s.sets_up} up on last time` : null,
  ]
    .filter(Boolean)
    .join(" · ");

export const relativeDay = (iso, now = new Date()) => {
  const midnight = (d) => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((midnight(now) - midnight(iso)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const stats = (dates) => ({
  streak: streakWeeks(dates),
  thisWeek: workoutsInWeeks(dates, 1),
  lastFourWeeks: workoutsInWeeks(dates, 4),
});

const message = (err) =>
  /fetch|network/i.test(err?.message || "")
    ? "Couldn't reach the server. Check your connection and try again."
    : err?.message || "Something went wrong. Try again.";

const sameSummary = (a, b) =>
  a.label === b.label &&
  new Date(a.date).getTime() === new Date(b.date).getTime() &&
  a.exercise_count === b.exercise_count &&
  a.set_count === b.set_count &&
  a.sets_up === b.sets_up;

// `summarise(workout)` comes from the app so the label and counts match what
// it shows: { label, exercise_count, set_count, sets_up }.
// `canPublish` is true once the account's workouts are on this device, so a
// half-loaded list never removes summaries. `active` is true while a friends
// screen is open.
export function useFriends({ user, workouts, summarise, canPublish, active }) {
  const userId = user?.id || null;
  // undefined = not loaded yet, null = hasn't set up friends
  const [profile, setProfile] = useState(undefined);
  const [links, setLinks] = useState([]);
  const [people, setPeople] = useState({});
  const [summaries, setSummaries] = useState([]);
  const [error, setError] = useState("");

  const latest = useRef({ workouts, summarise, userId });
  latest.current = { workouts, summarise, userId };
  const publishing = useRef(false);
  const publishAgain = useRef(false);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      const [profs, ships] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, friend_code, sharing_paused"),
        supabase.from("friendships").select("requester, addressee, status, created_at"),
      ]);
      if (profs.error) throw profs.error;
      if (ships.error) throw ships.error;

      const friendIds = ships.data
        .filter((f) => f.status === "accepted")
        .map((f) => (f.requester === userId ? f.addressee : f.requester));
      let rows = [];
      if (friendIds.length) {
        const since = weeksBefore(weekStart(new Date()), WEEKS_SHOWN);
        const res = await supabase
          .from("workout_summaries")
          .select(SUMMARY_COLUMNS)
          .in("user_id", friendIds)
          .gte("date", since.toISOString())
          .order("date", { ascending: false });
        if (res.error) throw res.error;
        rows = res.data;
      }
      // Signed out or switched account while this was loading
      if (latest.current.userId !== userId) return;

      setProfile(profs.data.find((p) => p.user_id === userId) || null);
      setPeople(Object.fromEntries(profs.data.map((p) => [p.user_id, p])));
      setLinks(ships.data);
      setSummaries(rows);
      setError("");
    } catch (err) {
      if (latest.current.userId === userId) setError(message(err));
    }
  }, [userId]);

  // Make the account's summaries match the workouts on this device
  const publish = useCallback(async () => {
    if (!supabase || !userId) return;
    if (publishing.current) {
      publishAgain.current = true;
      return;
    }
    publishing.current = true;
    try {
      const { data: existing, error: readErr } = await supabase
        .from("workout_summaries")
        .select(SUMMARY_COLUMNS)
        .eq("user_id", userId);
      if (readErr) throw readErr;
      if (latest.current.userId !== userId) return;

      const have = new Map(existing.map((r) => [r.workout_id, r]));
      const want = latest.current.workouts.map((w) => ({
        user_id: userId,
        workout_id: String(w.id),
        date: w.date,
        ...latest.current.summarise(w),
      }));
      const wanted = new Set(want.map((r) => r.workout_id));
      const changed = want.filter((r) => !have.has(r.workout_id) || !sameSummary(r, have.get(r.workout_id)));
      const gone = existing.map((r) => r.workout_id).filter((id) => !wanted.has(id));

      if (changed.length) {
        const { error: err } = await supabase
          .from("workout_summaries")
          .upsert(changed, { onConflict: "user_id,workout_id" });
        if (err) throw err;
      }
      if (gone.length) {
        const { error: err } = await supabase
          .from("workout_summaries")
          .delete()
          .eq("user_id", userId)
          .in("workout_id", gone);
        if (err) throw err;
      }
    } catch {
      // Offline or the server is down: the next change or visit tries again
    } finally {
      publishing.current = false;
    }
    if (publishAgain.current) {
      publishAgain.current = false;
      await publish();
    }
  }, [userId]);

  // Follow the signed-in user
  useEffect(() => {
    setProfile(undefined);
    setLinks([]);
    setPeople({});
    setSummaries([]);
    setError("");
    load();
  }, [userId, load]);

  // Refresh when a friends screen opens, and when the app comes back to it
  useEffect(() => {
    if (!active || !userId) return;
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, userId, load]);

  // Publish a moment after workouts stop changing, only once there's a profile
  const hasProfile = !!profile;
  useEffect(() => {
    if (!userId || !hasProfile || !canPublish) return;
    const t = setTimeout(publish, PUBLISH_DELAY);
    return () => clearTimeout(t);
  }, [workouts, userId, hasProfile, canPublish, publish]);

  const createProfile = async (name) => {
    const { data, error: err } = await supabase
      .from("profiles")
      .insert({ display_name: name.trim() })
      .select("user_id, display_name, friend_code, sharing_paused")
      .single();
    if (err) return message(err);
    setProfile(data);
    setPeople((p) => ({ ...p, [data.user_id]: data }));
    if (canPublish) publish();
    return null;
  };

  const updateProfile = async (patch) => {
    const { error: err } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (err) return message(err);
    setProfile((p) => ({ ...p, ...patch }));
    return null;
  };

  // Returns { name } of the person asked, or { error }
  const sendRequest = async (code) => {
    const { data, error: err } = await supabase.rpc("send_friend_request", {
      code: code.trim().toUpperCase(),
    });
    if (err) return { error: message(err) };
    await load();
    const row = Array.isArray(data) ? data[0] : data;
    return { name: (typeof row === "string" ? row : row?.display_name) || "your friend" };
  };

  const accept = async (requester) => {
    const { error: err } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester", requester)
      .eq("addressee", userId);
    if (err) return message(err);
    await load();
    return null;
  };

  // Decline, cancel or unlink: all remove the row between you and them
  const removeLink = async (otherId) => {
    const link = links.find((f) => f.requester === otherId || f.addressee === otherId);
    if (!link) return null;
    const { error: err } = await supabase
      .from("friendships")
      .delete()
      .eq("requester", link.requester)
      .eq("addressee", link.addressee);
    if (err) return message(err);
    setLinks((all) => all.filter((f) => f !== link));
    setSummaries((all) => all.filter((s) => s.user_id !== otherId));
    return null;
  };

  const nameOf = useCallback((id) => people[id]?.display_name || "Friend", [people]);

  // Oldest link first, so each friend keeps their colour as more are added
  const friends = useMemo(
    () =>
      links
        .filter((f) => f.status === "accepted")
        .sort(
          (a, b) =>
            new Date(a.created_at) - new Date(b.created_at) ||
            (a.requester + a.addressee).localeCompare(b.requester + b.addressee)
        )
        .map((f, index) => {
          const id = f.requester === userId ? f.addressee : f.requester;
          const sessions = summaries.filter((s) => s.user_id === id);
          return {
            id,
            index,
            name: nameOf(id),
            sessions,
            last: sessions[0]?.date || null,
            ...stats(sessions.map((s) => s.date)),
          };
        }),
    [links, summaries, userId, nameOf]
  );

  const incoming = links
    .filter((f) => f.status === "pending" && f.addressee === userId)
    .map((f) => ({ id: f.requester, name: nameOf(f.requester) }));
  const outgoing = links
    .filter((f) => f.status === "pending" && f.requester === userId)
    .map((f) => ({ id: f.addressee, name: nameOf(f.addressee) }));

  const me = useMemo(() => stats(workouts.map((w) => w.date)), [workouts]);

  return {
    profile,
    error,
    friends,
    incoming,
    outgoing,
    me,
    refresh: load,
    createProfile,
    updateProfile,
    sendRequest,
    accept,
    removeLink,
  };
}
