// game.ts — Pathfinding algorithms: BFS, DFS, IDS
// Types, maps, and generator-based search

export type Cell = { row: number; col: number };
export type AlgoType = 'BFS' | 'DFS' | 'IDS' | 'UCS' | 'Greedy' | 'AStar' | 'HillClimbing' | 'LocalBeam' | 'SimulatedAnnealing' | 'SensorlessSearch' | 'OnlineSearch' | 'AndOrSearch' | 'AC3' | 'BacktrackingSearch' | 'MinConflicts' | 'Minimax' | 'AlphaBeta' | 'Expectimax';
export type Grid = number[][]; // 0 = walkable, 1 = obstacle

export interface Step {
  current: Cell | null;
  visited: Map<string, Cell>;
  frontier: Cell[];
  path: Cell[];
  found: boolean;
  done: boolean;
  beliefState?: Cell[];
  agents?: {row: number, col: number, type: 'queen' | 'x' | 'o' | 'highlight' | 'monster'}[];
}

const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

function neighbours(cell: Cell, grid: Grid): Cell[] {
  const h = grid.length;
  const w = grid[0].length;
  const result: Cell[] = [];
  for (const [dr, dc] of dirs) {
    const r = cell.row + dr;
    const c = cell.col + dc;
    if (r >= 0 && r < h && c >= 0 && c < w && grid[r][c] !== 1 && grid[r][c] !== 7) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

// ── Maps ──

function applyBorder(g: Grid): Grid {
  const n = g.length;
  for (let i = 0; i < n; i++) {
    g[0][i] = 1;       // top
    g[n - 1][i] = 1;   // bottom
    g[i][0] = 1;       // left
    g[i][n - 1] = 1;   // right
  }
  return g;
}

/** Empty 21×21 grid — surrounded by border walls. */
export const MAP1: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  return applyBorder(g);
})();

/** Maze-like 21×21 grid with pillars at odd-odd positions. */
export const MAP2: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 2; r < n - 2; r += 2) {
    for (let c = 2; c < n - 2; c += 2) {
      g[r][c] = 1;
    }
  }
  return applyBorder(g);
})();

/** Random 21×21 grid with ~22% walls, guaranteed path via inner rows. */
export const MAP3: Grid = (() => {
  const n = 21;
  let seed = 42;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const g: Grid = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => (rng() < 0.22 ? 1 : 0)),
  );
  // Guarantee a path: clear an inner row and column instead of outer edge
  for (let c = 1; c < n - 1; c++) g[1][c] = 0;
  for (let r = 1; r < n - 1; r++) g[r][n - 2] = 0;
  return applyBorder(g);
})();

/** Lợi thế BFS: Đích gần điểm xuất phát, nhưng có nhiều đường hầm sâu xung quanh lừa DFS. */
export const MAP4: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  // Create deep horizontal/vertical tunnels
  for (let r = 2; r < n - 2; r += 2) {
    for (let c = 2; c < n - 2; c++) g[r][c] = 1;
  }
  // Open a short path near top left
  g[2][3] = 0; g[2][4] = 0; g[4][4] = 0;
  return applyBorder(g);
})();

/** Lợi thế DFS: Đường hầm ziczac dài một chiều, đích ở cuối con đường, DFS lao thẳng tới đích. */
export const MAP5: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(1));
  let r = 1, c = 1;
  g[r][c] = 0;
  // Create a winding snake path
  for (let i = 2; i < n - 1; i += 4) {
    while (c < n - 2) { c++; g[r][c] = 0; }
    r++; g[r][c] = 0;
    r++; g[r][c] = 0;
    while (c > 2) { c--; g[r][c] = 0; }
    r++; g[r][c] = 0;
    if (r + 1 < n - 1) { r++; g[r][c] = 0; }
  }
  while (c < n - 2) { c++; g[r][c] = 0; }
  return applyBorder(g);
})();

/** Lợi thế IDS: Không gian mở khổng lồ, BFS bung bét bộ nhớ, IDS tối ưu Frontier. */
export const MAP6: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  // Create just a few scattered blocks
  g[5][5] = 1; g[5][15] = 1; g[15][5] = 1; g[15][15] = 1;
  return applyBorder(g);
})();

/** Sensorless: Small open map with outer walls to slide against. */
export const MAP7: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  // Add some internal walls for bumping
  for(let i=5; i<15; i++) { g[5][i] = 1; g[15][i] = 1; }
  return applyBorder(g);
})();

