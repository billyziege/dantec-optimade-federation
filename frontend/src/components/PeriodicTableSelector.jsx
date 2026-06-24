// SVG grid layout and elementData.json adapted from NOMAD GUI
// (gui/src/components/search/input/InputPeriodicTable.js), Apache License 2.0.
// Original statistics/aggregation features and NOMAD search context coupling are not included.

import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import elementData from '../data/elementData.json';
import { cn } from '../lib/utils';

const elements = elementData.elements;

// Grid constants — 18 columns, 7 main rows + 0.5 gap row + 2 lanthanide/actinide rows
const COLS = 18;
const MAIN_ROWS = 7;
const GAP = 0.5;
const TOTAL_ROWS = MAIN_ROWS + GAP + 2; // 9.5

function tileStyle(xpos, ypos) {
  // Lanthanides (ypos 8) and actinides (ypos 9) are shifted down by GAP to
  // create a visual break below the main table.
  const adjustedY = ypos <= MAIN_ROWS ? ypos - 1 : ypos - 1 + GAP;
  return {
    left: `${((xpos - 1) / COLS) * 100}%`,
    top: `${(adjustedY / TOTAL_ROWS) * 100}%`,
    width: `${(1 / COLS) * 100}%`,
    height: `${(1 / TOTAL_ROWS) * 100}%`,
  };
}

// Pastel backgrounds by category — for quick visual orientation only
const CATEGORY_BG = {
  'diatomic nonmetal': 'bg-emerald-100',
  'noble gas': 'bg-purple-100',
  'alkali metal': 'bg-red-100',
  'alkaline earth metal': 'bg-orange-100',
  'metalloid': 'bg-teal-100',
  'polyatomic nonmetal': 'bg-green-200',
  'post-transition metal': 'bg-blue-100',
  'transition metal': 'bg-yellow-100',
  'lanthanide': 'bg-pink-100',
  'actinide': 'bg-rose-100',
};

const MODE_OPTIONS = [
  { value: 'has_all', label: 'Contains all' },
  { value: 'has_any', label: 'Contains any' },
  { value: 'exact',   label: 'Exactly these' },
];

export default function PeriodicTableSelector({
  selectedElements,
  onSelectionChange,
  mode,
  onModeChange,
}) {
  function handleTileClick(symbol) {
    const next = new Set(selectedElements);
    if (next.has(symbol)) {
      next.delete(symbol);
    } else {
      next.add(symbol);
    }
    onSelectionChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600">Filter mode:</span>
        <ToggleGroup.Root
          type="single"
          value={mode}
          onValueChange={v => v && onModeChange(v)}
          className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5 gap-0.5"
        >
          {MODE_OPTIONS.map(opt => (
            <ToggleGroup.Item
              key={opt.value}
              value={opt.value}
              className={cn(
                'px-3 py-1 text-sm rounded select-none transition-colors cursor-pointer',
                'data-[state=on]:bg-white data-[state=on]:shadow-sm data-[state=on]:text-blue-700 data-[state=on]:font-medium',
                'data-[state=off]:text-gray-500 hover:data-[state=off]:text-gray-800 focus:outline-none'
              )}
            >
              {opt.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        {selectedElements.size > 0 && (
          <button
            onClick={() => onSelectionChange(new Set())}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            Clear ({selectedElements.size})
          </button>
        )}
      </div>

      {/* Periodic table grid
          Container uses the padding-bottom trick to establish a fixed aspect ratio
          so tiles can be sized with percentage heights.
          Aspect ratio = COLS : TOTAL_ROWS = 18 : 9.5 */}
      <div
        className="relative w-full"
        style={{ paddingBottom: `${(TOTAL_ROWS / COLS) * 100}%` }}
      >
        {elements.map(el => {
          const selected = selectedElements.has(el.symbol);
          const catBg = CATEGORY_BG[el.category] ?? 'bg-gray-50';
          return (
            <button
              key={el.symbol}
              onClick={() => handleTileClick(el.symbol)}
              title={el.name}
              className={cn(
                'absolute flex items-center justify-center p-0 overflow-hidden',
                'border transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400',
                selected
                  ? 'bg-blue-500 text-white border-blue-600 z-10'
                  : `${catBg} text-gray-800 border-gray-200 hover:border-blue-400 hover:z-10`
              )}
              style={tileStyle(el.xpos, el.ypos)}
            >
              <span className="text-xs font-medium leading-none select-none">
                {el.symbol}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
