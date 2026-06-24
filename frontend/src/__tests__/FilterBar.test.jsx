import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../components/FilterBar';

// Helper that renders FilterBar and returns a pre-configured user event instance
function setup(onChange) {
  const user = userEvent.setup();
  render(<FilterBar onFilterChange={onChange} />);
  return user;
}

// ── Filter string derivation ────────────────────────────────────────────────

test('single element with default has_all mode', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByTitle('Iron'));
  expect(onChange).toHaveBeenLastCalledWith('elements HAS ALL "Fe"');
});

test('two elements are sorted alphabetically regardless of click order', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  // Click O first, then Fe — result must still be Fe before O
  await user.click(screen.getByTitle('Oxygen'));
  await user.click(screen.getByTitle('Iron'));
  expect(onChange).toHaveBeenLastCalledWith('elements HAS ALL "Fe","O"');
});

test('deselecting all elements produces an empty string', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByTitle('Iron')); // deselect
  expect(onChange).toHaveBeenLastCalledWith('');
});

// ── Mode switching ──────────────────────────────────────────────────────────

test('switching to has_any mode changes filter verb', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByTitle('Oxygen'));
  await user.click(screen.getByRole('radio', { name: 'Contains any' }));
  expect(onChange).toHaveBeenLastCalledWith('elements HAS ANY "Fe","O"');
});

test('exact mode produces HAS ALL … AND HAS ONLY …', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByTitle('Oxygen'));
  await user.click(screen.getByRole('radio', { name: 'Exactly these' }));
  expect(onChange).toHaveBeenLastCalledWith(
    'elements HAS ALL "Fe","O" AND elements HAS ONLY "Fe","O"'
  );
});

test('mode switch with empty selection produces empty string', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByRole('radio', { name: 'Contains any' }));
  expect(onChange).toHaveBeenLastCalledWith('');
});

// ── Clear button ────────────────────────────────────────────────────────────

test('Clear button appears after selecting an element and resets to empty string', async () => {
  const onChange = vi.fn();
  const user = setup(onChange);
  await user.click(screen.getByTitle('Copper'));
  expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /clear/i }));
  expect(onChange).toHaveBeenLastCalledWith('');
});

test('Clear button is absent when nothing is selected', () => {
  render(<FilterBar onFilterChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
});
