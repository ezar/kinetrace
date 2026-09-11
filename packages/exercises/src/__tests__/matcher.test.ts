import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../library/index.js';
import { levenshtein, libraryIndex, matchExercise, normalize, similarity } from '../matcher.js';

describe('normalize', () => {
  it('strips accents, punctuation and case', () => {
    expect(normalize('Báscula Pélvica, 3x10')).toBe('bascula pelvica 3x10');
  });
});

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('plancha', 'plancha')).toBe(0);
    expect(levenshtein('plancha', 'planchas')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('similarity', () => {
  it('scores a contained name highly', () => {
    expect(similarity('3x12 puente de glúteos', 'puente de glúteos')).toBeGreaterThan(0.8);
  });
});

describe('matchExercise', () => {
  it('matches Spanish sheet lines', () => {
    expect(matchExercise('Puente de glúteos', EXERCISES)?.exerciseId).toBe('glute-bridge');
    expect(matchExercise('plancha frontal', EXERCISES)?.exerciseId).toBe('front-plank');
    expect(matchExercise('gato-vaca', EXERCISES)?.exerciseId).toBe('cat-camel');
  });

  it('matches English sheet lines', () => {
    expect(matchExercise('bird dog', EXERCISES)?.exerciseId).toBe('bird-dog');
    expect(matchExercise('forearm plank', EXERCISES)?.exerciseId).toBe('front-plank');
  });

  it('tolerates typos', () => {
    expect(matchExercise('sentadila', EXERCISES)?.exerciseId).toBe('bodyweight-squat');
  });

  it('returns null rather than guessing', () => {
    expect(matchExercise('natación 20 minutos', EXERCISES)).toBeNull();
    expect(matchExercise('', EXERCISES)).toBeNull();
  });
});

describe('libraryIndex', () => {
  it('exposes ids, both names and the synonyms for the import prompt', () => {
    const index = libraryIndex(EXERCISES);
    expect(index).toHaveLength(EXERCISES.length);
    expect(index[0]).toHaveProperty('synonyms');
  });
});
