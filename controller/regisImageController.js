const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const { exec } = require("child_process");

  
 
const detectFaceAndProcess = (base64Image) => {
  return new Promise((resolve, reject) => {
      console.log("[DEBUG] Starting detectFaceAndProcess...");

      try {
          const tempFile = path.join(__dirname, 'temp_image.jpg');
          const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
          console.log(`[DEBUG] Writing temp image to: ${tempFile}`);
          fs.writeFileSync(tempFile, Buffer.from(base64Data, 'base64'));
 
          const command = `python E:\\.kltn\\source_code\\backend\\model\\face_crop.py ${tempFile}`;
          console.log(`[DEBUG] Running command: ${command}`);
          exec(command, (error, stdout, stderr) => {
              console.log("[DEBUG] Python script execution completed.");

              console.log("[DEBUG] Python script output:");
              console.log(stdout);

              const originalMatch = stdout.match(/Original path:\s([^\n]+)/);
              const processedMatch = stdout.match(/Processed path:\s([^\n]+)/);
              const originalEmbeddingMatch = stdout.match(/Original embedding:\s([^\n]+)/);
              const processedEmbeddingMatch = stdout.match(/Processed embedding:\s([^\n]+)/);

              console.log("[DEBUG] Parsing script output...");
              console.log(`[DEBUG] Original path match: ${originalMatch}`);
              console.log(`[DEBUG] Processed path match: ${processedMatch}`);
              console.log(`[DEBUG] Original embedding match: ${originalEmbeddingMatch}`);
              console.log(`[DEBUG] Processed embedding match: ${processedEmbeddingMatch}`);

              if (originalMatch && processedMatch && originalEmbeddingMatch && processedEmbeddingMatch) {
                  console.log("[DEBUG] Successfully parsed Python script output.");

                  const originalEmbedding = JSON.parse(originalEmbeddingMatch[1]);
                  const processedEmbedding = JSON.parse(processedEmbeddingMatch[1]);

                  // Check if either embedding is null
                  if (!originalEmbedding || !processedEmbedding) {
                      console.error("[ERROR] Embedding vector is null. Face embedding failed.");
                      return reject("Embedding vector is null. Ensure the face is clearly visible and try again.");
                  }

                  console.log("[DEBUG] Embeddings successfully retrieved.");
                  resolve({
                      originalPath: originalMatch[1].trim(),
                      processedPath: processedMatch[1].trim(),
                      originalEmbedding: originalEmbedding,
                      processedEmbedding: processedEmbedding,
                  });
              } else {
                  console.error("[ERROR] Failed to parse Python script output.");
                  reject("Face not processed correctly.");
              }
          });
      } catch (err) {
          console.error(`[ERROR] Exception occurred: ${err.message}`);
          reject("An unexpected error occurred.");
      }
  });
};   


