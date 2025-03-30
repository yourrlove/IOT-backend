const express = require("express");
const accountRouter = express.Router();
const accountController = require("../controller/accountController");

accountRouter.get("/getAccount", accountController.getAccount);
accountRouter.get("/getAllInforAcc", accountController.getAllInforAcc);
accountRouter.put("/updateaccountusername/:username", accountController.updateaccountusername);
accountRouter.get("/getAccountById/:account_id", accountController.getAccountById);
accountRouter.get("/AccStatistics", accountController.AccStatistics);


module.exports = accountRouter; 