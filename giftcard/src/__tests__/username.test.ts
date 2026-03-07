import { describe, it, expect } from 'vitest';
import { isValidUsername } from '../hive/username.js';

describe('isValidUsername', () => {
  // -- Valid usernames --
  it('accepts a standard 3-char username', () => {
    expect(isValidUsername('abc')).toBeNull();
  });

  it('accepts a typical username', () => {
    expect(isValidUsername('demotruktest27')).toBeNull();
  });

  it('accepts a 16-char username (max length)', () => {
    expect(isValidUsername('abcdefghijklmnop')).toBeNull();
  });

  it('accepts username with hyphens', () => {
    expect(isValidUsername('hive-user-test')).toBeNull();
  });

  it('accepts username with dots separating 3+ char segments', () => {
    expect(isValidUsername('abc.def')).toBeNull();
  });

  it('accepts username with digits', () => {
    expect(isValidUsername('user123')).toBeNull();
  });

  // -- Invalid usernames --
  it('rejects empty string', () => {
    expect(isValidUsername('')).toBe('Username required');
  });

  it('rejects uppercase letters', () => {
    expect(isValidUsername('ABC')).toBe('Username must be lowercase');
  });

  it('rejects mixed case', () => {
    expect(isValidUsername('Hello')).toBe('Username must be lowercase');
  });

  it('rejects username shorter than 3 characters', () => {
    expect(isValidUsername('ab')).toBe('Username must be at least 3 characters');
  });

  it('rejects username longer than 16 characters', () => {
    expect(isValidUsername('abcdefghijklmnopq')).toBe('Username must be 16 characters or fewer');
  });

  it('rejects username starting with a digit', () => {
    expect(isValidUsername('1abc')).toBe('Username must start with a letter');
  });

  it('rejects username starting with a hyphen', () => {
    expect(isValidUsername('-abc')).toBe('Username must start with a letter');
  });

  it('rejects username starting with a dot', () => {
    expect(isValidUsername('.abc')).toBe('Username must start with a letter');
  });

  it('rejects invalid characters (underscore)', () => {
    expect(isValidUsername('abc_def')).toBe('Username may only contain lowercase letters, digits, hyphens, and dots');
  });

  it('rejects invalid characters (space)', () => {
    expect(isValidUsername('abc def')).toBe('Username may only contain lowercase letters, digits, hyphens, and dots');
  });

  it('rejects trailing hyphen', () => {
    expect(isValidUsername('abc-')).toBe('Username must not end with a hyphen or dot');
  });

  it('rejects trailing dot', () => {
    expect(isValidUsername('abc.')).toBe('Username must not end with a hyphen or dot');
  });

  it('rejects consecutive dots', () => {
    expect(isValidUsername('abc..def')).toBe('Username must not contain consecutive dots');
  });

  it('rejects consecutive hyphens', () => {
    expect(isValidUsername('abc--def')).toBe('Username must not contain consecutive hyphens');
  });

  it('rejects dot-separated segment shorter than 3 chars', () => {
    const result = isValidUsername('abc.de');
    expect(result).toContain('too short');
  });

  it('rejects single-char segment', () => {
    const result = isValidUsername('abc.d');
    expect(result).toContain('too short');
  });
});
