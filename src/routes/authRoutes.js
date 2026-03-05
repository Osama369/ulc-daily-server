import express from 'express';
import {
    adminLogin,
    register,
    login,
    logout,
    me,
} from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

// Authentication Router
const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/user-login', login);
authRouter.post('/admin-login' , adminLogin);
authRouter.post('/logout', logout);
authRouter.post('/admin-logout', logout);
authRouter.get('/me', authMiddleware, me);

export default authRouter;



