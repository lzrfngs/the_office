/**
 * Pathfinding — A* grid-based pathfinding using EasyStar.js.
 * The world is divided into a grid; walkable tiles are marked.
 * Agents request paths and receive waypoint arrays.
 */

import Phaser from 'phaser';
import EasyStar from 'easystarjs';

const TILE_SIZE = 32;
const GRID_W = 40;  // 1280 / 32
const GRID_H = 23;  // 736 / 32 (slightly over 720)

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
    // Ensure station areas and fire pit are clear
    this.clearArea(grid, 34, 4, 3);   // scout station (1088/32 ≈ 34, 140/32 ≈ 4)
    this.clearArea(grid, 6, 16, 3);    // blacksmith station (200/32 ≈ 6, 510/32 ≈ 16)
    this.clearArea(grid, 20, 3, 3);    // oracle station (640/32 ≈ 20, 110/32 ≈ 3)
    this.clearArea(grid, 20, 11, 3);   // fire pit center (640/32 ≈ 20, 360/32 ≈ 11)
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
