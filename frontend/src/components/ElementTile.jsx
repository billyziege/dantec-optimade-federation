import React, { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib/utils';

// Pastel backgrounds by element category. Exported so PeriodicTableSelector
// can use the same map for the category legend without duplicating or cycling.
export const CATEGORY_BG = {
  'diatomic nonmetal':    'bg-emerald-100',
  'noble gas':            'bg-purple-100',
  'alkali metal':         'bg-red-100',
  'alkaline earth metal': 'bg-orange-100',
  'metalloid':            'bg-teal-100',
  'polyatomic nonmetal':  'bg-green-200',
  'post-transition metal':'bg-blue-100',
  'transition metal':     'bg-yellow-100',
  'lanthanide':           'bg-pink-100',
  'actinide':             'bg-rose-100',
};

function ringClass(hovered, selected) {
  if (!hovered && !selected) return '';
  if ( hovered && !selected) return 'ring-2 ring-inset ring-blue-400';
  if (!hovered &&  selected) return 'ring-4 ring-inset ring-blue-600';
  return 'ring-2 ring-inset ring-blue-500'; // hovered + selected → will deselect
}

export default function ElementTile({
  symbol,
  name,
  atomicNumber,
  atomicWeight,
  category,
  selected,
  onClick,
  style,
}) {
  const [hovered, setHovered] = useState(false);
  const catBg = CATEGORY_BG[category] ?? 'bg-gray-50';

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            onClick={onClick}
            title={name}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
              'absolute flex items-center justify-center p-0 overflow-hidden',
              'border border-gray-200 focus:outline-none transition-shadow',
              catBg,
              ringClass(hovered, selected),
              (hovered || selected) && 'z-10'
            )}
            style={style}
          >
            <span className="text-xs font-medium leading-none select-none text-gray-800">
              {symbol}
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            className="z-50 rounded-md bg-white border border-gray-200 shadow-md px-3 py-2 text-sm text-gray-800"
          >
            <div className="font-medium">{name}</div>
            <div className="text-xs text-gray-500">Z = {atomicNumber}</div>
            <div className="text-xs text-gray-500">{atomicWeight} u</div>
            <Tooltip.Arrow className="fill-white stroke-gray-200" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
