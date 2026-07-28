import { describe, it, expect } from 'vitest';
import { modelLabel, modelSuffix } from './modelLabel';

describe('modelLabel', () => {
  it('nombra los tres modelos del panel actual', () => {
    expect(modelLabel('gpt-5')).toBe('GPT-5');
    expect(modelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
    expect(modelLabel('claude-sonnet-5')).toBe('Claude Sonnet 5');
  });

  it('devuelve vacio cuando la evaluacion no registro modelo', () => {
    // Evaluaciones anteriores al panel multi-modelo (2026-07-15).
    expect(modelLabel(undefined)).toBe('');
    expect(modelLabel('')).toBe('');
    expect(modelLabel('   ')).toBe('');
  });

  it('no deja en blanco un modelo que todavia no esta en la tabla', () => {
    expect(modelLabel('gpt-5.6-luna')).toBe('GPT 5.6 Luna');
    expect(modelLabel('claude-sonnet-4-6')).toBe('Claude Sonnet 4.6');
  });
});

describe('modelSuffix', () => {
  it('envuelve en parentesis con espacio adelante', () => {
    expect(modelSuffix('claude-sonnet-5')).toBe(' (Claude Sonnet 5)');
  });

  it('no dibuja parentesis vacios', () => {
    expect(modelSuffix(undefined)).toBe('');
  });
});
