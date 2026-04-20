/**
 * Pathfinding — A* grid-based pathfinding using EasyStar.js.
 * The world is divided into a grid; walkable tiles are marked.
 * Agents request paths and receive waypoint arrays.
 */

import Phaser from 'phaser';
import EasyStar from 'easystarjs';

const TILE_SIZE = 48;
const GRID_W = 27;  // 1280 / 48 ≈ 27
const GRID_H = 15;  // 720 / 48 = 15

export class Pathfinder {
  constructor() {
    this.easystar = new EasyStar.js();
    this.grid = this.buildGrid();
    this.easystar.setGrid(this.grid);
    this.easystar.setAcceptableTiles([0]);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  /**
   * Build walkability grid. 0 = walkable, 1 = blocked.
   * Trees and stones form the perimeter; clearing is open.
   */
  buildGrid() {
    const grid = [];
    for (let row = 0; row < GRID_H; row++) {
      const rowData = [];
      for (let col = 0; col < GRID_W; col++) {
        // Border trees
        if (row === 0 || row === GRID_H - 1 || col === 0 || col === GRID_W - 1) {
          rowData.push(1);
        }
        // Second ring — sparse trees
        else if ((row === 1 || row === GRID_H - 2) && Math.random() < 0.6) {
          rowData.push(1);
        }
        else if ((col === 1 || col === GRID_W - 2) && Math.random() < 0.6) {
          rowData.push(1);
        }
        // Interior scattered obstacles
        else if (Math.random() < 0.04) {
          rowData.push(1);
        }
        else {
          rowData.push(0);
        }
      }
      grid.push(rowData);
    }
    // Ensure station areas and meeting room are clear
    this.clearArea(grid, 6, 4, 2);    // Mina's desk area (320/48 ≈ 6, 200/48 ≈ 4)
    this.clearArea(grid, 20, 4, 2);   // James's station (960/48 ≈ 20, 180/48 ≈ 4)
    this.clearArea(grid, 4, 10, 2);   // Carl's desk (200/48 ≈ 4, 500/48 ≈ 10)
    this.clearArea(grid, 16, 10, 2);  // Larry's spot (800/48 ≈ 16, 480/48 ≈ 10)
    this.clearArea(grid, 12, 9, 3);   // Conference area (580/48 ≈ 12, 420/48 ≈ 9)
    return grid;
  }

  clearArea(grid, cx, cy, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const r = cy + dy;
        const c = cx + dx;
        if (r >= 0 && r < GRID_H && c >= 0 && c < GRID_W) {
          grid[r][c] = 0;
        }
      }
    }
  }

  /**
   * Find a path from world coords to world coords.
   * Returns a promise that resolves to an array of {x, y} world positions.
   */
  findPath(fromX, fromY, toX, toY) {
    return new Promise((resolve) => {
      const startCol = Math.floor(fromX / TILE_SIZE);
      const startRow = Math.floor(fromY / TILE_SIZE);
      const endCol = Phaser.Math.Clamp(Math.floor(toX / TILE_SIZE), 0, GRID_W - 1);
      const endRow = Phaser.Math.Clamp(Math.floor(toY / TILE_SIZE), 0, GRID_H - 1);

      // If destination is blocked, find nearest open tile
      if (this.grid[endRow] && this.grid[endRow][endCol] === 1) {
        const nearest = this.findNearestOpen(endCol, endRow);
        if (nearest) {
          this.easystar.findPath(startCol, startRow, nearest.col, nearest.row, (path) => {
            resolve(path ? path.map(p => ({
              x: p.x * TILE_SIZE + TILE_SIZE / 2,
              y: p.y * TILE_SIZE + TILE_SIZE / 2
            })) : []);
          });
          this.easystar.calculate();
          return;
        }
      }

      this.easystar.findPath(startCol, startRow, endCol, endRow, (path) => {
        resolve(path ? path.map(p => ({
          x: p.x * TILE_SIZE + TILE_SIZE / 2,
          y: p.y * TILE_SIZE + TILE_SIZE / 2
        })) : []);
      });
      this.easystar.calculate();
    });
  }

  findNearestOpen(col, row) {
    for (let r = 1; r < 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nr = row + dy;
          const nc = col + dx;
          if (nr >= 0 && nr < GRID_H && nc >= 0 && nc < GRID_W && this.grid[nr][nc] === 0) {
            return { col: nc, row: nr };
          }
        }
      }
    }
    return null;
  }

  getGrid() {
    return this.grid;
  }

  getTileSize() {
    return TILE_SIZE;
  }

  getGridDimensions() {
    return { w: GRID_W, h: GRID_H };
  }
}
