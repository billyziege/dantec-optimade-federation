/**
 * Tests for StructuresPage, StructureList, and StructureCard.
 *
 * Relay's `loadQuery` (used by `useQueryLoader`) goes through an internal
 * preloading path that the relay-test-utils mock environment does not capture
 * via the `execute` proxy when using the default fetch policy.  For card /
 * list rendering tests we therefore use a thin `StructureListLazy` wrapper
 * that uses `useLazyLoadQuery` instead — that path *is* intercepted by the
 * mock environment and allows normal `resolveOperation` usage.
 *
 * Tests that exercise StructuresPage state management (loading state, filter
 * string derivation routed to a new query) still render the full component.
 */
import React from 'react';
import { useLazyLoadQuery } from 'react-relay';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructuresPage from '../pages/StructuresPage';
import StructureList from '../components/StructureList';
import StructuresQueryNode from '../__generated__/StructuresQuery.graphql';
import { createEnv, renderWithRelay, resolveOperation, queueResolver, renderResolved } from './relayTestUtils';

// Use the existing compiled StructuresQuery artifact with useLazyLoadQuery.
// useLazyLoadQuery goes through the environment's execute path which IS
// captured by the mock environment, unlike the useQueryLoader preloaded path.
function StructureListLazy({ variables, onSelect, savedIds, onSaveToggle }) {
  const data = useLazyLoadQuery(StructuresQueryNode, variables);
  return (
    <StructureList
      structures={data}
      onSelectStructure={onSelect}
      savedIds={savedIds}
      onSaveToggle={onSaveToggle}
    />
  );
}

function renderList(env, variables = { first: 10 }, onSelect = vi.fn(), extras = {}) {
  renderWithRelay(
    <StructureListLazy variables={variables} onSelect={onSelect} {...extras} />,
    env
  );
}

// Save-state integration wrapper — uses useLazyLoadQuery (intercepted by the
// mock environment) and mirrors the save/delete logic from StructuresPage.
// This exercises the bookmark toggle → save map → counter → delete flow
// without relying on loadQuery's preloaded path.
function SaveWrapper() {
  const [savedItems, setSavedItems] = React.useState(new Map());
  const data = useLazyLoadQuery(StructuresQueryNode, { first: 10 });

  function handleSaveToggle(item) {
    setSavedItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, {
          id: item.id,
          provider: item.provider,
          chemicalFormulaReduced: item.chemicalFormulaReduced,
          chemicalFormulaHill: item.chemicalFormulaHill,
          elements: item.elements ? [...item.elements] : [],
          nelements: item.nelements,
          nsites: item.nsites,
          lastModified: item.lastModified,
          providerMetadata: item.providerMetadata ? { ...item.providerMetadata } : null,
        });
      }
      return next;
    });
  }

  return (
    <div>
      <div>Saved ({savedItems.size})</div>
      {savedItems.size > 0 && (
        <div>
          {[...savedItems.values()].map(item => (
            <div key={item.id} data-testid="saved-item">
              <span>{item.chemicalFormulaReduced ?? item.chemicalFormulaHill ?? '—'}</span>
              <button
                type="button"
                aria-label="Delete saved item"
                onClick={() => handleSaveToggle(item)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <StructureList
        structures={data}
        onSelectStructure={vi.fn()}
        savedIds={new Set(savedItems.keys())}
        onSaveToggle={handleSaveToggle}
      />
    </div>
  );
}

beforeEach(() => IntersectionObserver.reset());

const nomadStructureResolvers = {
  Structure() {
    return {
      provider: 'nomad',
      chemicalFormulaReduced: 'Fe2O3',
      chemicalFormulaHill: null,
      elements: ['Fe', 'O'],
      nelements: 2,
      nsites: 5,
      lastModified: null,
    };
  },
  ProviderMetadata() {
    return { __typename: 'NomadMetadata' };
  },
  NomadMetadata() {
    return { entryId: 'test-entry-abc', archiveUrl: null };
  },
  PageInfo() {
    return { hasNextPage: false, endCursor: null };
  },
};

// ── Tab bar (StructuresPage) ─────────────────────────────────────────────────

test('StructuresPage shows Search and Saved tabs', () => {
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);
  expect(screen.getByRole('tab', { name: /^search$/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /saved \(0\)/i })).toBeInTheDocument();
});

test('Saved tab initially shows the empty-saved prompt', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);
  await user.click(screen.getByRole('tab', { name: /saved \(0\)/i }));
  expect(screen.getByText(/no saved structures/i)).toBeInTheDocument();
});

// ── Initial state (full StructuresPage) ─────────────────────────────────────

test('StructuresPage shows prompt and no results before first search', () => {
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);
  expect(screen.getByText(/enter filters and click search/i)).toBeInTheDocument();
  expect(screen.queryByText(/loading structures/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/no structures found/i)).not.toBeInTheDocument();
});

// ── StructureCard rendering ──────────────────────────────────────────────────

test('renders provider badge and chemical formula', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, nomadStructureResolvers);

  expect(screen.getByText('nomad')).toBeInTheDocument();
  expect(screen.getByText('Fe2O3')).toBeInTheDocument();
});