const createRegisterFace = async (req, res) => {
  try {
      console.log("[DEBUG] Starting createRegisterFace...");
      const { base64Image, account_id } = req.body;

      if (!base64Image || !account_id) {
          console.error("[ERROR] Missing required fields.");
          return res.status(400).json({ message: "Base64 image and account_id are required!" });
      }

      console.log("[DEBUG] Calling detectFaceAndProcess...");
      const { originalPath, processedPath, originalEmbedding, processedEmbedding } = await detectFaceAndProcess(base64Image);

      if (!originalPath || !processedPath) {
          console.error("[ERROR] Face not detected in the image.");
          return res.status(400).json({ message: "Face not detected in the image!" });
      }

      console.log("[DEBUG] Preparing file paths and directories...");
      const uniqueFileNameOriginal = `${uuidv4()}.jpg`;
      const uniqueFileNameProcessed = `processed_${uuidv4()}.jpg`;
      const uploadDirOriginal = path.join(__dirname, `../public/uploads/${account_id}`);
      const uploadDirProcessed = path.join(__dirname, `../public/process/${account_id}`);
      const imageUrlOriginal = `http://localhost:${process.env.PORT || 8888}/uploads/${account_id}/${uniqueFileNameOriginal}`;
      const imageUrlProcessed = `http://localhost:${process.env.PORT || 8888}/process/${account_id}/${uniqueFileNameProcessed}`;

      console.log(`[DEBUG] Upload paths: ${uploadDirOriginal}, ${uploadDirProcessed}`);

      if (!fs.existsSync(uploadDirOriginal)) fs.mkdirSync(uploadDirOriginal, { recursive: true });
      if (!fs.existsSync(uploadDirProcessed)) fs.mkdirSync(uploadDirProcessed, { recursive: true });

      try {
          fs.writeFileSync(path.join(uploadDirOriginal, uniqueFileNameOriginal), fs.readFileSync(originalPath));
          fs.writeFileSync(path.join(uploadDirProcessed, uniqueFileNameProcessed), fs.readFileSync(processedPath));
      } catch (fsError) {
          console.error("[ERROR] Error writing image files:", fsError);
          return res.status(500).json({ message: "Failed to save image files" });
      }

      console.log("[DEBUG] Formatting embeddings...");
      const formattedOriginalEmbedding = JSON.stringify([[account_id], originalEmbedding]);
      const formattedProcessedEmbedding = JSON.stringify([[account_id], processedEmbedding]);

      console.log("[DEBUG] Saving face data to database...");
      const sql = `
          INSERT INTO tbl_register_faces (face_image, face_image_process, account_id, image_vector, image_vector_process)
          VALUES (?, ?, ?, ?, ?)
      `;

      db.run(sql, [imageUrlOriginal, imageUrlProcessed, account_id, formattedOriginalEmbedding, formattedProcessedEmbedding], function (insertErr) {
          if (insertErr) {
              console.error("[ERROR] Database insert error:", insertErr);
              return res.status(500).json({ message: "Internal Server Error" });
          }

          console.log("[DEBUG] Face registration successful.");
          return res.status(201).json({
              message: "Face registration created successfully!",
              data: {
                  face_image: imageUrlOriginal,
                  face_image_process: imageUrlProcessed,
                  account_id,
                  image_vector: formattedOriginalEmbedding,
                  image_vector_process: formattedProcessedEmbedding,
              },
          });
      });
  } catch (error) {
      console.error("[ERROR] Unexpected error:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


// Function to get the image and its vector by account_id
const getImageByID = (req, res) => {
  const { accountId } = req.params;
  console.log("Extracted account ID:", accountId);

  if (!accountId) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  const query = `
    SELECT id, face_image, image_vector, face_image_process, image_vector_process 
    FROM tbl_register_faces 
    WHERE account_id = ?
  `;

  db.all(query, [accountId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ error: "No data found for the given account ID" });
    }

    const response = results.map((row) => {
      let parsedVector = null;
      let parsedVectorProcess = null;

      try {
        parsedVector = JSON.parse(row.image_vector);
        parsedVectorProcess = JSON.parse(row.image_vector_process);
      } catch (error) {
        console.error("Error parsing image vectors:", error);
        return null;  
      }

      return {
        id: row.id,
        face_image_url: row.face_image,
        image_vector: parsedVector,
        face_image_process_url: row.face_image_process,
        image_vector_process: parsedVectorProcess,
      };
    }).filter(Boolean);

    res.status(200).json(response);
  });
};

