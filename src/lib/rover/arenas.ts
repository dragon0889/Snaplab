import type { Arena, ArenaId } from "./types";

/**
 * Arena presets (centimetres, origin at the bottom-left corner, heading 0 = up).
 * The default car is 22 x 14 cm, so every corridor must stay wider than 1.5 x 14 = 21 cm (checked by tests).
 */
export const ARENAS: Readonly<Record<ArenaId, Arena>> = {
  // A wall across the lane: lesson "stop before the wall" (the goal behind it is optional).
  "straight-wall": {
    id: "straight-wall",
    title: "Bức tường chắn đường",
    width: 180,
    height: 240,
    start: { x: 90, y: 30, headingDeg: 0 },
    obstacles: [{ kind: "box", x: 90, y: 170, w: 120, h: 10 }],
    goals: [{ x: 90, y: 215, w: 60, h: 30 }],
  },
  // Three posts on the centre line: driving straight hits the first one, so the car must weave. Lesson "avoid obstacles".
  slalom: {
    id: "slalom",
    title: "Đường zig-zag",
    width: 200,
    height: 340,
    start: { x: 100, y: 35, headingDeg: 0 },
    obstacles: [
      { kind: "circle", x: 100, y: 100, r: 10 },
      { kind: "circle", x: 100, y: 170, r: 10 },
      { kind: "circle", x: 100, y: 240, r: 10 },
    ],
    goals: [{ x: 100, y: 305, w: 80, h: 40 }],
  },
  // Two staggered walls make an S-shaped corridor: lesson "maze".
  "maze-s": {
    id: "maze-s",
    title: "Mê cung chữ S",
    width: 240,
    height: 240,
    start: { x: 30, y: 30, headingDeg: 0 },
    obstacles: [
      { kind: "box", x: 160, y: 80, w: 160, h: 10 },
      { kind: "box", x: 80, y: 160, w: 160, h: 10 },
    ],
    goals: [{ x: 120, y: 205, w: 80, h: 40 }],
  },
  // Two parked cars with a gap between them: lesson "parking". The car starts facing right.
  parking: {
    id: "parking",
    title: "Đỗ xe vào chỗ trống",
    width: 240,
    height: 180,
    start: { x: 40, y: 30, headingDeg: 90 },
    obstacles: [
      { kind: "box", x: 110, y: 140, w: 30, h: 50 },
      { kind: "box", x: 190, y: 140, w: 30, h: 50 },
    ],
    goals: [{ x: 150, y: 135, w: 36, h: 40 }],
  },
};

export const ARENA_IDS = Object.keys(ARENAS) as ArenaId[];

export function getArena(id: ArenaId): Arena {
  return ARENAS[id];
}
