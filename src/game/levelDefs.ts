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
];
