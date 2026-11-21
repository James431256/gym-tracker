import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { recommend } from './App';
import { musclesFor, exercisesForMuscle } from './muscles';

beforeEach(() => localStorage.clear());

test('shows the workouts above the body parts on the train screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /train/i })).toBeInTheDocument();
  const days = screen.getByRole('region', { name: /workouts/i });
  const muscles = screen.getByRole('region', { name: /body parts/i });
  expect(days.compareDocumentPosition(muscles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'].forEach((name) =>
    expect(within(muscles).getByText(name)).toBeInTheDocument()
  );
  expect(within(days).getByText('Chest & Shoulders')).toBeInTheDocument();
  expect(within(days).getByText('Arms')).toBeInTheDocument();
});

test('picks biceps exercises, logs a set and saves the workout', () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  expect(screen.getByRole('heading', { name: 'Biceps' })).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: /preacher curls/i }));
  userEvent.click(screen.getByRole('button', { name: /hammer curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps · 2 exercises/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));

  expect(screen.getByRole('region', { name: 'Preacher Curls' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Hammer Curls' })).toBeInTheDocument();
  const preacher = within(screen.getByRole('region', { name: 'Preacher Curls' }));
  userEvent.type(preacher.getByLabelText('Set 1 weight in kg'), '20');
  userEvent.type(preacher.getByLabelText('Set 1 reps'), '10');
  userEvent.click(screen.getByRole('button', { name: 'Finish' }));

  // Three sets have no reps, so it checks first, then leaves them out
  expect(screen.getByRole('dialog', { name: /3 sets not logged/i })).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: /finish anyway/i }));

  // Back on the muscle page with the set showing as last time
  expect(screen.getByRole('heading', { name: 'Biceps' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /preacher curls/i })).toHaveTextContent(
    /20×10 · Today.*Go up to 22\.5 kg · Best 20×10/
  );
  const saved = JSON.parse(localStorage.getItem('gymWorkouts'));
  expect(saved).toHaveLength(1);
  expect(saved[0].type).toBe('muscle:biceps');
  expect(saved[0].exercises[0]).toEqual({
    id: expect.any(Number),
    name: 'Preacher Curls',
    sets: [{ weight: 20, reps: 10 }],
  });
});

test('sorts exercises onto muscles', () => {
  expect(musclesFor('Leg Curls')).toEqual(['hamstrings']);
  expect(musclesFor('Cable Bicep Curl')).toEqual(['biceps']);
  expect(musclesFor('Lat Raises')).toEqual(['shoulders']);
  expect(musclesFor('Wide Grip Lat Pulldown')).toEqual(['back']);
  expect(musclesFor('Pec Rear Delts')).toEqual(['back']);
  expect(musclesFor('Flys')).toEqual(['shoulders']);
  expect(musclesFor('Reverse Pec Deck')).toEqual(['back']);
  // Picking a body part moves a library exercise off its old one
  const moved = { chest: ['Lat Raises'] };
  expect(musclesFor('Lat Raises', moved)).toEqual(['chest']);
  expect(exercisesForMuscle('shoulders', moved)).not.toContain('Lat Raises');
  expect(exercisesForMuscle('chest', moved)).toContain('Lat Raises');
  expect(musclesFor('My Thing', { core: ['My Thing'] })).toEqual(['core']);
  expect(exercisesForMuscle('biceps', {}, ['Spider Curls', 'Squat'])).toContain('Spider Curls');
  expect(exercisesForMuscle('biceps', {}, ['Squat'])).not.toContain('Squat');
});

test('splits the old Chest and Shoulders & Arms days into Chest & Shoulders and Arms', () => {
  localStorage.setItem(
    'gymExercises',
    JSON.stringify({
      back: ['Row'],
      chest: ['Flys', 'Chest Press Machine'],
      shoulders_arms: ['Lat Raises', 'Bicep Curls', 'Tricep Extensions'],
    })
  );
  render(<App />);
  const saved = JSON.parse(localStorage.getItem('gymExercises'));
  expect(saved).toEqual({
    back: ['Row'],
    chest_shoulders: ['Flys', 'Chest Press Machine', 'Lat Raises'],
    arms: ['Bicep Curls', 'Tricep Extensions'],
  });
  expect(JSON.parse(localStorage.getItem('gymSettings')).regrouped).toBe(true);
});

