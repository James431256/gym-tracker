import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// An in-memory stand-in for the bits of supabase-js the app uses
jest.mock('./supabase', () => {
  const db = { workouts: [], user_data: [], offline: false, session: null };
  const listeners = new Set();
  const result = (data) =>
    db.offline ? { data: null, error: { message: 'Failed to fetch' } } : { data, error: null };
  const from = (table) => ({
    upsert: async (row) => {
      if (db.offline) return result(null);
      const key = table === 'workouts' ? (r) => r.id === row.id : (r) => r.user_id === row.user_id;
      db[table] = [...db[table].filter((r) => !key(r)), row];
      return result(null);
    },
    delete: () => ({
      eq: async (col, val) => {
        if (db.offline) return result(null);
        db[table] = db[table].filter((r) => r[col] !== val);
        return result(null);
      },
    }),
    select: () => {
      const rows = Promise.resolve().then(() => result(db[table]));
      rows.maybeSingle = async () => result(db[table][0] || null);
      return rows;
    },
  });
  const user = { id: 'user-1', email: 'lifter@example.com' };
  return {
    mockDb: db,
    supabase: {
      from,
      auth: {
        getSession: async () => ({ data: { session: db.session } }),
        onAuthStateChange: (cb) => {
          listeners.add(cb);
          return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
        },
        signInWithPassword: async () => {
          db.session = { user };
          listeners.forEach((cb) => cb('SIGNED_IN', db.session));
          return { error: null };
        },
        signUp: async () => ({ data: { session: null }, error: null }),
        signOut: async () => {
          db.session = null;
          listeners.forEach((cb) => cb('SIGNED_OUT', null));
          return { error: null };
        },
      },
    },
  };
});

const { mockDb: db } = require('./supabase');

const workout = (id, name, date) => ({
  id,
  type: 'muscle:biceps',
  date,
  exercises: [{ id: 1, name, sets: [{ weight: 20, reps: 10 }] }],
});

beforeEach(() => {
  localStorage.clear();
  db.workouts = [];
  db.user_data = [];
  db.offline = false;
  db.session = null;
});

test('signing in uploads workouts logged on this device', async () => {
  localStorage.setItem(
    'gymWorkouts',
    JSON.stringify([workout(111, 'Preacher Curls', '2026-10-01T10:00:00.000Z')])
  );
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Plans' }));
  userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
  userEvent.type(screen.getByLabelText('Email'), 'lifter@example.com');
  userEvent.type(screen.getByLabelText('Password'), 'hunter22');
  userEvent.click(screen.getAllByRole('button', { name: 'Sign in' }).pop());

  expect(await screen.findByText('Synced')).toBeInTheDocument();
  expect(db.workouts).toEqual([
    expect.objectContaining({ user_id: 'user-1', id: '111', type: 'muscle:biceps' }),
  ]);
  expect(db.user_data[0]).toMatchObject({ user_id: 'user-1', settings: { defaultSets: 2 } });
});

test("loads the account's workouts and plans on a new device", async () => {
  db.session = { user: { id: 'user-1', email: 'lifter@example.com' } };
  db.workouts = [
    {
      user_id: 'user-1',
      id: '222',
      type: 'chest',
      date: '2026-10-20T10:00:00.000Z',
      exercises: [{ name: 'Flys', sets: [{ weight: 30, reps: 9 }] }],
    },
  ];
  db.user_data = [{ user_id: 'user-1', settings: { defaultSets: 3, weightJump: 5 } }];
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Plans' }));
  expect(await screen.findByText('Synced')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
  userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByText('Flys')).toBeInTheDocument();
  // Plans and settings it pulled down don't bounce straight back up
  await act(() => new Promise((r) => setTimeout(r, 900)));
  expect(db.user_data[0].exercises).toBeUndefined();
});

test('keeps deletes made offline and uploads them when back online', async () => {
  db.session = { user: { id: 'user-1', email: 'lifter@example.com' } };
  localStorage.setItem('gymSyncUser', JSON.stringify('user-1'));
  const w = workout(333, 'Hammer Curls', '2026-10-21T10:00:00.000Z');
  db.workouts = [{ user_id: 'user-1', ...w, id: '333' }];
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText('Hammer Curls')).toBeInTheDocument();

  db.offline = true;
  userEvent.click(screen.getByRole('button', { name: /delete biceps workout/i }));
  userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('gymSyncQueue'))).toEqual([{ op: 'delete', id: 333 }])
  );
  expect(db.workouts).toHaveLength(1);

  db.offline = false;
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(db.workouts).toHaveLength(0));
  expect(JSON.parse(localStorage.getItem('gymSyncQueue'))).toEqual([]);
  expect(screen.queryByText('Hammer Curls')).not.toBeInTheDocument();
});
