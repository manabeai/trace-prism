// DFS の呼び出し木を頂点IDと from で記録する例。
#[cfg(feature = "viz")]
use traceprism::record;
#[cfg(not(feature = "viz"))]
macro_rules! record {
    ($($tokens:tt)*) => {
        ()
    };
}

fn dfs_children(
    u: usize,
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
        record!([v], from: u, adjacency, seen, order, u = v);
        dfs_children(v, adjacency, seen, order);
    }
}

fn main() {
    let adjacency = vec![vec![1, 2], vec![3, 4], vec![5], vec![], vec![5], vec![]];
    let mut seen = vec![false; adjacency.len()];
    let mut order = vec![0];
    seen[0] = true;
    record!([0], adjacency, seen, order, u = 0);
    dfs_children(0, &adjacency, &mut seen, &mut order);
    println!(
        "{}",
        order
            .iter()
            .map(usize::to_string)
            .collect::<Vec<_>>()
            .join(" ")
    );
}