test('keeps weights separate for each gym and opens at the default gym', () => {
  const ex = (weight) => [{ id: 1, name: 'Bicep Curls', sets: [{ weight, reps: 10 }, { weight, reps: 10 }] }];
  localStorage.setItem(
    'gymSettings',
    JSON.stringify({
      gyms: [
        { id: 'gym_main', name: 'Home gym' },
        { id: 'gym_2', name: 'Work gym' },
      ],
      defaultGymId: 'gym_main',
    })
  );
  localStorage.setItem(
    'gymWorkouts',
    JSON.stringify([
      { id: 2, type: 'muscle:biceps', date: '2026-10-02T10:00:00Z', gymId: 'gym_2', exercises: ex(12) },
      // Logged before gyms, so it belongs to the first gym
      { id: 1, type: 'muscle:biceps', date: '2026-10-01T10:00:00Z', exercises: ex(20) },
    ])
  );
  render(<App />);
  expect(screen.getByRole('button', { name: /gym: home gym/i })).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  expect(screen.getByRole('button', { name: /bicep curls/i })).toHaveTextContent(/20×10.*Go up to 22\.5 kg/);

  userEvent.click(screen.getByRole('button', { name: /back to train/i }));
  userEvent.click(screen.getByRole('button', { name: /change gym/i }));
  userEvent.click(screen.getByRole('button', { name: /work gym/i }));
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  expect(screen.getByRole('button', { name: /bicep curls/i })).toHaveTextContent(/12×10.*Go up to 14\.5 kg/);

  // The workout is saved against the gym it was done at
  userEvent.click(screen.getByRole('button', { name: /bicep curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  userEvent.click(screen.getByRole('button', { name: 'Finish' }));
  userEvent.click(screen.getByRole('button', { name: /finish anyway/i }));
  expect(JSON.parse(localStorage.getItem('gymWorkouts'))[0].gymId).toBe('gym_2');
});

test('asks which body part a new exercise works before adding it', () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /preacher curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));

  userEvent.click(screen.getByRole('button', { name: /^add exercise$/i }));
  userEvent.click(screen.getByRole('button', { name: 'All' }));
  userEvent.type(screen.getByLabelText('Search exercises'), 'Zottman Thing');
  userEvent.click(screen.getByRole('button', { name: /add “zottman thing”/i }));
  expect(screen.queryByRole('region', { name: 'Zottman Thing' })).not.toBeInTheDocument();

  const parts = screen.getByRole('group', { name: /body part for zottman thing/i });
  userEvent.click(within(parts).getByRole('button', { name: 'Triceps' }));
  expect(screen.getByRole('region', { name: 'Zottman Thing' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('gymMuscleExercises')).triceps).toEqual(['Zottman Thing']);
});

const seed = (sets, name = 'Bicep Curls') =>
  localStorage.setItem(
    'gymWorkouts',
    JSON.stringify([
      {
        id: 1,
        type: 'muscle:biceps',
        date: '2026-10-01T10:00:00Z',
        exercises: [{ id: 1, name, sets: sets.map(([weight, reps]) => ({ weight, reps })) }],
      },
    ])
  );

test('stays at the same weight when only a later set drops off', () => {
  seed([[20, 10], [20, 4]]);
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  expect(screen.getByRole('button', { name: /bicep curls/i })).toHaveTextContent(/Stay at 20 kg/);
});

test('still drops the weight when the first set falls well short', () => {
  seed([[20, 4], [20, 3]]);
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  expect(screen.getByRole('button', { name: /bicep curls/i })).toHaveTextContent(/Drop to 17\.5 kg/);
});

test('finishes straight away when every set is logged', () => {
  seed([[20, 10]]);
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /bicep curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  const curls = within(screen.getByRole('region', { name: 'Bicep Curls' }));
  userEvent.type(curls.getByLabelText('Set 1 reps'), '10');
  userEvent.type(curls.getByLabelText('Set 2 reps'), '9');
  userEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('gymWorkouts'))).toHaveLength(2);
});

