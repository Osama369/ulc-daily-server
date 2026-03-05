import express from "express";
import {
  getAllUsers,
  createUser,
  getUserById,
  initializeUserBalance,
  deductUserBalance,
  transferBalanceBetweenUsers,
  deleteUser,
  updateUser,
  toggleUserActiveStatus,
  getDistributorUsers,
  createDistributorUser,
  distributorDeleteUser,
  distributorUpdateUser,
  getDistributorParties,
} from "../controllers/userController.js";
import {
  authMiddleware,
  adminMiddleware,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/distributor-users", authMiddleware, getDistributorUsers); // distributor can get all users created by him
router.post("/distributor-create-user", authMiddleware, createDistributorUser);
router.delete('/distributor-delete/:id', authMiddleware, distributorDeleteUser);
router.patch('/distributor-update/:id', authMiddleware, distributorUpdateUser);
router.get('/distributor-parties', authMiddleware, getDistributorParties);
// admin routes 
router.get("/", authMiddleware, adminMiddleware, getAllUsers); // admin can get all users only 
router.post("/create-user", authMiddleware, adminMiddleware, createUser); // admin can create the distribuor only
router.get("/:id", authMiddleware, getUserById);  // this is the for user to show the profile data fetching 
router.patch("/:id", authMiddleware, adminMiddleware, updateUser); // admin can update the users 
router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);  // admin can delete the users 
router.patch(    // admin can active deactive account status
  "/:id/active",
  authMiddleware,
  adminMiddleware,
  toggleUserActiveStatus
);
router.patch(   // admin can initialize the balance of users
  "/:id/balance/initialize",
  authMiddleware,
  adminMiddleware,
  initializeUserBalance
);
router.patch(   //this is only for users whenever user hit to  add data it will deduct the balanace accordingly 
  "/:id/balance/deduct",
  authMiddleware,
  deductUserBalance
);
// Transfer endpoint: distributor (or admin) transfers funds to a target user
router.post('/:id/balance/transfer', authMiddleware, transferBalanceBetweenUsers);
export default router;
