import React, { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import PeriodicTableSelector from './PeriodicTableSelector';
import { cn } from '../lib/utils';

// ── Pure filter-clause derivation ─────────────────────────────────────────────

export function deriveElementsClause(selectedElements, mode) {
  if (selectedElements.size === 0) return null;
  const sorted = [...selectedElements].sort().map(s => `"${s}"`).join(',');
  if (mode === 'has_all') return `elements HAS ALL ${sorted}`;
  if (mode === 'has_any') return `elements HAS ANY ${sorted}`;
  return `elements HAS ALL ${sorted} AND elements HAS ONLY ${sorted}`;
}

export function deriveNPeriodicDimsClause(dims) {
  if (dims.size === 0) return null;
  const sorted = [...dims].sort((a, b) => a - b);
  if (sorted.length === 1) return `nperiodic_dimensions = ${sorted[0]}`;
  return `(${sorted.map(d => `nperiodic_dimensions = ${d}`).join(' OR ')})`;
}

export function deriveRangeClause(field, min, max) {
  const minInt = parseInt(min, 10);
  const maxInt = parseInt(max, 10);
  const hasMin = !isNaN(minInt);
  const hasMax = !isNaN(maxInt);
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax && minInt === maxInt) return `${field} = ${minInt}`;
  const parts = [];
  if (hasMin) parts.push(`${field} >= ${minInt}`);
  if (hasMax) parts.push(`${field} <= ${maxInt}`);
  return parts.join(' AND ');
}

export function deriveSpaceGroupClause(val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1 || n > 230) return null;
  return `space_group_it_number = ${n}`;
}

export function deriveLastModifiedClause(val) {
  if (!val) return null;
  return `last_modified > "${val}T00:00:00Z"`;
}

export function deriveFormulaClause(field, val) {
  const trimmed = (val ?? '').trim();
  if (!trimmed) return null;
  return `${field} = "${trimmed}"`;
}

export function buildFilterString({
  selectedElements, mode,
  nPeriodicDimensions,
  nElementsMin, nElementsMax,
  nSitesMin, nSitesMax,
  formulaAnonymous, formulaReduced,
  spaceGroupItNumber,
  lastModifiedSince,
}) {
  return [
    deriveElementsClause(selectedElements, mode),
    deriveNPeriodicDimsClause(nPeriodicDimensions),
    deriveRangeClause('nelements', nElementsMin, nElementsMax),
    deriveRangeClause('nsites', nSitesMin, nSitesMax),
    deriveFormulaClause('chemical_formula_anonymous', formulaAnonymous),
    deriveFormulaClause('chemical_formula_reduced', formulaReduced),
    deriveSpaceGroupClause(spaceGroupItNumber),
    deriveLastModifiedClause(lastModifiedSince),
  ].filter(Boolean).join(' AND ');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterSection({ label, tooltip, children }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        {tooltip && (
          <button
            type="button"
            title={tooltip}
            aria-label={`Help: ${label}`}
            className="w-4 h-4 rounded-full text-xs text-gray-400 border border-gray-300 leading-none hover:text-gray-600 hover:border-gray-400 flex items-center justify-center flex-shrink-0"
          >
            ?
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full text-sm border border-gray-200 rounded px-2 py-1.5',
        'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
        'placeholder:text-gray-300',
        className,
      )}
    />
  );
}

function NumberInput({ value, onChange, placeholder, min, max }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-300"
    />
  );
}

