import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
  // Hour in 24-hour numeric form (e.g. 11 for 11:00, 23 for 23:00)
  hour: { type: Number, required: true, min: 0, max: 23 },
  // Human label (e.g. "11:00" or "11 AM")
  label: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
}, { timestamps: true });

// Add a unique index on `hour` to prevent duplicate timeslots at the DB level.
// Note: Creating an index on an existing collection with duplicates will fail
// unless duplicates are resolved first. Run a migration or drop duplicates
// before applying in production. Example migration steps:
// 1. db.timeslots.aggregate([{ $group: { _id: "$hour", ids: { $push: "$_id" }, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }])
// 2. Remove or merge duplicate docs, then run: db.timeslots.createIndex({ hour: 1 }, { unique: true })
timeSlotSchema.index({ hour: 1 }, { unique: true });

export default mongoose.model('TimeSlot', timeSlotSchema);
