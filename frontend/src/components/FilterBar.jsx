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

  function handleSearch() {
    onFilterChange(deriveFilter(selectedElements, mode));
  }

  function handleClear() {
    setSelectedElements(new Set());
    onFilterChange('');
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <PeriodicTableSelector
        selectedElements={selectedElements}
        onSelectionChange={setSelectedElements}
        mode={mode}
        onModeChange={setMode}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSearch}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Search
        </button>
        {selectedElements.size > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            Clear ({selectedElements.size})
          </button>
        )}
      </div>
    </div>
  );
}
