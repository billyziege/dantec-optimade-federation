import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';

// Colors for lattice vectors: a=red, b=green, c=blue (VESTA convention).
// Exported so StructureDetailPanel can color-match the table rows.
export const LATTICE_COLORS = ['#C62828', '#2E7D32', '#1565C0'];
export const LATTICE_LABELS = ['a', 'b', 'c'];

// CPK coloring — standard element color convention
const CPK = {
  H:  '#CCCCCC', He: '#D9FFFF', Li: '#CC80FF', Be: '#C2FF00',
  B:  '#FFB5B5', C:  '#303030', N:  '#3050F8', O:  '#FF0D0D',
  F:  '#90E050', Ne: '#B3E3F5', Na: '#AB5CF2', Mg: '#8AFF00',
  Al: '#BFA6A6', Si: '#F0C8A0', P:  '#FF8000', S:  '#FFFF30',
  Cl: '#1FF01F', Ar: '#80D1E3', K:  '#8F40D4', Ca: '#3DFF00',
  Sc: '#E6E6E6', Ti: '#BFC2C7', V:  '#A6A6AB', Cr: '#8A99C7',
  Mn: '#9C7AC7', Fe: '#E06633', Co: '#F090A0', Ni: '#50D050',
  Cu: '#C88033', Zn: '#7D80B0', Ga: '#C28F8F', Ge: '#668F8F',
  As: '#BD80E3', Se: '#FFA100', Br: '#A62929', Kr: '#5CB8D1',
  Rb: '#702EB0', Sr: '#00FF00', Y:  '#94FFFF', Zr: '#94E0E0',
  Nb: '#73C2C9', Mo: '#54B5B5', Tc: '#3B9E9E', Ru: '#248F8F',
  Rh: '#0A7D8C', Pd: '#006985', Ag: '#C0C0C0', Cd: '#FFD98F',
  In: '#A67573', Sn: '#668080', Sb: '#9E63B5', Te: '#D47A00',
  I:  '#940094', Xe: '#429EB0', Cs: '#57178F', Ba: '#00C900',
  La: '#70D4FF', Ce: '#FFFFC7', Pr: '#D9FFC7', Nd: '#C7FFC7',
  Pm: '#A3FFC7', Sm: '#8FFFC7', Eu: '#61FFC7', Gd: '#45FFC7',
  Tb: '#30FFC7', Dy: '#1FFFC7', Ho: '#00FF9C', Er: '#00E675',
  Tm: '#00D452', Yb: '#00BF38', Lu: '#00AB24', Hf: '#4DC2FF',
  Ta: '#4DA6FF', W:  '#2194D6', Re: '#267DAB', Os: '#266696',
  Ir: '#175487', Pt: '#D0D0E0', Au: '#FFD123', Hg: '#B8B8D0',
  Tl: '#A6544D', Pb: '#575961', Bi: '#9E4FB5', Po: '#AB5C00',
  At: '#754F45', Rn: '#428296', Fr: '#420066', Ra: '#007D00',
  Ac: '#70ABFA', Th: '#00BAFF', Pa: '#00A1FF', U:  '#008FFF',
};

// Display radii (Å) — reduced from covalent radii for crystal structure clarity
const RADII = {
  H: 0.22, C: 0.35, N: 0.33, O: 0.30, F: 0.28, S: 0.40, P: 0.38,
  Cl: 0.38, Fe: 0.48, Ca: 0.48, Na: 0.43, K: 0.48, Mg: 0.43,
  Cu: 0.43, Zn: 0.43, Al: 0.43, Si: 0.38, Ga: 0.43, Ge: 0.43,
  Ba: 0.50, Sr: 0.50, Rb: 0.50, Cs: 0.55,
};
const DEFAULT_RADIUS = 0.40;

function atomColor(species) { return CPK[species] ?? '#888888'; }
function atomRadius(species) { return RADII[species] ?? DEFAULT_RADIUS; }

// 12 edges of the unit cell parallelepiped, translated by offset.
function cellEdges(lv, offset) {
  const [a, b, c] = lv.map(v => new THREE.Vector3(...v));
  const o = new THREE.Vector3(...offset);
  const p = [
    o.clone(),
    o.clone().add(a),
    o.clone().add(b),
    o.clone().add(c),
    o.clone().add(a).add(b),
    o.clone().add(a).add(c),
    o.clone().add(b).add(c),
    o.clone().add(a).add(b).add(c),
  ];
  return [
    [p[0], p[1]], [p[2], p[4]], [p[3], p[5]], [p[6], p[7]],
    [p[0], p[2]], [p[1], p[4]], [p[3], p[6]], [p[5], p[7]],
    [p[0], p[3]], [p[1], p[5]], [p[2], p[6]], [p[4], p[7]],
  ];
}

// All 8 corners of the unit cell in render space.
function cellCorners8(lv, offset) {
  const [a, b, c] = lv;
  const [ox, oy, oz] = offset;
  const combos = [
    [0,0,0],[1,0,0],[0,1,0],[0,0,1],
    [1,1,0],[1,0,1],[0,1,1],[1,1,1],
  ];
  return combos.map(([ia, ib, ic]) => [
    ox + ia*a[0] + ib*b[0] + ic*c[0],
    oy + ia*a[1] + ib*b[1] + ic*c[1],
    oz + ia*a[2] + ib*b[2] + ic*c[2],
  ]);
}

