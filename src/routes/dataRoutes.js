import express from "express";
import {
    addDataForTimeSlot,
    getDataForDate,
    getAllDocuments,
    deleteDataObjectById,
    getWinningNumbers,
    setWinningNumbers,
    updateWinningNumbers,
    deleteWinningNumbers,
    deleteIndividualEntries,
    getDataForClient,
    getCombinedVoucherData,
    searchDataByNumber,
    searchDistributorCombinedByNumber
} from "../controllers/dataController.js";
import { authMiddleware, adminMiddleware } from "../middlewares/authMiddleware.js";

const dataRouter = express.Router();

dataRouter.post("/add-data", authMiddleware, addDataForTimeSlot);
dataRouter.get("/get-data", authMiddleware, getDataForDate); // get data for a specific date or slot
dataRouter.get("/get-combined-voucher-data", authMiddleware, getCombinedVoucherData);
dataRouter.get("/search-number", authMiddleware, searchDataByNumber);
dataRouter.get("/admin-search-distributor-number", authMiddleware, adminMiddleware, searchDistributorCombinedByNumber);
dataRouter.get("/get-client-data", authMiddleware, getDataForClient); // get data for a specific user/date
dataRouter.get("/get-all-documents", authMiddleware ,  getAllDocuments);  // get all documents
dataRouter.delete("/delete-data/:id", authMiddleware,  deleteDataObjectById);
dataRouter.get("/get-winning-numbers", authMiddleware, getWinningNumbers);
dataRouter.post("/set-winning-numbers", authMiddleware, setWinningNumbers);
dataRouter.put("/update-winning-numbers", authMiddleware, updateWinningNumbers);
dataRouter.delete("/delete-winning-numbers", authMiddleware, deleteWinningNumbers);
dataRouter.delete('/delete-individual-entries', authMiddleware, deleteIndividualEntries);

export default dataRouter;
