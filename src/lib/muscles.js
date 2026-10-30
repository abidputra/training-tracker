/**
 * Which muscles an activity worked, from Garmin's per-exercise summary
 * (`summarizedExerciseSets`: category, subCategory, sets...).
 *
 * Garmin gives an exercise TYPE, not the muscles. The table below is a
 * practical mapping (prime movers = primary, helpers = secondary), not a
 * measurement. Intensity is weighted SETS: each set counts 1 for a primary
 * muscle and 0.5 for a secondary one. Muscle ids are those of
 * the dot figures in lib/dots.js.
 *
 * Pure functions, no React.
 */

const SHOULDERS = ['front-deltoids', 'back-deltoids'];

/** category -> { primary, secondary } (Garmin FIT exercise categories). */
const RULES = {
  BENCH_PRESS: { primary: ['chest'], secondary: ['triceps', 'front-deltoids'] },
  FLYE: { primary: ['chest'], secondary: ['front-deltoids'] },
  PUSH_UP: { primary: ['chest', 'triceps'], secondary: ['front-deltoids', 'abs'] },
  SHOULDER_PRESS: { primary: ['front-deltoids'], secondary: ['triceps', 'trapezius'] },
  LATERAL_RAISE: { primary: SHOULDERS, secondary: ['trapezius'] },
  SHOULDER_STABILITY: { primary: ['back-deltoids'], secondary: ['trapezius', 'upper-back'] },
  SHRUG: { primary: ['trapezius'], secondary: ['forearm'] },
  TRICEPS_EXTENSION: { primary: ['triceps'], secondary: [] },
  CURL: { primary: ['biceps'], secondary: ['forearm'] },
  ROW: { primary: ['upper-back'], secondary: ['biceps', 'back-deltoids', 'trapezius', 'forearm'] },
  PULL_UP: { primary: ['upper-back'], secondary: ['biceps', 'forearm'] },
  DEADLIFT: { primary: ['gluteal', 'hamstring', 'lower-back'], secondary: ['quadriceps', 'trapezius', 'forearm'] },
  SQUAT: { primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductor', 'lower-back', 'abs'] },
  LUNGE: { primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductor', 'calves'] },
  CALF_RAISE: { primary: ['calves'], secondary: [] },
  LEG_CURL: { primary: ['hamstring'], secondary: ['calves'] },
  HIP_RAISE: { primary: ['gluteal'], secondary: ['hamstring'] },
  HIP_STABILITY: { primary: ['abductors', 'gluteal'], secondary: [] },
  HIP_SWING: { primary: ['gluteal', 'hamstring'], secondary: ['lower-back', 'abs'] },
  HYPEREXTENSION: { primary: ['lower-back'], secondary: ['gluteal', 'hamstring'] },
  PLANK: { primary: ['abs'], secondary: ['obliques', 'front-deltoids', 'lower-back', 'gluteal'] },
  CORE: { primary: ['abs', 'obliques'], secondary: ['lower-back'] },
  CRUNCH: { primary: ['abs'], secondary: ['obliques'] },
  SIT_UP: { primary: ['abs'], secondary: ['obliques'] },
  LEG_RAISE: { primary: ['abs'], secondary: ['obliques'] },
  CHOP: { primary: ['obliques'], secondary: ['abs', 'front-deltoids'] },
  CARRY: { primary: ['trapezius', 'forearm'], secondary: ['abs', 'obliques'] },
  OLYMPIC_LIFT: { primary: ['gluteal', 'quadriceps', 'trapezius'], secondary: ['hamstring', 'back-deltoids', 'lower-back'] },
  PLYO: { primary: ['quadriceps', 'calves', 'gluteal'], secondary: [] },
  TOTAL_BODY: { primary: ['quadriceps', 'gluteal', 'front-deltoids', 'abs'], secondary: [] },
};

/** Variations that change the muscles noticeably (matched on the sub-category). */
const REFINE = {
  // Romanian / stiff-leg: hamstrings and glutes, little quad
  DEADLIFT: [[/ROMANIAN|STIFF/, { primary: ['hamstring', 'gluteal'], secondary: ['lower-back', 'forearm'] }]],
};

function ruleFor(category, subCategory) {
  const key = category.toUpperCase();
  for (const [re, rule] of REFINE[key] ?? []) if (re.test(subCategory.toUpperCase())) return rule;
  return RULES[key] ?? null;
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/**
 * { scores: { muscleId: weightedSets }, matchedSets, unmatchedSets }.
 * Exercises Garmin could not name (UNKNOWN) or we have no rule for count as unmatched.
 */
export function muscleLoad(exercises) {
  const scores = {};
  let matchedSets = 0;
  let unmatchedSets = 0;
  for (const e of exercises ?? []) {
    const sets = num(e?.sets) > 0 ? e.sets : 1;
    const rule = ruleFor(String(e?.category ?? ''), String(e?.subCategory ?? ''));
    if (!rule) {
      unmatchedSets += sets;
      continue;
    }
    matchedSets += sets;
    for (const m of rule.primary) scores[m] = (scores[m] ?? 0) + sets;
    for (const m of rule.secondary) scores[m] = (scores[m] ?? 0) + sets * 0.5;
  }
  return { scores, matchedSets, unmatchedSets };
}

/** Colour level 1..`steps` per muscle, by share of the hardest-worked muscle. */
export function muscleLevels(scores, steps = 4) {
  const max = Math.max(0, ...Object.values(scores));
  if (!max) return {};
  return Object.fromEntries(
    Object.entries(scores).map(([m, v]) => [m, Math.min(steps, Math.max(1, Math.ceil((v / max) * steps)))]),
  );
}

const LABELS = {
  chest: 'Chest',
  'front-deltoids': 'Shoulders',
  'back-deltoids': 'Shoulders',
  trapezius: 'Traps',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  gluteal: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  calves: 'Calves',
  adductor: 'Inner thighs',
  abductors: 'Outer hips',
};

/** Muscle groups, hardest-worked first: [{ label, share }] with share 0..1. Front and back shoulders merge. */
export function rankedMuscles(scores) {
  const groups = {};
  for (const [m, v] of Object.entries(scores)) {
    const label = LABELS[m];
    if (label) groups[label] = Math.max(groups[label] ?? 0, v);
  }
  const max = Math.max(0, ...Object.values(groups));
  return Object.entries(groups)
    .map(([label, v]) => ({ label, share: max ? v / max : 0 }))
    .sort((a, b) => b.share - a.share);
}
