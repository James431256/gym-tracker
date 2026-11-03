import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
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
    sets: [
      { weight: 20, reps: 10 },
      { weight: 0, reps: 0 },
    ],
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
