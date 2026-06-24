import { warningsStore } from '../lib/warningsStore';

beforeEach(() => warningsStore.clear());

test('get returns empty array initially', () => {
  expect(warningsStore.get()).toEqual([]);
});

test('add appends a warning and notifies subscribers', () => {
  const listener = vi.fn();
  const unsubscribe = warningsStore.subscribe(listener);

  warningsStore.add('provider x unreachable');

  expect(warningsStore.get()).toEqual(['provider x unreachable']);
  expect(listener).toHaveBeenCalledWith(['provider x unreachable']);
  unsubscribe();
});

test('add accumulates multiple warnings without losing earlier ones', () => {
  warningsStore.add('first');
  warningsStore.add('second');
  expect(warningsStore.get()).toEqual(['first', 'second']);
});

test('clear resets warnings to empty and notifies subscribers', () => {
  warningsStore.add('something');
  const listener = vi.fn();
  const unsubscribe = warningsStore.subscribe(listener);

  warningsStore.clear();

  expect(warningsStore.get()).toEqual([]);
  expect(listener).toHaveBeenCalledWith([]);
  unsubscribe();
});

test('subscribe returns an unsubscribe function that stops notifications', () => {
  const listener = vi.fn();
  const unsubscribe = warningsStore.subscribe(listener);

  unsubscribe();
  warningsStore.add('should not notify');

  expect(listener).not.toHaveBeenCalled();
});

test('multiple subscribers each receive notifications', () => {
  const a = vi.fn();
  const b = vi.fn();
  const unsubA = warningsStore.subscribe(a);
  const unsubB = warningsStore.subscribe(b);

  warningsStore.add('hello');

  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
  unsubA();
  unsubB();
});
