import { connectDB } from "./db/db.js";
import dotenv from "dotenv";
import { app } from "./app.js";
import User from "./models/User.js";
import TimeSlot from './models/TimeSlot.js';

dotenv.config({
  path: "./.env",
});

const seedAdmin = async () => {
  try {
    const admin = await User.findOne({ role: "admin" });
    if(!admin){
      const adminData = {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'password123',
        email: process.env.ADMIN_EMAIL,
        phone: process.env.ADMIN_PHONE,
        city: process.env.ADMIN_CITY || '',
        role: 'admin'
      };

      // Don't attempt to create an admin if required fields are missing to avoid Mongoose validation errors
      if (!adminData.email || !adminData.phone) {
        console.warn('Skipping default admin creation: ADMIN_EMAIL or ADMIN_PHONE missing in .env');
      } else {
        await User.create(adminData);
        console.log('Default admin created:', adminData.username);
      }
  }
  } catch (error) {
    console.log("Error while creating admin", error);
  }
}

// Draw model and seeding removed — TimeSlot is used instead

const seedTimeSlots = async () => {
  try {
    const count = await TimeSlot.countDocuments();
    if (count === 0) {
      console.log('Seeding default time slots (11:00-23:00)...');
      const slots = [];
      for (let h = 11; h <= 23; h++) {
        const label = `${String(h).padStart(2, '0')}:00`;
        slots.push({ hour: h, label, isActive: true });
      }
      await TimeSlot.create(slots);
    }
  } catch (error) {
    console.log('Error while seeding time slots', error);
  }
}

connectDB()
  .then(() => {
    seedAdmin();
    seedTimeSlots();
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`The server is running at port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the process using that port or change PORT in your .env.`);
        console.error('On Windows: run `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`.');
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.log("Database Connection failed", err);
  });
