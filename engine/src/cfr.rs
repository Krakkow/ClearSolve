//! CFR+ preflop solver — a faithful port of `src/domain/betTree.ts` + `preflopCfr.ts`.
//! Same arithmetic and traversal order as the TS engine, so results match to f64 parity
//! given the same (config, equity, iterations, range weights).

use crate::equity::pair_weights;

const N: usize = 169;
#[allow(dead_code)] // the default lives in TS for now; JS passes the resolved edge
pub const DEFAULT_REALIZATION_EDGE: f64 = 0.085;

#[derive(Clone, Copy)]
pub struct Config {
    pub small_blind: f64,
    pub big_blind: f64,
    pub stack: f64,
    pub open_to: f64,
    pub three_bet_to: f64,
    pub four_bet_to: f64,
}

// Action kinds (parallel to ActionKind in betTree.ts): 0 fold, 1 call, 2 raise, 3 allin.
#[derive(Clone, Copy, PartialEq)]
enum AKind {
    Fold,
    Call,
    Raise,
    Allin,
}

#[derive(Clone, Copy)]
enum Outcome {
    Fold { folder: usize },
    ShowdownAllin,
    ShowdownPreflop,
}

struct Action {
    kind: AKind,
    contrib_to: f64,
}

// Flat arena node. Terminals carry an outcome; decisions carry actions + child indices.
struct Node {
    terminal: bool,
    // decision:
    decision_id: usize, // index into per-node CFR arrays (decisions only)
    label_code: u8,     // 0 SB Open, 1 BB vs Open, 2 SB vs 3-bet, 3 BB vs 4-bet, 4 SB vs 5-bet jam
    to_act: usize,      // 0 = SB, 1 = BB
    contrib: [f64; 2],
    actions: Vec<Action>,
    children: Vec<usize>,
    // terminal:
    outcome: Outcome,
}

struct Tree {
    nodes: Vec<Node>,
    root: usize,
    decision_order: Vec<usize>, // arena indices of decision nodes, in id order
}

struct Builder {
    nodes: Vec<Node>,
    next_id: usize,
    stack: f64,
}

impl Builder {
    fn raise_or_allin(&self, target: f64, current_max: f64, kind_label: AKind) -> Action {
        let _ = kind_label;
        if target >= self.stack || target <= current_max {
            Action { kind: AKind::Allin, contrib_to: self.stack }
        } else {
            Action { kind: AKind::Raise, contrib_to: target }
        }
    }

    fn terminal_fold(&mut self, contrib: [f64; 2], folder: usize) -> usize {
        let idx = self.nodes.len();
        self.nodes.push(Node {
            terminal: true, decision_id: 0, label_code: 0, to_act: 0,
            contrib, actions: vec![], children: vec![], outcome: Outcome::Fold { folder },
        });
        idx
    }

    fn terminal_showdown(&mut self, contrib: [f64; 2], outcome: Outcome) -> usize {
        let idx = self.nodes.len();
        self.nodes.push(Node {
            terminal: true, decision_id: 0, label_code: 0, to_act: 0,
            contrib, actions: vec![], children: vec![], outcome,
        });
        idx
    }

    // Create a decision node (id assigned now, before children — matches TS build order).
    fn new_decision(&mut self, to_act: usize, label_code: u8, contrib: [f64; 2]) -> (usize, usize) {
        let idx = self.nodes.len();
        let id = self.next_id;
        self.next_id += 1;
        self.nodes.push(Node {
            terminal: false, decision_id: id, label_code, to_act,
            contrib, actions: vec![], children: vec![], outcome: Outcome::ShowdownPreflop,
        });
        (idx, id)
    }
}

