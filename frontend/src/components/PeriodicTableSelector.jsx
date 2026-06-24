// SVG grid layout and elementData.json adapted from NOMAD GUI
// (gui/src/components/search/input/InputPeriodicTable.js), Apache License 2.0.
// Original statistics/aggregation features and NOMAD search context coupling are not included.

import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import elementData from '../data/elementData.json';
import { CATEGORY_BG } from './ElementTile';
import ElementTile from './ElementTile';
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

// Placeholder tiles for the lanthanide/actinide gap in the main table rows
const PLACEHOLDERS = [
  { xpos: 3, ypos: 6, label: '*'  },
  { xpos: 3, ypos: 7, label: '**' },
];

// F-block row labels rendered in the empty xpos=1..3 area of the f-block rows
const FBLOCK_LABELS = [
  { ypos: 8, text: '* lanthanides' },
  { ypos: 9, text: '** actinides'  },
];

const MODE_OPTIONS = [
  { value: 'has_all', label: 'Contains all' },
  { value: 'has_any', label: 'Contains any' },
  { value: 'exact',   label: 'Exactly these' },
];

function categoryLabel(key) {
  return key.replace(/\b\w/g, c => c.toUpperCase());
}

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
      </div>

      {/* Periodic table grid.
          aspect-ratio replaces the old padding-bottom trick; tiles are
          absolutely positioned inside the relative container. */}
      <div
        className="relative w-full"
        style={{ aspectRatio: '18 / 9.5' }}
      >
        {elements.map(el => (
          <ElementTile
            key={el.symbol}
            symbol={el.symbol}
            name={el.name}
            atomicNumber={el.number}
            atomicWeight={el.atomic_mass}
            category={el.category}
            selected={selectedElements.has(el.symbol)}
            onClick={() => handleTileClick(el.symbol)}
            style={tileStyle(el.xpos, el.ypos)}
          />
        ))}

        {/* Placeholder * / ** tiles for Ba→Hf and Ra→Rf gaps in the main table */}
        {PLACEHOLDERS.map(({ xpos, ypos, label }) => (
          <div
            key={label}
            className="absolute flex items-center justify-center text-xs text-gray-400 border border-gray-100 bg-gray-50 select-none"
            style={tileStyle(xpos, ypos)}
          >
            {label}
          </div>
        ))}

        {/* F-block row labels in the empty columns 1–3 of the lanthanide/actinide rows */}
        {FBLOCK_LABELS.map(({ ypos, text }) => {
          const s = tileStyle(1, ypos);
          return (
            <div
              key={text}
              className="absolute flex items-center text-xs text-gray-400 select-none overflow-hidden"
              style={{ ...s, width: `${(3 / COLS) * 100}%` }}
            >
              {text}
            </div>
          );
        })}
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(CATEGORY_BG).map(([key, bg]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded-sm border border-gray-200 flex-shrink-0', bg)} />
            <span className="text-xs text-gray-600">{categoryLabel(key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
