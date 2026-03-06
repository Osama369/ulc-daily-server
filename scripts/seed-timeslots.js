import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../src/db/db.js";
import TimeSlot from "../src/models/TimeSlot.js";

// Load environment variables from .env
dotenv.config();

const buildDefaultTimeSlots = () => {
  const slots = [];
  for (let hour = 11; hour <= 23; hour++) {
    slots.push({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      isActive: true,
    });
  }
  return slots;
};

const seedTimeSlots = async () => {
  try {
    await connectDB();

    const slots = buildDefaultTimeSlots();
    let inserted = 0;
    let alreadyPresent = 0;

    for (const slot of slots) {
      const result = await TimeSlot.updateOne(
        { hour: slot.hour },
        { $setOnInsert: slot },
        { upsert: true }
      );

      if (result.upsertedCount > 0) inserted++;
      else alreadyPresent++;
    }

    console.log(
      `TimeSlots seed completed. Inserted: ${inserted}, Already present: ${alreadyPresent}`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error seeding time slots:", err.message || err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
};

seedTimeSlots();

