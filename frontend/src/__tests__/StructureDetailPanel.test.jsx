import React from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StructureDetailPanel from '../components/StructureDetailPanel';
import { warningsStore } from '../lib/warningsStore';
import { createEnv, renderWithRelay, resolveOperation } from './relayTestUtils';

beforeEach(() => warningsStore.clear());

const STRUCTURE_ID = 'U3RydWN0dXJlOm5vbWFkL3Rlc3QtaWQ='; // base64("Structure:nomad/test-id")

function renderPanel(structureId, onClose = vi.fn()) {
  const env = createEnv();
  renderWithRelay(
    <StructureDetailPanel structureId={structureId} onClose={onClose} />,
    env
  );
  return env;
}

// ── Panel open / closed ────────────────────────────────────────────────────

test('panel is closed (no dialog) when structureId is null', () => {
  renderPanel(null);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('panel opens (dialog visible) when structureId is non-null', () => {
  renderPanel(STRUCTURE_ID);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

// ── Structure data rendering ───────────────────────────────────────────────

const fullStructureResolvers = {
  Structure() {
    return {
      provider: 'nomad',
      chemicalFormulaReduced: 'Al2O3',
      chemicalFormulaHill: null,
      elements: ['Al', 'O'],
      nelements: 2,
      nsites: 10,
      nperiodicDimensions: 3,
      spaceGroupSymbol: 'R-3c',
      spaceGroupItNumber: 167,
      lastModified: null,
      latticeVectors: null,
      cartesianSitePositions: null,
      speciesAtSites: null,
      species: null,
    };
  },
  ProviderMetadata() {
    return { __typename: 'NomadMetadata' };
  },
  NomadMetadata() {
    return {
      entryId: 'alumina-entry-id',
      archiveUrl: null,
      programName: 'VASP',
      programVersion: '6.0',
    };
  },
};

test('shows chemical formula after query resolves', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  expect(screen.getByText('Al2O3')).toBeInTheDocument();
});

test('shows element chips for each element', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  expect(screen.getByText('Al')).toBeInTheDocument();
  expect(screen.getAllByText('O').length).toBeGreaterThanOrEqual(1);
});

test('shows space group information when present', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  expect(screen.getByText('R-3c')).toBeInTheDocument();
  expect(screen.getByText('167')).toBeInTheDocument();
});

test('shows NOMAD link prominently when entryId is present', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  const link = screen.getByRole('link', { name: /view in nomad/i });
  expect(link).toHaveAttribute(
    'href',
    'https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/alumina-entry-id'
  );
});

test('shows NOMAD program name when present', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  expect(screen.getByText(/VASP/)).toBeInTheDocument();
});

// ── Lattice vectors table ──────────────────────────────────────────────────

test('renders lattice vectors table when latticeVectors is present', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, {
    ...fullStructureResolvers,
    Structure() {
      return {
        ...fullStructureResolvers.Structure(),
        latticeVectors: [
          [4.76237, 0.0, 0.0],
          [-2.38118, 4.12431, 0.0],
          [0.0, 0.0, 12.99180],
        ],
      };
    },
  });
  expect(screen.getByText('Lattice vectors (Å)', { exact: false })).toBeInTheDocument();
  // Each row value should appear as formatted number
  expect(screen.getByText('4.76237')).toBeInTheDocument();
});

// ── Null structure (provider unreachable) ──────────────────────────────────

test('shows error message when structure query returns null', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await act(async () => {
    env.mock.resolveMostRecentOperation(operation => ({
      data: { structure: null },
    }));
  });
  expect(screen.getByText(/not found|unreachable/i)).toBeInTheDocument();
});

// ── Warnings banner ────────────────────────────────────────────────────────

test('shows warnings banner when warningsStore has warnings', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  await act(async () => { warningsStore.add("provider 'nomad' returned partial data"); });
  expect(screen.getByText(/provider warnings/i)).toBeInTheDocument();
  expect(screen.getByText(/returned partial data/)).toBeInTheDocument();
});

test('warnings banner is absent when no warnings', async () => {
  const env = renderPanel(STRUCTURE_ID);
  await resolveOperation(env, fullStructureResolvers);
  expect(screen.queryByText(/provider warnings/i)).not.toBeInTheDocument();
});

// ── Close button ───────────────────────────────────────────────────────────

test('onClose is called when the sheet close button is activated', async () => {
  const onClose = vi.fn();
  const env = createEnv();
  renderWithRelay(
    <StructureDetailPanel structureId={STRUCTURE_ID} onClose={onClose} />,
    env
  );
  await resolveOperation(env, fullStructureResolvers);

  const user = userEvent.setup();
  const closeBtn = screen.getByRole('button', { name: /close/i });
  await user.click(closeBtn);
  expect(onClose).toHaveBeenCalled();
});
