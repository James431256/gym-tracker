import React, { useState } from "react";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { dayKey, personClass, relativeDay, sessionLine, streakLabel } from "./friends";

const NAME_MAX = 30;
const SESSIONS_SHOWN = 20;

function Head({ title, backLabel, onBack }) {
  return (
    <div className="page-head">
      <div className="muscle-head">
        <button className="icon-btn" onClick={onBack} aria-label={backLabel}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
    </div>
  );
}

function SessionRows({ sessions, dated }) {
  return sessions.map((s) => (
    <div key={s.workout_id} className="row">
      <div className="row-main">
        <div className="row-title">{s.label}</div>
        <div className="row-sub">{sessionLine(s)}</div>
      </div>
      {dated && <div className="row-aside num">{relativeDay(s.date)}</div>}
    </div>
  ));
}

function NameForm({ id, value, onChange, onSubmit, error }) {
  return (
    <form id={id} onSubmit={onSubmit}>
      <label className="label" htmlFor={`${id}-input`}>
        Your name
      </label>
      <input
        id={`${id}-input`}
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={NAME_MAX}
        autoComplete="nickname"
        placeholder="What friends see"
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function FriendDetail({ friend, onBack, onUnlink, ConfirmSheet }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <Head title={friend.name} backLabel="Back to friends" onBack={onBack} />

      <div className="panel stat-row">
        <div>
          <span className="stat-value num">{friend.thisWeek}</span>
          <span className="stat-label">{friend.thisWeek === 1 ? "Workout" : "Workouts"} this week</span>
        </div>
        <div>
          <span className="stat-value num">{friend.streak}</span>
          <span className="stat-label">Week streak</span>
        </div>
        <div>
          <span className="stat-value num">{friend.lastFourWeeks}</span>
          <span className="stat-label">In the last 4 weeks</span>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Recent sessions</h2>
        </div>
        {friend.sessions.length ? (
          <div className="list">
            <SessionRows sessions={friend.sessions.slice(0, SESSIONS_SHOWN)} dated />
          </div>
        ) : (
          <p className="hint">Nothing shared yet.</p>
        )}
        <p className="hint friends-note">
          You see when {friend.name} trained and how it went, never weights or where.
        </p>
      </section>

      <section className="section">
        <button className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
          Unlink
        </button>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {confirming && (
        <ConfirmSheet
          title={`Unlink from ${friend.name}?`}
          body="You'll stop seeing each other's sessions. You can link up again with a code."
          confirmLabel="Unlink"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            const err = await onUnlink(friend.id);
            if (err) setError(err);
            else onBack();
          }}
        />
      )}
    </>
  );
}

