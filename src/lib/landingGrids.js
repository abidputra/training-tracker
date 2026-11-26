/**
 * Dot patterns for the landing page, written as text so they can be read and edited by eye.
 * Each grid is a list of rows; every character is one dot:
 *   '#' white (on)   'A' accent   '.' unlit   '_' empty (gap between bars)
 * Output is the { cols, cells } shape components/DotGrid.jsx paints.
 */

const KIND = { '#': 'on', A: 'acc', '.': 'dim', _: 'none' };

function grid(rows) {
  return { cols: rows[0].length, cells: rows.flatMap((r) => [...r].map((ch) => KIND[ch])) };
}

const rep = (row, n) => Array(n).fill(row);

/** "This week" chart: eight weeks, the newest in the accent. Phone is shorter than desktop. */
export const HERO_BARS_DESKTOP = grid([
  '.._.._.._.._.._.._##_AA_',
  '.._.._.._##_.._.._##_AA_',
  '.._.._.._##_##_##_##_AA_',
  '.._##_##_##_##_##_##_AA_',
  ...rep('##_##_##_##_##_##_##_AA_', 5),
]);
export const HERO_BARS_PHONE = grid([
  '.._.._.._.._.._.._##_AA_',
  '.._.._.._##_.._##_##_AA_',
  '.._##_##_##_##_##_##_AA_',
  ...rep('##_##_##_##_##_##_##_AA_', 4),
]);

/** Preview card chart: twelve weeks. */
export const PREVIEW_BARS_DESKTOP = grid([
  '.._.._.._.._.._.._.._.._.._.._.._AA_',
  '.._.._.._.._.._.._.._.._##_##_.._AA_',
  '.._.._.._.._##_.._##_.._##_##_##_AA_',
  '.._.._##_.._##_##_##_.._##_##_##_AA_',
  '.._.._##_##_##_##_##_##_##_##_##_AA_',
  '.._##_##_##_##_##_##_##_##_##_##_AA_',
  ...rep('##_##_##_##_##_##_##_##_##_##_##_AA_', 5),
]);
export const PREVIEW_BARS_PHONE = grid([
  '.._.._.._.._.._.._.._.._.._##_.._AA_',
  '.._.._.._.._##_.._##_.._##_##_##_AA_',
  '.._.._##_##_##_##_##_.._##_##_##_AA_',
  '.._##_##_##_##_##_##_##_##_##_##_AA_',
  ...rep('##_##_##_##_##_##_##_##_##_##_##_AA_', 3),
]);

/** Arrow between the three source steps: horizontal on desktop, vertical on phone. */
export const ARROW_ACROSS = grid(['#####A']);
export const ARROW_DOWN = grid(['#', '#', '#', '#', '#', 'A']);

/** 9 x 9 feature icons. */
export const ICONS = {
  bests: grid([
    '..#####..',
    '..#...#..',
    '#.#...#.#',
    '#.#...#.#',
    '.##...##.',
    '..#####..',
    '....#....',
    '....#....',
    '..#####..',
  ]),
  trends: grid([
    '.........',
    '.......A.',
    '......#..',
    '.#...#...',
    '#.#.#....',
    '..#......',
    '.........',
    '#########',
    '.........',
  ]),
  predictions: grid([
    '..#####..',
    '.#.....#.',
    '#...#...#',
    '#...#...#',
    '#...###.#',
    '#.......#',
    '.#.....#.',
    '..#####..',
    '.........',
  ]),
  metrics: grid([
    '.........',
    '......#..',
    '......#..',
    '..#...#..',
    '..#.#.#..',
    '#.#.#.#..',
    '#.#.#.#.#',
    '#.#.#.#.#',
    '#########',
  ]),
  strength: grid([
    '...###...',
    '...###...',
    '..#####..',
    '.#######.',
    '#.#####.#',
    '#.#####.#',
    '..##.##..',
    '..##.##..',
    '..##.##..',
  ]),
  install: grid([
    '..#####..',
    '..#...#..',
    '..#...#..',
    '..#.A.#..',
    '..#...#..',
    '..#...#..',
    '..#...#..',
    '..#####..',
    '....#....',
  ]),
};
