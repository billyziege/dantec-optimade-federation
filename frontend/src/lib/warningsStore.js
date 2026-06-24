// Simple pub/sub store for GraphQL extensions.warnings surfaced by the Relay
// network layer. Components subscribe to receive in-UI warning notices.

let _warnings = [];
const _listeners = new Set();

export const warningsStore = {
  add(warning) {
    _warnings = [..._warnings, warning];
    _listeners.forEach(l => l(_warnings));
  },
  clear() {
    _warnings = [];
    _listeners.forEach(l => l(_warnings));
  },
  get() {
    return _warnings;
  },
  subscribe(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
