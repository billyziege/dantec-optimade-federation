import React, { useState } from 'react';
import PeriodicTableSelector from './PeriodicTableSelector';

function deriveFilter(selectedElements, mode) {
  if (selectedElements.size === 0) return '';
  // Sort alphabetically — ensures identical selections always produce identical filter
  // strings, making query deduplication and caching reliable.
  const sorted = [...selectedElements].sort().map(s => `"${s}"`).join(',');
  if (mode === 'has_all') return `elements HAS ALL ${sorted}`;
  if (mode === 'has_any') return `elements HAS ANY ${sorted}`;
  // exact: HAS ALL ensures the set is a superset; HAS ONLY ensures it is a subset
  return `elements HAS ALL ${sorted} AND elements HAS ONLY ${sorted}`;
}

export default function FilterBar({ onFilterChange }) {
  const [selectedElements, setSelectedElements] = useState(new Set());
  const [mode, setMode] = useState('has_all');

  function handleSelectionChange(next) {
    setSelectedElements(next);
    onFilterChange(deriveFilter(next, mode));
  }

  function handleModeChange(newMode) {
    setMode(newMode);
    onFilterChange(deriveFilter(selectedElements, newMode));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <PeriodicTableSelector
        selectedElements={selectedElements}
        onSelectionChange={handleSelectionChange}
        mode={mode}
        onModeChange={handleModeChange}
      />
    </div>
  );
}
