import type { AlgoType, Cell, Grid } from './game';

export interface StepResult {
  current?: Cell | null;
  done: boolean;
  found: boolean;
  steps: number;
  visited: number;
  maxMemory?: number;
  path: number;
  beliefState?: Cell[];
  fogState?: Set<string>;
  agents?: { row: number; col: number; type: 'monster' | 'x' | 'o' | 'highlight' | 'beam-agent'; dr?: number; dc?: number }[];
  message?: string;
  highlightLine?: number;
  temp?: number;
  action?: string;
  isBacktracking?: boolean;
  adjacentCells?: { row: number; col: number; status: 'valid' | 'invalid' }[];
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const cellKey = (c: Cell) => `${c.row},${c.col}`;

const applyDirectionalPath = (grid: Grid, trail: Cell[]) => {
  for (let i = 0; i < trail.length; i++) {
    const c = trail[i];
    if (grid[c.row][c.col] !== 1 && grid[c.row][c.col] !== 7) {
      if (i < trail.length - 1) {
        const n = trail[i + 1];
        if (n.col > c.col) grid[c.row][c.col] = 42;
        else if (n.col < c.col) grid[c.row][c.col] = 44;
        else if (n.row > c.row) grid[c.row][c.col] = 43;
        else if (n.row < c.row) grid[c.row][c.col] = 41;
        else grid[c.row][c.col] = 4;
      } else {
        if (grid[c.row][c.col] < 41 || grid[c.row][c.col] > 44) {
          grid[c.row][c.col] = 4;
        }
      }
    }
  }
};

const getPathCoords = (parent: Map<string, Cell>, goal: Cell): Cell[] => {
  const path: Cell[] = [];
  let curr: Cell | undefined = goal;
  const visited = new Set<string>();
  while (curr) {
    const key = cellKey(curr);
    if (visited.has(key)) break;
    visited.add(key);
    path.push(curr);
    curr = parent.get(key);
  }
  path.reverse();
  // Ensure start is included if it was part of the chain
  return path;
};

const formatPath = (coords: Cell[]): string => {
  return coords.map(c => `[${c.row},${c.col}]`).join(" ➔ ");
};

const getDistance = (c: Cell, goal: Cell, fakes: Cell[]): number => {
  if (c.row === goal.row && c.col === goal.col) {
    return 0;
  }
  const atFakeIdx = fakes.findIndex(f => c.row === f.row && c.col === f.col);
  if (atFakeIdx !== -1) {
    const otherTargets = [goal, ...fakes.filter((_, idx) => idx !== atFakeIdx)];
    const dists = otherTargets.map(t => Math.abs(c.row - t.row) + Math.abs(c.col - t.col));
    return Math.min(...dists);
  }
  const targets = [goal, ...fakes];
  const dists = targets.map(t => Math.abs(c.row - t.row) + Math.abs(c.col - t.col));
  return Math.min(...dists);
};

// Chapter 5 Monsters Vision definition
interface Monster {
  row: number;
  col: number;
  dr: number;
  dc: number;
}



const getCorridorLength = (mRow: number, mCol: number, dr: number, dc: number, h: number, w: number, grid: Grid): number => {
  if (dr === 0 && dc === 0) return 1;
  let count = 1;
  let r = mRow + dr;
  let c = mCol + dc;
  while (r >= 1 && r <= h - 2 && c >= 1 && c <= w - 2 && grid[r][c] !== 1 && grid[r][c] !== 7) {
    count++;
    r += dr;
    c += dc;
  }
  r = mRow - dr;
  c = mCol - dc;
  while (r >= 1 && r <= h - 2 && c >= 1 && c <= w - 2 && grid[r][c] !== 1 && grid[r][c] !== 7) {
    count++;
    r -= dr;
    c -= dc;
  }
  return count;
};

const adjustOrRemoveMonster = (m: Monster, currentGrid: Grid): Monster | null => {
  const h = currentGrid.length;
  const w = currentGrid[0].length;
  const L_horiz = getCorridorLength(m.row, m.col, 0, 1, h, w, currentGrid);
  const L_vert = getCorridorLength(m.row, m.col, 1, 0, h, w, currentGrid);

  if (L_horiz < 3 && L_vert < 3) {
    return null;
  }
  
  let dr = m.dr;
  let dc = m.dc;
  
  if (L_horiz >= 3 && L_vert < 3) {
    dr = 0;
    dc = dc !== 0 ? dc : 1;
  } else if (L_vert >= 3 && L_horiz < 3) {
    dc = 0;
    dr = dr !== 0 ? dr : 1;
  } else {
    if (dr === 0 && dc === 0) {
      dr = 0;
      dc = 1;
    }
  }

  return { ...m, dr, dc };
};

export function getInitialMonsters(grid: Grid, patrolStarts?: { row: number; col: number }[]): { row: number; col: number; type: 'monster' }[] {
  const h = grid.length;
  const w = grid[0].length;

  const tempPatrol: Monster[] = [];
  if (patrolStarts) {
    const defaultDirs = [
      { dr: 0, dc: 1 },
      { dr: 0, dc: -1 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 }
    ];
    patrolStarts.forEach((p, idx) => {
      const d = defaultDirs[idx] || { dr: 0, dc: 1 };
      tempPatrol.push({ row: p.row, col: p.col, dr: d.dr, dc: d.dc });
    });
  } else {
    tempPatrol.push(
      { row: 5, col: 2, dr: 0, dc: 1 },
      { row: 15, col: 2, dr: 0, dc: -1 },
      { row: 2, col: 5, dr: 1, dc: 0 },
      { row: 2, col: 15, dr: 0, dc: -1 }
    );
  }

  // Filter out patrol starts that are out of bounds or inside walls
  const validPatrol = tempPatrol.filter(m => m.row >= 1 && m.row <= h - 2 && m.col >= 1 && m.col <= w - 2 && grid[m.row][m.col] !== 1 && grid[m.row][m.col] !== 7);

  const activePatrol: Monster[] = [];
  for (const m of validPatrol) {
    const adjusted = adjustOrRemoveMonster(m, grid);
    if (adjusted !== null) {
      activePatrol.push(adjusted);
    }
  }

  // Check static monsters (value 7) on the grid
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === 7) {
        const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
        const adjusted = adjustOrRemoveMonster(mStatic, grid);
        if (adjusted === null) {
          grid[r][c] = 0; // erase from grid
        }
      }
    }
  }

  const monsterAgents: { row: number; col: number; type: 'monster'; dr?: number; dc?: number }[] = [];
  for (const m of activePatrol) {
    monsterAgents.push({ row: m.row, col: m.col, type: 'monster' as const, dr: m.dr, dc: m.dc });
  }
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === 7) {
        if (!monsterAgents.some(ma => ma.row === r && ma.col === c)) {
          const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
          const adjusted = adjustOrRemoveMonster(mStatic, grid) || mStatic;
          monsterAgents.push({ row: r, col: c, type: 'monster' as const, dr: adjusted.dr, dc: adjusted.dc });
        }
      }
    }
  }
  return monsterAgents;
}

const getMonsterVisionRange = (m: Monster, grid: Grid): number => {
  const h = grid.length;
  const w = grid[0].length;
  let count = 0;
  let r = m.row + m.dr;
  let c = m.col + m.dc;
  while (r >= 0 && r < h && c >= 0 && c < w) {
    if (grid[r][c] === 1) break;
    count++;
    r += m.dr;
    c += m.dc;
  }
  return count;
};

const getMonsterAtTime = (m: Monster, _time: number, _currentGrid: Grid): Monster => {
  return { ...m };
};