// Plans → Friends: your name and code, requests, and the people you're linked with
export function FriendsScreen({ friends, cloud, onBack, onSignIn, Sheet, ConfirmSheet }) {
  const { profile } = friends;
  const [openId, setOpenId] = useState(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [addResult, setAddResult] = useState(null);
  const [copied, setCopied] = useState("");
  const [actionError, setActionError] = useState("");

  const head = <Head title="Friends" backLabel="Back to Plans" onBack={onBack} />;

  if (!cloud.enabled || (cloud.ready && !cloud.user)) {
    return (
      <>
        {head}
        <div className="empty">
          <h2>Friends needs an account</h2>
          <p>
            {cloud.enabled
              ? "Sign in to link up with friends and see each other's training days and streaks."
              : "This copy of the app saves to this device only. Connect a Supabase project (see SUPABASE.md), then sign in to link up with friends."}
          </p>
          {cloud.enabled && (
            <button className="btn btn-primary" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </>
    );
  }

  if (profile === undefined) {
    return (
      <>
        {head}
        {friends.error ? (
          <div className="empty">
            <h2>Couldn't load friends</h2>
            <p>{friends.error}</p>
            <button className="btn btn-secondary" onClick={friends.refresh}>
              Try again
            </button>
          </div>
        ) : (
          <p className="hint" role="status">
            Loading…
          </p>
        )}
      </>
    );
  }

  const saveName = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Type a name first.");
      return;
    }
    setBusy(true);
    const err = profile
      ? await friends.updateProfile({ display_name: trimmed })
      : await friends.createProfile(trimmed);
    setBusy(false);
    setNameError(err || "");
    if (!err) setEditingName(false);
  };

  if (!profile) {
    return (
      <>
        {head}
        <div className="panel stack">
          <p className="hint">
            Pick a name and you get a code to share. Friends see which days you trained, how
            many exercises and sets, and your streak. They never see your weights or your gym.
          </p>
          <NameForm
            id="friend-name"
            value={name}
            onChange={setName}
            onSubmit={saveName}
            error={nameError}
          />
          <button className="btn btn-primary btn-block" type="submit" form="friend-name" disabled={busy}>
            {busy ? "One sec…" : "Set up friends"}
          </button>
        </div>
      </>
    );
  }

  const open = friends.friends.find((f) => f.id === openId);
  if (open) {
    return (
      <FriendDetail
        friend={open}
        onBack={() => setOpenId(null)}
        onUnlink={friends.removeLink}
        ConfirmSheet={ConfirmSheet}
      />
    );
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.friend_code);
      setCopied("Copied");
    } catch {
      // No clipboard here (older browser or not https): the code can be selected by hand
      setCopied("Press and hold the code to copy it");
    }
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const res = await friends.sendRequest(code);
    setBusy(false);
    setAddResult(res);
    if (!res.error) setCode("");
  };

  const act = async (fn, id) => {
    const err = await fn(id);
    setActionError(err || "");
  };

  return (
    <>
      {head}

      <div className="list">
        <div className="setting-row">
          <div className="row-main">
            <div className="row-sub">Your name</div>
            <div className="row-title">{profile.display_name}</div>
          </div>
          <button
            className="icon-btn"
            onClick={() => {
              setName(profile.display_name);
              setNameError("");
              setEditingName(true);
            }}
            aria-label="Change your name"
          >
            <Pencil size={17} />
          </button>
        </div>
        <div className="setting-row">
          <div className="row-main">
            <div className="row-sub">Your code</div>
            <div className="friend-code num" aria-label={`Your code: ${profile.friend_code}`}>
              {profile.friend_code}
            </div>
            {copied && (
              <div className="row-sub" role="status">
                {copied}
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={copyCode}>
            Copy
          </button>
        </div>
        <div className="setting-row">
          <div className="row-main">
            <div className="row-title" id="pause-label">
              Pause sharing
            </div>
            <div className="row-sub">Friends stop seeing your sessions until you turn this off.</div>
          </div>
          <button
            className="switch"
            role="switch"
            aria-checked={!!profile.sharing_paused}
            aria-labelledby="pause-label"
            onClick={() => act(friends.updateProfile, { sharing_paused: !profile.sharing_paused })}
          >
            <span className="switch-knob" />
          </button>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Add a friend</h2>
        </div>
        <div className="list">
          <form className="inline-add friend-add" onSubmit={addFriend}>
            <input
              className="field num"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setAddResult(null);
              }}
              placeholder="Their code"
              aria-label="Friend's code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={12}
            />
            <button type="submit" className="btn btn-secondary" disabled={busy || !code.trim()}>
              Add
            </button>
          </form>
        </div>
        {addResult?.error && (
          <p className="field-error" role="alert">
            {addResult.error}
          </p>
        )}
        {addResult?.name && (
          <p className="field-note" role="status">
            Request sent to {addResult.name}
          </p>
        )}
      </section>

      {(friends.incoming.length > 0 || friends.outgoing.length > 0) && (
        <section className="section" aria-label="Requests">
          <div className="section-head">
            <h2 className="section-title">Requests</h2>
          </div>
          <div className="list">
            {friends.incoming.map((r) => (
              <div key={r.id} className="row friend-request">
                <div className="row-main">
                  <div className="row-title">{r.name}</div>
                  <div className="row-sub">Wants to link up</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => act(friends.removeLink, r.id)}
                  aria-label={`Decline ${r.name}`}
                >
                  Decline
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => act(friends.accept, r.id)}
                  aria-label={`Accept ${r.name}`}
                >
                  Accept
                </button>
              </div>
            ))}
            {friends.outgoing.map((r) => (
              <div key={r.id} className="row friend-request">
                <div className="row-main">
                  <div className="row-title">{r.name}</div>
                  <div className="row-sub">Waiting for them to accept</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => act(friends.removeLink, r.id)}
                  aria-label={`Cancel request to ${r.name}`}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="section" aria-label="Your friends">
        <div className="section-head">
          <h2 className="section-title">Your friends</h2>
        </div>
        {friends.friends.length ? (
          <div className="list">
            {friends.friends.map((f) => (
              <button key={f.id} className="row" onClick={() => setOpenId(f.id)}>
                <span className={`dot person-dot ${personClass(f.index)}`} aria-hidden="true" />
                <div className="row-main">
                  <div className="row-title">{f.name}</div>
                  <div className="row-sub">
                    {streakLabel(f.streak)} · {f.thisWeek} this week
                  </div>
                </div>
                <div className="row-aside num">{f.last ? relativeDay(f.last) : "Nothing yet"}</div>
                <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">
            No friends yet. Send someone your code, or add theirs above. They accept, and you
            see each other's training days.
          </p>
        )}
        {friends.error && <p className="hint friends-note">Couldn't refresh: {friends.error}</p>}
      </section>

      {editingName && (
        <Sheet
          title="Change your name"
          onClose={() => setEditingName(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditingName(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="friend-rename" disabled={busy}>
                Save
              </button>
            </>
          }
        >
          <NameForm
            id="friend-rename"
            value={name}
            onChange={setName}
            onSubmit={saveName}
            error={nameError}
          />
        </Sheet>
      )}
    </>
  );
}

// The Friends side of the Calendar: one dot per person who trained that day
export function FriendsCalendar({
  friends,
  signedIn,
  workouts,
  summarise,
  month,
  year,
  daysInMonth,
  startDow,
  onOpenFriends,
  Sheet,
}) {
  const [openDay, setOpenDay] = useState(null);

  if (!signedIn || !friends.profile) {
    return (
      <div className="empty">
        <h2>See when your friends train</h2>
        <p>
          {signedIn && friends.profile === undefined && !friends.error
            ? "Loading…"
            : "Set up your name and add a friend to compare training days and streaks."}
        </p>
        <button className="btn btn-secondary" onClick={onOpenFriends}>
          Go to Plans → Friends
        </button>
      </div>
    );
  }

  const mine = workouts.map((w) => ({ user_id: "me", workout_id: String(w.id), date: w.date, workout: w }));
  const everyone = [
    { id: "me", index: -1, name: "You", streak: friends.me.streak, sessions: mine },
    ...friends.friends,
  ];
  const byDay = {};
  everyone.forEach((person) =>
    person.sessions.forEach((s) => {
      const key = dayKey(s.date);
      const day = (byDay[key] = byDay[key] || new Map());
      day.set(person, [...(day.get(person) || []), s]);
    })
  );

  const openDate = openDay && new Date(year, month, openDay);
  const openPeople = openDay ? [...(byDay[dayKey(openDate)] || [])] : [];

  return (
    <>
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
            const date = new Date(year, month, day);
            const trained = [...(byDay[dayKey(date)]?.keys() || [])];
            const isToday = dayKey(date) === dayKey(new Date());
            const cls = `day${trained.length ? " has" : ""}${isToday ? " today" : ""}`;
            if (!trained.length) {
              return (
                <div key={day} className={cls}>
                  {day}
                  <div className="day-dots" />
                </div>
              );
            }
            return (
              <button
                key={day}
                className={cls}
                onClick={() => setOpenDay(day)}
                aria-label={`${date.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                })}: ${trained.map((p) => p.name).join(", ")} trained`}
              >
                {day}
                <div className="day-dots">
                  {trained.slice(0, 4).map((p) => (
                    <span key={p.id} className={`dot ${personClass(p.index)}`} data-person={p.name} />
                  ))}
                  {trained.length > 4 && <span className="day-more">+</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="list people-legend" aria-label="People">
        {everyone.map((p) => (
          <li key={p.id} className="row">
            <span className={`dot person-dot ${personClass(p.index)}`} aria-hidden="true" />
            <div className="row-main">
              <div className="row-title">{p.name}</div>
            </div>
            <div className="row-aside num">{streakLabel(p.streak)}</div>
          </li>
        ))}
      </ul>
      {friends.friends.length === 0 && (
        <p className="hint friends-note">
          No friends linked yet.{" "}
          <button className="link-btn" onClick={onOpenFriends}>
            Add one in Plans → Friends
          </button>
        </p>
      )}

      {openDay && (
        <Sheet
          title={openDate.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          onClose={() => setOpenDay(null)}
        >
          <div className="stack">
            {openPeople.map(([person, sessions]) => (
              <div key={person.id}>
                <div className="day-person">
                  <span className={`dot ${personClass(person.index)}`} aria-hidden="true" />
                  {person.name}
                </div>
                <div className="list">
                  <SessionRows
                    sessions={sessions.map((s) => (s.workout ? { ...s, ...summarise(s.workout) } : s))}
                  />
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
