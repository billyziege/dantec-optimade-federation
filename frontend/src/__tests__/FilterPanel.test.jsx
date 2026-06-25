import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterPanel, {
  buildFilterString,
  deriveElementsClause,
  deriveNPeriodicDimsClause,
  deriveRangeClause,
  deriveSpaceGroupClause,
  deriveLastModifiedClause,
  deriveFormulaClause,
} from '../components/FilterPanel';

// ── Pure derivation unit tests ──────────────────────────────────────────────

describe('deriveElementsClause', () => {
  test('has_all with one element', () => {
    expect(deriveElementsClause(new Set(['Fe']), 'has_all')).toBe('elements HAS ALL "Fe"');
  });

  test('has_all with two elements — sorted alphabetically', () => {
    expect(deriveElementsClause(new Set(['O', 'Fe']), 'has_all'))
      .toBe('elements HAS ALL "Fe","O"');
  });

  test('has_any mode', () => {
    expect(deriveElementsClause(new Set(['Fe', 'O']), 'has_any'))
      .toBe('elements HAS ANY "Fe","O"');
  });

  test('exact mode produces HAS ALL … AND HAS ONLY …', () => {
    expect(deriveElementsClause(new Set(['Fe', 'O']), 'exact'))
      .toBe('elements HAS ALL "Fe","O" AND elements HAS ONLY "Fe","O"');
  });

  test('empty set returns null', () => {
    expect(deriveElementsClause(new Set(), 'has_all')).toBeNull();
  });
});

describe('deriveNPeriodicDimsClause', () => {
  test('single dimension', () => {
    expect(deriveNPeriodicDimsClause(new Set([3]))).toBe('nperiodic_dimensions = 3');
  });

  test('multiple dimensions — sorted, wrapped in parentheses', () => {
    expect(deriveNPeriodicDimsClause(new Set([3, 2])))
      .toBe('(nperiodic_dimensions = 2 OR nperiodic_dimensions = 3)');
  });

  test('empty set returns null', () => {
    expect(deriveNPeriodicDimsClause(new Set())).toBeNull();
  });
});

describe('deriveRangeClause', () => {
  test('min and max different', () => {
    expect(deriveRangeClause('nelements', '2', '4'))
      .toBe('nelements >= 2 AND nelements <= 4');
  });

  test('min equals max collapses to equality', () => {
    expect(deriveRangeClause('nelements', '3', '3')).toBe('nelements = 3');
  });

  test('min only', () => {
    expect(deriveRangeClause('nelements', '2', '')).toBe('nelements >= 2');
  });

  test('max only', () => {
    expect(deriveRangeClause('nelements', '', '4')).toBe('nelements <= 4');
  });

  test('both empty returns null', () => {
    expect(deriveRangeClause('nelements', '', '')).toBeNull();
  });

  test('non-integer input is treated as empty', () => {
    expect(deriveRangeClause('nelements', 'abc', '')).toBeNull();
    expect(deriveRangeClause('nelements', '', 'abc')).toBeNull();
  });
});

describe('deriveSpaceGroupClause', () => {
  test('valid number', () => {
    expect(deriveSpaceGroupClause('225')).toBe('space_group_it_number = 225');
  });

  test('boundary 1', () => {
    expect(deriveSpaceGroupClause('1')).toBe('space_group_it_number = 1');
  });

  test('boundary 230', () => {
    expect(deriveSpaceGroupClause('230')).toBe('space_group_it_number = 230');
  });

  test('0 is out of range — returns null', () => {
    expect(deriveSpaceGroupClause('0')).toBeNull();
  });

  test('231 is out of range — returns null', () => {
    expect(deriveSpaceGroupClause('231')).toBeNull();
  });

  test('empty string returns null', () => {
    expect(deriveSpaceGroupClause('')).toBeNull();
  });

  test('text returns null', () => {
    expect(deriveSpaceGroupClause('Fm-3m')).toBeNull();
  });
});

describe('deriveLastModifiedClause', () => {
  test('date string', () => {
    expect(deriveLastModifiedClause('2024-01-01'))
      .toBe('last_modified > "2024-01-01T00:00:00Z"');
  });

  test('empty string returns null', () => {
    expect(deriveLastModifiedClause('')).toBeNull();
  });
});

describe('deriveFormulaClause', () => {
  test('anonymous formula', () => {
    expect(deriveFormulaClause('chemical_formula_anonymous', 'AB2'))
      .toBe('chemical_formula_anonymous = "AB2"');
  });

  test('trims whitespace', () => {
    expect(deriveFormulaClause('chemical_formula_reduced', ' Fe2O3 '))
      .toBe('chemical_formula_reduced = "Fe2O3"');
  });

  test('empty string returns null', () => {
    expect(deriveFormulaClause('chemical_formula_anonymous', '')).toBeNull();
  });
});

