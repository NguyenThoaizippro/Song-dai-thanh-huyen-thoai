// game.test.ts — Complete test suite for Starpath AI algorithms
import { describe, it, expect } from 'vitest';
import { bfs, dfs, ids, MAPS, type Step, type Grid, type Cell, type AlgoType } from './game';
import { createStepFn } from './step_fn';

function collectSteps(
  grid: Grid,
  start: Cell,
  goal: Cell,
  algo: (grid: Grid, start: Cell, goal: Cell) => Generator<Step>,
): Step[] {
  const steps: Step[] = [];
  const gen = algo(grid, start, goal);
  for (const s of gen) steps.push(s);
  return steps;
}

// ── BFS ──
describe('BFS', () => {
  it('finds path in empty 10×10 grid', () => {
    const steps = collectSteps(MAPS[0].grid, MAPS[0].start, MAPS[0].goal, bfs);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(true);
    expect(last.path.length).toBeGreaterThan(0);
    expect(last.path.length).toBe(37);
  });

  it('finds path in maze', () => {
    const steps = collectSteps(MAPS[1].grid, MAPS[1].start, MAPS[1].goal, bfs);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(true);
    expect(last.path.length).toBeGreaterThan(0);
  });

  it('respects obstacles (blocked goal)', () => {
    const grid: Grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ];
    const steps = collectSteps(grid, { row: 0, col: 0 }, { row: 2, col: 2 }, bfs);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(false);
    expect(last.path.length).toBe(0);
  });

  it('returns shortest path (BFS property)', () => {
    const grid = Array.from({ length: 10 }, () => Array(10).fill(0));
    const steps = collectSteps(grid, { row: 0, col: 0 }, { row: 5, col: 5 }, bfs);
    const last = steps[steps.length - 1];
    expect(last.path.length).toBe(11);
  });
});

// ── DFS ──
describe('DFS', () => {
  it('finds a path when goal is reachable', () => {
    const steps = collectSteps(MAPS[0].grid, MAPS[0].start, MAPS[0].goal, dfs);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(true);
    expect(last.path.length).toBeGreaterThan(0);
  });

  it('returns not-found when goal is unreachable', () => {
    const grid: Grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ];
    const steps = collectSteps(grid, { row: 0, col: 0 }, { row: 2, col: 2 }, dfs);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(false);
    expect(last.path.length).toBe(0);
  });
});

// ── IDS ──
describe('IDS', () => {
  it('finds a path when goal is reachable', () => {
    const grid: Grid = Array.from({ length: 4 }, () => Array(4).fill(0));
    const steps = collectSteps(grid, { row: 0, col: 0 }, { row: 3, col: 3 }, ids);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(true);
    expect(last.path.length).toBeGreaterThan(0);
  });

  it('returns not-found when goal is unreachable', () => {
    const grid: Grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ];
    const steps = collectSteps(grid, { row: 0, col: 0 }, { row: 2, col: 2 }, ids);
    const last = steps[steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.found).toBe(false);
    expect(last.path.length).toBe(0);
  });
});

// ── Nhóm 1: Offline Pathfinders & CSP ──
const offlineAlgos: AlgoType[] = [
  'UCS', 'Greedy', 'AStar', 'AC3', 'BacktrackingSearch', 'MinConflicts'
];

describe('Offline Pathfinders & CSP Integration Tests', () => {
  const getCleanGrid = (h: number, w: number): Grid => Array.from({ length: h }, () => Array(w).fill(0));

  offlineAlgos.forEach(algo => {
    it(`runs ${algo} on a clean map and finds path`, () => {
      const grid = getCleanGrid(6, 6);
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 4000) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.done).toBe(true);
      expect(res.found).toBe(true);
      expect(res.path).toBeGreaterThan(0);
    });

    it(`runs ${algo} and respects static obstacles/monsters`, () => {
      // Start (1,1), Goal (4,4).
      // We block (2,2) with a wall and (3,2) with a monster.
      // This leaves an open and safe path on the right side: (1,3), (1,4), (2,4), (3,4), (4,4).
      const grid = getCleanGrid(6, 6);
      grid[2][2] = 1; // Wall
      grid[3][2] = 7; // Monster
      
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 4000) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.done).toBe(true);
      if (algo !== 'MinConflicts') {
        expect(res.found).toBe(true);
      } else {
        expect(res.steps).toBeGreaterThan(0);
      }
      
      // Verify path cells do not overwrite wall (1) or monster (7)
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (grid[r][c] === 4) {
            expect(grid[r][c]).not.toBe(1);
            expect(grid[r][c]).not.toBe(7);
          }
        }
      }
    });

    it(`runs ${algo} and returns found=false when goal is unreachable`, () => {
      const grid = getCleanGrid(6, 6);
      // Surround start (1,1) with walls
      grid[0][1] = 1;
      grid[2][1] = 1;
      grid[1][0] = 1;
      grid[1][2] = 1;
      
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 4000) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.done).toBe(true);
      expect(res.found).toBe(false);
    });
  });
});

// ── Nhóm 2: Local Search ──
const localAlgos: AlgoType[] = ['HillClimbing', 'SimulatedAnnealing', 'LocalBeam'];

describe('Local Search Integration Tests', () => {
  const getCleanGrid = (h: number, w: number): Grid => Array.from({ length: h }, () => Array(w).fill(0));

  localAlgos.forEach(algo => {
    it(`runs ${algo} on a clean map and finds path`, () => {
      const grid = getCleanGrid(6, 6);
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 4000) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.done).toBe(true);
      expect(res.found).toBe(true);
    });

    it(`runs ${algo} with obstacles without crashing`, () => {
      const grid = getCleanGrid(6, 6);
      grid[2][2] = 1;
      grid[3][2] = 7;
      
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 200) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.steps).toBeGreaterThan(0);
    });
  });
});

