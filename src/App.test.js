import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the three training days on the train screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /train/i })).toBeInTheDocument();
  expect(screen.getByText('Back')).toBeInTheDocument();
  expect(screen.getByText('Chest')).toBeInTheDocument();
  expect(screen.getByText('Shoulders & Arms')).toBeInTheDocument();
});
