//! ClearSolve preflop solver core — Rust compiled to wasm32 (raw cdylib, no
//! wasm-bindgen). Exports use the C ABI; arrays are marshalled through wasm linear
//! memory via `alloc_f64` / `free_f64` (added as the engine is ported). This module
//! is the future home of the CFR+ solver that today lives in TypeScript; the first
//! milestone is proving the Rust -> WASM -> app pipeline end to end.

use std::alloc::{alloc, dealloc, Layout};

mod equity;
mod evaluator;
mod rng;

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