/** Online Search (Fog): Maze with dead ends. */
export const MAP8: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(1));
  // Generate a simple path with branches
  for (let r = 2; r < n - 2; r++) g[r][10] = 0; // vertical corridor
  for (let c = 2; c < n - 2; c++) g[10][c] = 0; // horizontal corridor
  g[2][9] = 0; g[2][8] = 0; // dead end
  g[18][11] = 0; g[18][12] = 0; // dead end
  g[1][1] = 0; g[1][2] = 0; g[2][2] = 0; g[2][1] = 0; // start room
  g[19][19] = 0; g[19][18] = 0; g[18][19] = 0; g[18][18] = 0; // goal room
  // Connect start to vertical corridor
  for (let c = 2; c <= 10; c++) g[2][c] = 0;
  // Connect goal to vertical corridor
  for (let c = 10; c <= 19; c++) g[18][c] = 0;
  return applyBorder(g);
})();

/** AND-OR Search (Non-deterministic): Agent bất định, môi trường random. */
export const MAP9: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  // Add some internal obstacles that form a simple layout, ensuring connectivity
  for (let i = 4; i < 17; i++) {
    g[6][i] = 1;
    g[14][i] = 1;
  }
  return applyBorder(g);
})();

/** CSP Pathfinding: Maze for Constraint Satisfaction */
export const MAP10: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(1));
  for (let r = 1; r < n - 1; r++) {
    for (let c = 1; c < n - 1; c++) {
      g[r][c] = 0;
    }
  }
  for (let r = 3; r < 18; r += 4) {
    for (let c = 3; c < 15; c++) g[r][c] = 1;
    for (let c = 6; c < 18; c++) g[r + 2][c] = 1;
  }
  g[2][8] = 1;
  g[2][9] = 1;
  g[2][10] = 1;
  return applyBorder(g);
})();

/** Adversarial Chase: A structured maze for chasing. */
export const MAP11: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(1));
  for (let r = 1; r < n - 1; r++) {
    for (let c = 1; c < n - 1; c++) {
      g[r][c] = 0;
    }
  }
  const centers = [4, 8, 12, 16];
  for (const r of centers) {
    for (const c of centers) {
      g[r][c] = 1;
      if (c < 16) g[r][c + 1] = 1;
      if (c > 4) g[r][c - 1] = 1;
      if (r < 16) g[r + 1][c] = 1;
      if (r > 4) g[r - 1][c] = 1;
    }
  }
  return applyBorder(g);
})();

/** Cosmic Swamp: A map with a muddy swamp barrier in the middle for Chapter 2. 6 = swamp */
export const MAP12: Grid = (() => {
  const n = 21;
  const g: Grid = Array.from({ length: n }, () => Array(n).fill(0));
  // Place a swamp barrier (value 6) in the middle
  for (let r = 5; r < 16; r++) {
    for (let c = 8; c < 13; c++) {
      g[r][c] = 6;
    }
  }
  // Add some obstacles to make it more interesting
  g[4][10] = 1;
  g[16][10] = 1;
  return applyBorder(g);
})();

/** Map metadata for convenience (grid references + start/goal). */


export interface MapDefinition {
  name: string;
  grid: Grid;
  start: Cell;
  goal: Cell;
  generate(): Grid;
}