test('renders element chips for each element', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, nomadStructureResolvers);

  const chips = screen.getAllByText('Fe');
  expect(chips.length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('O').length).toBeGreaterThanOrEqual(1);
});

test('renders NOMAD link with correct URL when entryId present', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, nomadStructureResolvers);

  const link = screen.getByRole('link', { name: /view in nomad/i });
  expect(link).toHaveAttribute(
    'href',
    'https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/test-entry-abc'
  );
  expect(link).toHaveAttribute('target', '_blank');
});

test('omits NOMAD link when entryId is null', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, {
    ...nomadStructureResolvers,
    NomadMetadata() { return { entryId: null, archiveUrl: null }; },
  });

  expect(screen.queryByRole('link', { name: /view in nomad/i })).not.toBeInTheDocument();
});

test('card click calls onSelectStructure with the structure id', async () => {
  const onSelect = vi.fn();
  const env = createEnv();
  const user = userEvent.setup();
  renderList(env, { first: 10 }, onSelect);
  await resolveOperation(env, nomadStructureResolvers);

  const card = screen.getByText('Fe2O3').closest('div[class*="rounded-lg"]');
  await user.click(card);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(typeof onSelect.mock.calls[0][0]).toBe('string');
});

test('clicking the NOMAD link does NOT call onSelectStructure', async () => {
  const onSelect = vi.fn();
  const env = createEnv();
  const user = userEvent.setup();
  renderList(env, { first: 10 }, onSelect);
  await resolveOperation(env, nomadStructureResolvers);

  await user.click(screen.getByRole('link', { name: /view in nomad/i }));
  expect(onSelect).not.toHaveBeenCalled();
});

// ── Bookmark (save) behavior ─────────────────────────────────────────────────

test('bookmark button appears when onSaveToggle is provided', async () => {
  const env = createEnv();
  renderList(env, { first: 10 }, vi.fn(), { onSaveToggle: vi.fn() });
  await resolveOperation(env, nomadStructureResolvers);

  expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
});

test('bookmark button is absent when onSaveToggle is not provided', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, nomadStructureResolvers);

  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
});

test('clicking bookmark calls onSaveToggle with structure data', async () => {
  const onSaveToggle = vi.fn();
  const user = userEvent.setup();
  const env = createEnv();
  renderList(env, { first: 10 }, vi.fn(), { onSaveToggle });
  await resolveOperation(env, nomadStructureResolvers);

  await user.click(screen.getByRole('button', { name: /^save$/i }));
  expect(onSaveToggle).toHaveBeenCalledTimes(1);
  expect(onSaveToggle.mock.calls[0][0]).toMatchObject({
    provider: 'nomad',
    chemicalFormulaReduced: 'Fe2O3',
  });
});

test('clicking bookmark does NOT call onSelectStructure', async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  const env = createEnv();
  renderList(env, { first: 10 }, onSelect, { onSaveToggle: vi.fn() });
  await resolveOperation(env, nomadStructureResolvers);

  await user.click(screen.getByRole('button', { name: /^save$/i }));
  expect(onSelect).not.toHaveBeenCalled();
});

