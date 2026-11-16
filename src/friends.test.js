import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { streakWeeks, workoutsInWeeks, weekStart } from './friends';

// An in-memory stand-in for supabase-js with the chained calls friends uses.
// It doesn't model row level security: tests only seed rows you could see.
jest.mock('./supabase', () => {
  const db = {
    workouts: [],
    user_data: [],
    profiles: [],
    friendships: [],
    workout_summaries: [],
    offline: false,
    session: null,
  };
  const KEYS = {
    workouts: ['id'],
    user_data: ['user_id'],
    profiles: ['user_id'],
    friendships: ['requester', 'addressee'],
    workout_summaries: ['user_id', 'workout_id'],
  };
  const me = () => db.session?.user.id;
  const withDefaults = (table, row) =>
    table === 'profiles'
      ? { user_id: me(), friend_code: 'ME1234', sharing_paused: false, ...row }
      : table === 'workout_summaries'
      ? { user_id: me(), ...row }
      : row;

  const from = (table) => {
    const q = { op: 'select', filters: [], order: null, one: false };
    const matches = (r) => q.filters.every((f) => f(r));
    const run = async () => {
      if (db.offline) return { data: null, error: { message: 'Failed to fetch' } };
      let data = null;
      if (q.op === 'select') {
        data = db[table].filter(matches);
      } else if (q.op === 'insert' || q.op === 'upsert') {
        const rows = [].concat(q.rows).map((r) => withDefaults(table, r));
        const same = (a, b) => KEYS[table].every((k) => a[k] === b[k]);
        if (q.op === 'insert' && rows.some((r) => db[table].some((o) => same(o, r)))) {
          return { data: null, error: { message: 'duplicate key value' } };
        }
        db[table] = [...db[table].filter((o) => !rows.some((r) => same(o, r))), ...rows];
        data = rows;
      } else if (q.op === 'update') {
        db[table] = db[table].map((r) => (matches(r) ? { ...r, ...q.patch } : r));
      } else if (q.op === 'delete') {
        db[table] = db[table].filter((r) => !matches(r));
      }
      if (data && q.order) {
        const { col, ascending } = q.order;
        data = [...data].sort((a, b) => (a[col] < b[col] ? -1 : 1) * (ascending ? 1 : -1));
      }
      if (q.one) data = data?.[0] || null;
      return { data, error: null };
    };
    const api = {
      select: () => api,
      insert: (rows) => Object.assign(q, { op: 'insert', rows }) && api,
      upsert: (rows) => Object.assign(q, { op: 'upsert', rows }) && api,
      update: (patch) => Object.assign(q, { op: 'update', patch }) && api,
      delete: () => Object.assign(q, { op: 'delete' }) && api,
      eq: (col, val) => q.filters.push((r) => r[col] === val) && api,
      in: (col, vals) => q.filters.push((r) => vals.includes(r[col])) && api,
      gte: (col, val) => q.filters.push((r) => new Date(r[col]) >= new Date(val)) && api,
      order: (col, { ascending = true } = {}) => Object.assign(q, { order: { col, ascending } }) && api,
      single: () => Object.assign(q, { one: true }) && api,
      maybeSingle: () => Object.assign(q, { one: true }) && api,
      then: (resolve, reject) => run().then(resolve, reject),
    };
    return api;
  };

  const rpc = async (name, { code }) => {
    const fail = (message) => ({ data: null, error: { message } });
    if (db.offline) return fail('Failed to fetch');
    if (!me()) return fail('Sign in first');
    if (!db.profiles.some((p) => p.user_id === me())) return fail('Set up your name first');
    const them = db.profiles.find((p) => p.friend_code === code);
    if (!them) return fail('No one has that code');
    if (them.user_id === me()) return fail("That's your own code");
    db.friendships = [
      ...db.friendships,
      { requester: me(), addressee: them.user_id, status: 'pending', created_at: new Date().toISOString() },
    ];
    return { data: them.display_name, error: null };
  };

  const listeners = new Set();
  return {
    mockDb: db,
    supabase: {
      from,
      rpc,
      auth: {
        getSession: async () => ({ data: { session: db.session } }),
        onAuthStateChange: (cb) => {
          listeners.add(cb);
          return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
        },
        signOut: async () => ({ error: null }),
      },
    },
  };
});

