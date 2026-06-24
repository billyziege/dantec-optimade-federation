import React, { Suspense, useEffect, useState } from 'react';
import { graphql, useFragment, useQueryLoader, usePreloadedQuery } from 'react-relay';
import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { warningsStore } from '../lib/warningsStore';

const StructureDetail_structure = graphql`
  fragment StructureDetail_structure on Structure {
    id
    provider
    chemicalFormulaReduced
    chemicalFormulaHill
    elements
    nelements
    nsites
    nperiodicDimensions
    dimensionTypes
    lastModified
    latticeVectors
    cartesianSitePositions
    spaceGroupSymbol
    spaceGroupItNumber
    species
    speciesAtSites
    providerMetadata {
      __typename
      ... on NomadMetadata {
        entryId
        archiveUrl
        programName
        programVersion
      }
      ... on GenericProviderMetadata {
        raw
      }
    }
  }
`;

const StructureDetailQuery = graphql`
  query StructureDetailQuery($id: ID!) {
    structure(id: $id) {
      ...StructureDetail_structure
    }
  }
`;

function WarningBanner({ warnings }) {
  if (!warnings.length) return null;
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
      <p className="text-xs font-semibold text-yellow-800 mb-1">Provider warnings</p>
      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-yellow-700">{w}</p>
      ))}
    </div>
  );
}

function StructureDetailInner({ queryRef }) {
  const queryData = usePreloadedQuery(StructureDetailQuery, queryRef);
  const structure = useFragment(StructureDetail_structure, queryData.structure);
  const [warnings, setWarnings] = useState(() => warningsStore.get());

  useEffect(() => warningsStore.subscribe(setWarnings), []);

  if (!structure) {
    return (
      <div className="text-red-600 text-sm">
        Structure not found or provider unreachable.
      </div>
    );
  }

  const formula = structure.chemicalFormulaReduced ?? structure.chemicalFormulaHill ?? '—';
  const isNomad = structure.providerMetadata?.__typename === 'NomadMetadata';
  const nomadMeta = isNomad ? structure.providerMetadata : null;
  const nomadUrl = nomadMeta?.entryId
    ? `https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/${nomadMeta.entryId}`
    : null;
  const date = structure.lastModified
    ? new Date(structure.lastModified).toLocaleString()
    : null;

  return (
    <div className="space-y-5">
      <WarningBanner warnings={warnings} />

      {/* Identity */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
            {structure.provider}
          </span>
          {nomadUrl && (
            <a
              href={nomadUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              View in NOMAD ↗
            </a>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900">{formula}</h3>
        {date && <p className="text-xs text-gray-400 mt-1">Last modified: {date}</p>}
      </section>

      {/* Composition */}
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Composition
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
          <div><span className="text-gray-500">Elements:</span> {structure.nelements ?? '—'}</div>
          <div><span className="text-gray-500">Sites:</span> {structure.nsites ?? '—'}</div>
          {structure.nperiodicDimensions != null && (
            <div>
              <span className="text-gray-500">Periodic dims:</span>{' '}
              {structure.nperiodicDimensions}
            </div>
          )}
        </div>
        {structure.elements && (
          <div className="flex flex-wrap gap-1">
            {structure.elements.map(el => (
              <span key={el} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                {el}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Symmetry */}
      {(structure.spaceGroupSymbol || structure.spaceGroupItNumber != null) && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Symmetry
          </h4>
          <div className="space-y-1 text-sm">
            {structure.spaceGroupSymbol && (
              <div>
                <span className="text-gray-500">Space group:</span>{' '}
                <span className="font-mono">{structure.spaceGroupSymbol}</span>
              </div>
            )}
            {structure.spaceGroupItNumber != null && (
              <div>
                <span className="text-gray-500">IT number:</span>{' '}
                {structure.spaceGroupItNumber}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Geometry */}
      {structure.latticeVectors && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Lattice vectors (Å)
          </h4>
          <table className="text-xs font-mono w-full">
            <tbody>
              {structure.latticeVectors.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 first:border-0">
                  {row.map((val, j) => (
                    <td key={j} className="pr-4 py-0.5 text-right text-gray-700">
                      {val.toFixed(5)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Sites */}
      {structure.speciesAtSites && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Sites ({structure.speciesAtSites.length})
          </h4>
          <div className="text-xs text-gray-600 font-mono max-h-28 overflow-y-auto bg-gray-50 rounded p-2">
            {structure.speciesAtSites.join('  ')}
          </div>
        </section>
      )}

      {/* Provider metadata */}
      {isNomad && nomadMeta && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            NOMAD metadata
          </h4>
          <div className="space-y-1 text-sm text-gray-700">
            {nomadMeta.programName && (
              <div>
                <span className="text-gray-500">Program:</span> {nomadMeta.programName}
                {nomadMeta.programVersion && (
                  <span className="text-gray-400"> v{nomadMeta.programVersion}</span>
                )}
              </div>
            )}
            {nomadMeta.archiveUrl && (
              <div>
                <a
                  href={nomadMeta.archiveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Archive URL ↗
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {!isNomad && structure.providerMetadata?.raw && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Provider metadata (raw)
          </h4>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-48 text-gray-700">
            {JSON.stringify(structure.providerMetadata.raw, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

export default function StructureDetailPanel({ structureId, onClose }) {
  const [queryRef, loadQuery] = useQueryLoader(StructureDetailQuery);

  useEffect(() => {
    if (structureId) {
      warningsStore.clear();
      loadQuery({ id: structureId }, { fetchPolicy: 'network-only' });
    }
  }, [structureId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={structureId !== null} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Structure detail</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {queryRef ? (
            <Suspense
              fallback={<div className="text-sm text-gray-400 animate-pulse">Loading…</div>}
            >
              <StructureDetailInner queryRef={queryRef} />
            </Suspense>
          ) : (
            <div className="text-sm text-gray-400">Select a structure to view details.</div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
