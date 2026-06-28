//! ClearSolve preflop solver core — Rust compiled to wasm32 (raw cdylib, no
//! wasm-bindgen). Exports use the C ABI; arrays are marshalled through wasm linear
//! memory via `alloc_f64` / `free_f64` (added as the engine is ported). This module
//! is the future home of the CFR+ solver that today lives in TypeScript; the first
//! milestone is proving the Rust -> WASM -> app pipeline end to end.

use std::alloc::{alloc, dealloc, Layout};

mod cfr;
mod equity;
mod evaluator;
mod rng;

/// Solve a preflop bet tree (CFR+). Writes a flat f64 result buffer to `out_ptr` and
/// returns the number of f64 produced. Layout:
///   [num_nodes, ev_sb, exploitability_bb, iterations]
///   then per node: [label_code, to_act, n_actions, contrib0, contrib1,
///                   action_kinds(n_actions), node_action_freq(n_actions), strategy(169*n_actions)]
/// `cfg_ptr` -> 6 f64 [smallBlind, bigBlind, stack, openTo, threeBetTo, fourBetTo].
/// `sb_range_ptr`/`bb_range_ptr` -> 169 f64 or null. `equity_ptr` -> 169*169 f64.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn solve_preflop_tree(
    equity_ptr: *const f64,
    cfg_ptr: *const f64,
    iterations: u32,
    edge: f64,
    sb_range_ptr: *const f64,
    bb_range_ptr: *const f64,
    out_ptr: *mut f64,
    out_cap: usize,
) -> usize {
    if equity_ptr.is_null() || cfg_ptr.is_null() || out_ptr.is_null() {
        return 0;
    }
    let equity = unsafe { std::slice::from_raw_parts(equity_ptr, 169 * 169) };
    let c = unsafe { std::slice::from_raw_parts(cfg_ptr, 6) };
    let cfg = cfr::Config {
        small_blind: c[0], big_blind: c[1], stack: c[2],
        open_to: c[3], three_bet_to: c[4], four_bet_to: c[5],
    };
    let sb_range = if sb_range_ptr.is_null() {
        None
    } else {
        Some(unsafe { std::slice::from_raw_parts(sb_range_ptr, 169) }.to_vec())
    };
    let bb_range = if bb_range_ptr.is_null() {
        None
    } else {
        Some(unsafe { std::slice::from_raw_parts(bb_range_ptr, 169) }.to_vec())
    };
    let opts = cfr::Options { realization_edge: edge, sb_range, bb_range };
    let res = cfr::solve(&cfg, equity, iterations as usize, &opts);

    let mut buf: Vec<f64> = Vec::new();
    buf.push(res.nodes.len() as f64);
    buf.push(res.ev_sb);
    buf.push(res.exploitability_bb);
    buf.push(res.iterations as f64);
    for node in &res.nodes {
        buf.push(node.label_code as f64);
        buf.push(node.to_act as f64);
        buf.push(node.action_kinds.len() as f64);
        buf.push(node.contrib[0]);
        buf.push(node.contrib[1]);
        for &k in &node.action_kinds {
            buf.push(k as f64);
        }
        for &f in &node.node_action_freq {
            buf.push(f);
        }
        for &s in &node.strategy {
            buf.push(s);
        }
    }
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, out_cap) };
    let nn = buf.len().min(out_cap);
    out[..nn].copy_from_slice(&buf[..nn]);
    buf.len()
}

/// Evaluate the best 5-card hand from 7 card ids (0..51). Returns the same packed
/// score as the TS `evaluate7`, so Rust and TS agree bit-for-bit.
#[no_mangle]
pub extern "C" fn eval7(a: u32, b: u32, c: u32, d: u32, e: u32, f: u32, g: u32) -> i32 {
    evaluator::evaluate7([a, b, c, d, e, f, g])
}

/// Build the 169x169 all-in equity matrix into `out` (caller allocs 169*169 f64 via
/// `alloc_f64`). Bit-identical to the TS `buildEquityMatrix(samples, seed)`.
#[no_mangle]
pub extern "C" fn build_equity_matrix(out: *mut f64, samples: u32, seed: u32) {
    if out.is_null() {
        return;
    }
    let m = unsafe { std::slice::from_raw_parts_mut(out, 169 * 169) };
    equity::build(m, samples as usize, seed);
}

/// Minimal interop proof: a pure numeric export.
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// Engine version encoded as an integer (major*10000 + minor*100 + patch).
#[no_mangle]
pub extern "C" fn engine_version() -> i32 {
    100 // 0.1.0
}

/// Sum a slice of f64 living in wasm memory — exercises the memory-marshalling path
/// the real solver will use (pass a pointer + length from JS to a Float64Array view).
#[no_mangle]
pub extern "C" fn sum_f64(ptr: *const f64, len: usize) -> f64 {
    if ptr.is_null() || len == 0 {
        return 0.0;
    }
    let slice = unsafe { std::slice::from_raw_parts(ptr, len) };
    slice.iter().sum()
}

/// Allocate `len` f64 in wasm memory and return the pointer (JS writes into the view).
#[no_mangle]
pub extern "C" fn alloc_f64(len: usize) -> *mut f64 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let layout = Layout::array::<f64>(len).unwrap();
    unsafe { alloc(layout) as *mut f64 }
}

/// Free a buffer previously returned by `alloc_f64`.
#[no_mangle]
pub extern "C" fn free_f64(ptr: *mut f64, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    let layout = Layout::array::<f64>(len).unwrap();
    unsafe { dealloc(ptr as *mut u8, layout) }
}
