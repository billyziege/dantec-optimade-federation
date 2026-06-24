import React from 'react';
import { useFragment, graphql } from 'react-relay';

export const StructureCard_structure = graphql`
  fragment StructureCard_structure on Structure {
    id
    provider
    chemicalFormulaReduced
    chemicalFormulaHill
    elements
    nelements
    nsites
    lastModified
    providerMetadata {
      __typename
      ... on NomadMetadata {
        entryId
      }
    }
  }
`;

function buildNomadUrl(entryId) {
  if (!entryId) return null;
  return `https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/${entryId}`;
}

export default function StructureCard({ structure: structureRef, onClick }) {
  const structure = useFragment(StructureCard_structure, structureRef);

  const formula = structure.chemicalFormulaReduced ?? structure.chemicalFormulaHill ?? '—';
  const isNomad = structure.providerMetadata?.__typename === 'NomadMetadata';
  const nomadUrl = isNomad ? buildNomadUrl(structure.providerMetadata.entryId) : null;
  const date = structure.lastModified
    ? new Date(structure.lastModified).toLocaleDateString()
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              {structure.provider}
            </span>
            {date && <span className="text-xs text-gray-400">{date}</span>}
          </div>
          <p className="text-base font-semibold text-gray-900 truncate">{formula}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {structure.nelements} elements · {structure.nsites} sites
          </p>
          {structure.elements && structure.elements.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {structure.elements.map(el => (
                <span
                  key={el}
                  className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                >
                  {el}
                </span>
              ))}
            </div>
          )}
        </div>
        {nomadUrl && (
          <a
            href={nomadUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap mt-1"
          >
            View in NOMAD ↗
          </a>
        )}
      </div>
    </div>
  );
}