test('edits the weights, reps and sets of a past workout', () => {
  seed([[20, 10], [20, 8]]);
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'History' })[0]);
  userEvent.click(screen.getByRole('button', { name: /edit biceps workout/i }));

  const reps2 = screen.getByLabelText('Bicep Curls set 2 reps');
  userEvent.clear(reps2);
  userEvent.type(reps2, '9');
  userEvent.click(screen.getByRole('button', { name: /add set/i }));
  userEvent.type(screen.getByLabelText('Bicep Curls set 3 reps'), '7');
  userEvent.click(screen.getByRole('button', { name: /remove bicep curls set 1/i }));
  userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(JSON.parse(localStorage.getItem('gymWorkouts'))[0].exercises[0].sets).toEqual([
    { weight: 20, reps: 9 },
    { weight: 20, reps: 7 },
  ]);
  expect(screen.getByText('20×9, 20×7')).toBeInTheDocument();
});

test('pre-fills the weight but leaves reps for you to type', () => {
  seed([[20, 9], [20, 8]]);
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /bicep curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  const curls = within(screen.getByRole('region', { name: 'Bicep Curls' }));
  expect(curls.getByLabelText('Set 1 weight in kg')).toHaveValue(20);
  expect(curls.getByLabelText('Set 1 reps')).toHaveValue(null);
  expect(curls.getByLabelText('Set 2 reps')).toHaveValue(null);
  // Forgetting them is caught at Finish
  userEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(screen.getByRole('dialog', { name: /2 sets not logged/i })).toBeInTheDocument();
});

test('saves the workout as the default list for its day', () => {
  render(<App />);
  userEvent.click(screen.getByText('Arms'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  userEvent.click(screen.getByRole('button', { name: /remove preacher curls/i }));
  userEvent.click(screen.getByRole('button', { name: 'Set default' }));
  userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save as default' }));

  expect(JSON.parse(localStorage.getItem('gymExercises')).arms).toEqual([
    'Bicep Curls',
    'Barbell Skull Crushers',
    'Tricep Extensions',
  ]);
  expect(screen.getByRole('button', { name: 'Default' })).toBeDisabled();
});

test("doesn't offer a default for a muscle workout", () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /preacher curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  expect(screen.queryByRole('button', { name: /set default|^default$/i })).not.toBeInTheDocument();
});

const startArms = () => {
  render(<App />);
  userEvent.click(screen.getByText('Arms'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
};
const order = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));

test('moves exercises up and down in a workout', () => {
  startArms();
  expect(order()).toEqual(['Bicep Curls', 'Preacher Curls', 'Barbell Skull Crushers', 'Tricep Extensions']);
  expect(screen.getByRole('button', { name: 'Move Bicep Curls up' })).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: 'Move Tricep Extensions up' }));
  userEvent.click(screen.getByRole('button', { name: 'Move Bicep Curls down' }));
  expect(order()).toEqual(['Preacher Curls', 'Bicep Curls', 'Tricep Extensions', 'Barbell Skull Crushers']);
});

test('undoes removing an exercise or a set', () => {
  startArms();
  userEvent.click(screen.getByRole('button', { name: 'Remove Preacher Curls' }));
  expect(order()).not.toContain('Preacher Curls');
  userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(order()[1]).toBe('Preacher Curls');

  const curls = within(screen.getByRole('region', { name: 'Bicep Curls' }));
  userEvent.type(curls.getByLabelText('Set 1 reps'), '9');
  userEvent.click(curls.getByRole('button', { name: 'Remove set 1' }));
  expect(screen.getByRole('status')).toHaveTextContent('Removed set 1 of Bicep Curls');
  userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(curls.getByLabelText('Set 1 reps')).toHaveValue(9);
});

test('undoes deleting a workout from history', () => {
  seed([[20, 10]]);
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'History' })[0]);
  userEvent.click(screen.getByRole('button', { name: /delete biceps workout/i }));
  userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(JSON.parse(localStorage.getItem('gymWorkouts'))).toHaveLength(0);
  userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(JSON.parse(localStorage.getItem('gymWorkouts'))).toHaveLength(1);
  expect(screen.getByText('20×10')).toBeInTheDocument();
});

