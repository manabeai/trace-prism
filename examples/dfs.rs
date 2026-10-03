// DFS の呼び出し木を from で記録する例。Graph は入力グラフの辺ではなく記録間の遷移を示す。
#[cfg(feature = "viz")]
use algo_vis::{record, FrameRef};
#[cfg(not(feature = "viz"))]
macro_rules! record { ($($tokens:tt)*) => { () }; }
#[cfg(not(feature = "viz"))]
type FrameRef = ();

fn dfs_children(
    u: usize,
    depth: usize,
    _parent: FrameRef,
    adjacency: &Vec<Vec<usize>>,
    seen: &mut Vec<bool>,
    order: &mut Vec<usize>,
) {
    for &v in &adjacency[u] {
        if seen[v] {
            continue;
        }
        seen[v] = true;
        order.push(v);
        let visit = record!([depth + 1, v], from: _parent, adjacency, seen, order, u = v);
        dfs_children(v, depth + 1, visit, adjacency, seen, order);
    }
}

fn main() {
    let adjacency = vec![vec![1, 2], vec![3, 4], vec![5], vec![], vec![5], vec![]];
    let mut seen = vec![false; adjacency.len()];
    let mut order = vec![0];
    seen[0] = true;
    let root = record!([0, 0], adjacency, seen, order, u = 0);
    dfs_children(0, 0, root, &adjacency, &mut seen, &mut order);
    println!("{}", order.iter().map(usize::to_string).collect::<Vec<_>>().join(" "));
}
