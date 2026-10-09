// Serialize した構造体を、フィールドを保った record 値として記録する例。
#[cfg(feature = "viz")]
use traceprism::record;
#[cfg(not(feature = "viz"))]
macro_rules! record {
    ($($tokens:tt)*) => {
        ()
    };
}

#[cfg_attr(feature = "viz", derive(serde::Serialize))]
struct LazySegTree {
    len: usize,
    sum: Vec<i64>,
    lazy: Vec<i64>,
}

impl LazySegTree {
    fn new(values: &[i64]) -> Self {
        let mut tree = Self {
            len: values.len(),
            sum: vec![0; values.len() * 4],
            lazy: vec![0; values.len() * 4],
        };
        tree.build(1, 0, values.len(), values);
        tree
    }

    fn build(&mut self, node: usize, left: usize, right: usize, values: &[i64]) {
        if right - left == 1 {
            self.sum[node] = values[left];
            return;
        }
        let middle = (left + right) / 2;
        self.build(node * 2, left, middle, values);
        self.build(node * 2 + 1, middle, right, values);
        self.sum[node] = self.sum[node * 2] + self.sum[node * 2 + 1];
    }

    fn range_add(&mut self, from: usize, to: usize, amount: i64) {
        self.add(1, 0, self.len, from, to, amount);
    }

    fn add(&mut self, node: usize, left: usize, right: usize, from: usize, to: usize, amount: i64) {
        if to <= left || right <= from {
            return;
        }
        if from <= left && right <= to {
            self.sum[node] += amount * (right - left) as i64;
            self.lazy[node] += amount;
            return;
        }
        let middle = (left + right) / 2;
        self.add(node * 2, left, middle, from, to, amount);
        self.add(node * 2 + 1, middle, right, from, to, amount);
        self.sum[node] =
            self.sum[node * 2] + self.sum[node * 2 + 1] + self.lazy[node] * (right - left) as i64;
    }
}

fn main() {
    let mut tree = LazySegTree::new(&[2, 1, 3, 4]);
    record!([], tree);

    tree.range_add(1, 4, 2);
    record!([1], tree);

    tree.range_add(0, 2, 3);
    record!([2], tree);

    println!("{}", tree.sum[1]);
}
