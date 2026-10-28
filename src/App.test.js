import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { musclesFor, exercisesForMuscle } from './muscles';

beforeEach(() => localStorage.clear());

test('shows the muscles and the three training days on the train screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /train/i })).toBeInTheDocument();
  const muscles = screen.getByRole('region', { name: /pick a muscle/i });
  ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'].forEach((name) =>
    expect(within(muscles).getByText(name)).toBeInTheDocument()
  );
  expect(screen.getByText('Shoulders & Arms')).toBeInTheDocument();
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
  expect(musclesFor('My Thing', { core: ['My Thing'] })).toEqual(['core']);
  expect(exercisesForMuscle('biceps', {}, ['Spider Curls', 'Squat'])).toContain('Spider Curls');
  expect(exercisesForMuscle('biceps', {}, ['Squat'])).not.toContain('Squat');
});
