// controllers/AuthController.js
const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const login = async (req, res, next) => {
  const { username, password } = req.body;

  // Check if username and password are provided
  if (!username || !password) {
    return res.status(400).json({
      status: "failed",
      error: "Username and password are required",
    });
  }

  const sql = `SELECT * FROM tbl_account WHERE username = ?`;

  db.get(sql, [username], (err, result) => {
    if (err) {
      return res.status(500).json({
        status: "failed",
        error: "Internal Server Error",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        status: "failed",
        error: "Account not found",
      });
    }

    const tbl_account = result;

    // Verify password (hashed password comparison)
    bcrypt.compare(password, tbl_account.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({
          status: "failed",
          error: "Error comparing passwords",
        });
      }

      if (!isMatch) {
        return res.status(401).json({
          status: "failed",
          error: "Invalid password",
        });
      }

      // Payload for JWT
      const payload = {
        username: tbl_account.username,
        role: tbl_account.role,
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" },
        (err, token) => {
          if (err) {
            console.error("JWT Error: ", err);
            return res.status(500).json({
              status: "failed",
              error: "Token generation failed",
            });
          }

          res.json({
            status: "success",
            token: token,
            role: tbl_account.role,
          });
        }
      );
    });
  });
};


const signUp = async (req, res, next) => {
  const { username, password, role } = req.body;

  // Check if the username already exists
  const checkUsernameQuery = "SELECT * FROM tbl_account WHERE username = ?";
  db.get(checkUsernameQuery, [username], async (err, row) => {
    if (err) {
      return res.status(500).json({
        status: "failed",
        error: "Internal Server Error",
      });
    }

    if (row) {
      return res.status(401).json({
        status: "error",
        message: "Username already exists.",
      });
    }

    // Hash the password before saving to the database
    try {
      const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds set to 10

      // Insert new account into database
      const insertAccountQuery = `
        INSERT INTO tbl_account (username, password, role)
        VALUES (?, ?, ?)
      `;
      const newUserValues = [username, hashedPassword, role];

      db.run(insertAccountQuery, newUserValues, function (err) {
        if (err) {
          return res.status(400).json({
            status: "failed",
            error: "Bad Request",
          });
        }

        res.json({
          status: "success",
          message: "Successfully created account!",
          username: username,
        });
      });
    } catch (hashError) {
      return res.status(500).json({
        status: "failed",
        error: "Error hashing password",
      });
    }
  });
};



module.exports = {
  login,
  signUp
};