export const MAPS: MapDefinition[] = [
  {
    name: 'Empty 21×21',
    grid: MAP1,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Maze 21×21',
    grid: MAP2,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Random ~22%',
    grid: MAP3,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Lợi thế BFS',
    grid: MAP4,
    start: { row: 1, col: 1 },
    goal: { row: 5, col: 4 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Lợi thế DFS',
    grid: MAP5,
    start: { row: 1, col: 1 },
    goal: { row: 17, col: 19 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Lợi thế IDS',
    grid: MAP6,
    start: { row: 10, col: 10 },
    goal: { row: 18, col: 18 },
    generate() {
      return this.grid.map((r) => [...r]);
    },
  },
  {
    name: 'Sensorless (Bất định)',
    grid: MAP7,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  },
  {
    name: 'Online Search (Sương mù)',
    grid: MAP8,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  },
  {
    name: 'AND-OR Search (Bất định)',
    grid: MAP9,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  },
  {
    name: 'Vành đai Ràng buộc (Chặng 5)',
    grid: MAP10,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  },
  {
    name: 'Đấu trường Đối kháng (Chặng 6)',
    grid: MAP11,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  },
  {
    name: 'Đầm lầy Vũ trụ (Chặng 2)',
    grid: MAP12,
    start: { row: 1, col: 1 },
    goal: { row: 19, col: 19 },
    generate() { return this.grid.map((r) => [...r]); },
  }
];

// ── BFS (queue FIFO) ──

export function* bfs(grid: Grid, start: Cell, goal: Cell): Generator<Step> {
  const visited = new Map<string, Cell>();
  const queue: { cell: Cell; path: Cell[] }[] = [{ cell: start, path: [start] }];
  visited.set(cellKey(start), start);

  while (queue.length > 0) {
    const { cell, path } = queue.shift()!;
    const isGoal = cell.row === goal.row && cell.col === goal.col;

    yield {
      current: cell,
      visited: new Map(visited),
      frontier: queue.map(q => q.cell),
      path: isGoal ? path : [],
      found: isGoal,
      done: isGoal,
    };

    if (isGoal) return;

    for (const nb of neighbours(cell, grid)) {
      const k = cellKey(nb);
      if (!visited.has(k)) {
        visited.set(k, nb);
        queue.push({ cell: nb, path: [...path, nb] });
      }
    }
  }

  yield { current: null, visited: new Map(visited), frontier: [], path: [], found: false, done: true };
}

// ── DFS (stack LIFO) ──

export function* dfs(grid: Grid, start: Cell, goal: Cell): Generator<Step> {
  const visited = new Map<string, Cell>();
  const stack: { cell: Cell; path: Cell[] }[] = [{ cell: start, path: [start] }];

  while (stack.length > 0) {
    const { cell, path } = stack.pop()!;
    const k = cellKey(cell);
    if (visited.has(k)) continue;
    visited.set(k, cell);

    const isGoal = cell.row === goal.row && cell.col === goal.col;

    yield {
      current: cell,
      visited: new Map(visited),
      frontier: stack.map(s => s.cell),
      path: isGoal ? path : [],
      found: isGoal,
      done: isGoal,
    };

    if (isGoal) return;

    const nbs = neighbours(cell, grid);
    // Push neighbours in reverse so explore order is left→right, up→down
    for (let i = nbs.length - 1; i >= 0; i--) {
      const nb = nbs[i];
      if (!visited.has(cellKey(nb))) {
        stack.push({ cell: nb, path: [...path, nb] });
      }
    }
  }

  yield { current: null, visited: new Map(visited), frontier: [], path: [], found: false, done: true };
}

// ── IDS (Iterative Deepening Search) ──

export function* ids(grid: Grid, start: Cell, goal: Cell): Generator<Step> {
  const h = grid.length;
  const w = grid[0].length;
  const maxDepth = h * w;

  for (let depthLimit = 0; depthLimit < maxDepth; depthLimit++) {
    const visited = new Map<string, Cell>();
    const stack: { cell: Cell; path: Cell[]; depth: number }[] = [
      { cell: start, path: [start], depth: 0 },
    ];
    let cut = false; // set when a node hits the depth limit

    while (stack.length > 0) {
      const { cell, path, depth } = stack.pop()!;
      const k = cellKey(cell);
      if (visited.has(k)) continue;
      visited.set(k, cell);

      const isGoal = cell.row === goal.row && cell.col === goal.col;

      yield {
        current: cell,
        visited: new Map(visited),
        frontier: stack.filter(s => s.depth < depthLimit).map(s => s.cell),
        path: isGoal ? path : [],
        found: isGoal,
        done: isGoal,
      };

      if (isGoal) return;

      if (depth < depthLimit) {
        const nbs = neighbours(cell, grid);
        for (let i = nbs.length - 1; i >= 0; i--) {
          const nb = nbs[i];
          if (!visited.has(cellKey(nb))) {
            stack.push({ cell: nb, path: [...path, nb], depth: depth + 1 });
          }
        }
      } else {
        cut = true; // this node was at the depth limit
      }
    }

    // If no node hit the depth limit, the entire reachable area was explored
    if (!cut) break;
  }

  yield { current: null, visited: new Map<string, Cell>(), frontier: [], path: [], found: false, done: true };
}