const DIM_OPTIONS = [
  { value: '0', label: 'Molecule' },
  { value: '1', label: 'Chain' },
  { value: '2', label: 'Layer' },
  { value: '3', label: 'Bulk' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function FilterPanel({
  onFilterChange,
  onReset,
  tableExpanded,
  onTableExpandChange,
}) {
  const [selectedElements, setSelectedElements] = useState(new Set());
  const [mode, setMode] = useState('has_all');
  const [nPeriodicDimensions, setNPeriodicDimensions] = useState(new Set());
  const [nElementsMin, setNElementsMin] = useState('');
  const [nElementsMax, setNElementsMax] = useState('');
  const [nSitesMin, setNSitesMin] = useState('');
  const [nSitesMax, setNSitesMax] = useState('');
  const [formulaAnonymous, setFormulaAnonymous] = useState('');
  const [formulaReduced, setFormulaReduced] = useState('');
  const [spaceGroupItNumber, setSpaceGroupItNumber] = useState('');
  const [lastModifiedSince, setLastModifiedSince] = useState('');

  function getState() {
    return {
      selectedElements, mode, nPeriodicDimensions,
      nElementsMin, nElementsMax,
      nSitesMin, nSitesMax,
      formulaAnonymous, formulaReduced,
      spaceGroupItNumber, lastModifiedSince,
    };
  }

  function handleSearch() {
    onFilterChange(buildFilterString(getState()));
  }

  function handleReset() {
    setSelectedElements(new Set());
    setMode('has_all');
    onTableExpandChange(false);
    setNPeriodicDimensions(new Set());
    setNElementsMin('');
    setNElementsMax('');
    setNSitesMin('');
    setNSitesMax('');
    setFormulaAnonymous('');
    setFormulaReduced('');
    setSpaceGroupItNumber('');
    setLastModifiedSince('');
    onReset();
  }

  function handleDimChange(vals) {
    setNPeriodicDimensions(new Set(vals.map(Number)));
  }

  return (
    <div>
      {/* ── Sticky top bar: Search + Reset ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-3 flex gap-2">
        <button
          type="button"
          onClick={handleSearch}
          className="flex-1 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* ── Scrollable filter body ── */}
      <div className="p-3 space-y-5">

        {/* 1. Elements — collapsible */}
        <div>
          {/* Collapsible header */}
          <div className="flex items-start gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onTableExpandChange(x => !x)}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 flex items-center gap-1 flex-shrink-0"
              aria-expanded={tableExpanded}
            >
              Select elements
              <span aria-hidden="true">{tableExpanded ? '▴' : '▾'}</span>
            </button>
            {selectedElements.size > 0 ? (
              <>
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {[...selectedElements].sort().map(el => (
                    <span
                      key={el}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                    >
                      {el}
                      <button
                        type="button"
                        aria-label={`Remove ${el}`}
                        onClick={() => {
                          const next = new Set(selectedElements);
                          next.delete(el);
                          setSelectedElements(next);
                        }}
                        className="hover:text-blue-900 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedElements(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-700 underline flex-shrink-0"
                >
                  Clear
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-300 italic">No elements selected</span>
            )}
          </div>

          {/* Expanded: periodic table + mode toggle */}
          {tableExpanded && (
            <div className="mt-2">
              <PeriodicTableSelector
                selectedElements={selectedElements}
                onSelectionChange={setSelectedElements}
                mode={mode}
                onModeChange={setMode}
              />
            </div>
          )}
        </div>

        {/* 2. Dimensionality */}
        <FilterSection label="Dimensionality">
          <ToggleGroup.Root
            type="multiple"
            value={[...nPeriodicDimensions].map(String)}
            onValueChange={handleDimChange}
            className="flex flex-wrap gap-1"
          >
            {DIM_OPTIONS.map(({ value, label }) => (
              <ToggleGroup.Item
                key={value}
                value={value}
                className={cn(
                  'px-2 py-1 text-xs rounded border transition-colors select-none cursor-pointer',
                  'data-[state=on]:bg-blue-100 data-[state=on]:border-blue-400 data-[state=on]:text-blue-700 data-[state=on]:font-medium',
                  'data-[state=off]:bg-white data-[state=off]:border-gray-200 data-[state=off]:text-gray-500',
                  'hover:data-[state=off]:border-gray-400 focus:outline-none',
                )}
              >
                <span className="font-mono font-semibold">{value}</span>
                <span className="ml-1 text-gray-400 text-[10px]">{label}</span>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </FilterSection>

        {/* 3. Number of elements range */}
        <FilterSection label="Elements (count)">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-0.5">Min</div>
              <NumberInput value={nElementsMin} onChange={setNElementsMin} placeholder="—" min="1" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-0.5">Max</div>
              <NumberInput value={nElementsMax} onChange={setNElementsMax} placeholder="—" min="1" />
            </div>
          </div>
        </FilterSection>

        {/* 4. Number of sites range (Max primary / leftmost) */}
        <FilterSection label="Sites (unit cell)">
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-0.5">Max</div>
              <NumberInput value={nSitesMax} onChange={setNSitesMax} placeholder="—" min="1" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-0.5">Min</div>
              <NumberInput value={nSitesMin} onChange={setNSitesMin} placeholder="—" min="1" />
            </div>
          </div>
        </FilterSection>

        {/* 5. Anonymous formula */}
        <FilterSection
          label="Anonymous formula"
          tooltip={
            'Element-agnostic formula: use A, B, C… for distinct species in order of ' +
            'increasing count. Example: AB2 matches TiO₂, MgF₂, FeS₂.'
          }
        >
          <TextInput
            value={formulaAnonymous}
            onChange={setFormulaAnonymous}
            placeholder="AB, AB2, ABO3…"
          />
        </FilterSection>

        {/* 6. Reduced formula */}
        <FilterSection label="Reduced formula">
          <TextInput
            value={formulaReduced}
            onChange={setFormulaReduced}
            placeholder="Fe2O3, TiO2…"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Case-sensitive. Use standard element symbols.</p>
        </FilterSection>

        {/* 7. Space group IT number */}
        <FilterSection label="Space group (IT no.)">
          <NumberInput
            value={spaceGroupItNumber}
            onChange={setSpaceGroupItNumber}
            placeholder="1–230"
            min="1"
            max="230"
          />
        </FilterSection>

        {/* 8. Last modified */}
        <FilterSection label="Modified after">
          <input
            type="date"
            value={lastModifiedSince}
            onChange={e => setLastModifiedSince(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </FilterSection>

      </div>
    </div>
  );
}
