/**
 * Database initialization for system info collection
 */

import type { DB as Database } from "https://deno.land/x/sqlite@v3.8/mod.ts";

export function initDatabase(db: Database): void {
  // Create tables if they don't exist
  db.execute(`
    CREATE TABLE IF NOT EXISTS system_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      hostname TEXT,
      kernel TEXT,
      os_name TEXT,
      os_version TEXT,
      architecture TEXT,
      uptime_seconds INTEGER,
      boot_time TEXT,
      timezone TEXT
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS cpu_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      model TEXT,
      cores INTEGER,
      threads INTEGER,
      current_freq_mhz REAL,
      max_freq_mhz REAL,
      usage_percent REAL
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS memory_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_mb INTEGER,
      available_mb INTEGER,
      used_mb INTEGER,
      usage_percent REAL,
      swap_total_mb INTEGER,
      swap_used_mb INTEGER
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS disk_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      device TEXT,
      mount_point TEXT,
      filesystem TEXT,
      size_gb REAL,
      used_gb REAL,
      available_gb REAL,
      usage_percent REAL
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS network_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      interface_name TEXT,
      ip_address TEXT,
      mac_address TEXT,
      state TEXT,
      speed_mbps INTEGER,
      rx_bytes INTEGER,
      tx_bytes INTEGER
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS gpu_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      vendor TEXT,
      model TEXT,
      driver_version TEXT,
      memory_total_mb INTEGER,
      memory_used_mb INTEGER,
      temperature_c INTEGER,
      utilization_percent INTEGER
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS service_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      service_name TEXT,
      state TEXT,
      enabled INTEGER,
      load_state TEXT,
      active_state TEXT,
      sub_state TEXT
    )
  `);
}