test('saved item shows filled bookmark and Remove label', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  const onSaveToggle = vi.fn();
  // Simulate the item already being saved by providing savedIds containing the resolved id.
  // We don't know the exact mock id, so we collect it from the onSaveToggle call first.
  renderList(env, { first: 10 }, vi.fn(), { onSaveToggle });
  await resolveOperation(env, nomadStructureResolvers);

  // First click: save it
  await user.click(screen.getByRole('button', { name: /^save$/i }));
  const savedData = onSaveToggle.mock.calls[0][0];

  // Re-render with isSaved=true (simulate StructuresPage having stored the item)
  const env2 = createEnv();
  renderList(env2, { first: 10 }, vi.fn(), {
    savedIds: new Set([savedData.id]),
    onSaveToggle,
  });
  await resolveOperation(env2, nomadStructureResolvers);

  expect(screen.getByRole('button', { name: /remove from saved/i })).toBeInTheDocument();
});

// ── Saved tab integration (SaveWrapper + useLazyLoadQuery) ───────────────────
//
// StructuresPage uses useQueryLoader / loadQuery whose preloaded path is not
// captured by the mock environment's execute proxy.  SaveWrapper replicates
// the same save-state logic (Map<id, snapshot>, toggle, delete) but uses
// useLazyLoadQuery, which IS intercepted.  renderResolved queues the resolver
// before mount so the Suspense resolves in the first act flush.

test('saving a result increments the saved counter', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  await renderResolved(<SaveWrapper />, env, nomadStructureResolvers);

  expect(screen.getByText('Saved (0)')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^save$/i }));
  expect(screen.getByText('Saved (1)')).toBeInTheDocument();
});

test('saved item appears in the saved list after toggling bookmark', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  await renderResolved(<SaveWrapper />, env, nomadStructureResolvers);

  await user.click(screen.getByRole('button', { name: /^save$/i }));

  expect(screen.getByTestId('saved-item')).toBeInTheDocument();
  expect(screen.getByTestId('saved-item')).toHaveTextContent('Fe2O3');
});

test('removing a saved item decrements the counter and removes it from the list', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  await renderResolved(<SaveWrapper />, env, nomadStructureResolvers);

  // Save then delete
  await user.click(screen.getByRole('button', { name: /^save$/i }));
  expect(screen.getByText('Saved (1)')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /delete saved item/i }));
  expect(screen.getByText('Saved (0)')).toBeInTheDocument();
  expect(screen.queryByTestId('saved-item')).not.toBeInTheDocument();
});

// ── Empty state ─────────────────────────────────────────────────────────────

test('shows empty-state message when no edges are returned', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, {
    StructureConnection() { return { edges: [] }; },
    PageInfo() { return { hasNextPage: false, endCursor: null }; },
  });

  expect(screen.getByText(/no structures found/i)).toBeInTheDocument();
});

// ── Pagination sentinel ──────────────────────────────────────────────────────

test('sentinel absent (no IntersectionObserver) when hasNextPage is false', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, nomadStructureResolvers); // hasNextPage: false in resolver

  expect(IntersectionObserver.instances.length).toBe(0);
});

test('sentinel (IntersectionObserver) registered when hasNextPage is true', async () => {
  const env = createEnv();
  renderList(env);
  await resolveOperation(env, {
    ...nomadStructureResolvers,
    PageInfo() { return { hasNextPage: true, endCursor: 'cursor1' }; },
  });

  expect(IntersectionObserver.instances.length).toBeGreaterThan(0);
});

// ── Filter change (StructuresPage) ──────────────────────────────────────────

test('selecting an element and clicking Search triggers a Relay operation with the correct filter', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);

  // Periodic table is collapsed by default in FilterPanel — expand it first.
  await user.click(screen.getByRole('button', { name: /select elements/i }));
  await user.click(screen.getByTitle('Iron'));
  await user.click(screen.getByRole('button', { name: /search/i }));
  await act(async () => {});

  const ops = env.mock.getAllOperations();
  expect(ops.length).toBeGreaterThanOrEqual(1);
  const filterOp = ops.find(op => op.request.variables.filter === 'elements HAS ALL "Fe"');
  expect(filterOp).toBeDefined();
});
