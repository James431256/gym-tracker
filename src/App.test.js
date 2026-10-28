import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the push and pull plans on the train screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /train/i })).toBeInTheDocument();
  expect(screen.getByText('Push')).toBeInTheDocument();
  expect(screen.getByText('Pull')).toBeInTheDocument();
});
