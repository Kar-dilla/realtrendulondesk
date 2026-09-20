// Jest (SWC) strips types, so a normal test can't prove type correctness.
// These tests invoke the real TypeScript compiler on generated fixtures.
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tsc = path.resolve(__dirname, '../node_modules/typescript/bin/tsc');
const typesPath = path.resolve(__dirname, '../lib/shared-store/types').replace(/\\/g, '/');

function compile(source: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsc-'));
  const file = path.join(dir, 'fixture.ts');
  fs.writeFileSync(file, `import type * as T from '${typesPath}';\n${source}`);
  return spawnSync('node', [tsc, '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2019', '--moduleResolution', 'node', file], { encoding: 'utf8' });
}

describe('shared-store types (real tsc)', () => {
  it('accepts valid shapes', () => {
    const r = compile(`
      const s: T.Story = { id: '1', headline: 'h', discoveredAt: '2026-01-01', sourceUrls: [] };
      const c: T.VerifiedClaim = { storyId: '1', claim: 'x', tier: 'CONFIRMED' };
      const r: T.RankedStory = { storyId: '1' };
      const b: T.StoryBrief = { storyId: '1' };
      const sc: T.Script = { id: 's', storyId: '1' };
      const v: T.VisualAsset = { id: 'v', storyId: '1' };
      const p: T.PublishRecord = { storyId: '1' };
      const d: T.PerformanceData = { storyId: '1' };
      const e: T.EditorialInsight = { id: 'i' };
      export {s,c,r,b,sc,v,p,d,e};
    `);
    expect(r.stderr + r.stdout).toBe('');
    expect(r.status).toBe(0);
  });

  it('rejects an invalid verification tier', () => {
    const r = compile(`const c: T.VerifiedClaim = { storyId: '1', claim: 'x', tier: 'MAYBE' }; export {c};`);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/TS2322/);
  });

  it('rejects a Story missing required fields', () => {
    const r = compile(`const s: T.Story = { id: '1' }; export {s};`);
    expect(r.status).not.toBe(0);
  });
});
