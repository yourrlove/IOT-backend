const registerController = require('../controller/regisImageController');
const express = require("express");
const router = express.Router();

// Route for creating face registration
router.post("/register-face", registerController.createRegisterFace);
router.post("/detect-face", registerController.detectFaceAndProcess);
router.delete("/delete-face/:id", registerController.deleteRegisterFace);
router.get("/getimagebyID/:memberId", registerController.getImageByID);
router.get("/getAllDataWithUsername", registerController.getAllDataWithUsername);
router.get("/getFaceRegistrationStats", registerController.getFaceRegistrationStats);


module.exports = router;  