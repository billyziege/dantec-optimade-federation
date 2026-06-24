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
import { createEnv, renderWithRelay, resolveOperation } from './relayTestUtils';

// Use the existing compiled StructuresQuery artifact with useLazyLoadQuery.
// useLazyLoadQuery goes through the environment's execute path which IS
// captured by the mock environment, unlike the useQueryLoader preloaded path.
function StructureListLazy({ variables, onSelect }) {
  const data = useLazyLoadQuery(StructuresQueryNode, variables);
  return <StructureList structures={data} onSelectStructure={onSelect} />;
}

function renderList(env, variables = { first: 10 }, onSelect = vi.fn()) {
  renderWithRelay(
    <StructureListLazy variables={variables} onSelect={onSelect} />,
    env
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

// ── Loading state (full StructuresPage) ─────────────────────────────────────

test('StructuresPage shows loading text while initial query is in flight', async () => {
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);
  await screen.findByText(/loading structures/i);
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

test('selecting an element triggers a new Relay operation with the correct filter', async () => {
  const user = userEvent.setup();
  const env = createEnv();
  renderWithRelay(<StructuresPage />, env);

  // Two operations will be queued: the initial empty-filter one (from
  // useEffect) and the filter-change one (from clicking Iron).
  await user.click(screen.getByTitle('Iron'));
  await act(async () => {});

  const ops = env.mock.getAllOperations();
  expect(ops.length).toBeGreaterThanOrEqual(2);
  const filterOp = ops.find(op => op.request.variables.filter === 'elements HAS ALL "Fe"');
  expect(filterOp).toBeDefined();
});