describe('buildFilterString', () => {
  function base(overrides = {}) {
    return {
      selectedElements: new Set(),
      mode: 'has_all',
      nPeriodicDimensions: new Set(),
      nElementsMin: '', nElementsMax: '',
      nSitesMin: '', nSitesMax: '',
      formulaAnonymous: '',
      formulaReduced: '',
      spaceGroupItNumber: '',
      lastModifiedSince: '',
      ...overrides,
    };
  }

  test('all defaults → empty string', () => {
    expect(buildFilterString(base())).toBe('');
  });

  test('elements only', () => {
    expect(buildFilterString(base({ selectedElements: new Set(['Fe', 'O']) })))
      .toBe('elements HAS ALL "Fe","O"');
  });

  test('multiple active fields are joined with AND', () => {
    const result = buildFilterString(base({
      selectedElements: new Set(['Fe', 'O']),
      nPeriodicDimensions: new Set([3]),
      formulaAnonymous: 'ABO3',
    }));
    expect(result).toBe(
      'elements HAS ALL "Fe","O" AND nperiodic_dimensions = 3 AND chemical_formula_anonymous = "ABO3"'
    );
  });
});

// ── UI interaction tests ────────────────────────────────────────────────────

// Wrapper that holds tableExpanded state, mirroring what StructuresPage does.
function FilterPanelWrapper({ onFilterChange, onReset }) {
  const [tableExpanded, setTableExpanded] = React.useState(false);
  return (
    <FilterPanel
      onFilterChange={onFilterChange}
      onReset={onReset}
      tableExpanded={tableExpanded}
      onTableExpandChange={setTableExpanded}
    />
  );
}

function setup({ onFilterChange = vi.fn(), onReset = vi.fn() } = {}) {
  const user = userEvent.setup();
  render(<FilterPanelWrapper onFilterChange={onFilterChange} onReset={onReset} />);
  return { user, onFilterChange, onReset };
}

test('Search and Reset buttons are visible on initial render', () => {
  setup();
  expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
});

test('periodic table is collapsed by default', () => {
  setup();
  expect(screen.queryByTitle('Iron')).not.toBeInTheDocument();
});

test('clicking Select elements expands the periodic table', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  expect(screen.getByTitle('Iron')).toBeInTheDocument();
});

test('Search with all defaults calls onFilterChange with empty string', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('');
});

test('element selection + Search produces correct filter string', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('elements HAS ALL "Fe"');
});

test('Clear button removes all chips without calling onFilterChange', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  // Close table so chips are visible in the header
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  expect(screen.getByText('Fe')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^clear$/i }));
  expect(screen.queryByText('Fe')).not.toBeInTheDocument();
  expect(onFilterChange).not.toHaveBeenCalled();
});

test('chip × button removes that element only', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByTitle('Oxygen'));
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByRole('button', { name: /remove fe/i }));
  // O chip remains
  expect(screen.getByText('O')).toBeInTheDocument();
  expect(screen.queryByText('Fe')).not.toBeInTheDocument();
  expect(onFilterChange).not.toHaveBeenCalled();
});

test('Clear button is absent when no elements are selected', () => {
  setup();
  expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument();
});

test('Reset clears fields, collapses table, and calls onReset', async () => {
  const { user, onReset, onFilterChange } = setup();
  // Expand table and select an element
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  expect(screen.getByTitle('Iron')).toBeInTheDocument(); // expanded
  // Click Reset
  await user.click(screen.getByRole('button', { name: /reset/i }));
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(onFilterChange).not.toHaveBeenCalled();
  // Table should be collapsed
  expect(screen.queryByTitle('Iron')).not.toBeInTheDocument();
  // No chips visible
  expect(screen.queryByText('Fe')).not.toBeInTheDocument();
});

test('Search after Reset uses empty filter string', async () => {
  const { user, onFilterChange, onReset } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByRole('button', { name: /reset/i }));
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('');
});

test('selecting dimensionality 3 adds nperiodic_dimensions clause', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /3.*bulk/i }));
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('nperiodic_dimensions = 3');
});

test('anonymous formula text field contributes to filter string', async () => {
  const { user, onFilterChange } = setup();
  await user.type(screen.getByPlaceholderText(/AB, AB2/i), 'ABO3');
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('chemical_formula_anonymous = "ABO3"');
});

test('space group IT number out of range produces no clause', async () => {
  const { user, onFilterChange } = setup();
  await user.type(screen.getByPlaceholderText('1–230'), '0');
  await user.click(screen.getByRole('button', { name: /search/i }));
  expect(onFilterChange).toHaveBeenCalledWith('');
});

test('field interactions do not call onFilterChange on their own', async () => {
  const { user, onFilterChange } = setup();
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  await user.type(screen.getByPlaceholderText(/AB, AB2/i), 'AB2');
  expect(onFilterChange).not.toHaveBeenCalled();
});
