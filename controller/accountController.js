const db = require("../config/database");
const bcrypt = require('bcrypt');

const getAccount = async (req, res) => {
    const sql = "SELECT username, role FROM tbl_account";
    db.all(sql, [], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching accounts" });
        }
        return res.status(200).json({ status: "success", accounts: result });
    });
};

const getAllInforAcc = async (req, res) => {
    const sql = `
        SELECT  id, username, role, name, email
        FROM tbl_account
    `;
    db.all(sql, [], (err, result) => {
        console.log(err);
        if (err) {
            return res.status(500).json({ error: "Error fetching account information" });
        }
        return res.status(200).json({ status: "success", accountsInfo: result });
    });
};

const getAccountById = async (req, res) => {
    const username = req.params.account_id; // Get username from request parameters
    const sql = `
        SELECT id, username, role, name, email
        FROM tbl_account
        WHERE username = ?;
    `;

    db.get(sql, [username], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching account" });
        }
        if (!result) {
            return res.status(404).json({ error: "Account not found" });
        }
        return res.status(200).json({ status: "success", accountInfo: result });
    });
};



const updateaccountusername = async (req, res) => {
    try {
        const username = req.params.username;
        const { role, password, name, email } = req.body;

        // Start building the SQL query dynamically
        let sql = "UPDATE tbl_account SET";
        let values = [];
        let updateFields = [];

        // Add fields to update if provided in the request
        if (role) {
            updateFields.push("role = ?");
            values.push(role);
        }

        if (password) {
            // Hash the password before storing it
            const hashedPassword = await bcrypt.hash(password, 10); // 10 = salt rounds
            updateFields.push("password = ?");
            values.push(hashedPassword);
        }

        if (name) {
            updateFields.push("name =?");
            values.push(name);
        }

        if (email) {
            updateFields.push("email =?");
            values.push(email);
        }

        // If no fields are provided, return an error
        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        // Construct the final SQL query
        sql += ` ${updateFields.join(", ")} WHERE username = ?`;
        values.push(username);

        // Execute the update query
        db.run(sql, values, function (err) {
            if (err) {
                console.error("Error updating account:", err);
                return res.status(500).json({ error: "Internal server error" });
            }

            // Check if any row was modified
            if (this.changes > 0) {
                return res.status(200).json({ status: "Account updated successfully" });
            } else {
                return res.status(404).json({ error: "Account not found" });
            }
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const AccStatistics = (req, res) => {
    try {
        const totalAccountsQuery = `SELECT COUNT(*) AS total FROM tbl_account;`;
        const registeredFaceAccountsQuery = `
            SELECT COUNT(DISTINCT a.username) AS registered
            FROM tbl_account a
            JOIN tbl_register_faces r ON a.id = r.account_id;
        `;

        let statistics = {
            totalAccounts: 0,
            registeredFaceAccounts: 0,
        };

        // Fetch total accounts
        db.get(totalAccountsQuery, (err, totalResult) => {
            if (err) {
                console.error("Error fetching total accounts:", err);
                return res.status(500).json({ error: "Failed to fetch account statistics" });
            }

            statistics.totalAccounts = totalResult?.total || 0;

            // Fetch registered face accounts
            db.get(registeredFaceAccountsQuery, (err, registeredResult) => {
                if (err) {
                    console.error("Error fetching registered face accounts:", err);
                    return res.status(500).json({ error: "Failed to fetch account statistics" });
                }

                statistics.registeredFaceAccounts = registeredResult?.registered || 0;

                // Send final statistics response
                return res.status(200).json(statistics);
            });
        });

    } catch (error) {
        console.error("Error fetching account statistics:", error);
        res.status(500).json({ error: "Failed to fetch account statistics" });
    }
};


module.exports = {
    getAccount,
    getAllInforAcc,
    updateaccountusername,
    getAccountById,
    AccStatistics
};