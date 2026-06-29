import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import type { AlgoType, Cell, Grid } from './game';
import { MAPS } from './game';
import { 
  playWinSound
} from './audio';

const ROWS = 21;
const COLS = 21;
const CELL = 25;
const CW = COLS * CELL;
const CH = ROWS * CELL;

// Load assets
import { createStepFn, getInitialMonsters } from './step_fn';
import type { StepResult } from './step_fn';

// Visited cells: faint green swamp hue
function drawVisited(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(52, 211, 153, 0.13)';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
}

// Frontier cells: glowing neon cyan outlines
function drawFrontier(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
}

function drawInvalidDomain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.0;
  ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
}

function drawPathCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(x + s/2, y + s/2, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArrowCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dx: number, dy: number) {
  ctx.save();
  ctx.translate(x + s/2, y + s/2);
  ctx.rotate(Math.atan2(dy, dx));
  
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#38bdf8';
  
  ctx.beginPath();
  ctx.moveTo(s * 0.25, 0); // Tip
  ctx.lineTo(-s * 0.2, s * 0.25); // Bottom right
  ctx.lineTo(-s * 0.1, 0); // Indent
  ctx.lineTo(-s * 0.2, -s * 0.25); // Top right
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function drawHuman(ctx: CanvasRenderingContext2D, r: number, c: number, s: number, ghost = false, img: HTMLImageElement | null = null) {
  const x = c * s;
  const y = r * s;
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.35;
  
  if (img && img.complete && img.naturalWidth !== 0) {
    ctx.drawImage(img, x, y, s, s);
  } else {
    // Glowing aura
    ctx.beginPath();
    ctx.arc(x + s/2, y + s/2, s * 0.45, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(x + s/2, y + s/2, 0, x + s/2, y + s/2, s * 0.45);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // Head/Body (Tribal hunter)
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath();
    ctx.arc(x + s/2, y + s/2 + 2, s * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x + s/2 - s*0.28, y + s/2 - 2, s*0.56, 3);

    // Feather crown (procedural)
    const feathers = ['#ef4444', '#f59e0b', '#38bdf8'];
    const angles = [-Math.PI/4, -Math.PI/2, -3*Math.PI/4];
    feathers.forEach((color, idx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + s/2 - 1);
      const angle = angles[idx];
      const fx = x + s/2 + Math.cos(angle) * s * 0.35;
      const fy = y + s/2 + Math.sin(angle) * s * 0.35;
      ctx.lineTo(fx, fy);
      ctx.stroke();
    });

    // Eyes
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x + s/2 - 3, y + s/2 + 2, 1.2, 0, Math.PI * 2);
    ctx.arc(x + s/2 + 3, y + s/2 + 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHunter(ctx: CanvasRenderingContext2D, r: number, c: number, s: number, img: HTMLImageElement | null = null) {
  // Dinosaur predator
  const x = c * s;
  const y = r * s;
  ctx.save();

  if (img && img.complete && img.naturalWidth !== 0) {
    ctx.drawImage(img, x, y, s, s);
  } else {
    // Glow
    ctx.beginPath();
    ctx.arc(x + s/2, y + s/2, s * 0.45, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(x + s/2, y + s/2, 0, x + s/2, y + s/2, s * 0.45);
    glow.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // Dinosaur green skin
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, s - 6, s - 6, 4);
    ctx.fill();

    // Spikes on back/top
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + s/2, y - 1); ctx.lineTo(x + s - 3, y + 3);
    ctx.fill();

    // Scary eyes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + 6, y + s/2, 2, 0, Math.PI * 2);
    ctx.arc(x + s - 6, y + s/2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Angry brow
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + s/2 - 2); ctx.lineTo(x + 8, y + s/2);
    ctx.moveTo(x + s - 4, y + s/2 - 2); ctx.lineTo(x + s - 8, y + s/2);
    ctx.stroke();

    // Sharp teeth
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + s - 6); ctx.lineTo(x + 8, y + s - 10); ctx.lineTo(x + 10, y + s - 6);
    ctx.moveTo(x + s - 6, y + s - 6); ctx.lineTo(x + s - 8, y + s - 10); ctx.lineTo(x + s - 10, y + s - 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawStation(ctx: CanvasRenderingContext2D, r: number, c: number, s: number, _img: HTMLImageElement | null = null) {
  // Goal: Meat on bone stick (🍖) - drawn on canvas to match rotten meat shape but fresh brown/red
  const x = c * s;
  const y = r * s;
  ctx.save();

  // Fresh warm orange-red glow
  ctx.beginPath();
  ctx.arc(x + s/2, y + s/2, s * 0.4, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(x + s/2, y + s/2, 0, x + s/2, y + s/2, s * 0.4);
  glow.addColorStop(0, 'rgba(249, 115, 22, 0.35)');
  glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fill();

  // Bone stick (fresh clean bone)
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + s - 4, y + s - 4);
  ctx.stroke();

  // Fresh meat body (warm brown meat color)
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.ellipse(x + s/2, y + s/2, s * 0.26, s * 0.18, Math.PI/4, 0, Math.PI * 2);
  ctx.fill();

  // Fresh fat strip/marbling detail (instead of moldy spots)
  ctx.fillStyle = '#fee2e2'; // light pink fat marble
  ctx.beginPath();
  ctx.ellipse(x + s/2 - 1, y + s/2 - 1, s * 0.12, s * 0.05, Math.PI/4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRottenMeat(ctx: CanvasRenderingContext2D, r: number, c: number, s: number) {
  const x = c * s;
  const y = r * s;
  ctx.save();

  // Sickly green glow
  ctx.beginPath();
  ctx.arc(x + s/2, y + s/2, s * 0.4, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(x + s/2, y + s/2, 0, x + s/2, y + s/2, s * 0.4);
  glow.addColorStop(0, 'rgba(132, 204, 22, 0.25)');
  glow.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fill();

  // Bone stick
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + s - 4, y + s - 4);
  ctx.stroke();

  // Rotten meat body
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(x + s/2, y + s/2, s * 0.26, s * 0.18, Math.PI/4, 0, Math.PI * 2);
  ctx.fill();

  // Moldy spots
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.arc(x + s/2 - 2, y + s/2, 1.2, 0, Math.PI * 2);
  ctx.arc(x + s/2 + 2, y + s/2 + 1, 1.0, 0, Math.PI * 2);
  ctx.fill();

  // Fly particles
  ctx.fillStyle = '#000000';
  for (let i = 0; i < 3; i++) {
    const fx = x + s/2 + (Math.random() - 0.5) * s * 0.5;
    const fy = y + s/2 - s * 0.2 + (Math.random() - 0.5) * s * 0.2;
    ctx.beginPath();
    ctx.arc(fx, fy, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

interface Chapter {
  id: number;
  name: string;
  algos: AlgoType[];
  theme: string;
  icon: string;
}

const CHAPTERS: Chapter[] = [
  { id: 1, name: 'Uninformed Search', algos: ['BFS', 'DFS', 'IDS'], theme: 'Ground Survival', icon: '👤' },
  { id: 2, name: 'Informed Search', algos: ['UCS', 'Greedy', 'AStar'], theme: 'Informed Escape', icon: '🗺️' },
  { id: 3, name: 'Local Search', algos: ['HillClimbing', 'LocalBeam', 'SimulatedAnnealing'], theme: 'Tactical Hunt', icon: '🏹' },
  { id: 4, name: 'Search under Uncertainty', algos: ['SensorlessSearch', 'OnlineSearch', 'AndOrSearch'], theme: 'Unmapped Zones', icon: '🌫️' },
  { id: 5, name: 'Constraint Satisfaction', algos: ['BacktrackingSearch', 'AC3', 'MinConflicts'], theme: 'Constraint Systems', icon: '⛓️' },
  { id: 6, name: 'Adversarial Search', algos: ['Minimax', 'AlphaBeta', 'Expectimax'], theme: 'Adversarial Tactics', icon: '⚔️' }
];

export default function App() {

  const [grid, setGrid] = useState<Grid>(() => MAPS[0].generate());
  const [algo, setAlgo] = useState<AlgoType>('BFS');
  const [screen, setScreen] = useState<'menu' | 'chapters' | 'game'>('menu');
  const [status, setStatus] = useState<'standby' | 'running' | 'paused' | 'found' | 'blocked' | 'stepping'>('standby');
  const [speed, setSpeed] = useState(6);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [singleStats, setSingleStats] = useState<StepResult>({ steps: 0, visited: 0, maxMemory: 0, path: 0, done: false, found: false });
  const currentChapter = CHAPTERS.find(c => c.id === selectedChapter);
  const [brushType, setBrushType] = useState<'wall' | 'swamp' | 'monster' | 'decoy'>('wall');


  // Pre-computation engine states
  const [computedSteps, setComputedSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const statusRef = useRef(status);
  const speedRef = useRef(speed);
  const algoRef = useRef(algo);
  
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { algoRef.current = algo; }, [algo]);



  const chapterGridsRef = useRef<Record<number, { grid: Grid; start: Cell; goal: Cell }>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const meatImgRef = useRef<HTMLImageElement | null>(null);
  const monsterImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let loadedCount = 0;
    const handleLoad = () => {
      loadedCount++;
      if (loadedCount === 3) {
        setImagesLoaded(true);
      }
    };

    const avatar = new Image();
    avatar.src = '/assets/avatar.png';
    avatar.onload = handleLoad;
    avatarImgRef.current = avatar;

    const meat = new Image();
    meat.src = '/assets/meat.png';
    meat.onload = handleLoad;
    meatImgRef.current = meat;

    const monster = new Image();
    monster.src = '/assets/monster.png';
    monster.onload = handleLoad;
    monsterImgRef.current = monster;
  }, []);

  const gridRef = useRef<Grid>(grid);
  const currentStepRef = useRef<any>(null);
  


  const timerRef = useRef<number | null>(null);

  const dragRef = useRef<{ active: boolean; mode: 'add' | 'remove' | 'move-start' | 'move-goal' | 'move-decoy' | 'move-monster' | 'move-patrol-monster' }>({ active: false, mode: 'add' });
  const startRef = useRef<Cell>({ row: MAPS[0].start.row, col: MAPS[0].start.col });
  const goalRef = useRef<Cell>({ row: MAPS[0].goal.row, col: MAPS[0].goal.col });
  const dragDecoyRef = useRef<Cell | null>(null);
  const dragMonsterRef = useRef<Cell | null>(null);
  const dragPatrolMonsterIndexRef = useRef<number | null>(null);
  const patrolMonstersStartRef = useRef<{ row: number; col: number }[]>([
    { row: 5, col: 2 },
    { row: 15, col: 2 },
    { row: 2, col: 5 },
    { row: 2, col: 15 }
  ]);
  const modeRef = useRef<'add' | 'remove'>('add');
  const rafRef = useRef<number | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const getDelay = (s: number) => Math.max(10, 110 - s * 10);

  // Pre-computation engine generator execution
  const computeSteps = (selectedAlgo: AlgoType, activeGrid: Grid) => {
    const startGrid = activeGrid.map(r => r.map(c => (c === 1 ? 1 : c === 5 ? 5 : c === 6 ? 6 : c === 7 ? 7 : c === 8 ? 8 : 0)));
    
    const initialBelief: Cell[] = [];
    if (selectedAlgo === 'SensorlessSearch') {
      const walkable: Cell[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (startGrid[r][c] !== 1 && startGrid[r][c] !== 7 && !(r === goalRef.current.row && c === goalRef.current.col)) {
            walkable.push({ row: r, col: c });
          }
        }
      }
      const shuffled = [...walkable].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(3, shuffled.length); i++) {
        initialBelief.push(shuffled[i]);
      }
    }

    const gen = createStepFn(selectedAlgo, startGrid, startRef.current, goalRef.current, initialBelief, patrolMonstersStartRef.current);
    
    const stepsList: any[] = [];

    stepsList.push({
      grid: startGrid.map(r => [...r]),
      currentPos: { ...startRef.current },
      stats: { steps: 0, visited: 0, maxMemory: 0, path: 0, temp: selectedAlgo === 'SimulatedAnnealing' ? 100.0 : undefined },
      status: 'standby',
      beliefState: selectedAlgo === 'SensorlessSearch' ? initialBelief : undefined,
      fogState: undefined,
      agents: ['Minimax', 'AlphaBeta', 'Expectimax'].includes(selectedAlgo) 
        ? [(() => {
            let mRow = 18, mCol = 10;
            let found = false;
            for(let r=0; r<ROWS; r++){
              for(let c=0; c<COLS; c++){
                if(startGrid[r][c] === 7) { mRow = r; mCol = c; found = true; break; }
              }
              if(found) break;
            }
            if(!found && patrolMonstersStartRef.current.length > 0) {
              mRow = patrolMonstersStartRef.current[0].row;
              mCol = patrolMonstersStartRef.current[0].col;
              found = true;
            }
            if(!found && (mRow >= ROWS || mCol >= COLS)) {
              mRow = Math.max(0, ROWS - 2);
              mCol = Math.max(0, COLS - 2);
            }
            return { row: mRow, col: mCol, type: 'monster' };
          })()] 
        : (['BacktrackingSearch', 'AC3', 'MinConflicts'].includes(selectedAlgo) 
            ? getInitialMonsters(startGrid, patrolMonstersStartRef.current) 
            : undefined)
    });
    
    let done = false;
    let limit = (selectedAlgo === 'AndOrSearch' || selectedAlgo === 'IDS') ? 2000 : 500;
    let stepCount = 0;
    
    while (!done && stepCount < limit) {
      const res = gen();
      stepCount++;
      const gridClone = startGrid.map(r => [...r]);
      stepsList.push({
        grid: gridClone,
        currentPos: res.current ? { ...res.current } : { ...startRef.current },
        stats: {
          steps: (selectedAlgo === 'AndOrSearch' ? stepCount : (res.steps || 0)),
          visited: res.visited || 0,
          maxMemory: res.maxMemory || 0,
          path: res.path || 0,
          temp: res.temp
        },
        status: res.done ? (res.found ? 'found' : 'blocked') : (res.isBacktracking ? 'back' : 'running'),
        beliefState: res.beliefState ? [...res.beliefState] : undefined,
        fogState: res.fogState ? new Set(res.fogState) : undefined,
        agents: res.agents ? res.agents.map(a => ({ ...a })) : undefined,
        message: res.message,
        highlightLine: res.highlightLine,
        action: res.action,
        adjacentCells: res.adjacentCells ? res.adjacentCells.map(c => ({ ...c })) : undefined
      });
      done = res.done;
    }
    
    const totalSteps = stepsList.length - 1;
    if (totalSteps > 0 && (selectedAlgo === 'SensorlessSearch' || selectedAlgo === 'AndOrSearch')) {
      const finalStep = stepsList[stepsList.length - 1];
      const totalVisited = finalStep.stats.visited;
      for (let i = 0; i < stepsList.length; i++) {
        stepsList[i].stats.visited = Math.floor((i / totalSteps) * totalVisited);
      }
    }
    
    return stepsList;
  };

  const triggerRecompute = (targetAlgo: AlgoType, targetGrid: Grid) => {
    const list = computeSteps(targetAlgo, targetGrid);
    setComputedSteps(list);
    setCurrentStepIndex(0);
    if (list.length > 0) {
      setSingleStats(list[0].stats);
      setStatus(list[0].status);
      currentStepRef.current = list[0];
    }
  };

  useEffect(() => {
    triggerRecompute('BFS', grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChapter = (id: number) => {
    setSelectedChapter(id);
    const c = CHAPTERS.find(ch => ch.id === id);
    let firstAlgo: AlgoType = 'BFS';
    if (c && c.algos.length > 0) {
      firstAlgo = c.algos[0];
      setAlgo(firstAlgo);
    }
    
    let g: Grid;
    let startCell: Cell;
    let goalCell: Cell;

    if (chapterGridsRef.current[id]) {
      const saved = chapterGridsRef.current[id];
      g = saved.grid.map(r => r.map(c => (c === 1 ? 1 : c === 5 ? 5 : c === 6 ? 6 : c === 7 ? 7 : c === 8 ? 8 : 0)));
      startCell = saved.start;
      goalCell = saved.goal;
    } else {
      let m = MAPS[0];
      if (['UCS', 'Greedy', 'AStar'].includes(firstAlgo)) m = MAPS[11];
      else if (firstAlgo === 'SensorlessSearch') m = MAPS[6];
      else if (firstAlgo === 'OnlineSearch') m = MAPS[7];
      else if (firstAlgo === 'AndOrSearch') m = MAPS[8];
      else if (['AC3', 'BacktrackingSearch', 'MinConflicts'].includes(firstAlgo)) m = MAPS[9];
      else if (['Minimax', 'AlphaBeta', 'Expectimax'].includes(firstAlgo)) m = MAPS[10];

      g = m.generate();
      if (id === 3) {
        g[5][15] = 8;
        g[15][5] = 8;
      }
      startCell = { ...m.start };
      goalCell = { ...m.goal };
    }

    chapterGridsRef.current[id] = { grid: g, start: startCell, goal: goalCell };

    setGrid(g);
    gridRef.current = g;
    startRef.current = { ...startCell };
    goalRef.current = { ...goalCell };
    
    pauseAuto();
    
    triggerRecompute(firstAlgo, g);
  };

  const handleAlgoSelect = (a: AlgoType) => {
    setAlgo(a);
    
    const newGrid = gridRef.current.map(r => r.map(c => (
      c === 1 ? 1 : c === 5 ? 5 : c === 6 ? 6 : c === 7 ? 7 : c === 8 ? 8 : 0
    )));
    
    setGrid(newGrid);
    gridRef.current = newGrid;

    if (selectedChapter) {
      chapterGridsRef.current[selectedChapter] = {
        grid: newGrid,
        start: { ...startRef.current },
        goal: { ...goalRef.current }
      };
    }
    
    pauseAuto();
    triggerRecompute(a, newGrid);
  };

  const getActionLogs = () => {
    const logs: string[] = [];
    if (computedSteps.length === 0) return logs;

    if (algo === 'SensorlessSearch') {
      if (currentStepIndex >= 1) {
        const step1 = computedSteps[1];
        const cells = step1.beliefState || [];
        const coordsStr = cells.map((c: any) => `(${c.row}, ${c.col})`).join(", ");
        logs.push(`Bước 1: Khởi tạo 3 vị trí ngẫu nhiên tại ${coordsStr}`);
      }
      for (let i = 2; i <= currentStepIndex; i++) {
        const curr = computedSteps[i];
        const actionStr = curr.action;
        if (actionStr) {
          logs.push(`Bước ${i}: Đi ${actionStr}`);
        } else {
          logs.push(`Bước ${i}: Không thực hiện hành động`);
        }
      }
      return logs;
    }

    if (algo === 'AndOrSearch') {
      for (let i = 1; i <= currentStepIndex; i++) {
        const curr = computedSteps[i];
        const actionStr = curr.action;
        const remainingCount = curr.beliefState ? curr.beliefState.length : 0;
        if (actionStr) {
          logs.push(`Bước ${i}: Đi ${actionStr} (Còn lại ${remainingCount} vị trí khả dĩ)`);
        } else {
          logs.push(`Bước ${i}: Không thực hiện hành động`);
        }
      }
      return logs;
    }

    for (let i = 1; i <= currentStepIndex; i++) {
      const prev = computedSteps[i - 1];
      const curr = computedSteps[i];
      const prevPos = prev.currentPos;
      const currPos = curr.currentPos;
      
      let dirStr = "";
      if (currPos.row < prevPos.row) dirStr = "↑ LÊN";
      else if (currPos.row > prevPos.row) dirStr = "↓ DƯỚI";
      else if (currPos.col < prevPos.col) dirStr = "← TRÁI";
      else if (currPos.col > prevPos.col) dirStr = "→ PHẢI";
      
      const posStr = `(${currPos.row}, ${currPos.col})`;
      if (dirStr) {
        logs.push(`Bước ${i}: Đi ${dirStr} tới ${posStr}`);
      } else {
        logs.push(`Bước ${i}: Đứng yên tại ${posStr}`);
      }
    }
    return logs;
  };
  const randomizePositions = () => {
    pauseAuto();
    const g = gridRef.current;
    const empties: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] === 0) empties.push({ row: r, col: c });
      }
    }
    if (empties.length < 2) return;
    
    for (let i = empties.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    
    startRef.current = { ...empties[0] };
    goalRef.current = { ...empties[1] };

    if (selectedChapter === 5) {
      const monsterEmpties = empties.slice(2);
      if (monsterEmpties.length >= 4) {
        patrolMonstersStartRef.current = [
          { ...monsterEmpties[0] },
          { ...monsterEmpties[1] },
          { ...monsterEmpties[2] },
          { ...monsterEmpties[3] }
        ];
      }
    }
    
    const cleanG = g.map(r => r.map(c => (c === 1 ? 1 : c === 5 ? 5 : c === 6 ? 6 : c === 7 ? 7 : c === 8 ? 8 : 0)));
    setGrid(cleanG); gridRef.current = cleanG;
    if (selectedChapter) {
      chapterGridsRef.current[selectedChapter] = {
        grid: cleanG,
        start: { ...startRef.current },
        goal: { ...goalRef.current }
      };
    }
    triggerRecompute(algo, cleanG);
  };

  const tick = () => {
    setCurrentStepIndex((prevIdx) => {
      if (prevIdx < computedSteps.length - 1) {
        const idx = prevIdx + 1;

        const frame = computedSteps[idx];
        setSingleStats(frame.stats);
        setStatus(frame.status);
        currentStepRef.current = frame;
        return idx;
      } else {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return prevIdx;
      }
    });
  };

  const runAuto = () => {
    if (status === 'running') return;
    if (status === 'found' || status === 'blocked' || currentStepIndex === computedSteps.length - 1) {
      setCurrentStepIndex(0);
      const frame = computedSteps[0];
      setSingleStats(frame.stats);
      setStatus(frame.status);
      currentStepRef.current = frame;
    }
    setStatus('running');
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(tick, getDelay(speed));
  };

  const pauseAuto = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStatus('paused');
  };

  const handleStepForward = () => {
    if (currentStepIndex < computedSteps.length - 1) {
      const idx = currentStepIndex + 1;
      setCurrentStepIndex(idx);
      const frame = computedSteps[idx];
      setSingleStats(frame.stats);
      setStatus(frame.status);
      currentStepRef.current = frame;
    }
  };

  const handleStepBackward = () => {
    if (currentStepIndex > 0) {
      const idx = currentStepIndex - 1;
      setCurrentStepIndex(idx);
      const frame = computedSteps[idx];
      setSingleStats(frame.stats);
      setStatus(frame.status);
      currentStepRef.current = frame;
    }
  };

  const clearAll = () => {
    pauseAuto();
    const g = gridRef.current.map((r, rIdx) => 
      r.map((_, cIdx) => (rIdx === 0 || rIdx === ROWS - 1 || cIdx === 0 || cIdx === COLS - 1) ? 1 : 0)
    );
    setGrid(g); gridRef.current = g;
    if (selectedChapter) {
      chapterGridsRef.current[selectedChapter] = {
        grid: g,
        start: { ...startRef.current },
        goal: { ...goalRef.current }
      };
    }
    triggerRecompute(algo, g);
  };

  const resetMap = () => {
    pauseAuto();
    let m = MAPS[0];
    const firstAlgo = currentChapter?.algos[0];
    if (firstAlgo) {
      if (['UCS', 'Greedy', 'AStar'].includes(firstAlgo)) m = MAPS[11];
      else if (firstAlgo === 'SensorlessSearch') m = MAPS[6];
      else if (firstAlgo === 'OnlineSearch') m = MAPS[7];
      else if (firstAlgo === 'AndOrSearch') m = MAPS[8];
      else if (['AC3', 'BacktrackingSearch', 'MinConflicts'].includes(firstAlgo)) m = MAPS[9];
      else if (['Minimax', 'AlphaBeta', 'Expectimax'].includes(firstAlgo)) m = MAPS[10];
    }
    const g = m.generate();
    if (selectedChapter === 3) {
      g[5][15] = 8;
      g[15][5] = 8;
    }
    patrolMonstersStartRef.current = [
      { row: 5, col: 2 },
      { row: 15, col: 2 },
      { row: 2, col: 5 },
      { row: 2, col: 15 }
    ];
    setGrid(g); gridRef.current = g;
    if (selectedChapter) {
      chapterGridsRef.current[selectedChapter] = {
        grid: g,
        start: { ...startRef.current },
        goal: { ...goalRef.current }
      };
    }
    triggerRecompute(algo, g);
  };



  useEffect(() => {
    if (status === 'running') {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(tick, getDelay(speed));
      }
    }
  }, [speed, status]);

  useEffect(() => {
    if (status === 'found') {
      playWinSound();
      pauseAuto();
    } else if (status === 'blocked') {
      pauseAuto();
    }
  }, [status]);



  const getCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = canvas.width / rect.width;
    const actualX = x * scale;
    const actualY = y * scale;
    const cSize = canvas.width / COLS;
    const col = Math.floor(actualX / cSize);
    const row = Math.floor(actualY / cSize);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { row, col };
  };

  const applyCell = (rc: { row: number; col: number } | null) => {
    if (!rc) return;
    const { row, col } = rc;
    if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return;
    if (row === startRef.current.row && col === startRef.current.col) return;
    if (row === goalRef.current.row && col === goalRef.current.col) return;
    
    if (modeRef.current === 'remove') {
      if (selectedChapter === 5) {
        const patrolIdx = patrolMonstersStartRef.current.findIndex(p => p.row === row && p.col === col);
        if (patrolIdx !== -1) {
          patrolMonstersStartRef.current.splice(patrolIdx, 1);
        }
      }
      gridRef.current[row][col] = 0;
    } else {
      const val = brushType === 'wall' ? 1 : brushType === 'swamp' ? 6 : brushType === 'monster' ? 7 : 8;
      if (gridRef.current[row][col] === val) return;
      gridRef.current[row][col] = val;
    }
  };

  const handleCanvasMouseEvents = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status === 'running') return;

    const rc = getCell(e);
    if (!rc) return;
    const { row, col } = rc;
    if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return;

    if (e.type === 'mousedown') {
      // If the game was won/blocked, reset to step 0 / standby state immediately
      if (status === 'found' || status === 'blocked') {
        setCurrentStepIndex(0);
        const frame = computedSteps[0];
        if (frame) {
          setSingleStats(frame.stats);
          setStatus(frame.status);
          currentStepRef.current = frame;
        } else {
          setStatus('standby');
        }
      }

      dragRef.current.active = true;
      const patrolIdx = selectedChapter === 5 ? patrolMonstersStartRef.current.findIndex(p => p.row === row && p.col === col) : -1;
      if (e.shiftKey) {
        dragRef.current.mode = 'remove';
        modeRef.current = 'remove';
        applyCell(rc);
      } else if (row === startRef.current.row && col === startRef.current.col) {
        dragRef.current.mode = 'move-start';
      } else if (row === goalRef.current.row && col === goalRef.current.col) {
        dragRef.current.mode = 'move-goal';
      } else if (gridRef.current[row][col] === 8) {
        dragRef.current.mode = 'move-decoy';
        dragDecoyRef.current = { row, col };
      } else {
        const hasMonster = gridRef.current[row][col] === 7 || patrolIdx !== -1;
        const targetVal = brushType === 'wall' ? 1 : brushType === 'swamp' ? 6 : brushType === 'monster' ? 7 : 8;
        const shouldRemove = (brushType === 'monster' && hasMonster) || (gridRef.current[row][col] === targetVal);
        dragRef.current.mode = shouldRemove ? 'remove' : 'add';
        modeRef.current = shouldRemove ? 'remove' : 'add';
        applyCell(rc);
      }
    } else if (e.type === 'mousemove') {
      if (!dragRef.current.active) return;
      if (dragRef.current.mode === 'move-start') {
        if (row === goalRef.current.row && col === goalRef.current.col) return;
        if (gridRef.current[row][col] === 1 || gridRef.current[row][col] === 7 || gridRef.current[row][col] === 8) return;
        startRef.current = { row, col };
        const tempGrid = gridRef.current.map(r => [...r]);
        setGrid(tempGrid);
      } else if (dragRef.current.mode === 'move-goal') {
        if (row === startRef.current.row && col === startRef.current.col) return;
        if (gridRef.current[row][col] === 1 || gridRef.current[row][col] === 7 || gridRef.current[row][col] === 8) return;
        goalRef.current = { row, col };
        const tempGrid = gridRef.current.map(r => [...r]);
        setGrid(tempGrid);
      } else if (dragRef.current.mode === 'move-decoy') {
        if (row === startRef.current.row && col === startRef.current.col) return;
        if (row === goalRef.current.row && col === goalRef.current.col) return;
        if (gridRef.current[row][col] !== 0) return;
        if (dragDecoyRef.current) {
          gridRef.current[dragDecoyRef.current.row][dragDecoyRef.current.col] = 0;
          gridRef.current[row][col] = 8;
          dragDecoyRef.current = { row, col };
          const tempGrid = gridRef.current.map(r => [...r]);
          setGrid(tempGrid);
        }
      } else {
        applyCell(rc);
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      dragDecoyRef.current = null;
      dragMonsterRef.current = null;
      dragPatrolMonsterIndexRef.current = null;
      const finalGrid = gridRef.current.map(r => [...r]);
      setGrid(finalGrid);
      if (selectedChapter) {
        chapterGridsRef.current[selectedChapter] = {
          grid: finalGrid,
          start: { ...startRef.current },
          goal: { ...goalRef.current }
        };
      }
      triggerRecompute(algo, finalGrid);
    }
  };

  const drawMap = (ctx: CanvasRenderingContext2D, g: Grid, _start: Cell, goal: Cell, moving: Cell | null, cSize: number, fogState?: Set<string>, beliefState?: Cell[], agents?: {row: number, col: number, type: string, dr?: number, dc?: number}[], adjacentCells?: {row: number, col: number, status: 'valid' | 'invalid'}[]) => {
    const w = COLS * cSize;
    const h = ROWS * cSize;
    if (ctx.canvas.width !== w) ctx.canvas.width = w;
    if (ctx.canvas.height !== h) ctx.canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    
    ctx.fillStyle = '#031710';
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * cSize;
        const y = r * cSize;
        
        const baseTerrain = gridRef.current?.[r]?.[c];
        const currentVal = g[r]?.[c];
        
        if (baseTerrain === 1 || currentVal === 1) { 
          ctx.fillStyle = '#7c2d12';
          ctx.fillRect(x + 1, y + 1, cSize - 2, cSize - 2);
          ctx.strokeStyle = '#9a3412';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, cSize - 2, cSize - 2);
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.moveTo(x + 1, y + cSize/2); ctx.lineTo(x + cSize - 1, y + cSize/2);
          ctx.moveTo(x + cSize/2, y + 1); ctx.lineTo(x + cSize/2, y + cSize/2);
          ctx.moveTo(x + cSize/3, y + cSize/2); ctx.lineTo(x + cSize/3, y + cSize - 1);
          ctx.stroke();
        }
        else if (baseTerrain === 6) {
          ctx.fillStyle = '#3d2314';
          ctx.fillRect(x + 1, y + 1, cSize - 2, cSize - 2);
          ctx.strokeStyle = '#24140b';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, cSize - 2, cSize - 2);
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.beginPath();
          ctx.moveTo(x + 3, y + cSize/2); ctx.lineTo(x + cSize - 3, y + cSize/2);
          ctx.stroke();
        }
        else if (baseTerrain === 7) {
          drawHunter(ctx, r, c, cSize, monsterImgRef.current);
        }
        else if (baseTerrain === 8) {
          drawRottenMeat(ctx, r, c, cSize);
        }

        if (baseTerrain !== 1 && baseTerrain !== 7 && baseTerrain !== 8) {
          if (currentVal === 2) drawVisited(ctx, x, y, cSize);
          else if (currentVal === 3) drawFrontier(ctx, x, y, cSize);
          else if (algo === 'AC3' && status !== 'standby' && currentVal === 0) {
            drawInvalidDomain(ctx, x, y, cSize);
          }
          else if (currentVal === 4 || (currentVal >= 41 && currentVal <= 44)) {
            drawVisited(ctx, x, y, cSize);
            if (currentVal === 41) drawArrowCell(ctx, x, y, cSize, 0, -1);
            else if (currentVal === 42) drawArrowCell(ctx, x, y, cSize, 1, 0);
            else if (currentVal === 43) drawArrowCell(ctx, x, y, cSize, 0, 1);
            else if (currentVal === 44) drawArrowCell(ctx, x, y, cSize, -1, 0);
            else drawPathCell(ctx, x, y, cSize);
          }
        }
        
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.03)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cSize, cSize);
      }
    }
    
    let hasPath = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r]?.[c] === 4 || (g[r]?.[c] >= 41 && g[r]?.[c] <= 44)) hasPath = true;
      }
    }
    if (hasPath) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val = g[r]?.[c];
          if (val >= 41 && val <= 44) {
            let nextR = r, nextC = c;
            if (val === 41) nextR = r - 1;
            else if (val === 42) nextC = c + 1;
            else if (val === 43) nextR = r + 1;
            else if (val === 44) nextC = c - 1;

            if (nextR >= 0 && nextR < ROWS && nextC >= 0 && nextC < COLS) {
               const nextVal = g[nextR]?.[nextC];
               if (nextVal === 4 || (nextVal >= 41 && nextVal <= 44)) {
                 ctx.moveTo(c * cSize + cSize/2, r * cSize + cSize/2);
                 ctx.lineTo(nextC * cSize + cSize/2, nextR * cSize + cSize/2);
               }
            }
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    
    drawStation(ctx, goal.row, goal.col, cSize, meatImgRef.current);
    
    if (beliefState && algo === 'SensorlessSearch') {
      const uniqueKeys = new Set<string>();
      for (const b of beliefState) {
        const key = `${b.row},${b.col}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          drawHuman(ctx, b.row, b.col, cSize, true, avatarImgRef.current);
        }
      }
    }

    if (adjacentCells) {
      for (const cell of adjacentCells) {
        const x = cell.col * cSize;
        const y = cell.row * cSize;
        ctx.save();
        if (cell.status === 'valid') {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
          ctx.fillRect(x + 1, y + 1, cSize - 2, cSize - 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 6;
          ctx.strokeRect(x + 1, y + 1, cSize - 2, cSize - 2);
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fillRect(x + 1, y + 1, cSize - 2, cSize - 2);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 6;
          ctx.strokeRect(x + 1, y + 1, cSize - 2, cSize - 2);
        }
        ctx.restore();
      }
    }

    if (agents) {
      for (const a of agents) {
        if (a.type === 'monster') {
          if (status !== 'standby' && a.dr !== undefined && a.dc !== undefined && (a.dr !== 0 || a.dc !== 0)) {
            ctx.save();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.setLineDash([4, 4]);

            let currR = a.row + a.dr;
            let currC = a.col + a.dc;
            
            ctx.beginPath();
            ctx.moveTo((a.col + 0.5) * cSize, (a.row + 0.5) * cSize);
            
            while (currR >= 0 && currR < ROWS && currC >= 0 && currC < COLS) {
              if (gridRef.current?.[currR]?.[currC] === 1) {
                ctx.lineTo((currC + 0.5) * cSize, (currR + 0.5) * cSize);
                break;
              }
              ctx.lineTo((currC + 0.5) * cSize, (currR + 0.5) * cSize);
              currR += a.dr;
              currC += a.dc;
            }
            ctx.stroke();
            ctx.restore();
          }
          drawHunter(ctx, a.row, a.col, cSize, monsterImgRef.current);
        } else if (a.type === 'x') {
          drawRottenMeat(ctx, a.row, a.col, cSize);
        } else if (a.type === 'highlight') {
          drawFrontier(ctx, a.col * cSize, a.row * cSize, cSize);
        } else if (a.type === 'beam-agent') {
          drawHuman(ctx, a.row, a.col, cSize, true, avatarImgRef.current);
        }
      }
    }

    const shouldDrawMain = (algo !== 'LocalBeam' || status === 'standby') && (algo !== 'SensorlessSearch');
    if (moving && shouldDrawMain) drawHuman(ctx, moving.row, moving.col, cSize, false, avatarImgRef.current);
    
    if (fogState) {
       ctx.fillStyle = 'rgba(2, 8, 5, 0.96)';
       for (let r = 0; r < ROWS; r++) {
         for (let c = 0; c < COLS; c++) {
            if (!fogState.has(`${r},${c}`)) {
               ctx.fillRect(c * cSize, r * cSize, cSize, cSize);
               ctx.strokeStyle = 'rgba(52, 211, 153, 0.05)';
               ctx.beginPath(); ctx.moveTo(c*cSize, r*cSize); ctx.lineTo((c+1)*cSize, (r+1)*cSize); ctx.stroke();
            }
         }
       }
     }
  };

  useEffect(() => {
    const loop = () => {
        if (canvasRef.current) {
           const ctx = canvasRef.current.getContext('2d');
           if (ctx) {
              if (status === 'standby' || computedSteps.length === 0) {
                 drawMap(
                   ctx,
                   gridRef.current,
                   startRef.current,
                   goalRef.current,
                   startRef.current,
                   CELL,
                   undefined,
                   computedSteps[0]?.beliefState,
                   computedSteps[0]?.agents
                 );
              } else {
                 const currentFrame = computedSteps[currentStepIndex];
                 if (currentFrame) {
                    drawMap(
                      ctx, 
                      currentFrame.grid, 
                      startRef.current, 
                      goalRef.current, 
                      currentFrame.currentPos, 
                      CELL, 
                      currentFrame.fogState, 
                      currentFrame.beliefState, 
                      currentFrame.agents,
                      currentFrame.adjacentCells
                    );
                 }
              }
           }
        }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [computedSteps, currentStepIndex, status, currentChapter, imagesLoaded, speed]);

  const getStatusTextVietnamese = (s: string) => {
    switch (s) {
      case 'standby': return 'SẴN SÀNG';
      case 'running': return 'ĐANG CHẠY';
      case 'back': return 'QUAY LUI (BACK)';
      case 'paused': return 'TẠM DỪNG';
      case 'found': return 'THÀNH CÔNG';
      case 'blocked': return 'BỊ CHẶN';
      case 'stepping': return 'TỪNG BƯỚC';
      case 'finished': return 'HOÀN THÀNH';
      default: return s.toUpperCase();
    }
  };

  if (screen === 'menu') {
    return (
      <div className="app screen-menu">
        <div className="menu-content">
          <h1 className="hud-title">PRIMORDIAL AI</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button className="menu-btn" onClick={() => { setScreen('chapters'); }}>BẮT ĐẦU PHIÊU LƯU</button>
            <button className="menu-btn outline" onClick={() => { setShowSettings(true); }}>CÀI ĐẶT</button>
          </div>
        </div>
        {showSettings && (
          <div className="overlay" onClick={() => setShowSettings(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
               <h2>Cài đặt & Chú thích bản đồ</h2>
               <div className="legend-grid">
                 <div className="legend-row"><span className="dot astro" /><span>Thổ dân Amazon (Bắt đầu)</span></div>
                 <div className="legend-row"><span className="dot dest" /><span>Cục thịt rừng (Đích đến)</span></div>
                 <div className="legend-row"><span className="dot wall" /><span>Tường (Vật cản)</span></div>
                 <div className="legend-row"><span className="dot visited" /><span>Đất đã qua</span></div>
                 <div className="legend-row"><span className="dot frontier" /><span>Vùng biên tìm kiếm</span></div>
                 <div className="legend-row"><span className="dot path" /><span>Đường đi tối ưu</span></div>
                 {selectedChapter !== 5 && <div className="legend-row"><span className="dot swamp" /><span>Đầm lầy (tốn 3 NL)</span></div>}
                 <div className="legend-row"><span className="dot rotten-meat" /><span>Mồi giả hoang dã</span></div>
                 <div className="legend-row"><span className="dot monster" /><span>Quái vật (Tuần tra/Đuổi bắt)</span></div>
               </div>
               <p className="modal-desc">
                 Mẹo: Giữ chuột trái để vẽ nhanh vật cản trên bản đồ. Giữ phím <b>Shift</b> kết hợp kéo chuột trái để xóa vật cản.
               </p>
               <button className="modal-close" onClick={() => setShowSettings(false)}>ĐÓNG</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'chapters') {
    return (
      <div className="app screen-chapters">
        <header className="header">
          <button className="btn" onClick={() => setScreen('menu')}>⬅ QUAY LẠI MENU</button>
          <h2 className="hud-title">BẢN ĐỒ THÁM HIỂM</h2>
        </header>
        <div className="chapter-list">
          {CHAPTERS.map(c => (
            <button key={c.id} className="chapter-btn" onClick={() => { loadChapter(c.id); setScreen('game'); }}>
              CHẶNG {c.id}: {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="hud-title">PRIMORDIAL AI</h1>
          <p className="hud-sub">CHẶNG {currentChapter?.id}: {currentChapter?.name}</p>
        </div>
        <div className="header-controls">
          <div className="tabs">
            {currentChapter?.algos.map((a) => (
              <button key={a} className={`tab ${algo === a ? 'active' : ''}`} onClick={() => handleAlgoSelect(a)}>{displayAlgoName(a)}</button>
            ))}
          </div>
          <button className="btn" onClick={() => setScreen('chapters')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', display: 'inline-flex', alignSelf: 'center', transform: 'translateY(-1px)' }}>←</span>
            <span>ĐỔI CHẶNG</span>
          </button>
        </div>
      </header>
      
      <main className="game-stage">
          <div className="game-layout">
            <div className="sidebar-left">
              <div className="panel-title">CÔNG CỤ VẼ BẢN ĐỒ</div>
              <div className="brush-group">
                 <button 
                   className={`btn outline small ${brushType === 'wall' ? 'active' : ''}`} 
                   onClick={() => setBrushType('wall')}
                 >
                   <span className="dot wall" /> TƯỜNG
                 </button>
                 {[2, 3, 4].includes(selectedChapter) && (
                   <button 
                     className={`btn outline small ${brushType === 'swamp' ? 'active' : ''}`} 
                     onClick={() => setBrushType('swamp')}
                   >
                     <span className="dot swamp" /> ĐẦM LẦY
                   </button>
                 )}
                 {[5, 6].includes(selectedChapter) && (
                   <button 
                     className={`btn outline small ${brushType === 'monster' ? 'active' : ''}`} 
                     onClick={() => setBrushType('monster')}
                   >
                     <span className="dot monster" /> QUÁI VẬT
                   </button>
                 )}
                 {selectedChapter === 3 && (
                    <button 
                      className={`btn outline small ${brushType === 'decoy' ? 'active' : ''}`} 
                      onClick={() => setBrushType('decoy')}
                    >
                      <span className="dot rotten-meat" /> MỒI GIẢ
                    </button>
                  )}
              </div>

              <div className="panel-title">THAO TÁC BẢN ĐỒ</div>
              <div className="action-group">
                 <button className="btn outline small" onClick={resetMap}>LÀM MỚI</button>
                 <button className="btn outline small" onClick={randomizePositions}>NGẪU NHIÊN</button>
                 <button className="btn danger small" onClick={clearAll} style={{ gridColumn: 'span 2' }}>XÓA TOÀN BỘ</button>
              </div>

              <div className="panel-title">HƯỚNG DẪN VẼ</div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '8px' }}>
                * Nhấp và kéo chuột để vẽ vật cản trên bản đồ.<br/>
                * Giữ phím <b>Shift</b> khi di chuột để xóa vật cản.<br/>
                * Bấm nút Auto để chạy tự động hoặc đi từng bước bằng mũi tên điều hướng.
              </p>
              
              <div className="panel-title">CHÚ THÍCH KÝ HIỆU</div>
              <div className="legend-list">
                <div className="legend-item"><span className="dot astro" /><span>Thổ dân Amazon (Bắt đầu)</span></div>
                <div className="legend-item"><span className="dot dest" /><span>Cục thịt rừng (Đích đến)</span></div>
                <div className="legend-item"><span className="dot wall" /><span>Tường (Vật cản)</span></div>
                <div className="legend-item"><span className="dot path" /><span>Đường đi tối ưu</span></div>
                
                {/* Đất đã qua & Vùng biên - chỉ hiện khi không phải chặng 4 Sensorless/AndOr (để giữ giao diện sạch) */}
                {currentChapter?.id !== 4 && (
                  <>
                    <div className="legend-item"><span className="dot visited" /><span>Đất đã qua (Đã xét)</span></div>
                    {currentChapter?.id !== 3 && (
                      <div className="legend-item"><span className="dot frontier" /><span>Vùng biên quét tìm kiếm</span></div>
                    )}
                  </>
                )}

                {/* Chặng 2: Đầm lầy */}
                {currentChapter?.id === 2 && (
                  <div className="legend-item"><span className="dot swamp" /><span>Đầm lầy hoang dã (NL: 3)</span></div>
                )}

                {/* Chặng 3: Mồi giả */}
                {currentChapter?.id === 3 && (
                  <div className="legend-item"><span className="dot rotten-meat" /><span>Mồi giả hoang dã (Ô bẫy)</span></div>
                )}

                {/* Chặng 4: Sương mù */}
                {currentChapter?.id === 4 && (
                  <>
                    <div className="legend-item"><span className="dot visited" style={{ backgroundColor: 'rgba(2, 8, 5, 0.96)', border: '1px solid rgba(52, 211, 153, 0.15)' }} /><span>Sương mù rừng rậm</span></div>
                  </>
                )}

                {/* Chặng 5: Quái vật tuần tra */}
                {currentChapter?.id === 5 && (
                  <div className="legend-item"><span className="dot monster" /><span>Thú săn mồi tuần tra</span></div>
                )}

                {/* Chặng 6: Quái vật rượt đuổi */}
                {currentChapter?.id === 6 && (
                  <div className="legend-item"><span className="dot monster" /><span>Quái vật rượt đuổi (Tầm 3x3)</span></div>
                )}
              </div>
            </div>
            
            <div className="simulation-center">
              <div className="canvas-frame">
                <canvas
                  ref={canvasRef}
                  className="stage"
                  width={CW}
                  height={CH}
                  onMouseDown={handleCanvasMouseEvents}
                  onMouseMove={handleCanvasMouseEvents}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  onKeyDown={(e) => { if (e.key === 'Shift') modeRef.current = 'remove'; }}
                  onKeyUp={(e) => { if (e.key === 'Shift') modeRef.current = 'add'; }}
                  tabIndex={0}
                />
              </div>
              
              <div className="action-bar">
                <div className={`status-badge status-${status}`}>{getStatusTextVietnamese(status)}</div>
                <button className="btn" onClick={handleStepBackward} disabled={currentStepIndex === 0} title="Lùi 1 bước">
                  |◀ LÙI
                </button>
                <button className="btn primary" onClick={status === 'running' ? pauseAuto : runAuto}>
                  {status === 'running' ? '⏸ TẠM DỪNG' : (status === 'paused' ? '▶ TIẾP TỤC' : '▶ TỰ ĐỘNG')}
                </button>
                <button className="btn" onClick={handleStepForward} disabled={currentStepIndex === computedSteps.length - 1} title="Tiến 1 bước">
                  TIẾN ▶|
                </button>
                <div className="speed-control">
                   <span>TỐC ĐỘ: {speed}</span>
                   <input type="range" min={1} max={10} value={speed} onChange={e => setSpeed(Number(e.target.value))} />
                </div>
              </div>
            </div>
            
            <div className="sidebar-right">
              <div className="stats-panel">
                 <div className="stats-title">BẢNG ĐIỀU KHIỂN HÀNH TRÌNH</div>
                 <div className="stat-row"><span>THUẬT TOÁN: <span className="stat-val highlight">{displayAlgoName(algo)}</span></span></div>
                 <div className="stat-row"><span>SỐ BƯỚC DUYỆT: <span className="stat-val">{singleStats.steps}</span></span></div>
                 <div className="stat-row"><span>SỐ Ô ĐÃ DUYỆT: <span className="stat-val">{singleStats.visited}</span></span></div>
                 {algo === 'SimulatedAnnealing' && singleStats.temp !== undefined && (
                   <div className="stat-row">
                     <span>NHIỆT ĐỘ (T): <span className="stat-val yellow">{singleStats.temp.toFixed(2)}</span></span>
                   </div>
                 )}
                 <div className="stat-row"><span>BỘ NHỚ LỚN NHẤT: <span className="stat-val cyan">{singleStats.maxMemory} ô</span></span></div>
                 {singleStats.path > 0 && (
                   <div className="stat-row">
                     <span>
                       {['UCS', 'Greedy', 'AStar'].includes(algo) ? 'NĂNG LƯỢNG TIÊU THỤ: ' : 'CHIỀU DÀI ĐƯỜNG ĐI: '}
                       <span className="stat-val success">
                         {singleStats.path} {['UCS', 'Greedy', 'AStar'].includes(algo) ? 'năng lượng' : 'bước'}
                       </span>
                     </span>
                   </div>
                 )}
                 {currentStepRef.current?.message && (
                   <div className="hud-stat-row" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', flexDirection: 'column', alignItems: 'flex-start' }}>
                     <span className="hud-stat-val success" style={{ fontSize: '11px', textTransform: 'none', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', overflowY: 'auto', maxHeight: '120px', width: '100%', wordBreak: 'break-all', display: 'block', lineHeight: '1.4' }}>
                       {currentStepRef.current.message}
                     </span>
                   </div>
                 )}
               </div>
                
                <div className="logs-title">NHẬT KÝ HÀNH ĐỘNG ({currentStepIndex} BƯỚC)</div>
                <div className="logs-box">
                  {getActionLogs().length === 0 && <span style={{ opacity: 0.5 }}>Chưa có hành động nào.</span>}
                  {getActionLogs().map((log, idx) => (
                    <div key={idx}>
                      {log}
                    </div>
                  ))}
                </div>


            </div>
          </div>
      </main>

    </div>
  );
}

const displayAlgoName = (name: string) => {
  if (name === 'AStar') return 'A*';
  if (name === 'BacktrackingSearch') return 'Backtracking có forwardlooking';
  if (name === 'AC3') return 'Backtracking có AC3';
  return name;
};