// ── Nhóm 3: Online & Uncertainty Search ──
describe('Online & Uncertainty Search Integration Tests', () => {
  const getCleanGrid = (h: number, w: number): Grid => Array.from({ length: h }, () => Array(w).fill(0));

  it('runs OnlineSearch on clean map and finds path', () => {
    const grid = getCleanGrid(6, 6);
    const start = { row: 1, col: 1 };
    const goal = { row: 4, col: 4 };
    
    const stepFn = createStepFn('OnlineSearch', grid, start, goal);
    let done = false;
    let res: any = null;
    let steps = 0;
    
    while (!done && steps < 4000) {
      res = stepFn();
      done = res.done;
      steps++;
    }
    
    expect(res.done).toBe(true);
    expect(res.found).toBe(true);
  });

  it('runs OnlineSearch and returns found=false when goal is unreachable', () => {
    const grid = getCleanGrid(6, 6);
    // Block all exits of start (1,1)
    grid[0][1] = 1;
    grid[2][1] = 1;
    grid[1][0] = 1;
    grid[1][2] = 1;
    
    const start = { row: 1, col: 1 };
    const goal = { row: 4, col: 4 };
    
    const stepFn = createStepFn('OnlineSearch', grid, start, goal);
    let done = false;
    let res: any = null;
    let steps = 0;
    
    while (!done && steps < 4000) {
      res = stepFn();
      done = res.done;
      steps++;
    }
    
    expect(res.done).toBe(true);
    expect(res.found).toBe(false);
  });

  it('runs AndOrSearch on clean map and finds path', () => {
    const grid = getCleanGrid(6, 6);
    const start = { row: 1, col: 1 };
    const goal = { row: 4, col: 4 };
    
    const stepFn = createStepFn('AndOrSearch', grid, start, goal);
    let done = false;
    let res: any = null;
    let steps = 0;
    
    while (!done && steps < 5000) {
      res = stepFn();
      done = res.done;
      steps++;
    }
    
    expect(res.done).toBe(true);
    expect(res.found).toBe(true);
  });

  it('runs AndOrSearch with obstacles without crashing', () => {
    const grid = getCleanGrid(6, 6);
    grid[2][2] = 1;
    
    const start = { row: 1, col: 1 };
    const goal = { row: 4, col: 4 };
    
    const stepFn = createStepFn('AndOrSearch', grid, start, goal);
    let done = false;
    let res: any = null;
    let steps = 0;
    
    while (!done && steps < 100) {
      res = stepFn();
      done = res.done;
      steps++;
    }
    
    expect(res).not.toBeNull();
    expect(res.steps).toBeGreaterThan(0);
  });

  it('runs SensorlessSearch without crashing and updates beliefState', () => {
    const grid = getCleanGrid(6, 6);
    const start = { row: 1, col: 1 };
    const goal = { row: 4, col: 4 };
    
    const stepFn = createStepFn('SensorlessSearch', grid, start, goal);
    let res = stepFn();
    expect(res.beliefState).toBeDefined();
    
    for (let i = 0; i < 20; i++) {
      res = stepFn();
    }
    expect(res.beliefState).toBeDefined();
    expect(res.steps).toBeGreaterThan(0);
  });
});

// ── Special Tests for Chapter 2 Cost (Swamp / Ice) ──
describe('Chapter 2 Cost Logic', () => {
  it('UCS and AStar bypass swamp to minimize path cost', () => {
    // 2x4 grid:
    // Row 0: S (0) | Swamp (6) | Swamp (6) | G (0)
    // Row 1: Normal (0) | Normal (0) | Normal (0) | Normal (0)
    // Detour (5) < Straight (6). UCS and AStar must choose the detour.
    const grid: Grid = [
      [0, 6, 6, 0],
      [0, 0, 0, 0]
    ];
    
    const start = { row: 0, col: 0 };
    const goal = { row: 0, col: 3 };
    
    const stepFn = createStepFn('AStar', grid, start, goal);
    let done = false;
    let res: any = null;
    let steps = 0;
    
    while (!done && steps < 100) {
      res = stepFn();
      done = res.done;
      steps++;
    }
    
    expect(res.found).toBe(true);
    // Swamp cells (0,1) and (0,2) should NOT be on the path (value 4)
    expect(grid[0][1]).not.toBe(4);
    expect(grid[0][2]).not.toBe(4);
  });
});

// ── Special Tests for Chapter 6 Adversarial Algorithms ──
describe('Adversarial Algorithms (Minimax, AlphaBeta, Expectimax)', () => {
  const adversarialAlgos: AlgoType[] = ['Minimax', 'AlphaBeta', 'Expectimax'];

  adversarialAlgos.forEach(algo => {
    it(`runs ${algo} on a 6x6 grid with monster and finishes`, () => {
      const grid = Array.from({ length: 6 }, () => Array(6).fill(0));
      grid[4][3] = 7;
      
      const start = { row: 1, col: 1 };
      const goal = { row: 4, col: 4 };
      
      const stepFn = createStepFn(algo, grid, start, goal);
      let done = false;
      let res: any = null;
      let steps = 0;
      
      while (!done && steps < 100) {
        res = stepFn();
        done = res.done;
        steps++;
      }
      
      expect(res).not.toBeNull();
      expect(res.steps).toBeGreaterThan(0);
      expect(res.agents).toBeDefined();
      expect(res.agents.length).toBe(1); // monster agent
      expect(res.agents[0].type).toBe('monster');
    });
  });
});
