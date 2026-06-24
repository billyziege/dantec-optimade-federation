// Stub for @react-three/fiber — prevents WebGL reconciler from loading in jsdom.
export const Canvas = ({ children }) => children ?? null;
export const useFrame = () => {};
export const useThree = () => ({});
export const useLoader = () => null;