const { mockDb: db } = require('./supabase');

const ME = 'user-1';
const SAM = 'user-2';

const day = (ago) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ago);
  return d.toISOString();
};

const profile = (user_id, display_name, friend_code) => ({
  user_id,
  display_name,
  friend_code,
  sharing_paused: false,
});

const summary = (workout_id, ago, extra = {}) => ({
  user_id: SAM,
  workout_id,
  label: 'Back',
  date: day(ago),
  exercise_count: 6,
  set_count: 14,
  sets_up: 3,
  ...extra,
});

const linkedWithSam = (status = 'accepted') => {
  db.profiles = [profile(ME, 'James', 'ME1234'), profile(SAM, 'Sam', 'SAM123')];
  db.friendships = [
    { requester: SAM, addressee: ME, status, created_at: '2026-01-01T00:00:00Z' },
  ];
};

const openFriends = async () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Plans' }));
  userEvent.click(screen.getByRole('button', { name: /^friends/i }));
  expect(screen.getByRole('heading', { name: 'Friends' })).toBeInTheDocument();
};

beforeEach(() => {
  localStorage.clear();
  Object.assign(db, {
    workouts: [],
    user_data: [],
    profiles: [],
    friendships: [],
    workout_summaries: [],
    offline: false,
    session: { user: { id: ME, email: 'lifter@example.com' } },
  });
  localStorage.setItem('gymSyncUser', JSON.stringify(ME));
});

describe('streakWeeks', () => {
  // Wednesday 18 November 2026; that week starts Monday the 16th
  const now = new Date(2026, 10, 18, 9);
  const on = (dayOfMonth) => new Date(2026, 10, dayOfMonth, 18).toISOString();

  test('counts this week when it has a workout', () => {
    expect(streakWeeks([on(17), on(11), on(3)], now)).toBe(3);
  });

  test("isn't broken by a week that has only just started", () => {
    expect(streakWeeks([on(15), on(9), on(8)], now)).toBe(2);
  });

  test('stops at a week with no workout', () => {
    // Nothing in the week of the 9th
    expect(streakWeeks([on(16), on(4), new Date(2026, 9, 28).toISOString()], now)).toBe(1);
    expect(streakWeeks([on(4)], now)).toBe(0);
  });

  test('is zero with no workouts', () => {
    expect(streakWeeks([], now)).toBe(0);
  });

  test('weeks run Monday to Sunday', () => {
    expect(weekStart(new Date(2026, 10, 22, 23, 59)).getDate()).toBe(16);
    expect(weekStart(new Date(2026, 10, 16, 0, 0)).getDate()).toBe(16);
    // Sunday the 15th and Monday the 16th are different weeks
    expect(streakWeeks([on(15), on(16)], now)).toBe(2);
    expect(workoutsInWeeks([on(15), on(16), on(17)], 1, now)).toBe(2);
    expect(workoutsInWeeks([on(15), on(16), on(17)], 4, now)).toBe(3);
  });
});

