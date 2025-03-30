const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const sharp = require('sharp'); // For converting base64 image to JPEG buffer
const { exec } = require("child_process");

const createEnterHistory = async (req, res) => {
    try {
        const { base64Image, account_id } = req.body;

        if (!base64Image || !account_id) {
            return res.status(400).json({ message: "Base64 image and account_id are required!" });
        }

        // Step 1: Retrieve username from tbl_account (merged with member table)
        db.get(`SELECT username FROM tbl_account WHERE id = ?`, [account_id], async (err, row) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ message: "Internal server error" });
            }
            if (!row) {
                return res.status(404).json({ message: "Account not found!" });
            }

            const username = row.username;

            // Step 2: Convert base64 image to buffer and save as JPEG
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = await sharp(Buffer.from(base64Data, "base64"))
                .jpeg()
                .toBuffer();

            const uniqueFileName = `${uuidv4()}.jpg`;
            const uploadDir = path.join(__dirname, `../public/histories/${username}`);
            const imagePath = path.join(uploadDir, uniqueFileName);
            const imageUrl = `http://localhost:${process.env.PORT || 8888}/histories/${username}/${uniqueFileName}`;

            // Ensure the directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Save the image file
            fs.writeFileSync(imagePath, imageBuffer);

            // Step 3: Insert data into tbl_enter_history
            const insertQuery = `INSERT INTO tbl_enter_history (account_id, face_image) VALUES (?, ?)`;
            db.run(insertQuery, [account_id, imageUrl], function (err) {
                if (err) {
                    console.error("Error inserting entry history:", err);
                    return res.status(500).json({ message: "Internal server error" });
                }

                // Respond with success
                res.status(201).json({
                    message: "Entry history created successfully!",
                    data: {
                        account_id,
                        face_image: imageUrl,
                    },
                });
            });
        });

    } catch (error) {
        console.error("Error creating entry history:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const deleteHistories = (req, res) => {
    try {
        const { id } = req.params; // Get the id from the request params

        if (!id) {
            return res.status(400).json({ message: "ID is required!" });
        }

        // Step 1: Get the face_image URL from the database
        db.get("SELECT face_image FROM tbl_enter_history WHERE id = ?", [id], (err, row) => {
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            if (!row) { 
                return res.status(404).json({ message: "History record not found" });
            }

            const faceImageUrl = row.face_image;

            // Step 2: Extract the image file name and account ID from the URL
            const imageFileName = path.basename(faceImageUrl); // Extract file name from URL
            const accountId = faceImageUrl.split("/").slice(-2, -1)[0]; // Extract accountId

            // Step 3: Construct the path to the image file on the server
            const imageFilePath = path.join(__dirname, `../public/histories/${accountId}`, imageFileName);

            // Step 4: Delete the image file from the server (if it exists)
            if (fs.existsSync(imageFilePath)) {
                fs.unlink(imageFilePath, (fsErr) => {
                    if (fsErr) {
                        console.error("Error deleting image file:", fsErr);
                    } else {
                        console.log(`Deleted image: ${imageFilePath}`);
                    }
                });
            } else {
                console.log(`Image not found at: ${imageFilePath}`);
            }

            // Step 5: Delete the record from the database
            db.run("DELETE FROM tbl_enter_history WHERE id = ?", [id], function (deleteErr) {
                if (deleteErr) {
                    console.error("Error deleting database record:", deleteErr);
                    return res.status(500).json({ message: "Internal Server Error" });
                }

                res.status(200).json({
                    message: "History record and image deleted successfully",
                });
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const getAllHistories = (req, res) => {
    try {
        // Query to fetch all records from tbl_enter_history
        const sql = `
            SELECT h.id, h.enter_at, h.account_id, h.face_image, a.name 
            FROM tbl_enter_history h 
            JOIN tbl_account a ON h.account_id = a.id
        `;

        db.all(sql, [], (err, rows) => {  // ✅ Use db.all() for fetching multiple rows
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            // Check if no data is found
            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: "No history records found" });
            }

            // Respond with all data
            res.status(200).json({
                message: "History records retrieved successfully",
                data: rows,
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


const getHistories = (req, res) => {
    try {
        // Query to fetch all records from tbl_enter_history
        const sql = "SELECT * FROM tbl_enter_history";

        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            // Check if no data is found
            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: "No history records found" });
            }

            // Respond with all data
            res.status(200).json({
                message: "History records retrieved successfully",
                data: rows,
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const getHistoriesByMemberId = (req, res) => {
    try {
        const { id } = req.params; // Use 'id' to match the route parameter

        if (!id) {
            return res.status(400).json({ message: "Member ID is required!" });
        } 

        // Query to fetch records from tbl_enter_history by member_id and join with tbl_member
        const query = `
            SELECT 
                eh.id AS entry_id,
                eh.enter_at,
                eh.face_image,
                a.id AS account_id,
                a.name,
                a.phone_number,
                a.email
            FROM tbl_enter_history eh
            JOIN tbl_account a ON eh.account_id = a.id
            WHERE eh.account_id = ?
        `;

        db.all(query, [id], (err, rows) => {
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            // Check if no data is found
            if (!rows || rows.length === 0) {
                return res.status(404).json({ message: "No history records found for this member" });
            }

            // Respond with the data
            res.status(200).json({
                message: "History records retrieved successfully",
                data: rows,
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const moment = require('moment-timezone');

const HisStatistics = (req, res) => {
    try {
        // Get current date in Vietnam Time (GMT+7)
        const vietnamTime = moment().tz("Asia/Ho_Chi_Minh");

        // Set start of the day to 12:00 AM Vietnam Time
        const startOfDayVN = vietnamTime.clone().startOf('day'); // Set to 12:00 AM

        // Set end of the day to 11:59:59 PM Vietnam Time
        const endOfDayVN = vietnamTime.clone().endOf('day'); // Set to 11:59:59 PM

        // Convert to MySQL datetime format
        const startOfDay = startOfDayVN.format('YYYY-MM-DD HH:mm:ss');
        const endOfDay = endOfDayVN.format('YYYY-MM-DD HH:mm:ss');

        console.log("Start of Day (Vietnam Time):", startOfDay);
        console.log("End of Day (Vietnam Time):", endOfDay);

        const totalEntriesQuery = `
            SELECT COUNT(*) AS total FROM tbl_enter_history
            WHERE enter_at BETWEEN ? AND ?;
        `;
        const importerEntriesQuery = `
            SELECT COUNT(*) AS importers FROM tbl_enter_history
            WHERE account_id = -1 AND enter_at BETWEEN ? AND ?;
        `;

        // Initialize result object
        let statistics = {
            totalEntries: 0,
            totalImporters: 0,
        };

        // Execute the first query
        db.query(totalEntriesQuery, [startOfDay, endOfDay], (err, totalResult) => {
            if (err) {
                console.error("Error fetching total entries:", err);
                return res.status(500).json({ error: "Failed to fetch history statistics" });
            }

            console.log("Total Entries Result:", totalResult);

            statistics.totalEntries = totalResult[0]?.total || 0;

            // Execute the second query
            db.query(importerEntriesQuery, [startOfDay, endOfDay], (err, importerResult) => {
                if (err) {
                    console.error("Error fetching importer entries:", err);
                    return res.status(500).json({ error: "Failed to fetch history statistics" });
                }

                console.log("Importer Entries Result:", importerResult);

                statistics.totalImporters = importerResult[0]?.importers || 0;

                // Send the response
                console.log("Sending Response:", statistics);
                return res.status(200).json(statistics);
            });
        });
    } catch (error) {
        console.error("Error fetching history statistics:", error);
        res.status(500).json({ error: "Failed to fetch history statistics" });
    }
};

module.exports = { 
    createEnterHistory,
    deleteHistories,
    getAllHistories,
    getHistoriesByMemberId,
    HisStatistics,
    getHistories
};
