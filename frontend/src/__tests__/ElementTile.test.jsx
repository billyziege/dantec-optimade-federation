import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElementTile from '../components/ElementTile';

const BASE_PROPS = {
  symbol: 'Fe',
  name: 'Iron',
  atomicNumber: 26,
  atomicWeight: 55.845,
  category: 'transition metal',
  selected: false,
  style: { left: '0%', top: '0%', width: '5.556%', height: '10.526%' },
};

function renderTile(overrides = {}) {
  render(<ElementTile {...BASE_PROPS} onClick={vi.fn()} {...overrides} />);
  return screen.getByTitle('Iron');
}

// ── Ring states ──────────────────────────────────────────────────────────────

test('idle tile (not hovered, not selected) has no ring classes', () => {
  const btn = renderTile();
  expect(btn).not.toHaveClass('ring-2');
  expect(btn).not.toHaveClass('ring-4');
});

test('hovered (not selected) tile shows thin ring — signals will-select', async () => {
  const user = userEvent.setup();
  const btn = renderTile();
  await user.hover(btn);
  expect(btn).toHaveClass('ring-2');
  expect(btn).toHaveClass('ring-blue-400');
  expect(btn).not.toHaveClass('ring-4');
});

test('selected (not hovered) tile shows thick ring', () => {
  const btn = renderTile({ selected: true });
  expect(btn).toHaveClass('ring-4');
  expect(btn).toHaveClass('ring-blue-600');
  expect(btn).not.toHaveClass('ring-2');
});

test('hovered + selected tile shows thin ring — signals will-deselect', async () => {
  const user = userEvent.setup();
  const btn = renderTile({ selected: true });
  await user.hover(btn);
  expect(btn).toHaveClass('ring-2');
  expect(btn).toHaveClass('ring-blue-500');
  expect(btn).not.toHaveClass('ring-4');
});

// ── Tooltip content ──────────────────────────────────────────────────────────

test('tooltip shows element name, atomic number, and atomic weight on hover', async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<ElementTile {...BASE_PROPS} onClick={vi.fn()} />);

  await user.hover(screen.getByTitle('Iron'));
  await act(async () => { vi.advanceTimersByTime(400); }); // past delayDuration=300

  // Radix renders content twice: once visible, once as a hidden aria role="tooltip".
  // Query the role to avoid the duplicate-element error from findByText.
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Iron');
  expect(tooltip).toHaveTextContent('Z = 26');
  expect(tooltip).toHaveTextContent('55.845');
  vi.useRealTimers();
});