test('explains that friends needs an account when signed out', async () => {
  db.session = null;
  await openFriends();
  expect(await screen.findByText('Friends needs an account')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  // The Plans tab stays lit, and the calendar points back here
  expect(screen.getByRole('button', { name: 'Plans' })).toHaveAttribute('aria-current', 'page');
  userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
  userEvent.click(screen.getByRole('button', { name: 'Friends' }));
  userEvent.click(screen.getByRole('button', { name: /go to plans → friends/i }));
  expect(screen.getByText('Friends needs an account')).toBeInTheDocument();
});

test('sets up a name, shows your code and pauses sharing', async () => {
  await openFriends();
  userEvent.type(await screen.findByLabelText('Your name'), 'James');
  userEvent.click(screen.getByRole('button', { name: 'Set up friends' }));

  expect(await screen.findByText('ME1234')).toBeInTheDocument();
  expect(db.profiles).toEqual([expect.objectContaining({ user_id: ME, display_name: 'James' })]);

  userEvent.click(screen.getByRole('switch', { name: 'Pause sharing' }));
  await waitFor(() => expect(db.profiles[0].sharing_paused).toBe(true));
  expect(screen.getByRole('switch', { name: 'Pause sharing' })).toBeChecked();

  userEvent.click(screen.getByRole('button', { name: 'Change your name' }));
  const input = within(screen.getByRole('dialog')).getByLabelText('Your name');
  userEvent.clear(input);
  userEvent.type(input, 'Jim');
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(db.profiles[0].display_name).toBe('Jim'));
  expect(screen.getByText('Jim')).toBeInTheDocument();
});

test('sends a request by code and shows what went wrong with a bad one', async () => {
  db.profiles = [profile(ME, 'James', 'ME1234'), profile(SAM, 'Sam', 'SAM123')];
  await openFriends();

  const code = await screen.findByLabelText("Friend's code");
  userEvent.type(code, 'nope99');
  userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No one has that code');

  userEvent.clear(code);
  userEvent.type(code, 'sam123');
  userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByText('Request sent to Sam')).toBeInTheDocument();
  expect(db.friendships).toEqual([
    expect.objectContaining({ requester: ME, addressee: SAM, status: 'pending' }),
  ]);

  // It waits under Requests until they accept, and can be cancelled
  const requests = within(screen.getByRole('region', { name: 'Requests' }));
  expect(requests.getByText('Sam')).toBeInTheDocument();
  userEvent.click(requests.getByRole('button', { name: 'Cancel request to Sam' }));
  await waitFor(() => expect(db.friendships).toEqual([]));
  expect(screen.queryByRole('region', { name: 'Requests' })).not.toBeInTheDocument();
});

test('accepts an incoming request', async () => {
  linkedWithSam('pending');
  await openFriends();

  userEvent.click(await screen.findByRole('button', { name: 'Accept Sam' }));
  await waitFor(() => expect(db.friendships[0].status).toBe('accepted'));
  const list = within(screen.getByRole('region', { name: 'Your friends' }));
  expect(await list.findByRole('button', { name: /sam/i })).toHaveTextContent('No streak · 0 this week');
  expect(screen.queryByRole('region', { name: 'Requests' })).not.toBeInTheDocument();
});