test('sums up this week on the train screen', () => {
  const day = (ago) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ago);
    return d.toISOString();
  };
  const monday = (new Date().getDay() + 6) % 7; // days since Monday
  const w = (id, date, sets) => ({
    id,
    type: 'arms',
    date,
    exercises: [{ id: 1, name: 'Bicep Curls', sets: sets.map(([weight, reps]) => ({ weight, reps })) }],
  });
  localStorage.setItem(
    'gymWorkouts',
    JSON.stringify([
      w(3, day(0), [[20, 10], [20, 8]]),
      w(2, day(monday + 2), [[20, 9], [20, 8]]),
      w(1, day(monday + 20), [[20, 8]]),
    ])
  );
  render(<App />);
  const week = within(screen.getByRole('region', { name: 'This week' }));
  expect(week.getByText('Workout this week').previousSibling).toHaveTextContent('1');
  expect(week.getByText('Sets logged').previousSibling).toHaveTextContent('2');
  expect(week.getByText('Sets up on last time').previousSibling).toHaveTextContent('1');
  expect(week.getByText('Last week: 1 workout.')).toBeInTheDocument();
});

test('makes a new plan from a pasted list and starts it with those sets and weights', () => {
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);
  userEvent.click(screen.getByRole('button', { name: /new plan from a list/i }));
  userEvent.type(screen.getByLabelText('Name'), 'Push');
  userEvent.paste(
    screen.getByLabelText('Exercises'),
    'Bench Press, Chest, 3, 60\nLandmine Thing\nShoulder Press, Shoulders'
  );
  // Landmine Thing is new and the app can't guess its body part, so it can't save yet
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));
  expect(screen.getByText(/line 2: new exercise: add its body part/i)).toBeInTheDocument();

  const box = screen.getByLabelText('Exercises');
  userEvent.clear(box);
  userEvent.paste(box, 'Bench Press, Chest, 3, 60\nLandmine Thing, Chest, 2\nShoulder Press, Shoulders');
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));

  const plans = JSON.parse(localStorage.getItem('gymCustomPlans'));
  expect(plans).toEqual([
    expect.objectContaining({ name: 'Push', exercises: ['Bench Press', 'Landmine Thing', 'Shoulder Press'] }),
  ]);
  expect(JSON.parse(localStorage.getItem('gymMuscleExercises')).chest).toContain('Landmine Thing');

  userEvent.click(screen.getAllByRole('button', { name: 'Train' })[0]);
  userEvent.click(screen.getByText('Push'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  const bench = within(screen.getByRole('region', { name: 'Bench Press' }));
  expect(bench.getByLabelText('Set 3 weight in kg')).toHaveValue(60);
  const fly = within(screen.getByRole('region', { name: 'Landmine Thing' }));
  expect(fly.queryByLabelText('Set 3 weight in kg')).not.toBeInTheDocument();
  expect(fly.getByLabelText('Set 2 weight in kg')).toHaveValue(null);
});

test('edits a day as a list and loads a list from a file', async () => {
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);
  userEvent.click(screen.getByRole('button', { name: 'Edit Arms as a list' }));
  expect(screen.getByLabelText('Exercises')).toHaveValue(
    'Bicep Curls, Biceps\nPreacher Curls, Biceps\nBarbell Skull Crushers, Triceps\nTricep Extensions, Triceps'
  );
  const file = new File(['Exercise,Body part,Sets\nHammer Curls,Biceps,3\nTricep Pushdowns,Triceps'], 'arms.csv', {
    type: 'text/csv',
  });
  userEvent.upload(screen.getByTestId('plan-file'), file);
  expect(await screen.findByText('Loaded arms.csv')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));

  expect(JSON.parse(localStorage.getItem('gymExercises')).arms).toEqual(['Hammer Curls', 'Tricep Pushdowns']);
  expect(JSON.parse(localStorage.getItem('gymSettings')).planTargets.arms).toEqual({ 'Hammer Curls': { sets: 3 } });
});

test("doesn't duplicate an exercise typed with different capitals", () => {
  seed([[20, 10]]); // Bicep Curls history
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);

  // Adding one that's already on the day doesn't add it twice
  const arms = within(screen.getByRole('textbox', { name: 'New Arms exercise' }).closest('form'));
  userEvent.type(arms.getByRole('textbox'), 'bicep curls');
  userEvent.click(arms.getByRole('button', { name: 'Add' }));
  expect(JSON.parse(localStorage.getItem('gymExercises')).arms.filter((n) => /bicep curls/i.test(n))).toEqual([
    'Bicep Curls',
  ]);

  // A list keeps the existing spelling, so the history carries on
  userEvent.click(screen.getByRole('button', { name: /new plan from a list/i }));
  userEvent.type(screen.getByLabelText('Name'), 'Curls');
  userEvent.paste(screen.getByLabelText('Exercises'), 'bicep curls');
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));
  expect(JSON.parse(localStorage.getItem('gymCustomPlans'))[0].exercises).toEqual(['Bicep Curls']);

  userEvent.click(screen.getAllByRole('button', { name: 'Train' })[0]);
  userEvent.click(screen.getByText('Curls'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  expect(screen.getByRole('region', { name: 'Bicep Curls' })).toHaveTextContent(/Go up to 22\.5 kg/);
});

