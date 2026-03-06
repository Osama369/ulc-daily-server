import mongoose from 'mongoose';

const timeSlotOverrideSchema = new mongoose.Schema(
  {
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: true,
      index: true,
    },
    // YYYY-MM-DD (Pakistan/local date string selected in UI)
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    isActive: { type: Boolean, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true }
);

timeSlotOverrideSchema.index({ timeSlotId: 1, date: 1 }, { unique: true });

export default mongoose.model('TimeSlotOverride', timeSlotOverrideSchema);

