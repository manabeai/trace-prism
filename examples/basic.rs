// ローカルの cargo run では送信し、単体ソースの提出時は依存なしで無効化する。
#[cfg(feature = "viz")] use traceprism::record;
#[cfg(not(feature = "viz"))] macro_rules! record {
    ([$($span:expr),*], from: $from:expr, $($name:ident),+) => {{ let _ = &$from; () }};
    ($($tokens:tt)*) => { () };
}

use std::collections::{BTreeMap, BTreeSet};

fn main() {
    let mut count = 0;
    let mut values = vec![3, 1, 4];
    let mut active = BTreeSet::from([1, 3]);
    let mut scores = BTreeMap::from([("alpha", 2), ("beta", 1)]);
    let origin = record!([], count, values, active, scores);
    for i in 0..3 {
        count += 1;
        values[i] += count;
        active.insert(i);
        scores.insert("alpha", count);
        record!([i], from: origin, count, values, active, scores);
    }
    println!("{}", values.iter().sum::<i32>());
}