fn build_tree(cfg: &Config) -> Tree {
    let mut b = Builder { nodes: vec![], next_id: 0, stack: cfg.stack };
    let stack = cfg.stack;

    // Node: SB vs BB 5-bet jam — SB: FOLD / CALL.
    fn sb_vs_5bet(b: &mut Builder, contrib: [f64; 2], stack: f64) -> usize {
        let (idx, _) = b.new_decision(0, 4, contrib);
        let fold_c = contrib[0];
        let t1 = b.terminal_fold(contrib, 0);
        let t2 = b.terminal_showdown([stack, stack], Outcome::ShowdownAllin);
        b.nodes[idx].actions = vec![
            Action { kind: AKind::Fold, contrib_to: fold_c },
            Action { kind: AKind::Call, contrib_to: stack },
        ];
        b.nodes[idx].children = vec![t1, t2];
        idx
    }

    // Node: BB vs SB 4-bet — BB: FOLD / CALL / ALL-IN(5-bet jam).
    fn bb_vs_4bet(b: &mut Builder, contrib: [f64; 2], sb_contrib: f64, stack: f64) -> usize {
        let (idx, _) = b.new_decision(1, 3, contrib);
        let fold_c = contrib[1];
        let call_to = sb_contrib;
        let is_allin_call = sb_contrib >= stack;
        let t_fold = b.terminal_fold(contrib, 1);
        let t_call = b.terminal_showdown(
            [sb_contrib, call_to],
            if is_allin_call { Outcome::ShowdownAllin } else { Outcome::ShowdownPreflop },
        );
        let t_jam = sb_vs_5bet(b, [sb_contrib, stack], stack);
        b.nodes[idx].actions = vec![
            Action { kind: AKind::Fold, contrib_to: fold_c },
            Action { kind: AKind::Call, contrib_to: call_to },
            Action { kind: AKind::Allin, contrib_to: stack },
        ];
        b.nodes[idx].children = vec![t_fold, t_call, t_jam];
        idx
    }

    // Node: SB vs BB 3-bet — SB: FOLD / CALL / 4BET / ALL-IN.
    fn sb_vs_3bet(b: &mut Builder, contrib: [f64; 2], bb_contrib: f64, cfg: &Config) -> usize {
        let stack = cfg.stack;
        let (idx, _) = b.new_decision(0, 2, contrib);
        let fold_c = contrib[0];
        let call_to = bb_contrib;
        let is_allin_call = bb_contrib >= stack;
        let t_fold = b.terminal_fold(contrib, 0);
        let t_call = b.terminal_showdown(
            [call_to, bb_contrib],
            if is_allin_call { Outcome::ShowdownAllin } else { Outcome::ShowdownPreflop },
        );
        let four_bet = b.raise_or_allin(cfg.four_bet_to, bb_contrib, AKind::Raise);
        let four_to = four_bet.contrib_to;
        let t_4bet = bb_vs_4bet(b, [four_to, bb_contrib], four_to, stack);
        b.nodes[idx].actions = vec![
            Action { kind: AKind::Fold, contrib_to: fold_c },
            Action { kind: AKind::Call, contrib_to: call_to },
            four_bet,
        ];
        b.nodes[idx].children = vec![t_fold, t_call, t_4bet];
        idx
    }

    // Node: BB vs SB open — BB: FOLD / CALL / 3BET / ALL-IN.
    fn bb_vs_open(b: &mut Builder, contrib: [f64; 2], open_contrib: f64, cfg: &Config) -> usize {
        let stack = cfg.stack;
        let (idx, _) = b.new_decision(1, 1, contrib);
        let fold_c = contrib[1];
        let call_to = open_contrib;
        let is_allin_call = open_contrib >= stack;
        let t_fold = b.terminal_fold(contrib, 1);
        let t_call = b.terminal_showdown(
            [open_contrib, call_to],
            if is_allin_call { Outcome::ShowdownAllin } else { Outcome::ShowdownPreflop },
        );
        let three_bet = b.raise_or_allin(cfg.three_bet_to, open_contrib, AKind::Raise);
        let three_to = three_bet.contrib_to;
        let t_3bet = sb_vs_3bet(b, [open_contrib, three_to], three_to, cfg);
        b.nodes[idx].actions = vec![
            Action { kind: AKind::Fold, contrib_to: fold_c },
            Action { kind: AKind::Call, contrib_to: call_to },
            three_bet,
        ];
        b.nodes[idx].children = vec![t_fold, t_call, t_3bet];
        idx
    }

    // Root: SB open — SB: FOLD / OPEN / ALL-IN.
    let root_contrib = [cfg.small_blind, cfg.big_blind];
    let (root, _) = b.new_decision(0, 0, root_contrib);
    let fold_t = b.terminal_fold(root_contrib, 0);
    let open = b.raise_or_allin(cfg.open_to, cfg.big_blind, AKind::Raise);
    let open_to = open.contrib_to;
    let open_child = bb_vs_open(&mut b, [open_to, cfg.big_blind], open_to, cfg);
    let mut actions = vec![
        Action { kind: AKind::Fold, contrib_to: cfg.small_blind },
        open,
    ];
    let mut children = vec![fold_t, open_child];
    // ALL-IN (only if open wasn't already all-in)
    let open_is_allin = b.nodes[open_child].terminal; // not used; check the action kind instead
    let _ = open_is_allin;
    if actions[1].kind != AKind::Allin {
        let allin_child = bb_vs_open(&mut b, [stack, cfg.big_blind], stack, cfg);
        actions.push(Action { kind: AKind::Allin, contrib_to: stack });
        children.push(allin_child);
    }
    b.nodes[root].actions = actions;
    b.nodes[root].children = children;

    // Decision nodes in id order.
    let mut decision_order: Vec<usize> = (0..b.nodes.len()).filter(|&i| !b.nodes[i].terminal).collect();
    decision_order.sort_by_key(|&i| b.nodes[i].decision_id);

    Tree { nodes: b.nodes, root, decision_order }
}

