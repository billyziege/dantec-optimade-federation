import '@testing-library/jest-dom';

// relay-test-utils was written for Jest and calls jest.fn() internally;
// vitest's `vi` is a drop-in replacement so expose it as `jest` globally.
global.jest = vi;

// IntersectionObserver is not available in jsdom; expose triggerAll/reset for tests
class IntersectionObserverMock {
  constructor(callback) {
    this._cb = callback;
    IntersectionObserverMock.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
IntersectionObserverMock.instances = [];
IntersectionObserverMock.triggerAll = (isIntersecting = true) => {
  IntersectionObserverMock.instances.forEach(io =>
    io._cb([{ isIntersecting }])
  );
};
IntersectionObserverMock.reset = () => {
  IntersectionObserverMock.instances = [];
};
global.IntersectionObserver = IntersectionObserverMock;

// ResizeObserver is used internally by Radix UI
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// matchMedia is expected by some Radix components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.IS_REACT_ACT_ENVIRONMENT = true;