const getAllDataWithUsername = (req, res) => {
  const query = `
    SELECT 
      r.id AS register_face_id,
      r.account_id, 
      r.face_image, 
      r.image_vector, 
      r.face_image_process, 
      r.image_vector_process,
      a.username
    FROM tbl_register_faces r
    LEFT JOIN tbl_account a ON r.account_id = a.id;
  `;

  db.all(query, [], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ error: "No data found in the database" });
    }


    const response = results.map((row) => {
      let parsedVector = null;
      let parsedVectorProcess = null;


      if (row.image_vector) {
        try {
          parsedVector = JSON.parse(row.image_vector);
        } catch (error) {
          console.error(`Error parsing image_vector for ID ${row.register_face_id}:`, error);
        }
      }

      if (row.image_vector_process) {
        try {
          parsedVectorProcess = JSON.parse(row.image_vector_process);
        } catch (error) {
          console.error(`Error parsing image_vector_process for ID ${row.register_face_id}:`, error);
        }
      }

      return {
        id: row.register_face_id,
        account_id: row.account_id,
        username: row.username,
        face_image_url: row.face_image,
        image_vector: parsedVector,
        face_image_process_url: row.face_image_process,
        image_vector_process: parsedVectorProcess,
      };
    });
    res.status(200).json(response);
  });
};


const deleteRegisterFace = (req, res) => {
  try {
      const { id } = req.params; // Get the ID from request params

      if (!id) {
          return res.status(400).json({ message: "ID is required!" });
      }

      // Step 1: Get the face_image URL from the database
      const querySelect = "SELECT face_image FROM tbl_register_faces WHERE id = ?";

      db.get(querySelect, [id], (err, row) => {
          if (err) {
              console.error("Error querying the database:", err);
              return res.status(500).json({ message: "Internal Server Error" });
          }

          if (!row) {
              return res.status(404).json({ message: "Face registration not found" });
          }

          const faceImageUrl = row.face_image;
          const imageFileName = path.basename(faceImageUrl); // Extract file name
          const accountId = faceImageUrl.split("/").slice(-2, -1)[0]; // Extract accountId
          const imageFilePath = path.join(__dirname, `../public/uploads/${accountId}`, imageFileName);

          // Step 2: Delete the image file if it exists
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

          // Step 3: Delete the record from the database
          const queryDelete = "DELETE FROM tbl_register_faces WHERE id = ?";

          db.run(queryDelete, [id], function (deleteErr) {
              if (deleteErr) {
                  console.error("Error deleting database record:", deleteErr);
                  return res.status(500).json({ message: "Internal Server Error" });
              }

              res.status(200).json({ message: "Face registration and image deleted successfully" });
          });
      });
  } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

  
const getFaceRegistrationStats = async (req, res) => {
  try {
      const queryRegistered = `
          SELECT COUNT(DISTINCT a.id) AS registered_count
          FROM tbl_account a
          INNER JOIN tbl_register_faces rf ON a.id = rf.account_id;
      `;

      const queryNotRegistered = `
          SELECT COUNT(*) AS not_registered_count
          FROM tbl_account a
          WHERE NOT EXISTS (
              SELECT 1 FROM tbl_register_faces rf
              WHERE a.id = rf.account_id
          );
      `;

      // Execute both queries using SQLite methods
      db.get(queryRegistered, [], (err, registeredRow) => {
          if (err) {
              console.error("Error fetching registered count:", err);
              return res.status(500).json({
                  success: false,
                  message: "Failed to fetch registered count",
              });
          }

          db.get(queryNotRegistered, [], (err, notRegisteredRow) => {
              if (err) {
                  console.error("Error fetching not registered count:", err);
                  return res.status(500).json({
                      success: false,
                      message: "Failed to fetch not registered count",
                  });
              }

              // Extract counts
              const registeredCount = registeredRow ? registeredRow.registered_count : 0;
              const notRegisteredCount = notRegisteredRow ? notRegisteredRow.not_registered_count : 0;

              // Send the response
              res.json({
                  success: true,
                  data: {
                      registeredCount,
                      notRegisteredCount,
                  },
              });
          });
      });
  } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({
          success: false,
          message: "Internal Server Error",
      });
  }
};


module.exports = { 
    createRegisterFace,
    deleteRegisterFace,
    getImageByID,
    detectFaceAndProcess,
    getAllDataWithUsername,
    getFaceRegistrationStats
};
