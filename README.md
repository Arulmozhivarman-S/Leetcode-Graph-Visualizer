# Graph Visualizer

A fast, zero-setup graph visualizer for LeetCode-style inputs. Paste an edge list, adjacency list, or adjacency matrix and see the graph rendered with a force-directed layout — no more manually typing out edges to reason about a problem.

**[Live demo](#)** · Built with React + D3

https://leetcode-graph-visualizer.vercel.app/

## Why

LeetCode graph problems hand you input as raw arrays (`edges = [[0,1],[1,2]]`, adjacency lists, `n x n` matrices), but there's no quick way to *see* the graph you're working with. Existing tools make you retype every edge by hand. This takes the array as-is and draws it.

## Features

- **Three input formats**, auto-parsed: edge list, adjacency list, adjacency matrix
- **Weighted / unweighted auto-detection** — triples in an edge list or non-`1` matrix entries are treated as weights
- **Directed / undirected toggle** — draws arrowheads and keeps `u→v` / `v→u` separate when directed
- **1-indexed input toggle** for edge lists that number nodes from 1
- **Interactive canvas** — drag nodes, scroll to zoom, drag the background to pan
- **Stable layout** — toggling options preserves node positions; only *Re-layout* re-simulates
- **Isolated-node support** via an optional node count (`n`)

## Supported input formats

| Format | Example | Notes |
| --- | --- | --- |
| Edge list | `[[0,1],[1,2],[2,0]]` | Pairs = unweighted |
| Weighted edge list | `[[0,1,4],[1,2,3]]` | Triples = `[u, v, weight]` |
| Adjacency list | `[[1,2],[0,2],[0,1]]` | Array index is the node id |
| Weighted adjacency list | `[[[1,4],[2,1]],[[0,4]]]` | Neighbors as `[node, weight]` |
| Adjacency matrix | `[[0,1,0],[1,0,1],[0,1,0]]` | `0` = no edge; all-`1` = unweighted |

Directed vs. undirected can't be inferred from the input (LeetCode never encodes it), so it stays a manual toggle.

## Getting started

```bash
git clone https://github.com/Arulmozhivarman-S/Leetcode-Graph-Visualizer.git
cd graph-visualizer
npm install
npm run dev
```

Open the printed localhost URL. To build for production:

```bash
npm run build
```

## Tech stack

- **React** — UI and state
- **D3** (`d3-force`, `d3-drag`, `d3-zoom`) — force simulation and interaction
- **Vite** — dev server and bundler

## How it works

The pipeline is three stages: parse → simulate → render.

**Parsing.** Each format is normalized into a shared `{ nodes, links }` shape. Edges are deduped by a canonical key — `min-max` for undirected graphs, `u->v` for directed — so a symmetric adjacency matrix doesn't produce doubled lines. Weights are detected during parsing rather than declared up front.

**Layout.** A `d3.forceSimulation` positions nodes with link, charge, centering, and collision forces. Node positions are cached in a ref keyed by node id, so changing options (directed, show-weights) reuses the existing layout instead of restarting the simulation — the graph doesn't jump around on every toggle.

**Rendering.** Nodes, edges, and weight labels are drawn as SVG and updated on each simulation tick. Edge endpoints are shortened by the node radius so arrowheads sit cleanly at the node boundary.

## Roadmap

- Traversal animation (BFS / Dijkstra) that colors nodes by visit order — turns the viewer into a debugger for traversal logic
- Grid mode for `grid[][]` problems where cells are implicit nodes with 4-directional edges
- Chrome extension that scrapes the active test case off the LeetCode page and injects a *Visualize* button next to Run/Submit

## License

MIT