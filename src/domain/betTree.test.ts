import { describe, it, expect } from 'vitest';
import { buildBetTree, DEFAULT_SIZES, type DecisionNode, type TreeNode } from './betTree';

function cfg(stack: number) {
  return {
    smallBlind: DEFAULT_SIZES.smallBlind,
    bigBlind: DEFAULT_SIZES.bigBlind,
    stack,
    openTo: DEFAULT_SIZES.openTo,
    threeBetTo: DEFAULT_SIZES.threeBetTo,
    fourBetTo: DEFAULT_SIZES.fourBetTo,
  };
}

function walk(node: TreeNode, visit: (n: DecisionNode) => void) {
  if (node.kind === 'terminal') return;
  visit(node);
  for (const c of node.children) walk(c, visit);
}

describe('bet tree structure', () => {
  it('root is SB Open with Fold / Open / All-in at 100bb', () => {
    const tree = buildBetTree(cfg(100));
    expect(tree.root.label).toBe('SB Open');
    expect(tree.root.toAct).toBe(0);
    const labels = tree.root.actions.map((a) => a.label);
    expect(labels).toContain('Fold');
    expect(labels.some((l) => l.startsWith('Open'))).toBe(true);
    expect(labels).toContain('All-in');
  });

  it('every action has a parallel child', () => {
    const tree = buildBetTree(cfg(100));
    walk(tree.root, (n) => {
      expect(n.actions.length).toBe(n.children.length);
      expect(n.actions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('contributions never exceed the stack', () => {
    const tree = buildBetTree(cfg(100));
    walk(tree.root, (n) => {
      for (const a of n.actions) expect(a.contribTo).toBeLessThanOrEqual(100 + 1e-9);
    });
  });

  it('clamps to jam/fold at short stacks (open >= stack)', () => {
    // At 2bb, an open-to-2.5 exceeds the stack -> SB open becomes all-in, so the
    // SB root degenerates to Fold / All-in (push/fold shape).
    const tree = buildBetTree(cfg(2));
    const labels = tree.root.actions.map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(['Fold', 'All-in']));
    // No separate non-all-in "Open" action remains.
    expect(labels.some((l) => l.startsWith('Open'))).toBe(false);
  });

  it('deep stacks keep a full multi-action tree', () => {
    const tree = buildBetTree(cfg(100));
    // Expect distinct decision nodes for: SB open, BB vs open, SB vs 3bet,
    // BB vs 4bet, SB vs 5bet jam (some appear twice via open vs jam lines).
    const labelSet = new Set(tree.decisionNodes.map((n) => n.label));
    expect(labelSet).toContain('SB Open');
    expect(labelSet).toContain('BB vs Open');
    expect(labelSet).toContain('SB vs 3-bet');
    expect(labelSet).toContain('BB vs 4-bet');
    expect(labelSet).toContain('SB vs 5-bet jam');
  });
});
