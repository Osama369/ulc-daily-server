import TimeSlot from '../models/TimeSlot.js';

// Create a new TimeSlot (admin only)
export const createTimeSlot = async (req, res) => {
  const { hour, label, isActive } = req.body;
  try {
    if (hour == null || label == null) return res.status(400).json({ error: 'hour and label are required' });
    // Validate hour range explicitly (0-23)
    const hNum = Number(hour);
    if (!Number.isFinite(hNum) || hNum < 0 || hNum > 23) return res.status(400).json({ error: 'hour must be a number between 0 and 23' });
    const existing = await TimeSlot.findOne({ hour });
    if (existing) return res.status(400).json({ error: 'TimeSlot for this hour already exists' });
    const ts = new TimeSlot({ hour, label, isActive: !!isActive, createdBy: req.user.id });
    await ts.save();
    res.status(201).json({ message: 'TimeSlot created', timeSlot: ts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update TimeSlot (admin only)
export const updateTimeSlot = async (req, res) => {
  const { id } = req.params;
  const { hour, label, isActive } = req.body;
  try {
    const ts = await TimeSlot.findById(id);
    if (!ts) return res.status(404).json({ error: 'TimeSlot not found' });
    if (hour != null) {
      const hNum = Number(hour);
      if (!Number.isFinite(hNum) || hNum < 0 || hNum > 23) return res.status(400).json({ error: 'hour must be a number between 0 and 23' });
      ts.hour = hour;
    }
    if (label != null) ts.label = label;
    if (isActive != null) ts.isActive = !!isActive;
    await ts.save();
    res.status(200).json({ message: 'TimeSlot updated', timeSlot: ts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// List all timeSlots (authenticated)
export const listTimeSlots = async (req, res) => {
  try {
    const slots = await TimeSlot.find().sort({ hour: 1 });
    res.status(200).json({ timeSlots: slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List active timeSlots
export const listActiveTimeSlots = async (req, res) => {
  try {
    const slots = await TimeSlot.find({ isActive: true }).sort({ hour: 1 });
    res.status(200).json({ timeSlots: slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default { createTimeSlot, updateTimeSlot, listTimeSlots, listActiveTimeSlots };
