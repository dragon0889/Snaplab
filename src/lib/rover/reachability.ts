import type { Arena, GoalZone, Obstacle, Pose } from "./types";

/** Distance from a point to the surface of an obstacle (0 when inside). */
export function distanceToObstacle(px: number, py: number, o: Obstacle): number {
  if (o.kind === "circle") return Math.max(0, Math.hypot(px - o.x, py - o.y) - o.r);
  const dx = Math.max(Math.abs(px - o.x) - o.w / 2, 0);
  const dy = Math.max(Math.abs(py - o.y) - o.h / 2, 0);
  return Math.hypot(dx, dy);
}

export function insideGoal(px: number, py: number, g: GoalZone): boolean {
  return Math.abs(px - g.x) <= g.w / 2 && Math.abs(py - g.y) <= g.h / 2;
}

/**
 * Can a car reach a goal zone through corridors at least `minWidthCm` wide?
 * Grid search over the arena: a cell is usable when the car centre keeps `minWidthCm / 2` of clearance from
 * every wall and obstacle (with half a cell of tolerance for the grid resolution). Used to validate arena presets.
 */
export function isGoalReachable(arena: Arena, start: Pose, minWidthCm: number, cellCm = 2): boolean {
  const need = minWidthCm / 2 - cellCm / 2;
  const cols = Math.ceil(arena.width / cellCm);
  const rows = Math.ceil(arena.height / cellCm);
  const centreX = (c: number) => (c + 0.5) * cellCm;
  const centreY = (r: number) => (r + 0.5) * cellCm;

  const free = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    const x = centreX(c);
    const y = centreY(r);
    if (Math.min(x, arena.width - x, y, arena.height - y) < need) return false;
    return arena.obstacles.every((o) => distanceToObstacle(x, y, o) >= need);
  };

  const startCol = Math.floor(start.x / cellCm);
  const startRow = Math.floor(start.y / cellCm);
  if (!free(startCol, startRow)) return false;

  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [startRow * cols + startCol];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const c = cell % cols;
    const r = Math.floor(cell / cols);
    if (arena.goals.some((g) => insideGoal(centreX(c), centreY(r), g))) return true;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!free(nc, nr)) continue;
        const idx = nr * cols + nc;
        if (seen[idx]) continue;
        seen[idx] = 1;
        queue.push(idx);
      }
    }
  }
  return false;
}