test('suggests the heavier weight when sets were at different weights', () => {
  const last = (sets) => [{ date: '2026-11-11', sets }];
  // 7.5×12 then 10×12: move every set up to 10 kg
  expect(recommend('Overhead Cable Extension', last([
    { weight: 7.5, reps: 12 },
    { weight: 10, reps: 12 },
  ]), 2.5)).toMatchObject({ action: 'up', weight: 10 });
  // Heavier set fell short: stay at the weight that worked
  expect(recommend('Row', last([
    { weight: 50, reps: 10 },
    { weight: 55, reps: 5 },
  ]), 2.5)).toMatchObject({ action: 'stay', weight: 50 });
  // Started too heavy, then dropped: do every set at the lighter weight
  expect(recommend('Row', last([
    { weight: 55, reps: 5 },
    { weight: 50, reps: 9 },
  ]), 2.5)).toMatchObject({ action: 'down', weight: 50 });
  // Assisted: less assistance is the harder weight
  expect(recommend('Assisted Pull Ups', last([
    { weight: 30, reps: 10 },
    { weight: 25, reps: 9 },
  ]), 2.5)).toMatchObject({ action: 'up', weight: 25 });
  // Same weight still works as before
  expect(recommend('Row', last([
    { weight: 50, reps: 10 },
    { weight: 50, reps: 10 },
  ]), 2.5)).toMatchObject({ action: 'up', weight: 52.5 });
});

const savedWorkout = (id, type, date, sets = [[20, 10]], name = 'Bicep Curls') => ({
  id,
  type,
  date,
  exercises: [{ id: 1, name, sets: sets.map(([weight, reps]) => ({ weight, reps })) }],
});

test('picks a plate colour for a new plan and shows it on the calendar', () => {
  localStorage.setItem(
    'gymCustomPlans',
    JSON.stringify([{ id: 'custom_1', name: 'Legs', exercises: ['Squat'] }])
  );
  localStorage.setItem(
    'gymWorkouts',
    JSON.stringify([savedWorkout(1, 'custom_1', new Date().toISOString(), [[60, 8]], 'Squat')])
  );
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: /^new plan$/i }));
  // The first colour no plan uses yet is picked for you
  expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
  userEvent.click(screen.getByRole('radio', { name: 'Purple' }));
  userEvent.type(screen.getByLabelText('Name'), 'Pull');
  userEvent.type(screen.getByPlaceholderText('Romanian Deadlift'), 'Lat Pulldowns{enter}');
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));

  expect(JSON.parse(localStorage.getItem('gymCustomPlans'))[1]).toMatchObject({
    name: 'Pull',
    colour: 'purple',
  });
  const pull = screen.getByRole('button', { name: /^pull/i });
  // The plate is drawn, not read out, so check its colour class directly
  // eslint-disable-next-line testing-library/no-node-access
  expect(pull.querySelector('.disc')).toHaveClass('tone-purple');

  // Plans without a colour stay white, and the calendar names them instead of "Other"
  userEvent.click(screen.getAllByRole('button', { name: 'Calendar' })[0]);
  // eslint-disable-next-line testing-library/no-node-access
  expect(screen.getByText('Legs').querySelector('.dot')).toHaveClass('tone-other');
  expect(screen.queryByText('Other')).not.toBeInTheDocument();
});