export function createStepFn(algo: AlgoType, grid: Grid, start: Cell, goal: Cell, initialBelief?: Cell[], patrolStarts?: { row: number; col: number }[]): () => StepResult {
  let steps = 0;
  const h = grid.length;
  const w = grid[0].length;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const originalGrid = grid.map(row => [...row]);

  // Stateful dynamic monsters for Chapter 5
  const defaultDirs = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 }
  ];
  const tempPatrol: Monster[] = (
    patrolStarts 
      ? patrolStarts.map((p, idx) => {
          const d = defaultDirs[idx] || { dr: 0, dc: 1 };
          return { row: p.row, col: p.col, dr: d.dr, dc: d.dc };
        })
      : [
          { row: 5, col: 2, dr: 0, dc: 1 },
          { row: 15, col: 2, dr: 0, dc: -1 },
          { row: 2, col: 5, dr: 1, dc: 0 },
          { row: 2, col: 15, dr: 0, dc: -1 }
        ]
  ).filter(m => m.row >= 1 && m.row <= h - 2 && m.col >= 1 && m.col <= w - 2 && grid[m.row][m.col] !== 1 && grid[m.row][m.col] !== 7);

  const patrolMonsters: Monster[] = [];
  for (const m of tempPatrol) {
    const adjusted = adjustOrRemoveMonster(m, grid);
    if (adjusted !== null) {
      patrolMonsters.push(adjusted);
    }
  }

  // Remove blocked static monsters (value 7) on the grid
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === 7) {
        const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
        const adjusted = adjustOrRemoveMonster(mStatic, grid);
        if (adjusted === null) {
          grid[r][c] = 0;
        }
      }
    }
  }

  const isUnderMonsterVisionState = (cell: Cell, currentGrid: Grid): boolean => {
    for (const m of patrolMonsters) {
      if (m.row === cell.row && m.col === cell.col) return true;
      const range = getMonsterVisionRange(m, currentGrid);
      let r = m.row + m.dr;
      let c = m.col + m.dc;
      let steps = 0;
      while (r >= 0 && r < h && c >= 0 && c < w && steps < range) {
        if (currentGrid[r][c] === 1) break;
        if (r === cell.row && c === cell.col) return true;
        r += m.dr;
        c += m.dc;
        steps++;
      }
    }
    return false;
  };

  const updateDynamicMonsters = () => {
    // Monsters stay completely static, no movement!
  };

  const neighbors = (c: Cell) => {
    const res: Cell[] = [];
    for (const [dr, dc] of dirs) {
      const r = c.row + dr;
      const col = c.col + dc;
      if (r >= 0 && r < h && col >= 0 && col < w && grid[r][col] !== 1) {
        res.push({ row: r, col });
      }
    }
    return res;
  };

  const drawPath = (parent: Map<string, Cell>) => {
    let curr: Cell | undefined = goal;
    let pathLen = 0;
    const visited = new Set<string>();
    while (curr) {
      const key = cellKey(curr);
      if (visited.has(key)) break;
      visited.add(key);
      const p = parent.get(key);
      if (grid[curr.row][curr.col] !== 1) {
        if (grid[curr.row][curr.col] < 41 || grid[curr.row][curr.col] > 44) {
          grid[curr.row][curr.col] = 4;
        }
      }
      if (p && grid[p.row][p.col] !== 1) {
        if (curr.col > p.col) grid[p.row][p.col] = 42;
        else if (curr.col < p.col) grid[p.row][p.col] = 44;
        else if (curr.row > p.row) grid[p.row][p.col] = 43;
        else if (curr.row < p.row) grid[p.row][p.col] = 41;
      }
      curr = p;
      pathLen++;
    }
    if (grid[start.row][start.col] < 41 || grid[start.row][start.col] > 44) grid[start.row][start.col] = 4;
    if (grid[goal.row][goal.col] < 41 || grid[goal.row][goal.col] > 44) grid[goal.row][goal.col] = 4;
    return pathLen;
  };

  // ── CHAPTER 1: UNINFORMED SEARCH ──

  if (algo === 'BFS') {
    const queue = [start];
    const visited = new Set([cellKey(start)]);
    const parent = new Map<string, Cell>();
    let maxMemory = queue.length;

    return () => {
      steps++;
      maxMemory = Math.max(maxMemory, queue.length);
      if (queue.length === 0) return { done: true, found: false, steps, visited: visited.size, maxMemory, path: 0 };
      const curr = queue.shift()!;
      if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2; // visited color

      if (curr.row === goal.row && curr.col === goal.col) {
        const pathLen = drawPath(parent);
        return { current: curr, done: true, found: true, steps, visited: visited.size, maxMemory, path: pathLen };
      }

      for (const nb of neighbors(curr)) {
        const key = cellKey(nb);
        if (!visited.has(key)) {
          visited.add(key);
          parent.set(key, curr);
          queue.push(nb);
          if (grid[nb.row][nb.col] !== 1 && grid[nb.row][nb.col] !== 2) {
            grid[nb.row][nb.col] = 3; // frontier color
          }
        }
      }
      return { current: curr, done: false, steps, visited: visited.size, maxMemory, path: 0, found: false };
    };
  }

  if (algo === 'DFS') {
    const stack = [start];
    const visited = new Set<string>();
    const parent = new Map<string, Cell>();
    let maxMemory = stack.length;

    return () => {
      steps++;
      maxMemory = Math.max(maxMemory, stack.length);

      let curr: Cell | null = null;
      while (stack.length > 0) {
        const popped = stack.pop()!;
        const k = cellKey(popped);
        if (!visited.has(k)) {
          curr = popped;
          visited.add(k);
          break;
        }
      }

      if (!curr) return { done: true, found: false, steps, visited: visited.size, maxMemory, path: 0 };

      if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2;

      if (curr.row === goal.row && curr.col === goal.col) {
        const pathLen = drawPath(parent);
        return { current: curr, done: true, found: true, steps, visited: visited.size, maxMemory, path: pathLen };
      }

      const nbs = neighbors(curr);
      // DFS standard search order
      for (let i = nbs.length - 1; i >= 0; i--) {
        const nb = nbs[i];
        if (!visited.has(cellKey(nb))) {
          parent.set(cellKey(nb), curr);
          stack.push(nb);
          if (grid[nb.row][nb.col] !== 1 && grid[nb.row][nb.col] !== 2) {
            grid[nb.row][nb.col] = 3;
          }
        }
      }
      return { current: curr, done: false, steps, visited: visited.size, maxMemory, path: 0, found: false };
    };
  }

  if (algo === 'IDS') {
    let depthLimit = 0;
    let stack = [{ cell: start, depth: 0 }];
    let depthReached = new Map<string, number>();
    depthReached.set(cellKey(start), 0);
    let parent = new Map<string, Cell>();
    let cut = false;
    let maxMemory = stack.length;

    return () => {
      steps++;
      maxMemory = Math.max(maxMemory, stack.length);

      while (true) {
        if (stack.length === 0) {
          if (!cut) return { done: true, found: false, steps, visited: depthReached.size, maxMemory, path: 0 };
          depthLimit++;
          stack = [{ cell: start, depth: 0 }];
          depthReached = new Map();
          depthReached.set(cellKey(start), 0);
          parent = new Map();
          cut = false;

          for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
              if (grid[r][c] >= 2) grid[r][c] = 0; // reset visits
            }
          }
          continue;
        }

        const popped = stack.pop()!;
        const k = cellKey(popped.cell);
        
        if (popped.depth <= depthReached.get(k)!) {
          const curr = popped.cell;
          const depth = popped.depth;

          if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2;

          if (curr.row === goal.row && curr.col === goal.col) {
            const pathLen = drawPath(parent);
            return { current: curr, done: true, found: true, steps, visited: depthReached.size, maxMemory, path: pathLen };
          }

          if (depth < depthLimit) {
            const nbs = neighbors(curr);
            for (let i = nbs.length - 1; i >= 0; i--) {
              const nb = nbs[i];
              const nbDepth = depth + 1;
              const nbKey = cellKey(nb);
              if (!depthReached.has(nbKey) || nbDepth < depthReached.get(nbKey)!) {
                depthReached.set(nbKey, nbDepth);
                parent.set(nbKey, curr);
                stack.push({ cell: nb, depth: nbDepth });
                if (grid[nb.row][nb.col] !== 1 && grid[nb.row][nb.col] !== 2) {
                  grid[nb.row][nb.col] = 3;
                }
              }
            }
          } else {
            cut = true;
          }

          return { current: curr, done: false, steps, visited: depthReached.size, maxMemory, path: 0, found: false };
        }
      }
    };
  }

  // ── CHAPTER 2: INFORMED SEARCH (Swamp Support) ──

  if (['UCS', 'Greedy', 'AStar'].includes(algo)) {
    const isAStar = algo === 'AStar';
    const isUCS = algo === 'UCS';
    const heuristic = (a: Cell, b: Cell) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    
    class MinHeap<T> {
      private heap: T[] = [];
      private compare: (a: T, b: T) => number;
      constructor(compare: (a: T, b: T) => number) {
        this.compare = compare;
      }
      push(item: T) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
      }
      shift(): T | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop();
        const top = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
        return top;
      }
      get length() { return this.heap.length; }
      private bubbleUp(index: number) {
        while (index > 0) {
          const parent = (index - 1) >>> 1;
          if (this.compare(this.heap[parent], this.heap[index]) <= 0) break;
          [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
          index = parent;
        }
      }
      private bubbleDown(index: number) {
        const length = this.heap.length;
        while (true) {
          let left = (index << 1) + 1;
          let right = left + 1;
          let smallest = index;
          if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
          if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
          if (smallest === index) break;
          [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
          index = smallest;
        }
      }
    }

    type PQItem = { cell: Cell; g: number; f: number };
    const pq = new MinHeap<PQItem>((a, b) => a.f - b.f);
    pq.push({ cell: start, g: 0, f: isUCS ? 0 : heuristic(start, goal) });
    
    const visited = new Map<string, number>();
    const parent = new Map<string, Cell>();
    visited.set(cellKey(start), 0);
    let maxMemory = pq.length;

    return () => {
      steps++;
      maxMemory = Math.max(maxMemory, pq.length);

      while (true) {
        if (pq.length === 0) return { done: true, found: false, steps, visited: visited.size, maxMemory, path: 0 };

        const { cell: curr, g } = pq.shift()!;
        const k = cellKey(curr);

        if (g <= visited.get(k)!) {
          if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2;

          if (curr.row === goal.row && curr.col === goal.col) {
            const pathLen = drawPath(parent);
            return { current: curr, done: true, found: true, steps, visited: visited.size, maxMemory, path: pathLen };
          }

          for (const nb of neighbors(curr)) {
            const nbKey = cellKey(nb);
            const cost = originalGrid[nb.row][nb.col] === 6 ? 3 : 1;
            const newG = g + cost;
            if (!visited.has(nbKey) || newG < visited.get(nbKey)!) {
              visited.set(nbKey, newG);
              parent.set(nbKey, curr);
              const hVal = heuristic(nb, goal);
              pq.push({ cell: nb, g: newG, f: isUCS ? newG : (isAStar ? newG + hVal : hVal) });
              if (grid[nb.row][nb.col] !== 1 && grid[nb.row][nb.col] !== 2) {
                grid[nb.row][nb.col] = 3;
              }
            }
          }

          return { current: curr, done: false, steps, visited: visited.size, maxMemory, path: 0, found: false };
        }
      }
    };
  }

  // ── CHAPTER 3: LOCAL SEARCH (Distance & Baits) ──

  const fakeGoals: Cell[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (originalGrid[r]?.[c] === 8) {
        fakeGoals.push({ row: r, col: c });
      }
    }
  }

  if (algo === 'HillClimbing') {
    let curr = start;
    let currDist = getDistance(curr, goal, fakeGoals);
    const parent = new Map<string, Cell>();
    let stuck = false;

    return () => {
      steps++;
      if (stuck) {
        return { current: curr, done: true, found: false, steps, visited: 0, path: 0, message: "Đã bị kẹt!" };
      }
      if (curr.row === goal.row && curr.col === goal.col) {
        const pathLength = drawPath(parent);
        const coords = getPathCoords(parent, goal);
        return { current: curr, done: true, found: true, steps, visited: 1, path: pathLength, message: `Đã chạm goal!\nĐường đi:\n${formatPath(coords)}` };
      }
      if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2;

      const nbs = neighbors(curr);
      let bestNb = null;
      let bestDist = currDist;
      for (const nb of nbs) {
        const dVal = getDistance(nb, goal, fakeGoals);
        if (dVal < bestDist) {
          bestDist = dVal;
          bestNb = nb;
        }
        if (grid[nb.row][nb.col] !== 1 && grid[nb.row][nb.col] !== 2) {
          grid[nb.row][nb.col] = 3;
        }
      }

      if (bestNb && bestDist < currDist) {
        parent.set(cellKey(bestNb), curr);
        curr = bestNb;
        currDist = bestDist;
      } else {
        stuck = true;
      }

      const isGoal = curr.row === goal.row && curr.col === goal.col;
      let msg = "";
      if (stuck) {
        msg = "Đã bị kẹt!";
      } else if (isGoal) {
        drawPath(parent);
        const coords = getPathCoords(parent, goal);
        msg = `Đã chạm goal!\nĐường đi:\n${formatPath(coords)}`;
      }

      return {
        current: curr,
        done: stuck || isGoal,
        found: isGoal,
        steps,
        visited: steps,
        path: 0,
        agents: fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' })),
        message: msg || undefined
      };
    };
  }

  if (algo === 'LocalBeam') {
    const cellPaths = new Map<string, Cell[]>();
    const selectTopKRandomized = (candidates: Array<{ cell: Cell, parentCell: Cell, evalScore: number, path?: Cell[] }>, k: number) => {
        candidates.sort((a, b) => a.evalScore - b.evalScore);
        if (candidates.length <= k) {
          return { selected: candidates, unselected: [] };
        }
        
        const topK = candidates.slice(0, k);
        const kThScore = topK[k - 1].evalScore;
        
        const bestCandidates = candidates.filter(c => c.evalScore < kThScore);
        const tieCandidates = candidates.filter(c => c.evalScore === kThScore);
        const unselected = candidates.filter(c => c.evalScore > kThScore);
        
        tieCandidates.sort(() => 0.5 - Math.random());
        const needed = k - bestCandidates.length;
        const selectedTies = tieCandidates.slice(0, needed);
        const remainingTies = tieCandidates.slice(needed);
        
        return {
          selected: [...bestCandidates, ...selectedTies],
          unselected: [...unselected, ...remainingTies]
        };
      };

      let currentStates = [start];
      
      let initialized = false;
      let done = false;
      let found = false;
      let pathLen = 0;
      let message: string | undefined = undefined;

      return () => {
        steps++;
        if (done) {
          return { done: true, found, steps, visited: currentStates.length, path: pathLen, message, agents: fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' as const })) };
        }

        if (!initialized) {
          const initialNbs = neighbors(start);
          const sortedNbs = initialNbs.map(nb => ({
            cell: nb,
            parentCell: start,
            evalScore: getDistance(nb, goal, fakeGoals)
          }));
          
          const { selected, unselected } = selectTopKRandomized(sortedNbs, 4);
          
          currentStates = selected.map(s => {
            cellPaths.set(cellKey(s.cell), [start, s.cell]);
            return s.cell;
          });
          
          initialized = true;
          return {
            current: currentStates[0],
            done: false,
            found: false,
            steps,
            visited: currentStates.length,
            path: 0,
            agents: [
              ...fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' as const })),
              ...currentStates.map(s => ({ row: s.row, col: s.col, type: 'beam-agent' as const })),
              ...unselected.map(s => ({ row: s.cell.row, col: s.cell.col, type: 'highlight' as const }))
            ]
          };
        }

        for (const state of currentStates) {
          if (grid[state.row][state.col] !== 1 && grid[state.row][state.col] !== 7) {
            grid[state.row][state.col] = 2; // Visited color
          }
        }

        const nextNbsMap = new Map<string, { cell: Cell, parentCell: Cell, evalScore: number, path: Cell[] }>();
        for (const state of currentStates) {
          const statePath = cellPaths.get(cellKey(state)) || [];
          const stateNbs = neighbors(state);
          for (const nb of stateNbs) {
            const key = cellKey(nb);
            const evalScore = getDistance(nb, goal, fakeGoals);
            if (!nextNbsMap.has(key) || evalScore < nextNbsMap.get(key)!.evalScore) {
              nextNbsMap.set(key, { cell: nb, parentCell: state, evalScore, path: [...statePath, nb] });
            }
          }
        }

        const allNbs = Array.from(nextNbsMap.values());
        if (allNbs.length === 0) {
            done = true;
            message = "Đã bị kẹt!";
            return { done: true, found: false, steps, visited: currentStates.length, path: 0, message, agents: fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' as const })) };
        }

        const { selected } = selectTopKRandomized(allNbs, 4);
        currentStates = selected.map(s => {
            cellPaths.set(cellKey(s.cell), s.path!);
            return s.cell;
        });

        for (const state of currentStates) {
            if (state.row === goal.row && state.col === goal.col) {
                found = true;
                done = true;
                const winPath = cellPaths.get(cellKey(state)) || [];
                applyDirectionalPath(grid, winPath);
                pathLen = Math.max(0, winPath.length - 1);
                message = `Đã chạm goal!\nĐường đi:\n${formatPath(winPath)}`;
            }
        }

        return {
            current: currentStates[0],
            done,
            found,
            steps,
            visited: currentStates.length,
            path: found ? pathLen : 0,
            message,
            agents: [
                ...fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' as const })),
                ...currentStates.map(s => ({ row: s.row, col: s.col, type: 'beam-agent' as const }))
            ]
        };
      };
  }

  if (algo === 'SimulatedAnnealing') {
    let curr = start;
    let currDist = getDistance(curr, goal, fakeGoals);
    const parent = new Map<string, Cell>();
    let temp = 100.0;
    const coolingRate = 0.95;
    let done = false;
    let found = false;
    const pathTrace: Cell[] = [start];

    return () => {
      steps++;
      if (done) return { done: true, found, steps, visited: steps, path: 0, temp };

      if (grid[curr.row][curr.col] !== 1) grid[curr.row][curr.col] = 2;

      if (curr.row === goal.row && curr.col === goal.col) {
        found = true;
        done = true;
        parent.clear();
        for (let i = 1; i < pathTrace.length; i++) {
          parent.set(cellKey(pathTrace[i]), pathTrace[i - 1]);
        }
        const pLen = drawPath(parent);
        const coords = getPathCoords(parent, goal);
        const message = `Đã chạm goal!\nĐường đi:\n${formatPath(coords)}`;
        return { current: curr, done: true, found: true, steps, visited: steps, path: pLen, temp, message };
      }

      const nbs = neighbors(curr);
      if (nbs.length === 0 || temp < 0.005) {
        done = true;
        return { current: curr, done: true, found: false, steps, visited: steps, path: 0, temp };
      }

      const randNb = nbs[Math.floor(Math.random() * nbs.length)];
      const currentDist = getDistance(curr, goal, fakeGoals);
      const nextDist = getDistance(randNb, goal, fakeGoals);
      const dE = currentDist - nextDist; // > 0 means distance decreased (improved)

      if (dE > 0 || Math.random() < Math.exp(dE / temp)) {
        const idx = pathTrace.findIndex(c => c.row === randNb.row && c.col === randNb.col);
        if (idx !== -1) {
          pathTrace.splice(idx + 1);
        } else {
          pathTrace.push(randNb);
        }
        parent.set(cellKey(randNb), curr);
        curr = randNb;
      }

      temp *= coolingRate;

      return {
        current: curr,
        done: false,
        found: false,
        steps,
        visited: steps,
        path: 0,
        temp,
        agents: fakeGoals.map(f => ({ row: f.row, col: f.col, type: 'x' }))
      };
    };
  }

  // ── CHAPTER 4: UNCERTAINTY ──

  if (algo === 'SensorlessSearch') {
    let beliefState: Cell[] = initialBelief || [];
    if (beliefState.length === 0) {
      const walkable: Cell[] = [];
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (originalGrid[r][c] !== 1 && originalGrid[r][c] !== 7 && !(r === goal.row && c === goal.col)) {
            walkable.push({ row: r, col: c });
          }
        }
      }
      const shuffled = [...walkable].sort(() => 0.5 - Math.random());
      beliefState = shuffled.slice(0, Math.min(3, shuffled.length));
    }

    const getBeliefKey = (belief: Cell[]) => {
      const keys = belief.map(cellKey);
      keys.sort();
      return keys.join('|');
    };

    const applyAction = (belief: Cell[], action: [number, number]): Cell[] => {
      const nextBelief: Cell[] = [];
      for (const b of belief) {
        const nr = b.row + action[0];
        const nc = b.col + action[1];
        if (nr >= 0 && nr < h && nc >= 0 && nc < w && originalGrid[nr][nc] !== 1 && originalGrid[nr][nc] !== 7) {
          nextBelief.push({ row: nr, col: nc });
        } else {
          nextBelief.push({ ...b });
        }
      }
      return nextBelief;
    };

    const heuristic = (belief: Cell[]) => {
      let sumH = 0;
      for (const b of belief) {
        sumH += Math.abs(b.row - goal.row) + Math.abs(b.col - goal.col);
      }
      return sumH;
    };

    const pq: { belief: Cell[]; g: number; f: number; path: [number, number][]; lastActionStr?: string }[] = [];
    pq.push({ belief: beliefState, g: 0, f: heuristic(beliefState), path: [] });
    
    const reached = new Map<string, number>();
    reached.set(getBeliefKey(beliefState), 0);

    const insertSorted = (arr: any[], item: any) => {
      let low = 0, high = arr.length;
      while (low < high) {
        let mid = (low + high) >>> 1;
        if (arr[mid].f < item.f) low = mid + 1;
        else high = mid;
      }
      arr.splice(low, 0, item);
    };

    let done = false;
    let found = false;

    return () => {
      steps++;
      if (done) {
        return { done: true, found, steps, visited: reached.size, path: 0, beliefState };
      }

      if (pq.length === 0) {
        done = true;
        return { done: true, found: false, steps, visited: reached.size, path: 0, beliefState };
      }

      const curr = pq.shift()!;
      beliefState = curr.belief;

      for (const b of beliefState) {
        if (grid[b.row][b.col] !== 1 && grid[b.row][b.col] !== 7) {
          grid[b.row][b.col] = 2; // visited color
        }
      }

      const isGoal = curr.belief.every(b => b.row === goal.row && b.col === goal.col);
      if (isGoal) {
        found = true;
        done = true;
        return { done: true, found: true, steps, visited: reached.size, path: curr.path.length, beliefState, action: curr.lastActionStr };
      }

      for (const action of dirs) {
        const nextBelief = applyAction(curr.belief, action as [number, number]);
        
        let equal = true;
        for (let idx = 0; idx < nextBelief.length; idx++) {
          if (nextBelief[idx].row !== curr.belief[idx].row || nextBelief[idx].col !== curr.belief[idx].col) {
            equal = false;
            break;
          }
        }
        if (equal) continue;

        const key = getBeliefKey(nextBelief);
        const newG = curr.g + 1;
        if (!reached.has(key) || newG < reached.get(key)!) {
          reached.set(key, newG);
          const newF = newG + heuristic(nextBelief);

          let actionStr = "";
          if (action[0] === -1) actionStr = "LÊN";
          else if (action[0] === 1) actionStr = "DƯỚI";
          else if (action[1] === -1) actionStr = "TRÁI";
          else if (action[1] === 1) actionStr = "PHẢI";

          insertSorted(pq, { 
            belief: nextBelief, 
            g: newG, 
            f: newF, 
            path: [...curr.path, action as [number, number]],
            lastActionStr: actionStr 
          });

          for (const b of nextBelief) {
            if (grid[b.row][b.col] !== 1 && grid[b.row][b.col] !== 7 && grid[b.row][b.col] !== 2) {
              grid[b.row][b.col] = 3; // frontier color
            }
          }
        }
      }

      return {
        done: false,
        found: false,
        steps,
        visited: reached.size,
        path: 0,
        beliefState,
        action: curr.lastActionStr
      };
    };
  }

  if (algo === 'OnlineSearch') {
    const fogState = new Set<string>();
    let curr = { ...start };
    let done = false;
    let found = false;
    const trail: Cell[] = [{ ...start }];
    let plannedPath: Cell[] = [];

    const revealFog = (pos: Cell) => {
      const radius = 2;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = pos.row + dr;
          const c = pos.col + dc;
          if (r >= 0 && r < h && c >= 0 && c < w) {
            fogState.add(`${r},${c}`);
          }
        }
      }
    };

    revealFog(curr);

    const aStarAssumedEmpty = (startNode: Cell): Cell[] | null => {
      const pq: { cell: Cell; g: number; f: number; path: Cell[] }[] = [];
      const heuristic = (c: Cell) => Math.abs(c.row - goal.row) + Math.abs(c.col - goal.col);
      pq.push({ cell: startNode, g: 0, f: heuristic(startNode), path: [startNode] });
      const visited = new Set<string>();
      visited.add(cellKey(startNode));

      while (pq.length > 0) {
        pq.sort((a, b) => a.f - b.f);
        const { cell: c, g, path } = pq.shift()!;
        if (c.row === goal.row && c.col === goal.col) return path;

        for (const [dr, dc] of dirs) {
          const nr = c.row + dr;
          const nc = c.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w) {
            const key = `${nr},${nc}`;
            if (fogState.has(key) && (originalGrid[nr][nc] === 1 || originalGrid[nr][nc] === 7)) continue;
            
            if (!visited.has(key)) {
              visited.add(key);
              pq.push({ cell: { row: nr, col: nc }, g: g + 1, f: g + 1 + heuristic({ row: nr, col: nc }), path: [...path, { row: nr, col: nc }] });
            }
          }
        }
      }
      return null;
    };

    const aStarNearestUnexplored = (startNode: Cell): Cell[] | null => {
      const pq: { cell: Cell; dist: number; path: Cell[] }[] = [];
      pq.push({ cell: startNode, dist: 0, path: [startNode] });
      const visited = new Set<string>();
      visited.add(cellKey(startNode));

      while (pq.length > 0) {
        const { cell: c, dist, path } = pq.shift()!;
        if (!fogState.has(cellKey(c))) return path;

        for (const [dr, dc] of dirs) {
          const nr = c.row + dr;
          const nc = c.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w) {
            const key = `${nr},${nc}`;
            if (fogState.has(key) && (originalGrid[nr][nc] === 1 || originalGrid[nr][nc] === 7)) continue;
            
            if (!visited.has(key)) {
              visited.add(key);
              pq.push({ cell: { row: nr, col: nc }, dist: dist + 1, path: [...path, { row: nr, col: nc }] });
            }
          }
        }
      }
      return null;
    };

    return () => {
      steps++;
      if (done) return { current: curr, done: true, found, steps, visited: fogState.size, path: trail.length, fogState };

      if (curr.row === goal.row && curr.col === goal.col) {
        found = true;
        done = true;
        applyDirectionalPath(grid, trail);
        return { current: curr, done: true, found: true, steps, visited: fogState.size, path: trail.length, fogState };
      }

      if (grid[curr.row][curr.col] !== 1 && grid[curr.row][curr.col] !== 7) grid[curr.row][curr.col] = 2;

      let pathValid = plannedPath.length > 1;
      if (pathValid) {
        const nextCell = plannedPath[1];
        if (fogState.has(cellKey(nextCell)) && (originalGrid[nextCell.row][nextCell.col] === 1 || originalGrid[nextCell.row][nextCell.col] === 7)) {
          pathValid = false;
        }
      }

      if (!pathValid) {
        plannedPath = aStarAssumedEmpty(curr) || [];
        if (plannedPath.length === 0) {
          plannedPath = aStarNearestUnexplored(curr) || [];
        }
      }

      if (plannedPath.length > 1) {
        curr = plannedPath[1];
        plannedPath.shift();
        trail.push({ ...curr });
        revealFog(curr);
      } else {
        done = true;
      }

      const isFound = curr.row === goal.row && curr.col === goal.col;
      if (isFound) {
        found = true;
        done = true;
        applyDirectionalPath(grid, trail);
      }

      return {
        current: curr,
        done,
        found: isFound,
        steps,
        visited: fogState.size,
        path: done && found ? trail.length : 0,
        fogState
      };
    };
  }

  if (algo === 'AndOrSearch') {
    let visitedCount = 0;
    let firstBranchReached = false;
    
    // completedPlans maps cellKey to the path from that cell to the goal
    const completedPlans = new Map<string, Cell[]>(); 
    const visitedAll = new Set<string>();
    
    function* andOrDFS(state: Cell, path: Cell[]): Generator<any, Cell[] | null, unknown> {
      visitedCount++;
      const sKey = cellKey(state);
      
      if (completedPlans.has(sKey)) {
        // "nếu nó có plan hoàn thiện thì mình lấy plan của trạng thái này thêm vào plan của nhánh này luôn"
        const reusedPlan = completedPlans.get(sKey)!;
        for (const step of reusedPlan) {
          yield { 
            current: step, 
            agents: [],
            message: "Sử dụng Plan hoàn thiện", 
            action: "Tái sử dụng Plan" 
          };
        }
        return [state, ...reusedPlan];
      }
      
      if (visitedAll.has(sKey)) {
        // Trạng thái đã tồn tại nhưng không có plan hoàn thiện
        yield { 
          current: path.length > 0 ? path[path.length - 1] : state, 
          message: "Đã tồn tại nhưng không có đường, bỏ qua", 
          action: "Bỏ đi" 
        };
        return null;
      }
      
      visitedAll.add(sKey);
      
      if (grid[state.row][state.col] === 0 || grid[state.row][state.col] === 3) {
        grid[state.row][state.col] = 2; // Visited (xanh mạ)
      }
      yield { 
        current: state, 
        message: "Duyệt trạng thái: [" + state.row + "," + state.col + "]" 
      };
      
      if (state.row === goal.row && state.col === goal.col) {
        if (!firstBranchReached) {
          firstBranchReached = true;
          // In xanh dương cho nhánh đầu tiên chạm đích
          applyDirectionalPath(grid, [...path, state]);
          yield { 
            current: state, 
            message: "Nhánh đầu tiên chạm đích!", 
            action: "In xanh dương" 
          };
        } else {
          // Các nhánh khác chỉ di chuyển agent tới đích
          yield { 
            current: state, 
            message: "Một nhánh khác chạm đích!", 
            action: "Không in xanh" 
          };
        }
        completedPlans.set(sKey, [state]);
        return [state];
      }
      
      // "sinh ra 4 trạng thái ở 4 góc"
      const outcomes: Cell[] = [];
      for (const [dr, dc] of dirs) {
        const nr = state.row + dr;
        const nc = state.col + dc;
        if (nr >= 0 && nr < h && nc >= 0 && nc < w && originalGrid[nr][nc] !== 1 && originalGrid[nr][nc] !== 7) {
          outcomes.push({ row: nr, col: nc });
        }
      }
      
      // "có hiển thị trạng thái đó đã từng được sinh"
      for (const out of outcomes) {
         if (grid[out.row][out.col] === 0) {
            grid[out.row][out.col] = 3; // marked as generated visual
         }
      }
      if (outcomes.length > 0) {
        yield { 
          current: state, 
          message: "Sinh các trạng thái kế tiếp", 
          action: "Hiển thị trạng thái sinh" 
        };
      }
      
      // "rồi random 1 trạng thái để duyệt DFS"
      for (let i = outcomes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
      }
      
      let myPlan: Cell[] | null = null;
      
      for (const out of outcomes) {
         const plan = yield* andOrDFS(out, [...path, state]);
         if (!plan) {
            continue;
         }
         if (!myPlan) {
            myPlan = [state, ...plan]; // Lấy plan của nhánh thành công đầu tiên
         }
         // Không break để tiếp tục hoàn thiện plan cho các nhánh khác (Universal Plan)
      }
      
      if (myPlan || (state.row === goal.row && state.col === goal.col)) {
        const finalPlan = myPlan || [state];
        completedPlans.set(sKey, finalPlan);
        return finalPlan;
      }
      
      return null;
    }

    const iterator = andOrDFS(start, []);
    let finalResult: StepResult | null = null;
    
    return () => {
      steps++;
      if (finalResult) {
         finalResult.steps = steps;
         return finalResult;
      }
      
      const res = iterator.next();
      if (res.done) {
        const success = res.value !== null;
        finalResult = {
          current: start, // Final agent pos can just be start or goal
          done: true,
          found: success,
          steps,
          visited: visitedCount,
          path: success ? completedPlans.size : 0,
          beliefState: [],
          agents: []
        };
        return finalResult;
      }
      
      const stateYielded = res.value;
      return {
         current: stateYielded.current,
         done: false,
         found: false,
         steps,
         visited: visitedCount,
         path: 0,
         beliefState: stateYielded.beliefState,
         message: stateYielded.message,
         action: stateYielded.action
      };
    };
  }

  // ── CHAPTER 5: CONSTRAINT SATISFACTION (CSP) ──

  if (algo === 'BacktrackingSearch') {
    let done = false;
    let found = false;
    
    const getShortestPathLength = (): number => {
      const queue: { cell: Cell; dist: number }[] = [{ cell: start, dist: 1 }];
      const visited = new Set<string>([`${start.row},${start.col}`]);
      while (queue.length > 0) {
        const { cell, dist } = queue.shift()!;
        if (cell.row === goal.row && cell.col === goal.col) return dist;
        for (const [dr, dc] of dirs) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== 1 && grid[nr][nc] !== 7) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ cell: { row: nr, col: nc }, dist: dist + 1 });
            }
          }
        }
      }
      return 0;
    };

    const S = getShortestPathLength();
    if (S === 0) {
      return () => ({ done: true, found: false, steps: 0, visited: 0, path: 0 });
    }
    const K = h > 10 ? 150 : S;

    const isThreatCell = (cell: Cell, _t: number, currentGrid: Grid): boolean => {
      if (currentGrid[cell.row][cell.col] === 7) return true;
      if (isUnderMonsterVisionState(cell, currentGrid)) return true;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (currentGrid[r][c] === 7) {
            if (Math.abs(r - cell.row) <= 1 && Math.abs(c - cell.col) <= 1) return true;
          }
        }
      }
      return false;
    };

    const assignment: Cell[] = Array(K);
    assignment[0] = start;

    const candidatesStack: Cell[][] = Array(K).fill(null).map(() => []);
    let varIdx = 1;
    let finalPath: Cell[] = [];
    const visitedSet = new Set<string>();

    return () => {
      steps++;
      if (done) return { done: true, found, steps, visited: visitedSet.size, path: finalPath.length };

      updateDynamicMonsters();

      const monsterAgents = patrolMonsters.map(m => ({ row: m.row, col: m.col, type: 'monster' as const, dr: m.dr, dc: m.dc }));
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 7) {
            const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
            const adjusted = adjustOrRemoveMonster(mStatic, grid) || mStatic;
            monsterAgents.push({ row: r, col: c, type: 'monster' as const, dr: adjusted.dr, dc: adjusted.dc });
          }
        }
      }

      if (steps >= 10000) {
        done = true;
        found = false;
        return { done: true, found: false, steps, visited: visitedSet.size, path: 0, agents: monsterAgents };
      }

      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 2 || grid[r][c] === 3 || grid[r][c] === 4) {
            grid[r][c] = 0;
          }
        }
      }

      if (varIdx === K) {
        if (assignment[K - 1].row === goal.row && assignment[K - 1].col === goal.col) {
          done = true;
          found = true;
          finalPath = [...assignment];
          for (let i = 0; i < finalPath.length; i++) {
            const p = finalPath[i];
            if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
              if (i < finalPath.length - 1) {
                const next = finalPath[i + 1];
                if (next.col > p.col) grid[p.row][p.col] = 42;
                else if (next.col < p.col) grid[p.row][p.col] = 44;
                else if (next.row > p.row) grid[p.row][p.col] = 43;
                else if (next.row < p.row) grid[p.row][p.col] = 41;
                else grid[p.row][p.col] = 4;
              } else {
                grid[p.row][p.col] = 4;
              }
            }
          }
          return { current: assignment[K - 1], done: true, found: true, steps, visited: visitedSet.size, path: finalPath.length, agents: monsterAgents };
        } else {
          varIdx--;
        }
      }

      if (varIdx === 0) {
        done = true;
        found = false;
        return { done: true, found: false, steps, visited: visitedSet.size, path: 0, agents: monsterAgents };
      }

      const prev = assignment[varIdx - 1] || start;
      const currentPos = prev;
      const currentPathLen = varIdx;

      const adjacentCells: { row: number; col: number; status: 'valid' | 'invalid' }[] = [];
      for (const [dr, dc] of dirs) {
        const nr = prev.row + dr;
        const nc = prev.col + dc;
        if (nr >= 0 && nr < h && nc >= 0 && nc < w) {
          if (grid[nr][nc] !== 1 && grid[nr][nc] !== 7) {
            const isVisited = visitedSet.has(`${nr},${nc}`) || (nr === start.row && nc === start.col);
            if (!isVisited) {
              const nb = { row: nr, col: nc };
              const isThreat = isThreatCell(nb, varIdx, grid);
              adjacentCells.push({ row: nr, col: nc, status: isThreat ? 'invalid' : 'valid' });
            }
          }
        }
      }

      let isBacktracking = false;
      let action: string | undefined = undefined;
      let message: string | undefined = undefined;

      if (candidatesStack[varIdx].length === 0) {
        const nbs = neighbors(prev).filter(nb => {
          if (grid[nb.row][nb.col] === 1 || grid[nb.row][nb.col] === 7) return false;
          if (isThreatCell(nb, varIdx, grid)) return false;
          if (visitedSet.has(`${nb.row},${nb.col}`) || (nb.row === start.row && nb.col === start.col)) return false;

          if (varIdx + 1 < K) {
            let hasValidNext = false;
            const nextNbs = neighbors(nb);
            for (const nnb of nextNbs) {
              if (grid[nnb.row][nnb.col] !== 1 && grid[nnb.row][nnb.col] !== 7 && !isThreatCell(nnb, varIdx + 1, grid)) {
                const duplicate = visitedSet.has(`${nnb.row},${nnb.col}`) || (nnb.row === start.row && nnb.col === start.col);
                if (!duplicate && !(nb.row === nnb.row && nb.col === nnb.col)) {
                  hasValidNext = true;
                  break;
                }
              }
            }
            if (!hasValidNext) return false;
          }
          return true;
        });

        if (K > S) {
          shuffleArray(nbs);
        } else {
          nbs.sort((a, b) => {
            const distA = Math.abs(a.row - goal.row) + Math.abs(a.col - goal.col);
            const distB = Math.abs(b.row - goal.row) + Math.abs(b.col - goal.col);
            return distB - distA; 
          });
        }
        candidatesStack[varIdx] = nbs;
      }

      if (candidatesStack[varIdx].length > 0) {
        const nextCell = candidatesStack[varIdx].pop()!;
        assignment[varIdx] = nextCell;
        visitedSet.add(`${nextCell.row},${nextCell.col}`);
        varIdx++;
        action = "Gán nhãn";
        message = `Gán giá trị ô [${nextCell.row},${nextCell.col}] vào đường dẫn`;
        if (nextCell.row === goal.row && nextCell.col === goal.col) {
          done = true;
          found = true;
          finalPath = assignment.slice(0, varIdx);
          for (let i = 0; i < finalPath.length; i++) {
            const p = finalPath[i];
            if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
              if (i < finalPath.length - 1) {
                const next = finalPath[i + 1];
                if (next.col > p.col) grid[p.row][p.col] = 42;
                else if (next.col < p.col) grid[p.row][p.col] = 44;
                else if (next.row > p.row) grid[p.row][p.col] = 43;
                else if (next.row < p.row) grid[p.row][p.col] = 41;
                else grid[p.row][p.col] = 4;
              } else {
                grid[p.row][p.col] = 4;
              }
            }
          }
          return { current: nextCell, done: true, found: true, steps, visited: visitedSet.size, path: finalPath.length, agents: monsterAgents, action, message };
        }
      } else {
        const backtrackCell = assignment[varIdx - 1] || start;
        candidatesStack[varIdx] = [];
        varIdx--;
        isBacktracking = true;
        action = "Quay lui";
        message = `Không có nước đi hợp lệ, quay lui từ [${backtrackCell.row},${backtrackCell.col}]`;
      }

      for (let i = 1; i < varIdx; i++) {
        const p = assignment[i];
        if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
          grid[p.row][p.col] = 2;
        }
      }

      return {
        current: currentPos,
        done: false,
        found: false,
        steps,
        visited: visitedSet.size,
        path: currentPathLen,
        agents: monsterAgents,
        adjacentCells,
        isBacktracking,
        action,
        message
      };
    };
  }

  if (algo === 'AC3') {
    let done = false;
    let found = false;
    
    const getShortestPathLength = (): number => {
      const queue: { cell: Cell; dist: number }[] = [{ cell: start, dist: 1 }];
      const visited = new Set<string>([`${start.row},${start.col}`]);
      while (queue.length > 0) {
        const { cell, dist } = queue.shift()!;
        if (cell.row === goal.row && cell.col === goal.col) return dist;
        
        for (const [dr, dc] of dirs) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== 1 && grid[nr][nc] !== 7) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ cell: { row: nr, col: nc }, dist: dist + 1 });
            }
          }
        }
      }
      return 0;
    };
    
    const S = getShortestPathLength();
    if (S === 0) {
      return () => ({ done: true, found: false, steps: 0, visited: 0, path: 0 });
    }
    const K = h > 10 ? 150 : S;
    
    const isThreatCell = (cell: Cell, currentGrid: Grid): boolean => {
      if (currentGrid[cell.row][cell.col] === 7) return true;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (currentGrid[r][c] === 7) {
            if (Math.abs(r - cell.row) <= 1 && Math.abs(c - cell.col) <= 1) return true;
          }
        }
      }

      for (const pm of patrolMonsters) {
        const m = getMonsterAtTime(pm, 0, currentGrid);
        if (m.row === cell.row && m.col === cell.col) return true;

        const range = getMonsterVisionRange(m, currentGrid);
        let r = m.row + m.dr;
        let c = m.col + m.dc;
        let s = 0;
        while (r >= 0 && r < h && c >= 0 && c < w && s < range) {
          if (currentGrid[r][c] === 1) break;
          if (r === cell.row && c === cell.col) return true;
          r += m.dr;
          c += m.dc;
          s++;
        }
      }
      return false;
    };

    const runAC3Preprocessing = (currentGrid: Grid): Map<string, Set<string>> | null => {
      const domainsMap = new Map<string, Set<string>>();
      const allWalkable = new Set<string>();

      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (currentGrid[r][c] !== 1 && currentGrid[r][c] !== 7 && !isThreatCell({ row: r, col: c }, currentGrid)) {
            allWalkable.add(`${r},${c}`);
          }
        }
      }

      for (const key of allWalkable) {
        const [r, c] = key.split(',').map(Number);
        const nbs = new Set<string>();
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          const nKey = `${nr},${nc}`;
          if (allWalkable.has(nKey)) {
            nbs.add(nKey);
          }
        }
        domainsMap.set(key, nbs);
      }

      const queue: string[] = Array.from(allWalkable);
      const inQueue = new Set<string>(queue);
      const startKey = `${start.row},${start.col}`;
      const goalKey = `${goal.row},${goal.col}`;

      while (queue.length > 0) {
        const u = queue.shift()!;
        inQueue.delete(u);

        const neighborsSet = domainsMap.get(u);
        if (!neighborsSet) continue;

        const requiredDegree = (u === startKey || u === goalKey) ? 1 : 2;

        if (neighborsSet.size < requiredDegree) {
          domainsMap.delete(u);
          allWalkable.delete(u);

          for (const v of neighborsSet) {
            const vNbs = domainsMap.get(v);
            if (vNbs) {
              vNbs.delete(u);
              if (!inQueue.has(v)) {
                queue.push(v);
                inQueue.add(v);
              }
            }
          }
        }
      }

      const reachableFromStart = new Set<string>();
      const startBFS = [startKey];
      reachableFromStart.add(startKey);
      let idx = 0;
      while (idx < startBFS.length) {
        const curr = startBFS[idx++];
        const nbs = domainsMap.get(curr);
        if (nbs) {
          for (const nextCell of nbs) {
            if (!reachableFromStart.has(nextCell)) {
              reachableFromStart.add(nextCell);
              startBFS.push(nextCell);
            }
          }
        }
      }

      const canReachGoal = new Set<string>();
      const goalBFS = [goalKey];
      canReachGoal.add(goalKey);
      idx = 0;
      while (idx < goalBFS.length) {
        const curr = goalBFS[idx++];
        const nbs = domainsMap.get(curr);
        if (nbs) {
          for (const prevCell of nbs) {
            if (!canReachGoal.has(prevCell)) {
              canReachGoal.add(prevCell);
              goalBFS.push(prevCell);
            }
          }
        }
      }

      const finalFiltered = new Set<string>();
      for (const key of allWalkable) {
        if (reachableFromStart.has(key) && canReachGoal.has(key)) {
          finalFiltered.add(key);
        }
      }

      if (!finalFiltered.has(startKey) || !finalFiltered.has(goalKey)) {
        return null; 
      }

      for (const key of finalFiltered) {
        const nbs = domainsMap.get(key);
        if (nbs) {
          for (const nb of Array.from(nbs)) {
            if (!finalFiltered.has(nb)) {
              nbs.delete(nb);
            }
          }
        }
      }
      
      const finalDomains = new Map<string, Set<string>>();
      for (const key of finalFiltered) {
        finalDomains.set(key, domainsMap.get(key)!);
      }
      return finalDomains;
    };

    const finalDomains = runAC3Preprocessing(grid);
    if (!finalDomains) {
      return () => ({ current: start, done: true, found: false, steps: 1, visited: 0, path: 0, message: "AC3 lọc rỗng toàn bộ đường đi!" });
    }

    const assignment: Cell[] = Array(K);
    assignment[0] = start;
    const candidatesStack: Cell[][] = Array(K).fill(null).map(() => []);
    let varIdx = 1;
    let finalPath: Cell[] = [];
    const visitedSet = new Set<string>([`${start.row},${start.col}`]);
 
    return () => {
      steps++;
      if (done) return { done: true, found, steps, visited: visitedSet.size, path: finalPath.length };
 
      updateDynamicMonsters();
      const monsterAgents = patrolMonsters.map(m => ({ row: m.row, col: m.col, type: 'monster' as const, dr: m.dr, dc: m.dc }));
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 7) {
            const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
            const adjusted = adjustOrRemoveMonster(mStatic, grid) || mStatic;
            monsterAgents.push({ row: r, col: c, type: 'monster' as const, dr: adjusted.dr, dc: adjusted.dc });
          }
        }
      }
 
      if (steps >= 10000) {
        done = true;
        found = false;
        return { done: true, found: false, steps, visited: visitedSet.size, path: 0, agents: monsterAgents };
      }
 
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 2 || grid[r][c] === 3 || grid[r][c] === 4) {
            grid[r][c] = 0;
          }
        }
      }

      for (const key of finalDomains.keys()) {
        const [r, c] = key.split(',').map(Number);
        if (grid[r][c] !== 1 && grid[r][c] !== 7) {
          grid[r][c] = 3;
        }
      }
 
      if (varIdx === K) {
        if (assignment[K - 1].row === goal.row && assignment[K - 1].col === goal.col) {
          done = true;
          found = true;
          finalPath = [...assignment];
          for (let i = 0; i < finalPath.length; i++) {
            const p = finalPath[i];
            if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
              if (i < finalPath.length - 1) {
                const next = finalPath[i + 1];
                if (next.col > p.col) grid[p.row][p.col] = 42;
                else if (next.col < p.col) grid[p.row][p.col] = 44;
                else if (next.row > p.row) grid[p.row][p.col] = 43;
                else if (next.row < p.row) grid[p.row][p.col] = 41;
                else grid[p.row][p.col] = 4;
              } else {
                grid[p.row][p.col] = 4;
              }
            }
          }
          return { current: assignment[K - 1], done: true, found: true, steps, visited: visitedSet.size, path: finalPath.length, agents: monsterAgents };
        } else {
          varIdx--;
        }
      }
 
      if (varIdx === 0) {
        done = true;
        found = false;
        return { done: true, found: false, steps, visited: visitedSet.size, path: 0, agents: monsterAgents };
      }
 
      const prev = assignment[varIdx - 1] || start;
      const currentPos = prev;
      const currentPathLen = varIdx;
 
      let isBacktracking = false;
      let action: string | undefined = undefined;
      let message: string | undefined = undefined;
      const adjacentCells: { row: number; col: number; status: 'valid' | 'invalid' }[] = [];

      if (candidatesStack[varIdx].length === 0) {
        const nbs: Cell[] = [];
        const allowed = finalDomains.get(`${prev.row},${prev.col}`);
        if (allowed) {
          for (const nbKey of allowed) {
            const [nr, nc] = nbKey.split(',').map(Number);
            const duplicate = visitedSet.has(`${nr},${nc}`) || (nr === start.row && nc === start.col);
            if (!duplicate) {
              nbs.push({ row: nr, col: nc });
            }
          }
        }

        if (K > S) {
          shuffleArray(nbs);
        } else {
          nbs.sort((a, b) => {
            const distA = Math.abs(a.row - goal.row) + Math.abs(a.col - goal.col);
            const distB = Math.abs(b.row - goal.row) + Math.abs(b.col - goal.col);
            return distB - distA;
          });
        }
        candidatesStack[varIdx] = nbs;
      }

      if (candidatesStack[varIdx].length > 0) {
        const nextCell = candidatesStack[varIdx].pop()!;
        assignment[varIdx] = nextCell;
        visitedSet.add(`${nextCell.row},${nextCell.col}`);
        varIdx++;
        action = "Gán nhãn";
        message = `Gán giá trị ô [${nextCell.row},${nextCell.col}] vào đường dẫn`;
        
        if (nextCell.row === goal.row && nextCell.col === goal.col) {
          done = true;
          found = true;
          finalPath = assignment.slice(0, varIdx);
          for (let i = 0; i < finalPath.length; i++) {
            const p = finalPath[i];
            if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
              if (i < finalPath.length - 1) {
                const next = finalPath[i + 1];
                if (next.col > p.col) grid[p.row][p.col] = 42;
                else if (next.col < p.col) grid[p.row][p.col] = 44;
                else if (next.row > p.row) grid[p.row][p.col] = 43;
                else if (next.row < p.row) grid[p.row][p.col] = 41;
                else grid[p.row][p.col] = 4;
              } else {
                grid[p.row][p.col] = 4;
              }
            }
          }
          return { current: nextCell, done: true, found: true, steps, visited: visitedSet.size, path: finalPath.length, agents: monsterAgents, action, message };
        }
      } else {
        candidatesStack[varIdx] = [];
        varIdx--;
        isBacktracking = true;
        action = "Quay lui";
        message = `Không có nước đi hợp lệ từ [${prev.row},${prev.col}], quay lui`;
      }

      for (let i = 1; i < varIdx; i++) {
        const p = assignment[i];
        if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
          grid[p.row][p.col] = 2; 
        }
      }
 
      return {
        current: currentPos,
        done: false,
        found: false,
        steps,
        visited: visitedSet.size,
        path: currentPathLen,
        agents: monsterAgents,
        adjacentCells,
        isBacktracking,
        action,
        message
      };
    };
  }

  if (algo === 'MinConflicts') {

    let done = false;
    let found = false;
    
    const getRandomDFSPath = (): Cell[] => {
      const path: Cell[] = [];
      const visited = new Set<string>();
      
      const dfs = (curr: Cell): boolean => {
        path.push(curr);
        visited.add(`${curr.row},${curr.col}`);
        
        if (curr.row === goal.row && curr.col === goal.col) {
          return true;
        }
        
        const shuffDirs = [...dirs];
        for (let i = shuffDirs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffDirs[i], shuffDirs[j]] = [shuffDirs[j], shuffDirs[i]];
        }
        
        for (const [dr, dc] of shuffDirs) {
          const nr = curr.row + dr;
          const nc = curr.col + dc;
          if (nr > 0 && nr < h - 1 && nc > 0 && nc < w - 1 && grid[nr][nc] !== 1) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              if (dfs({ row: nr, col: nc })) {
                return true;
              }
            }
          }
        }
        
        path.pop();
        return false;
      };
      
      dfs(start);
      return path;
    };

    const getBFSPath = (): Cell[] => {
      const queue: { cell: Cell; path: Cell[] }[] = [{ cell: start, path: [start] }];
      const visited = new Set<string>([`${start.row},${start.col}`]);
      while (queue.length > 0) {
        const { cell, path } = queue.shift()!;
        if (cell.row === goal.row && cell.col === goal.col) return path;
        
        for (const [dr, dc] of dirs) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== 1 && grid[nr][nc] !== 7) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ cell: { row: nr, col: nc }, path: [...path, { row: nr, col: nc }] });
            }
          }
        }
      }
      return [];
    };

    const bfsPath = getBFSPath();
    if (bfsPath.length === 0) {
      return () => ({ done: true, found: false, steps: 0, visited: 0, path: 0 });
    }
    
    let pathList: Cell[] = [];
    const dfsPath = getRandomDFSPath();
    pathList = dfsPath.length > 0 ? [...dfsPath] : [...bfsPath];

    // ── Phát hiện xung đột: ô nằm trong tầm nhìn quái vật hoặc kề quái vật ──
    const isCellConflict = (cell: Cell): boolean => {
      if (grid[cell.row][cell.col] === 7) return true;
      if (isUnderMonsterVisionState(cell, grid)) return true;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 7) {
            if (Math.abs(r - cell.row) <= 1 && Math.abs(c - cell.col) <= 1) {
              return true;
            }
            const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
            const adjusted = adjustOrRemoveMonster(mStatic, grid) || mStatic;
            const range = getMonsterVisionRange(adjusted, grid);
            let vr = adjusted.row + adjusted.dr;
            let vc = adjusted.col + adjusted.dc;
            let vSteps = 0;
            while (vr >= 0 && vr < h && vc >= 0 && vc < w && vSteps < range) {
              if (grid[vr][vc] === 1) break;
              if (vr === cell.row && vc === cell.col) return true;
              vr += adjusted.dr;
              vc += adjusted.dc;
              vSteps++;
            }
          }
        }
      }
      return false;
    };

    // ── Greedy Search tìm đường ít xung đột nhất ──
    const findGreedyPath = (from: Cell, to: Cell): Cell[] => {
      if (from.row === to.row && from.col === to.col) return [from];
      
      const queue: { cell: Cell; path: Cell[]; h: number }[] = [];
      const visited = new Set<string>([`${from.row},${from.col}`]);
      
      const getH = (c: Cell) => {
        const conflictPenalty = isCellConflict(c) ? 1000 : 0;
        const dist = Math.abs(c.row - to.row) + Math.abs(c.col - to.col);
        return conflictPenalty + dist;
      };
      
      queue.push({ cell: from, path: [from], h: getH(from) });
      
      while (queue.length > 0) {
        queue.sort((a, b) => a.h - b.h);
        const { cell, path } = queue.shift()!;
        
        if (cell.row === to.row && cell.col === to.col) {
          return path;
        }
        
        for (const [dr, dc] of dirs) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== 1) {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              const nextCell = { row: nr, col: nc };
              queue.push({ cell: nextCell, path: [...path, nextCell], h: getH(nextCell) });
            }
          }
        }
      }
      return [from, to];
    };

    // ── Loại bỏ các vòng lặp (cycles) trên đường đi ──
    const removeCycles = (path: Cell[]): Cell[] => {
      const newPath: Cell[] = [];
      const seen = new Map<string, number>();
      
      for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        const key = `${cell.row},${cell.col}`;
        
        if (seen.has(key)) {
          const cutIdx = seen.get(key)!;
          const removed = newPath.splice(cutIdx + 1);
          for (const r of removed) {
            seen.delete(`${r.row},${r.col}`);
          }
        } else {
          newPath.push(cell);
          seen.set(key, newPath.length - 1);
        }
      }
      return newPath;
    };

    // ── Tìm tất cả index ô xung đột trên đường đi (trừ start và goal) ──
    const getConflictIndices = (): number[] => {
      const indices: number[] = [];
      for (let i = 1; i < pathList.length - 1; i++) {
        if (isCellConflict(pathList[i])) {
          indices.push(i);
        }
      }
      return indices;
    };

    // ── Vẽ đường đi bằng mũi tên lên grid ──
    const drawPathOnGrid = () => {
      for (let i = 0; i < pathList.length; i++) {
        const c = pathList[i];
        if (grid[c.row][c.col] !== 1 && grid[c.row][c.col] !== 7) {
          if (i < pathList.length - 1) {
            const next = pathList[i + 1];
            if (next.col > c.col) grid[c.row][c.col] = 42;
            else if (next.col < c.col) grid[c.row][c.col] = 44;
            else if (next.row > c.row) grid[c.row][c.col] = 43;
            else if (next.row < c.row) grid[c.row][c.col] = 41;
            else grid[c.row][c.col] = 4;
          } else {
            grid[c.row][c.col] = 4;
          }
        }
      }
    };

    let attempts = 0;
    let phase: 'fixing' | 'walking' | 'repairing_anim' = 'fixing';
    let walkIndex = 0;
    let activeRepair: {
      left: Cell[];
      greedyPath: Cell[];
      right: Cell[];
      idx: number;
      conflictCell: Cell;
    } | null = null;

    return () => {
      steps++;
      attempts++;
      if (done) return { done: true, found, steps, visited: attempts, path: pathList.length };

      updateDynamicMonsters();
      const monsterAgents = patrolMonsters.map(m => ({ row: m.row, col: m.col, type: 'monster' as const, dr: m.dr, dc: m.dc }));
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 7) {
            const mStatic: Monster = { row: r, col: c, dr: 0, dc: 1 };
            const adjusted = adjustOrRemoveMonster(mStatic, grid) || mStatic;
            monsterAgents.push({ row: r, col: c, type: 'monster' as const, dr: adjusted.dr, dc: adjusted.dc });
          }
        }
      }

      // Dọn dẹp các ô vẽ đường dẫn cũ
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === 2 || grid[r][c] === 3 || grid[r][c] === 4 || (grid[r][c] >= 41 && grid[r][c] <= 44)) {
            grid[r][c] = originalGrid[r][c];
          }
        }
      }

      // ═══════════════════════════════════════════
      // GIAI ĐOẠN 3: Agent di chuyển dọc đường đi
      // ═══════════════════════════════════════════
      if (phase === 'walking') {
        walkIndex++;
        drawPathOnGrid();

        if (walkIndex >= pathList.length - 1) {
          done = true;
          found = true;
          return {
            current: goal,
            done: true,
            found: true,
            steps,
            visited: attempts,
            path: pathList.length,
            agents: monsterAgents,
            action: "Đã tới đích",
            message: `Bước ${attempts}: Phi hành gia đã tới Trạm Không Gian thành công! Tổng chiều dài đường đi: ${pathList.length} bước.`
          };
        }

        return {
          current: pathList[walkIndex],
          done: false,
          found: false,
          steps,
          visited: attempts,
          path: pathList.length,
          agents: monsterAgents,
          action: "Di chuyển",
          message: `Bước ${attempts}: Phi hành gia di chuyển tới [${pathList[walkIndex].row}, ${pathList[walkIndex].col}] (${walkIndex}/${pathList.length - 1}).`
        };
      }

      // ═══════════════════════════════════════════
      // GIAI ĐOẠN 1: Khởi tạo đường đi ngẫu nhiên
      // ═══════════════════════════════════════════
      if (attempts === 1) {
        drawPathOnGrid();

        const conflicts = getConflictIndices();
        const conflictCells = conflicts.map(i => ({
          row: pathList[i].row,
          col: pathList[i].col,
          status: 'invalid' as const
        }));

        if (conflicts.length === 0) {
          phase = 'walking';
          walkIndex = 0;
          return {
            current: start,
            done: false,
            found: false,
            steps,
            visited: attempts,
            path: pathList.length,
            agents: monsterAgents,
            action: "Khởi tạo đường đi",
            message: `Bước ${attempts}: Đường đi ngẫu nhiên (${pathList.length} bước). Không có xung đột! Bắt đầu di chuyển.`
          };
        }

        return {
          current: start,
          done: false,
          found: false,
          steps,
          visited: attempts,
          path: pathList.length,
          agents: monsterAgents,
          adjacentCells: conflictCells,
          action: "Khởi tạo đường đi",
          message: `Bước ${attempts}: Khởi tạo đường đi ngẫu nhiên (${pathList.length} bước). Phát hiện ${conflicts.length} ô xung đột (tô đỏ). Bắt đầu sửa xung đột.`
        };
      }

      // ═══════════════════════════════════════════
      // GIAI ĐOẠN 2: Vòng lặp sửa xung đột
      // ═══════════════════════════════════════════
      if (phase === 'fixing') {
        const conflictIndices = getConflictIndices();

        if (conflictIndices.length === 0) {
          phase = 'walking';
          walkIndex = 0;
          drawPathOnGrid();
          return {
            current: start,
            done: false,
            found: false,
            steps,
            visited: attempts,
            path: pathList.length,
            agents: monsterAgents,
            action: "Đường đi hoàn thiện",
            message: `Bước ${attempts}: Đã loại bỏ tất cả xung đột! Đường đi an toàn (${pathList.length} bước). Bắt đầu di chuyển.`
          };
        }

        if (attempts > 2000) {
          done = true;
          found = false;
          drawPathOnGrid();
          return {
            current: start,
            done: true,
            found: false,
            steps,
            visited: attempts,
            path: pathList.length,
            agents: monsterAgents,
            action: "Hết thời gian",
            message: `Bước ${attempts}: Không thể loại bỏ hết xung đột sau 2000 bước. Còn ${conflictIndices.length} ô xung đột.`
          };
        }

        // Chọn ngẫu nhiên 1 ô bị xung đột
        const randIdx = conflictIndices[Math.floor(Math.random() * conflictIndices.length)];
        const conflictCell = pathList[randIdx];
        const prevCell = pathList[randIdx - 1];
        const nextCell = pathList[randIdx + 1];

        // Dùng Greedy để tìm đường nối ít xung đột nhất từ prevCell tới nextCell
        const greedyPath = findGreedyPath(prevCell, nextCell);

        activeRepair = {
          left: pathList.slice(0, randIdx),
          greedyPath,
          right: pathList.slice(randIdx + 1),
          idx: 0,
          conflictCell
        };
        
        phase = 'repairing_anim';
        
        // Bước đầu tiên của animation
        pathList = removeCycles([...activeRepair.left, ...activeRepair.greedyPath.slice(0, 1), ...activeRepair.right]);
        drawPathOnGrid();

        const remainingConflicts = getConflictIndices();
        const remainCells = remainingConflicts.map(i => ({
          row: pathList[i].row,
          col: pathList[i].col,
          status: 'invalid' as const
        }));

        return {
          current: prevCell,
          done: false,
          found: false,
          steps,
          visited: attempts,
          path: pathList.length,
          agents: monsterAgents,
          adjacentCells: remainCells,
          action: "Bắt đầu nối",
          message: `Bước ${attempts}: Chọn ô xung đột [${conflictCell.row}, ${conflictCell.col}]. Bắt đầu nối lại đường đi.`
        };
      }

      // ═══════════════════════════════════════════
      // GIAI ĐOẠN 2.5: Animation nối đường Greedy
      // ═══════════════════════════════════════════
      if (phase === 'repairing_anim') {
         if (!activeRepair) {
            phase = 'fixing';
            return { current: start, done: false, found: false, steps, visited: attempts, path: pathList.length, agents: monsterAgents, action: "Error", message: "Lỗi animation." };
         }
         
         activeRepair.idx++;
         const { left, greedyPath, right } = activeRepair;
         
         const currentHead = greedyPath[activeRepair.idx];
         
         pathList = removeCycles([...left, ...greedyPath.slice(0, activeRepair.idx + 1), ...right]);
         drawPathOnGrid();
         
         const remainingConflicts = getConflictIndices();
         const remainCells = remainingConflicts.map(i => ({
            row: pathList[i].row,
            col: pathList[i].col,
            status: 'invalid' as const
         }));
         
         if (activeRepair.idx >= greedyPath.length - 1) {
            phase = 'fixing';
            activeRepair = null;
         }
         
         return {
            current: currentHead,
            done: false,
            found: false,
            steps,
            visited: attempts,
            path: pathList.length,
            agents: monsterAgents,
            adjacentCells: remainCells,
            action: "Đang nối đường",
            message: `Bước ${attempts}: Đang đi tìm đường mới tới [${currentHead.row}, ${currentHead.col}]. Còn ${remainingConflicts.length} xung đột.`
         };
      }

      return { current: start, done: true, found: false, steps, visited: attempts, path: pathList.length, agents: monsterAgents, action: "Error", message: "Fallback." };
    };
  }

  // ── CHAPTER 6: ADVERSARIAL SEARCH ──

  if (algo === 'Minimax') {
    // --- Minimax implementation with unified tree, 3x3 catch range, and Astro as MIN player ---
  }
  if (['Minimax', 'AlphaBeta', 'Expectimax'].includes(algo)) {
    let monsterPos = { row: 18, col: 10 };
    let foundMonster = false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[r][c] === 7) {
          monsterPos = { row: r, col: c };
          foundMonster = true;
          break;
        }
      }
      if (foundMonster) break;
    }
    if (!foundMonster && patrolStarts && patrolStarts.length > 0) {
      monsterPos = { row: patrolStarts[0].row, col: patrolStarts[0].col };
      foundMonster = true;
    }
    if (!foundMonster && (monsterPos.row >= h || monsterPos.col >= w)) {
      monsterPos = { row: Math.max(0, h - 2), col: Math.max(0, w - 2) };
    }

    let astroPos = { row: start.row, col: start.col };
    let done = false;
    let found = false;
    const astroTrail: Cell[] = [{ ...start }];
    const getStateKey = (a: Cell, m: Cell) => `${a.row},${a.col}|${m.row},${m.col}`;
    const reached = new Set<string>([getStateKey(astroPos, monsterPos)]);

    // Precompute All-Pairs Shortest Path (APSP) using BFS for true maze distances
    const distMatrix: number[][] = Array(h * w).fill(0).map(() => Array(h * w).fill(9999));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[r][c] === 1) continue;
        const startIdx = r * w + c;
        distMatrix[startIdx][startIdx] = 0;
        const q: number[] = [startIdx];
        let head = 0;
        while (head < q.length) {
          const currIdx = q[head++];
          const currR = Math.floor(currIdx / w);
          const currC = currIdx % w;
          const d = distMatrix[startIdx][currIdx];
          
          for (const [dr, dc] of dirs) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== 1) {
              const nIdx = nr * w + nc;
              if (distMatrix[startIdx][nIdx] > d + 1) {
                distMatrix[startIdx][nIdx] = d + 1;
                q.push(nIdx);
              }
            }
          }
        }
      }
    }

    const evalMonster = (m: Cell, a: Cell): number => {
      const mIdx = m.row * w + m.col;
      const aIdx = a.row * w + a.col;
      const gIdx = goal.row * w + goal.col;
      const distToMonster = distMatrix[mIdx][aIdx];
      const distToGoal = distMatrix[aIdx][gIdx];
      return -distToMonster * 2 + distToGoal;
    };

    // --- MONSTER SEARCH TREE ---
    const minimaxMonster = (mPos: Cell, aPos: Cell, depth: number, isMax: boolean): number => {
      if (Math.abs(mPos.row - aPos.row) <= 1 && Math.abs(mPos.col - aPos.col) <= 1) return 1000 - (4 - depth);
      if (aPos.row === goal.row && aPos.col === goal.col) return -1000 + (4 - depth);
      if (depth === 0) return evalMonster(mPos, aPos);

      if (isMax) {
        let maxVal = -Infinity;
        const allNbs = neighbors(mPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(aPos, nb)));
        const candidates = nbs.length > 0 ? nbs : [mPos];
        for (const nb of candidates) {
          maxVal = Math.max(maxVal, minimaxMonster(nb, aPos, depth - 1, false));
        }
        return maxVal;
      } else {
        let minVal = Infinity;
        const allNbs = neighbors(aPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(nb, mPos)));
        const candidates = nbs.length > 0 ? nbs : [aPos];
        for (const nb of candidates) {
          minVal = Math.min(minVal, minimaxMonster(mPos, nb, depth - 1, true));
        }
        return minVal;
      }
    };

    const alphabetaMonster = (mPos: Cell, aPos: Cell, depth: number, alpha: number, beta: number, isMax: boolean): number => {
      if (Math.abs(mPos.row - aPos.row) <= 1 && Math.abs(mPos.col - aPos.col) <= 1) return 1000 - (4 - depth);
      if (aPos.row === goal.row && aPos.col === goal.col) return -1000 + (4 - depth);
      if (depth === 0) return evalMonster(mPos, aPos);

      if (isMax) {
        let maxVal = -Infinity;
        const allNbs = neighbors(mPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(aPos, nb)));
        const candidates = nbs.length > 0 ? nbs : [mPos];
        for (const nb of candidates) {
          maxVal = Math.max(maxVal, alphabetaMonster(nb, aPos, depth - 1, alpha, beta, false));
          alpha = Math.max(alpha, maxVal);
          if (beta <= alpha) break;
        }
        return maxVal;
      } else {
        let minVal = Infinity;
        const allNbs = neighbors(aPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(nb, mPos)));
        const candidates = nbs.length > 0 ? nbs : [aPos];
        for (const nb of candidates) {
          minVal = Math.min(minVal, alphabetaMonster(mPos, nb, depth - 1, alpha, beta, true));
          beta = Math.min(beta, minVal);
          if (beta <= alpha) break;
        }
        return minVal;
      }
    };

    const expectimaxMonster = (mPos: Cell, aPos: Cell, depth: number, isMax: boolean): number => {
      if (Math.abs(mPos.row - aPos.row) <= 1 && Math.abs(mPos.col - aPos.col) <= 1) return 1000 - (4 - depth);
      if (aPos.row === goal.row && aPos.col === goal.col) return -1000 + (4 - depth);
      if (depth === 0) return evalMonster(mPos, aPos);

      if (isMax) {
        let maxVal = -Infinity;
        const allNbs = neighbors(mPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(aPos, nb)));
        const candidates = nbs.length > 0 ? nbs : [mPos];
        for (const nb of candidates) {
          maxVal = Math.max(maxVal, expectimaxMonster(nb, aPos, depth - 1, false));
        }
        return maxVal;
      } else {
        const allNbs = neighbors(aPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(nb, mPos)));
        const candidates = nbs.length > 0 ? nbs : [aPos];
        let sum = 0;
        for (const nb of candidates) {
          sum += expectimaxMonster(mPos, nb, depth - 1, true);
        }
        return sum / candidates.length;
      }
    };

    const expectimaxAstro = (mPos: Cell, aPos: Cell, depth: number, isMax: boolean): number => {
      if (Math.abs(mPos.row - aPos.row) <= 1 && Math.abs(mPos.col - aPos.col) <= 1) return 1000 - (4 - depth);
      if (aPos.row === goal.row && aPos.col === goal.col) return -1000 + (4 - depth);
      if (depth === 0) return evalMonster(mPos, aPos);

      if (isMax) {
        const allNbs = neighbors(mPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(aPos, nb)));
        const candidates = nbs.length > 0 ? nbs : [mPos];
        let sum = 0;
        for (const nb of candidates) {
          sum += expectimaxAstro(nb, aPos, depth - 1, false);
        }
        return sum / candidates.length;
      } else {
        let minVal = Infinity;
        const allNbs = neighbors(aPos);
        const nbs = allNbs.filter(nb => !reached.has(getStateKey(nb, mPos)));
        const candidates = nbs.length > 0 ? nbs : [aPos];
        for (const nb of candidates) {
          minVal = Math.min(minVal, expectimaxAstro(mPos, nb, depth - 1, true));
        }
        return minVal;
      }
    };

    const getBestMonsterMove = (): Cell => {
      const allNbs = neighbors(monsterPos);
      const nbs = allNbs.filter(nb => !reached.has(getStateKey(astroPos, nb)));
      const candidates = nbs.length > 0 ? nbs : [monsterPos];
      if (candidates.length === 1 && candidates[0] === monsterPos) return monsterPos;
      
      let bestMove = monsterPos;
      let bestVal = -Infinity;

      for (const nb of candidates) {
        let val = 0;
        if (algo === 'Minimax') {
          val = minimaxMonster(nb, astroPos, 3, false);
        } else if (algo === 'AlphaBeta') {
          val = alphabetaMonster(nb, astroPos, 3, -Infinity, Infinity, false);
        } else if (algo === 'Expectimax') {
          val = expectimaxMonster(nb, astroPos, 3, false);
        }

        if (val > bestVal) {
          bestVal = val;
          bestMove = nb;
        }
      }
      return bestMove;
    };

    return () => {
      steps++;
      if (done) return { current: astroPos, done: true, found, steps, visited: steps, path: astroTrail.length, agents: [{ row: monsterPos.row, col: monsterPos.col, type: 'monster' }] };

      // 1. Astro di chuyển trước
      const allAstroNbs = neighbors(astroPos);
      const astroNbs = allAstroNbs.filter(nb => !reached.has(getStateKey(nb, monsterPos)));
      let bestAstroMove = astroPos;
      if (astroNbs.length > 0) {
        let bestVal = Infinity;
        for (const nb of astroNbs) {
          let val = 0;
          if (algo === 'Minimax') {
            val = minimaxMonster(monsterPos, nb, 3, true);
          } else if (algo === 'AlphaBeta') {
            val = alphabetaMonster(monsterPos, nb, 3, -Infinity, Infinity, true);
          } else if (algo === 'Expectimax') {
            val = expectimaxAstro(monsterPos, nb, 3, true);
          }

          if (val < bestVal) {
            bestVal = val;
            bestAstroMove = nb;
          }
        }
      }

      astroPos = bestAstroMove;
      astroTrail.push({ ...astroPos });
      reached.add(getStateKey(astroPos, monsterPos));

      // Kiểm tra nếu Astro đến đích
      if (astroPos.row === goal.row && astroPos.col === goal.col) {
        done = true;
        found = true;
      }

      // Kiểm tra nếu Astro tự đi vào tầm bắt của quái vật
      if (!done && Math.abs(monsterPos.row - astroPos.row) <= 1 && Math.abs(monsterPos.col - astroPos.col) <= 1) {
        done = true;
        found = false;
      }

      // 2. Quái vật di chuyển sau
      if (!done) {
        monsterPos = getBestMonsterMove();
        reached.add(getStateKey(astroPos, monsterPos));
        if (Math.abs(monsterPos.row - astroPos.row) <= 1 && Math.abs(monsterPos.col - astroPos.col) <= 1) {
          done = true;
          found = false;
        }
      }

      // Paint astro trail
      for (let i = 0; i < astroTrail.length; i++) {
        const p = astroTrail[i];
        if (grid[p.row][p.col] !== 1 && grid[p.row][p.col] !== 7) {
          if (i < astroTrail.length - 1) {
            const n = astroTrail[i + 1];
            if (n.col > p.col) grid[p.row][p.col] = 42;
            else if (n.col < p.col) grid[p.row][p.col] = 44;
            else if (n.row > p.row) grid[p.row][p.col] = 43;
            else if (n.row < p.row) grid[p.row][p.col] = 41;
            else grid[p.row][p.col] = 4;
          } else {
            if (grid[p.row][p.col] < 41 || grid[p.row][p.col] > 44) {
              grid[p.row][p.col] = 4;
            }
          }
        }
      }

      return {
        current: astroPos,
        done,
        found,
        steps,
        visited: steps,
        path: done && found ? astroTrail.length : 0,
        agents: [{ row: monsterPos.row, col: monsterPos.col, type: 'monster' }]
      };
    };
  }

  return () => ({ done: true, found: false, steps: 0, visited: 0, path: 0 });
}
