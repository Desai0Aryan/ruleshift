import { bumper, cup, type LevelDef, wall } from './levelKit';

/**
 * Authored base levels (World: 90 x 160, y grows downward, ball r=3).
 * Every level is verified solvable by `npm run levels:solve`, which pins a reference solution in
 * levels.solutions.json. The tests fail if a level has no valid pinned solution or is trivially solvable.
 */
export const LEVEL_DEFS: LevelDef[] = [
  {
    id: 'L01', name: 'First Drop',
    ball: [22, 18], target: [68, 138],
    planks: [30],
  },
  {
    id: 'L02', name: 'The Ledge',
    ball: [72, 16], target: [70, 134],
    segments: [wall(90, 50, 42, 60), ...cup(70, 120, 22, 22)],
    planks: [28],
  },
  {
    id: 'L03', name: 'Pinball Wizard',
    ball: [72, 16], target: [16, 140],
    discs: [bumper(30, 62), bumper(62, 84), bumper(34, 108)],
    planks: [24],
  },
  {
    id: 'L04', name: 'Funnel Vision',
    ball: [14, 18], target: [45, 142],
    segments: [wall(8, 72, 36, 104), wall(82, 72, 54, 104), ...cup(45, 128, 14, 22)],
    planks: [30, 22],
  },
  {
    id: 'L05', name: 'Zig Zag',
    ball: [14, 16], target: [74, 146],
    segments: [wall(0, 48, 58, 60), wall(90, 82, 32, 96), wall(0, 116, 50, 128)],
    planks: [24, 24],
  },
  {
    id: 'L06', name: 'Home Cup',
    ball: [72, 16], target: [20, 134],
    segments: [wall(46, 62, 90, 72), ...cup(20, 118, 26, 26)],
    planks: [30, 26],
  },
  {
    id: 'L07', name: 'Trampoline Park',
    ball: [45, 14], target: [18, 60], targetR: 6,
    discs: [bumper(45, 120, 9, 1.18)],
    segments: [wall(0, 80, 22, 80), wall(70, 40, 90, 40)],
    planks: [24, 20],
  },
  {
    id: 'L08', name: 'Bumper Cars',
    ball: [20, 16], target: [70, 140],
    discs: [bumper(34, 54, 6), bumper(66, 70, 6), bumper(30, 96, 6), bumper(60, 116, 5)],
    planks: [22, 22],
  },
  {
    id: 'L09', name: 'Long Way Down',
    ball: [76, 14], target: [16, 148],
    segments: [wall(90, 40, 40, 52), wall(0, 80, 52, 92), wall(90, 118, 40, 128), ...cup(16, 132, 22, 18)],
    discs: [bumper(60, 100, 4)],
    planks: [26, 24, 22],
  },
  {
    id: 'L10', name: 'The Needle',
    ball: [60, 16], target: [26, 138], targetR: 6,
    segments: [wall(0, 88, 52, 100), wall(70, 88, 90, 88), wall(14, 112, 14, 150), wall(38, 124, 38, 150)],
    planks: [24, 20],
  },
  {
    id: 'L11', name: 'Mind the Gap',
    ball: [14, 18], target: [74, 142],
    segments: [wall(0, 62, 34, 72), wall(0, 108, 36, 108), wall(54, 108, 90, 108), ...cup(74, 124, 24, 26)],
    planks: [26, 26],
  },
  {
    id: 'L12', name: 'Switchback',
    ball: [14, 16], target: [74, 146],
    segments: [wall(0, 44, 66, 54), wall(90, 78, 24, 90), wall(0, 112, 66, 122)],
    discs: [bumper(76, 134, 4)],
    planks: [22, 22, 22],
  },
  // ---- Part 3: second pack (harder, more varied) ----
  {
    id: 'L13', name: 'Slalom',
    ball: [14, 16], target: [26, 146],
    segments: [wall(0, 50, 60, 58), wall(90, 84, 30, 92), wall(0, 118, 60, 126)],
    discs: [bumper(72, 70, 4), bumper(18, 104, 4)],
    planks: [24, 22],
  },
  {
    id: 'L14', name: 'Pachinko',
    ball: [45, 14], target: [45, 146],
    discs: [bumper(30, 50, 5), bumper(60, 50, 5), bumper(18, 80, 5), bumper(45, 80, 5), bumper(72, 80, 5), bumper(30, 110, 5), bumper(60, 110, 5)],
    segments: [wall(10, 130, 38, 150), wall(80, 130, 52, 150)],
    planks: [22, 22],
  },
  {
    id: 'L15', name: 'Over the Wall',
    ball: [16, 20], target: [74, 140],
    segments: [wall(50, 70, 50, 150), wall(50, 70, 36, 70)],
    planks: [30, 24],
  },
  {
    id: 'L16', name: 'Tight Squeeze',
    ball: [70, 16], target: [20, 142], targetR: 6,
    segments: [wall(0, 70, 56, 82), wall(76, 70, 90, 70), wall(24, 110, 90, 110), wall(24, 110, 24, 130)],
    planks: [26, 22],
  },
  {
    id: 'L17', name: 'Two Cups',
    ball: [45, 14], target: [74, 138],
    segments: [...cup(18, 100, 24, 30), ...cup(74, 112, 24, 24)],
    discs: [bumper(45, 70, 5)],
    planks: [30, 24],
  },
  {
    id: 'L18', name: 'Spiral Stair',
    ball: [14, 14], target: [12, 148],
    segments: [wall(0, 40, 66, 54), wall(90, 76, 24, 92), wall(0, 110, 66, 124), wall(90, 136, 36, 148)],
    planks: [24, 22, 22],
    maxTime: 17,
  },
  {
    id: 'L19', name: 'Bank Shot',
    ball: [76, 14], target: [14, 120], targetR: 6,
    segments: [wall(40, 60, 40, 100), wall(40, 100, 0, 100)],
    discs: [bumper(60, 90, 6, 1.2)],
    planks: [28, 24],
    maxTime: 12,
  },
  {
    id: 'L20', name: 'Narrow Gate',
    ball: [20, 16], target: [70, 142],
    segments: [wall(0, 80, 38, 80), wall(54, 80, 90, 80), wall(38, 80, 38, 94), wall(54, 80, 54, 94)],
    discs: [bumper(16, 56, 5), bumper(74, 110, 5)],
    planks: [24, 22, 20],
  },
  {
    id: 'L21', name: 'Stepping Stones',
    ball: [12, 16], target: [78, 146],
    segments: [wall(4, 52, 30, 56), wall(40, 74, 62, 78), wall(58, 100, 86, 104), wall(0, 126, 40, 132)],
    planks: [24, 24],
  },
  {
    id: 'L22', name: 'The Funnel Maze',
    ball: [45, 12], target: [45, 148], targetR: 6,
    segments: [wall(0, 44, 36, 66), wall(90, 44, 54, 66), wall(0, 90, 36, 112), wall(90, 90, 54, 112), wall(32, 126, 58, 126)],
    planks: [26, 22, 20],
  },
  {
    id: 'L23', name: 'Under the Roof',
    ball: [76, 14], target: [76, 146], targetR: 6,
    segments: [wall(30, 60, 90, 60), wall(0, 96, 56, 110)],
    planks: [28, 24],
  },
  {
    id: 'L24', name: 'Grand Finale',
    ball: [14, 14], target: [76, 148], targetR: 6,
    segments: [wall(0, 46, 62, 54), wall(90, 76, 28, 86), wall(0, 108, 62, 116), wall(54, 130, 54, 150)],
    discs: [bumper(76, 62, 4), bumper(16, 92, 4), bumper(70, 124, 4)],
    planks: [22, 22, 20],
  },
];