test('pins a plan to the top of the workouts list', () => {
  localStorage.setItem(
    'gymCustomPlans',
    JSON.stringify([{ id: 'custom_1', name: 'Legs', exercises: ['Squat'], colour: 'orange' }])
  );
  render(<App />);
  const names = () =>
    within(screen.getByRole('region', { name: /workouts/i }))
      .getAllByRole('button', { name: /exercises?/ })
      .map((b) => b.textContent);
  expect(names()[0]).toMatch(/^Back/);
  userEvent.click(screen.getByRole('button', { name: 'Pin Legs to the top' }));
  expect(names()[0]).toMatch(/^Legs/);
  expect(screen.getByRole('button', { name: 'Unpin Legs' })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(localStorage.getItem('gymSettings')).pinnedPlans).toEqual(['custom_1']);
  userEvent.click(screen.getByRole('button', { name: 'Unpin Legs' }));
  expect(names()[0]).toMatch(/^Back/);
});

describe('on a Sunday', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2026-11-22T18:00:00'));
  });
  afterEach(() => jest.useRealTimers());

  test('sums up the sets for each body part that week', () => {
    localStorage.setItem(
      'gymWorkouts',
      JSON.stringify([
        savedWorkout(3, 'arms', '2026-11-21T10:00:00', [[20, 10], [20, 9]]),
        savedWorkout(2, 'back', '2026-11-17T10:00:00', [[50, 10], [50, 10], [50, 9]], 'Lat Pulldowns'),
        // The Saturday before doesn't count
        savedWorkout(1, 'back', '2026-11-15T10:00:00', [[50, 10]], 'Lat Pulldowns'),
      ])
    );
    render(<App />);
    const week = within(screen.getByRole('region', { name: 'This week' }));
    expect(week.getByText('Sets per body part this week')).toBeInTheDocument();
    const rows = week.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['Back3', 'Biceps2']);
    expect(week.getByText(/not hit: chest, shoulders, triceps/i)).toBeInTheDocument();
  });

  test('can turn the summary off', () => {
    localStorage.setItem(
      'gymWorkouts',
      JSON.stringify([savedWorkout(1, 'arms', '2026-11-21T10:00:00', [[20, 10]])])
    );
    render(<App />);
    expect(screen.getByText('Sets per body part this week')).toBeInTheDocument();
    userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);
    const setting = within(screen.getByRole('group', { name: 'Sunday summary' }));
    userEvent.click(setting.getByRole('button', { name: 'Off' }));
    expect(JSON.parse(localStorage.getItem('gymSettings')).sundaySummary).toBe(false);
    userEvent.click(screen.getAllByRole('button', { name: 'Train' })[0]);
    expect(screen.queryByText('Sets per body part this week')).not.toBeInTheDocument();
    // The rest of the week panel stays
    expect(screen.getByRole('region', { name: 'This week' })).toBeInTheDocument();
  });
});

test('an exercise can have its own sets, starting weight and weight jump', () => {
  render(<App />);
  userEvent.click(screen.getByRole('button', { name: 'Plans' }));
  userEvent.click(screen.getByRole('button', { name: /set defaults for an exercise/i }));
  userEvent.type(screen.getByLabelText('Exercise'), 'preacher curls');
  userEvent.type(screen.getByLabelText('Sets'), '4');
  userEvent.type(screen.getByLabelText('Starting weight (kg)'), '15');
  const sheet = within(screen.getByRole('dialog', { name: 'Exercise defaults' }));
  userEvent.click(within(sheet.getByRole('group', { name: /weight jump/i })).getByRole('button', { name: '1' }));
  userEvent.click(sheet.getByRole('button', { name: 'Save' }));

  const defaults = screen.getByRole('region', { name: 'Exercise defaults' });
  expect(within(defaults).getByText('Preacher Curls')).toBeInTheDocument();
  expect(within(defaults).getByText('4 sets · starts at 15 kg · +1 kg jumps')).toBeInTheDocument();

  // First time: four sets at the starting weight
  userEvent.click(screen.getByRole('button', { name: 'Train' }));
  userEvent.click(screen.getByRole('button', { name: /^biceps/i }));
  userEvent.click(screen.getByRole('button', { name: /preacher curls/i }));
  userEvent.click(screen.getByRole('button', { name: /start biceps · 1 exercise/i }));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  const preacher = within(screen.getByRole('region', { name: 'Preacher Curls' }));
  [1, 2, 3, 4].forEach((n) => {
    expect(preacher.getByLabelText(`Set ${n} weight in kg`)).toHaveValue(15);
    userEvent.type(preacher.getByLabelText(`Set ${n} reps`), '10');
  });
  userEvent.click(screen.getByRole('button', { name: 'Finish' }));

  // Next time it goes up by this exercise's 1 kg, not the app's 2.5 kg
  expect(screen.getByRole('button', { name: /preacher curls/i })).toHaveTextContent(/Go up to 16 kg/);
});