#[inline]
fn terminal_sb_net(node: &Node, sb_class: usize, bb_class: usize, equity: &[f64], edge: f64) -> f64 {
    let c0 = node.contrib[0];
    let c1 = node.contrib[1];
    let pot = c0 + c1;
    match node.outcome {
        Outcome::Fold { folder } => {
            if folder == 0 { -c0 } else { c1 }
        }
        Outcome::ShowdownAllin => {
            let eq_sb = equity[sb_class * N + bb_class];
            eq_sb * pot - c0
        }
        Outcome::ShowdownPreflop => {
            let eq_sb = equity[sb_class * N + bb_class];
            eq_sb * pot - c0 + edge * pot
        }
    }
}

fn build_joint_prior(sb_w: Option<&[f64]>, bb_w: Option<&[f64]>) -> Vec<f64> {
    let mut joint = vec![0.0f64; N * N];
    let pw = pair_weights();
    let mut total = 0.0f64;
    for i in 0..N {
        let wi = sb_w.map_or(1.0, |w| w[i]);
        if wi <= 0.0 {
            continue;
        }
        for j in 0..N {
            let wj = bb_w.map_or(1.0, |w| w[j]);
            if wj <= 0.0 {
                continue;
            }
            let v = pw[i * N + j] * wi * wj;
            joint[i * N + j] = v;
            total += v;
        }
    }
    if total > 0.0 {
        for v in joint.iter_mut() {
            *v /= total;
        }
    }
    joint
}

pub struct NodeStrategy {
    pub label_code: u8,
    pub to_act: usize,
    pub action_kinds: Vec<u8>,
    pub strategy: Vec<f64>,      // N * n_actions (row-major by class)
    pub node_action_freq: Vec<f64>, // n_actions
    pub contrib: [f64; 2],
}

pub struct SolveResult {
    pub nodes: Vec<NodeStrategy>,
    pub iterations: usize,
    pub exploitability_bb: f64,
    pub ev_sb: f64,
}

pub struct Options {
    pub realization_edge: f64,
    pub sb_range: Option<Vec<f64>>,
    pub bb_range: Option<Vec<f64>>,
}

