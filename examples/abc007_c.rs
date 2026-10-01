// AtCoder Beginner Contest 007 C: https://atcoder.jp/contests/abc007/tasks/abc007_3
#[cfg(feature = "viz")]
use algo_vis::record;
#[cfg(not(feature = "viz"))]
macro_rules! record { ($($tokens:tt)*) => { () }; }

use std::collections::VecDeque;
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut words = input.split_whitespace();
    let rows: usize = words.next().unwrap().parse().unwrap();
    let cols: usize = words.next().unwrap().parse().unwrap();
    let sy: usize = words.next().unwrap().parse::<usize>().unwrap() - 1;
    let sx: usize = words.next().unwrap().parse::<usize>().unwrap() - 1;
    let gy: usize = words.next().unwrap().parse::<usize>().unwrap() - 1;
    let gx: usize = words.next().unwrap().parse::<usize>().unwrap() - 1;
    let board: Vec<Vec<u8>> = (0..rows).map(|_| words.next().unwrap().bytes().map(|cell| u8::from(cell == b'#')).collect()).collect();

    let mut dist = vec![vec![-1_i32; cols]; rows];
    dist[sy][sx] = 0;
    let mut queue = VecDeque::from([(sy, sx)]);
    let _start = [sy, sx];
    let origin = record!([], board, dist, queue, pos = _start);
    let mut parent = vec![vec![origin; cols]; rows];

    while let Some((y, x)) = queue.pop_front() {
        let _pos = [y, x];
        let _visit = record!([dist[y][x], y, x], from: parent[y][x], dist, queue, pos = _pos);
        if (y, x) == (gy, gx) { break; }
        for (dy, dx) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
            let ny = y as isize + dy;
            let nx = x as isize + dx;
            if ny < 0 || nx < 0 || ny >= rows as isize || nx >= cols as isize { continue; }
            let (ny, nx) = (ny as usize, nx as usize);
            if board[ny][nx] == 1 || dist[ny][nx] != -1 { continue; }
            dist[ny][nx] = dist[y][x] + 1;
            queue.push_back((ny, nx));
            let _pos = [ny, nx];
            parent[ny][nx] = record!([dist[ny][nx], ny, nx], from: _visit, dist, queue, pos = _pos);
        }
    }

    println!("{}", dist[gy][gx]);
}