test("shows a friend's streak and sessions, and unlinks after asking", async () => {
  linkedWithSam();
  db.workout_summaries = [summary('a', 0), summary('b', 7, { label: 'Arms', sets_up: 0 })];
  await openFriends();

  const row = await screen.findByRole('button', { name: /sam/i });
  expect(row).toHaveTextContent('2-week streak · 1 this week');
  expect(row).toHaveTextContent('Today');
  userEvent.click(row);

  expect(screen.getByRole('heading', { name: 'Sam' })).toBeInTheDocument();
  expect(screen.getByText('Week streak').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('In the last 4 weeks').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Back')).toBeInTheDocument();
  expect(screen.getByText('6 exercises · 14 sets · 3 up on last time')).toBeInTheDocument();
  expect(screen.getByText('6 exercises · 14 sets')).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  expect(db.friendships).toHaveLength(1);
  userEvent.click(within(screen.getByRole('dialog', { name: 'Unlink from Sam?' })).getByRole('button', { name: 'Unlink' }));
  await waitFor(() => expect(db.friendships).toEqual([]));
  expect(await screen.findByText(/no friends yet/i)).toBeInTheDocument();
});

test('says nothing is shared yet when a friend has no sessions to show', async () => {
  linkedWithSam();
  await openFriends();
  userEvent.click(await screen.findByRole('button', { name: /sam/i }));
  expect(screen.getByText('Nothing shared yet.')).toBeInTheDocument();
});

test('publishes summaries of your workouts only once you have a profile', async () => {
  const sets = (...all) => all.map(([weight, reps]) => ({ weight, reps }));
  db.workouts = [
    {
      user_id: ME,
      id: '2',
      type: 'muscle:biceps',
      date: day(1),
      gym_id: 'gym_secret',
      exercises: [
        { id: 1, name: 'Bicep Curls', sets: sets([22.5, 10], [20, 8]) },
        { id: 2, name: 'Hammer Curls', sets: sets([14, 0]) },
      ],
    },
    {
      user_id: ME,
      id: '1',
      type: 'muscle:biceps',
      date: day(8),
      gym_id: 'gym_secret',
      exercises: [{ id: 1, name: 'Bicep Curls', sets: sets([20, 10], [20, 8]) }],
    },
  ];
  await openFriends();
  await screen.findByLabelText('Your name');
  await act(() => new Promise((r) => setTimeout(r, 1800)));
  expect(db.workout_summaries).toEqual([]);

  userEvent.type(screen.getByLabelText('Your name'), 'James');
  userEvent.click(screen.getByRole('button', { name: 'Set up friends' }));
  await waitFor(() => expect(db.workout_summaries).toHaveLength(2), { timeout: 4000 });

  const latest = db.workout_summaries.find((s) => s.workout_id === '2');
  // Only the name, the date and three counts go up: no weights, no gym
  expect(latest).toEqual({
    user_id: ME,
    workout_id: '2',
    label: 'Biceps',
    date: db.workouts[0].date,
    exercise_count: 1,
    set_count: 2,
    sets_up: 1,
  });

  // Deleting the workout takes its summary down too
  userEvent.click(screen.getByRole('button', { name: 'History' }));
  userEvent.click(screen.getAllByRole('button', { name: /delete biceps workout/i })[0]);
  userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(
    () => expect(db.workout_summaries.map((s) => s.workout_id)).toEqual(['1']),
    { timeout: 4000 }
  );
}, 15000);

test("shows a friend's dot on the calendar and who trained that day", async () => {
  linkedWithSam();
  db.workout_summaries = [summary('a', 0)];
  db.workouts = [
    {
      user_id: ME,
      id: '5',
      type: 'arms',
      date: day(0),
      exercises: [{ id: 1, name: 'Bicep Curls', sets: [{ weight: 20, reps: 10 }] }],
    },
  ];
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Calendar' }));

  // Me is the calendar as it was: plate dots and the plan legend
  expect(screen.getByRole('button', { name: 'Me' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Chest & Shoulders')).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Friends' }));
  const today = await screen.findByRole('button', { name: /: You, Sam trained$/ });
  const dots = [...today.querySelectorAll('.dot')];
  expect(dots.map((d) => d.dataset.person)).toEqual(['You', 'Sam']);
  expect(dots[0]).toHaveClass('person-me');
  expect(dots[1]).toHaveClass('person-1');

  const people = within(screen.getByRole('list', { name: 'People' })).getAllByRole('listitem');
  expect(people[0]).toHaveTextContent('You1-week streak');
  expect(people[1]).toHaveTextContent('Sam1-week streak');

  userEvent.click(today);
  const sheet = within(screen.getByRole('dialog'));
  expect(sheet.getByText('Sam')).toBeInTheDocument();
  expect(sheet.getByText('Back')).toBeInTheDocument();
  expect(sheet.getByText('6 exercises · 14 sets · 3 up on last time')).toBeInTheDocument();
  expect(sheet.getByText('Arms')).toBeInTheDocument();
  expect(sheet.getByText('1 exercise · 1 set')).toBeInTheDocument();
});
