#[cfg(feature = "viz")]
use algo_vis::record;
#[cfg(not(feature = "viz"))]
macro_rules! record { ($($tokens:tt)*) => { () }; }

fn main() {
    let a = vec![2, 5, 8, 11, 15];
    let target = 10;
    let (mut left, mut right) = (0, a.len());
    let mut mid = 0;
    let mut ok = false;
    let origin = record!([], a, target, left, right, mid, ok);

    let mut iteration = 0;
    while left < right {
        mid = (left + right) / 2;
        ok = a[mid] >= target;
        let compared = record!([iteration], from: origin, left, right, mid, ok);
        if ok { right = mid; } else { left = mid + 1; }
        record!([iteration, 1], from: compared, left, right);
        iteration += 1;
    }
    println!("{left}");
}
