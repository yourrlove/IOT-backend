const express = require("express");


const accountRoutes = require("./routes/accounts");
const authRoutes = require("./routes/auth");
const regisImageRoutes = require("./routes/regisImage"); 
const historiesRoutes = require("./routes/histories"); 

 

require("dotenv").config();

const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const db = require("./config/database");
const configViewEngine = require("./config/viewEngine");
const app = express();

const port = process.env.PORT || 37320;

app.use(cors());
configViewEngine(app);



app.use(express.json({ limit: "50mb" })); // Set payload size limit
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));


app.use("/", accountRoutes);
app.use("/", authRoutes);
app.use("/", regisImageRoutes); // This must point to the correct route file
app.use("/", historiesRoutes); // This must point to the correct route file

// Middleware for serving static files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use("/histories", express.static(path.join(__dirname, "public/histories")));
app.use("/process", express.static(path.join(__dirname, "public/process")));

// Catch-all middleware for unknown routes
app.use((req, res) => {
  res.status(404).send(`Route ${req.method} ${req.originalUrl} not found.`);
});

// Start the server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

db.get("SELECT 1 + 1 AS result", (err, row) => {
  if (err) {
      console.error("Error connecting to SQLite:", err.message);
      return;
  }
  console.log("Connected to SQLite! Test Query Result:", row.result);
});