pub fn solve(cfg: &Config, equity: &[f64], iterations: usize, opts: &Options) -> SolveResult {
    let edge = opts.realization_edge;
    let tree = build_tree(cfg);
    let n_dec = tree.decision_order.len();

    // id -> position in decision_order (== decision_id, since we sorted by id).
    let mut id_to_pos = vec![0usize; n_dec];
    for (pos, &idx) in tree.decision_order.iter().enumerate() {
        id_to_pos[tree.nodes[idx].decision_id] = pos;
    }
    let n_actions: Vec<usize> = tree.decision_order.iter().map(|&idx| tree.nodes[idx].actions.len()).collect();

    let mut regret: Vec<Vec<f64>> = n_actions.iter().map(|&na| vec![0.0; N * na]).collect();
    let mut strat_sum: Vec<Vec<f64>> = n_actions.iter().map(|&na| vec![0.0; N * na]).collect();
    let mut cur: Vec<Vec<f64>> = n_actions.iter().map(|&na| vec![0.0; N * na]).collect();

    let joint = build_joint_prior(opts.sb_range.as_deref(), opts.bb_range.as_deref());

    let nodes = &tree.nodes;

    // regret-matching+ : recompute current strategy per node.
    let compute_strategies = |cur: &mut [Vec<f64>], regret: &[Vec<f64>]| {
        for d in 0..n_dec {
            let na = n_actions[d];
            let r = &regret[d];
            let s = &mut cur[d];
            for k in 0..N {
                let base = k * na;
                let mut sum = 0.0;
                for a in 0..na {
                    sum += r[base + a];
                }
                if sum > 0.0 {
                    for a in 0..na {
                        s[base + a] = r[base + a] / sum;
                    }
                } else {
                    let u = 1.0 / na as f64;
                    for a in 0..na {
                        s[base + a] = u;
                    }
                }
            }
        }
    };

    // Recursive CFR traversal returning SB net delta for fixed (i, j).
    fn traverse(
        node_idx: usize, i: usize, j: usize, reach0: f64, reach1: f64,
        nodes: &[Node], cur: &[Vec<f64>], regret: &mut [Vec<f64>], strat_sum: &mut [Vec<f64>],
        id_to_pos: &[usize], equity: &[f64], edge: f64,
    ) -> f64 {
        let node = &nodes[node_idx];
        if node.terminal {
            return terminal_sb_net(node, i, j, equity, edge);
        }
        let d = id_to_pos[node.decision_id];
        let na = node.actions.len();
        let is_sb = node.to_act == 0;
        let my_class = if is_sb { i } else { j };
        let my_reach = if is_sb { reach0 } else { reach1 };
        let opp_reach = if is_sb { reach1 } else { reach0 };
        let base = my_class * na;

        let mut child_vals = [0.0f64; 4];
        let mut node_val = 0.0;
        for a in 0..na {
            let p = cur[d][base + a];
            let nr0 = if is_sb { reach0 * p } else { reach0 };
            let nr1 = if is_sb { reach1 } else { reach1 * p };
            let v = traverse(node.children[a], i, j, nr0, nr1, nodes, cur, regret, strat_sum, id_to_pos, equity, edge);
            child_vals[a] = v;
            node_val += p * v;
        }
        let sign = if is_sb { 1.0 } else { -1.0 };
        let node_util = sign * node_val;
        for a in 0..na {
            let util = sign * child_vals[a];
            let mut r = regret[d][base + a] + opp_reach * (util - node_util);
            if r < 0.0 {
                r = 0.0;
            }
            regret[d][base + a] = r;
            strat_sum[d][base + a] += my_reach * cur[d][base + a];
        }
        node_val
    }

    for _t in 0..iterations {
        compute_strategies(&mut cur, &regret);
        for i in 0..N {
            for j in 0..N {
                let w = joint[i * N + j];
                if w == 0.0 {
                    continue;
                }
                traverse(tree.root, i, j, w, w, nodes, &cur, &mut regret, &mut strat_sum, &id_to_pos, equity, edge);
            }
        }
    }

    // ---- finalize: averaged strategies ----
    let mut avg: Vec<Vec<f64>> = Vec::with_capacity(n_dec);
    for d in 0..n_dec {
        let na = n_actions[d];
        let mut a = vec![0.0f64; N * na];
        for k in 0..N {
            let base = k * na;
            let mut sum = 0.0;
            for x in 0..na {
                sum += strat_sum[d][base + x];
            }
            if sum > 0.0 {
                for x in 0..na {
                    a[base + x] = strat_sum[d][base + x] / sum;
                }
            } else {
                let u = 1.0 / na as f64;
                for x in 0..na {
                    a[base + x] = u;
                }
            }
        }
        avg.push(a);
    }

    // reach-by-node-class under the average strategy (for node action frequencies).
    let mut reach_by_node: Vec<Vec<f64>> = (0..n_dec).map(|_| vec![0.0f64; N]).collect();
    fn accumulate_reach(
        node_idx: usize, i: usize, j: usize, reach_acting: f64, w: f64,
        nodes: &[Node], avg: &[Vec<f64>], id_to_pos: &[usize], reach_by_node: &mut [Vec<f64>],
    ) {
        let node = &nodes[node_idx];
        if node.terminal {
            return;
        }
        let d = id_to_pos[node.decision_id];
        let na = node.actions.len();
        let is_sb = node.to_act == 0;
        let my_class = if is_sb { i } else { j };
        reach_by_node[d][my_class] += w * reach_acting;
        let base = my_class * na;
        for a in 0..na {
            let p = avg[d][base + a];
            accumulate_reach(node.children[a], i, j, reach_acting * p, w, nodes, avg, id_to_pos, reach_by_node);
        }
    }
    for i in 0..N {
        for j in 0..N {
            let w = joint[i * N + j];
            if w != 0.0 {
                accumulate_reach(tree.root, i, j, 1.0, w, nodes, &avg, &id_to_pos, &mut reach_by_node);
            }
        }
    }

    let mut out_nodes: Vec<NodeStrategy> = Vec::with_capacity(n_dec);
    for d in 0..n_dec {
        let node = &nodes[tree.decision_order[d]];
        let na = n_actions[d];
        let reach = &reach_by_node[d];
        let mut node_action_freq = vec![0.0f64; na];
        let mut reach_total = 0.0;
        for k in 0..N {
            let rw = reach[k];
            reach_total += rw;
            let base = k * na;
            for a in 0..na {
                node_action_freq[a] += rw * avg[d][base + a];
            }
        }
        if reach_total > 0.0 {
            for a in 0..na {
                node_action_freq[a] /= reach_total;
            }
        }
        out_nodes.push(NodeStrategy {
            label_code: node.label_code,
            to_act: node.to_act,
            action_kinds: node.actions.iter().map(|a| match a.kind {
                AKind::Fold => 0, AKind::Call => 1, AKind::Raise => 2, AKind::Allin => 3,
            }).collect(),
            strategy: avg[d].clone(),
            node_action_freq,
            contrib: node.contrib,
        });
    }

    let ev_sb = compute_root_ev(&tree, &avg, &id_to_pos, equity, &joint, edge);
    let expl = compute_exploitability(&tree, &avg, &id_to_pos, equity, &joint, edge);

    SolveResult { nodes: out_nodes, iterations, exploitability_bb: expl, ev_sb }
}