const MAX_SITES = 200;
const FOV = 45;
const Y_UP = new THREE.Vector3(0, 1, 0);

function AtomMesh({ renderPos, displayPos, species: sp }) {
  const [hovered, setHovered] = useState(false);
  const r = atomRadius(sp);
  const coordStr = displayPos.map(v => v.toFixed(3)).join(', ');

  return (
    <mesh
      position={renderPos}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[r, 24, 16]} />
      <meshStandardMaterial color={atomColor(sp)} roughness={0.35} metalness={0.1} />
      {hovered && (
        <Html
          position={[0, r + 0.15, 0]}
          center
          zIndexRange={[100, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            color: '#111827',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}>
            <span style={{ fontWeight: 600 }}>{sp}</span>
            <span style={{ color: '#6b7280', marginLeft: 6 }}>[{coordStr}] Å</span>
          </div>
        </Html>
      )}
    </mesh>
  );
}

// Colored arrow for one lattice vector: shaft (Line) + arrowhead (cone) + label (Html).
function LatticeVector({ origin, tip, color, label }) {
  const orig = new THREE.Vector3(...origin);
  const tipV = new THREE.Vector3(...tip);
  const diff = tipV.clone().sub(orig);
  const len = diff.length();
  if (len < 0.001) return null;
  const dir = diff.clone().normalize();

  const coneH = Math.min(0.55, len * 0.14);
  const coneR = coneH * 0.38;
  const coneCenter = tipV.clone().sub(dir.clone().multiplyScalar(coneH / 2));
  const shaftEnd = tipV.clone().sub(dir.clone().multiplyScalar(coneH));
  const labelPos = tipV.clone().add(dir.clone().multiplyScalar(0.5)).toArray();

  const q = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir);

  return (
    <>
      <Line points={[orig.toArray(), shaftEnd.toArray()]} color={color} lineWidth={2.5} />
      <mesh position={coneCenter.toArray()} quaternion={q.toArray()}>
        <coneGeometry args={[coneR, coneH, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
        <span style={{
          color,
          fontWeight: 700,
          fontSize: 13,
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
          textShadow: '0 0 4px white',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {label}
        </span>
      </Html>
    </>
  );
}

export default function StructureViewer({ sites, latticeVectors }) {
  if (!sites || sites.length === 0) return null;

  // Center on unit cell midpoint (a+b+c)/2; fall back to atom mean when no cell.
  const center = latticeVectors
    ? [
        (latticeVectors[0][0] + latticeVectors[1][0] + latticeVectors[2][0]) / 2,
        (latticeVectors[0][1] + latticeVectors[1][1] + latticeVectors[2][1]) / 2,
        (latticeVectors[0][2] + latticeVectors[1][2] + latticeVectors[2][2]) / 2,
      ]
    : sites.reduce(
        (acc, { position: p }) => [
          acc[0] + p[0] / sites.length,
          acc[1] + p[1] / sites.length,
          acc[2] + p[2] / sites.length,
        ],
        [0, 0, 0],
      );

  const offset = [-center[0], -center[1], -center[2]];
  const shown = sites.slice(0, MAX_SITES);
  const truncated = sites.length > MAX_SITES;

  const prepared = shown.map(({ species: sp, position: p }) => ({
    species: sp,
    renderPos: [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]],
    displayPos: p,
  }));

  // Bounding sphere over all cell corners + atom positions → FOV-aware camera distance.
  const corners = latticeVectors ? cellCorners8(latticeVectors, offset) : [];
  const allPoints = [...corners, ...prepared.map(s => s.renderPos)];
  const boundingR = allPoints.reduce(
    (m, p) => Math.max(m, Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2)),
    0.5,
  );
  const cameraZ = Math.max(
    (boundingR / Math.tan((FOV / 2) * (Math.PI / 180))) * 1.15,
    5,
  );

  const edges = latticeVectors ? cellEdges(latticeVectors, offset) : [];

  // Lattice vector tips in render space (vectors start from cell origin = offset).
  const lvTips = latticeVectors
    ? latticeVectors.map(v => [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2]])
    : [];

  const elements = [...new Set(sites.map(s => s.species))].sort();

  return (
    <div>
      <div style={{ height: 300 }} className="rounded border border-gray-200 overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, cameraZ], fov: FOV }}
          gl={{ antialias: true }}
          style={{ background: '#ffffff' }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[10, 10, 5]} intensity={0.9} />
          <directionalLight position={[-8, -5, -5]} intensity={0.2} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.1} />

          {prepared.map(({ species: sp, renderPos, displayPos }, i) => (
            <AtomMesh key={i} renderPos={renderPos} displayPos={displayPos} species={sp} />
          ))}

          {edges.map(([s, e], i) => (
            <Line key={i} points={[s.toArray(), e.toArray()]} color="#9CA3AF" lineWidth={1} />
          ))}

          {latticeVectors && latticeVectors.map((lv, i) => (
            <LatticeVector
              key={i}
              origin={offset}
              tip={lvTips[i]}
              color={LATTICE_COLORS[i]}
              label={LATTICE_LABELS[i]}
            />
          ))}


        </Canvas>
      </div>

      {truncated && (
        <p className="text-xs text-gray-400 mt-1">
          Showing {MAX_SITES} of {sites.length} sites.
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {elements.map(el => (
          <div key={el} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
              style={{ backgroundColor: atomColor(el) }}
            />
            <span className="text-xs text-gray-600">{el}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
