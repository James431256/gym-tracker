import { parsePlanList, planToText, findPart } from './planList';

const known = { 'Bench Press': 'chest', 'Lat Raises': 'shoulders' };
const opts = { partOf: (n) => known[n] || '', isKnown: (n) => n in known };

test('reads names, body parts, sets and starting weights', () => {
  const rows = parsePlanList(
    'Bench Press, Chest, 3, 60\nLat Raises\nCable Fly, chest, 2\nZottman Curl; Biceps; ; 12 kg',
    opts
  );
  expect(rows.map(({ name, part, sets, weight, isNew, problem }) => ({ name, part, sets, weight, isNew, problem }))).toEqual([
    { name: 'Bench Press', part: 'chest', sets: 3, weight: 60, isNew: false, problem: null },
    { name: 'Lat Raises', part: 'shoulders', sets: undefined, weight: undefined, isNew: false, problem: null },
    { name: 'Cable Fly', part: 'chest', sets: 2, weight: undefined, isNew: true, problem: null },
    { name: 'Zottman Curl', part: 'biceps', sets: undefined, weight: 12, isNew: true, problem: null },
  ]);
});

test('skips a spreadsheet header, blank lines and bullets', () => {
  const rows = parsePlanList('Exercise,Body part,Sets,Weight\n\n- Bench Press\n2. Lat Raises\n', opts);
  expect(rows.map((r) => r.name)).toEqual(['Bench Press', 'Lat Raises']);
});

test('flags lines it can not use', () => {
  const rows = parsePlanList(
    'Mystery Move\nBench Press, Elbows\nLat Raises, Shoulders, lots\nBench Press\n, Chest',
    opts
  );
  expect(rows.map((r) => r.problem)).toEqual([
    'New exercise: add its body part',
    'Don\'t know the body part "Elbows"',
    'Sets should be a whole number from 1 to 10, not "lots"',
    'Already in this list',
    'No exercise name',
  ]);
});

test('understands common body part names', () => {
  expect(findPart('Shoulder')).toBe('shoulders');
  expect(findPart('abs & core')).toBe('core');
  expect(findPart('Hamstrings & Glutes')).toBe('hamstrings');
  expect(findPart('tricep')).toBe('triceps');
  expect(findPart('wings')).toBe(null);
});

test('turns a plan back into a list that reads the same', () => {
  const text = planToText(['Bench Press', 'Lat Raises'], { 'Bench Press': { sets: 3, weight: 60 } }, opts.partOf);
  expect(text).toBe('Bench Press, Chest, 3, 60\nLat Raises, Shoulders');
  expect(parsePlanList(text, opts).every((r) => !r.problem)).toBe(true);
});