fn node_val_avg(
    node_idx: usize, i: usize, j: usize,
    nodes: &[Node], avg: &[Vec<f64>], id_to_pos: &[usize], equity: &[f64], edge: f64,
) -> f64 {
    let node = &nodes[node_idx];
    if node.terminal {
        return terminal_sb_net(node, i, j, equity, edge);
    }
    let d = id_to_pos[node.decision_id];
    let na = node.actions.len();
    let my_class = if node.to_act == 0 { i } else { j };
    let base = my_class * na;
    let mut v = 0.0;
    for a in 0..na {
        v += avg[d][base + a] * node_val_avg(node.children[a], i, j, nodes, avg, id_to_pos, equity, edge);
    }
    v
}

fn compute_root_ev(
    tree: &Tree, avg: &[Vec<f64>], id_to_pos: &[usize], equity: &[f64], joint: &[f64], edge: f64,
) -> f64 {
    let mut ev = 0.0;
    for i in 0..N {
        for j in 0..N {
            let w = joint[i * N + j];
            if w != 0.0 {
                ev += w * node_val_avg(tree.root, i, j, &tree.nodes, avg, id_to_pos, equity, edge);
            }
        }
    }
    ev
}

fn best_response_value(
    tree: &Tree, avg: &[Vec<f64>], id_to_pos: &[usize], equity: &[f64], joint: &[f64], hero: usize, edge: f64,
) -> f64 {
    let sign = if hero == 0 { 1.0 } else { -1.0 };

    fn val(
        node_idx: usize, i: usize, opp_w: &[f64],
        nodes: &[Node], avg: &[Vec<f64>], id_to_pos: &[usize], equity: &[f64], hero: usize, sign: f64, edge: f64,
    ) -> f64 {
        let node = &nodes[node_idx];
        if node.terminal {
            let mut total = 0.0;
            for j in 0..N {
                let w = opp_w[j];
                if w == 0.0 {
                    continue;
                }
                let (sb_class, bb_class) = if hero == 0 { (i, j) } else { (j, i) };
                let sb_net = terminal_sb_net(node, sb_class, bb_class, equity, edge);
                total += w * sign * sb_net;
            }
            return total;
        }
        let d = id_to_pos[node.decision_id];
        let na = node.actions.len();
        if node.to_act == hero {
            let mut best = f64::NEG_INFINITY;
            for a in 0..na {
                let v = val(node.children[a], i, opp_w, nodes, avg, id_to_pos, equity, hero, sign, edge);
                if v > best {
                    best = v;
                }
            }
            return best;
        }
        let mut total = 0.0;
        for a in 0..na {
            let mut child_w = vec![0.0f64; N];
            for j in 0..N {
                let w = opp_w[j];
                child_w[j] = if w == 0.0 { 0.0 } else { w * avg[d][j * na + a] };
            }
            total += val(node.children[a], i, &child_w, nodes, avg, id_to_pos, equity, hero, sign, edge);
        }
        total
    }

    let mut total = 0.0;
    for i in 0..N {
        let mut root_w = vec![0.0f64; N];
        for j in 0..N {
            root_w[j] = if hero == 0 { joint[i * N + j] } else { joint[j * N + i] };
        }
        total += val(tree.root, i, &root_w, &tree.nodes, avg, id_to_pos, equity, hero, sign, edge);
    }
    total
}

fn compute_exploitability(
    tree: &Tree, avg: &[Vec<f64>], id_to_pos: &[usize], equity: &[f64], joint: &[f64], edge: f64,
) -> f64 {
    let br_sb = best_response_value(tree, avg, id_to_pos, equity, joint, 0, edge);
    let br_bb = best_response_value(tree, avg, id_to_pos, equity, joint, 1, edge);
    (br_sb + br_bb).max(0.0)
}
