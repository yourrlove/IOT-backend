require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("SQLite connection failed:", err.message);
    else console.log("Connected to SQLite database.");
});

// Function to create tables (without relations)// Function to create tables with foreign keys directly
const createTables = () => {
  db.serialize(() => {
      db.run("PRAGMA foreign_keys = ON;"); // Ensure foreign keys are enforced

      //Create tables with foreign keys included
      db.run(`CREATE TABLE IF NOT EXISTS tbl_account (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255),
          role TEXT CHECK(role IN ('admin', 'user')),
          name VARCHAR(100),
          email VARCHAR(100)
      );`);

      db.run(`CREATE TABLE IF NOT EXISTS tbl_register_faces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          face_image VARCHAR(255),
          account_id INTEGER,
          image_vector JSON,
          image_vector_process JSON,
          face_image_process VARCHAR(255),
          FOREIGN KEY (account_id) REFERENCES tbl_account(id) ON DELETE CASCADE
      );`);

      db.run(`CREATE TABLE IF NOT EXISTS tbl_enter_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          enter_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          account_id INTEGER,
          face_image VARCHAR(255),
          FOREIGN KEY (account_id) REFERENCES tbl_account(id) ON DELETE CASCADE
      );`);
  });
};

// Initialize tables on startup
createTables();

module.exports = db;