test('recommend goes up by the jump it is given', () => {
  const history = [{ sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] }];
  expect(recommend('Row', history, 2).weight).toBe(22);
  expect(recommend('Row', history, 1).weight).toBe(21);
});

const setCount = (name) =>
  within(screen.getByRole('region', { name })).getAllByLabelText(/^Set \d+ reps$/).length;

test('a workout has its own sets, and an exercise in it can have its own', () => {
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);

  // Arms starts every exercise on 4 sets
  userEvent.click(screen.getByRole('button', { name: 'Arms defaults' }));
  userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Sets per exercise'), '4');
  // Bicep Curls in Arms only: 3 sets with 1 kg jumps
  userEvent.click(screen.getByRole('button', { name: 'Defaults for Bicep Curls in Arms' }));
  let sheet = within(screen.getByRole('dialog', { name: 'Bicep Curls' }));
  userEvent.type(sheet.getByLabelText('Sets'), '3');
  userEvent.click(within(sheet.getByRole('group', { name: /weight jump/i })).getByRole('button', { name: '1' }));
  userEvent.click(sheet.getByRole('button', { name: 'Save' }));
  // Back on the Arms sheet with what was typed there kept
  sheet = within(screen.getByRole('dialog', { name: 'Arms defaults' }));
  expect(sheet.getByLabelText('Sets per exercise')).toHaveValue(4);
  expect(sheet.getByRole('button', { name: /bicep curls in arms/i })).toHaveTextContent('3 sets · +1 kg jumps');
  userEvent.click(sheet.getByRole('button', { name: 'Save' }));

  userEvent.click(screen.getAllByRole('button', { name: 'Train' })[0]);
  userEvent.click(screen.getByText('Arms'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  expect(setCount('Bicep Curls')).toBe(3);
  expect(setCount('Preacher Curls')).toBe(4);

  // Other workouts are untouched
  const s = JSON.parse(localStorage.getItem('gymSettings'));
  expect(s.planDefaults).toEqual({ arms: { sets: 4 } });
  expect(s.planTargets.arms['Bicep Curls']).toEqual({ sets: 3, jump: 1 });
  expect(s.exerciseDefaults || {}).toEqual({});
});

test('changing a workout\'s defaults mid-workout updates sets not logged yet', () => {
  render(<App />);
  userEvent.click(screen.getByText('Arms'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  expect(setCount('Preacher Curls')).toBe(2);
  userEvent.click(screen.getByRole('button', { name: /workout defaults/i }));
  userEvent.type(screen.getByLabelText('Sets per exercise'), '3');
  userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
  expect(setCount('Preacher Curls')).toBe(3);
});

test('custom plans have their own defaults', () => {
  render(<App />);
  userEvent.click(screen.getAllByRole('button', { name: 'Plans' })[0]);
  userEvent.click(screen.getByRole('button', { name: /new plan from a list/i }));
  userEvent.type(screen.getByLabelText('Name'), 'Push');
  userEvent.paste(screen.getByLabelText('Exercises'), 'Bench Press, Chest\nShoulder Press, Shoulders');
  userEvent.click(screen.getByRole('button', { name: 'Save plan' }));

  userEvent.click(screen.getByRole('button', { name: 'Push defaults' }));
  userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Sets per exercise'), '2');
  userEvent.click(screen.getByRole('button', { name: 'Defaults for Bench Press in Push' }));
  userEvent.type(screen.getByLabelText('Sets'), '5');
  userEvent.click(within(screen.getByRole('dialog', { name: 'Bench Press' })).getByRole('button', { name: 'Save' }));
  userEvent.click(within(screen.getByRole('dialog', { name: 'Push defaults' })).getByRole('button', { name: 'Save' }));
  expect(screen.getByText(/2 exercises · 2 sets each/)).toBeInTheDocument();

  userEvent.click(screen.getAllByRole('button', { name: 'Train' })[0]);
  userEvent.click(screen.getByText('Push'));
  userEvent.click(screen.getByRole('button', { name: /start workout/i }));
  expect(setCount('Bench Press')).toBe(5);
  expect(setCount('Shoulder Press')).toBe(2);
});
