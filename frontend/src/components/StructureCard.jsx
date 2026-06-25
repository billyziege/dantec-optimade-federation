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

function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
      {filled ? (
        <path fill="currentColor" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth="1.5"
          d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
      )}
    </svg>
  );
}

// Shared card UI — accepts plain data (no Relay dependency).
function StructureCardContent({ structure, onClick, isSaved, onSaveToggle, onDelete }) {
  const formula = structure.chemicalFormulaReduced ?? structure.chemicalFormulaHill ?? '—';
  const isNomad = structure.providerMetadata?.__typename === 'NomadMetadata';
  const nomadUrl = isNomad ? buildNomadUrl(structure.providerMetadata?.entryId) : null;
  const date = structure.lastModified
    ? new Date(structure.lastModified).toLocaleDateString()
    : null;

  const hasAction = onSaveToggle != null || onDelete != null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all relative"
    >
      {/* Top-right action: bookmark toggle (Search tab) or delete (Saved tab) */}
      {hasAction && (
        <div className="absolute top-2 right-2">
          {onSaveToggle != null && (
            <button
              type="button"
              aria-label={isSaved ? 'Remove from Saved' : 'Save'}
              onClick={e => { e.stopPropagation(); onSaveToggle(); }}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                isSaved ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'
              }`}
            >
              <BookmarkIcon filled={isSaved} />
            </button>
          )}
          {onDelete != null && (
            <button
              type="button"
              aria-label="Remove from Saved"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-gray-100 transition-colors text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Main content — padded right when an action button is present */}
      <div className={hasAction ? 'pr-8' : ''}>
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
        {nomadUrl && (
          <a
            href={nomadUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            View in NOMAD ↗
          </a>
        )}
      </div>
    </div>
  );
}

// Search-tab card: resolves data via Relay fragment, shows bookmark toggle.
export default function StructureCard({ structure: structureRef, onClick, isSaved, onSaveToggle }) {
  const structure = useFragment(StructureCard_structure, structureRef);
  return (
    <StructureCardContent
      structure={structure}
      onClick={onClick}
      isSaved={isSaved}
      onSaveToggle={onSaveToggle != null ? () => onSaveToggle(structure) : null}
    />
  );
}

// Saved-tab card: takes a plain data snapshot (no Relay fragment), shows delete button.
export function SavedStructureCard({ structure, onClick, onDelete }) {
  return (
    <StructureCardContent
      structure={structure}
      onClick={onClick}
      onDelete={onDelete}
    />
  );
}
