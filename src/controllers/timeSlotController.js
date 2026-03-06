import TimeSlot from '../models/TimeSlot.js';
import TimeSlotOverride from '../models/TimeSlotOverride.js';

const normalizeDateISO = (value) => {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const mergeDateOverrides = async (slots, selectedDate) => {
  if (!selectedDate || !Array.isArray(slots) || slots.length === 0) return slots;
  const slotIds = slots.map((s) => s._id);
  const overrides = await TimeSlotOverride.find({ date: selectedDate, timeSlotId: { $in: slotIds } }).lean();
  const bySlotId = new Map(overrides.map((o) => [String(o.timeSlotId), o]));
  return slots.map((slot) => {
    const override = bySlotId.get(String(slot._id));
    const baseIsActive = !!slot.isActive;
    const effectiveIsActive = override ? !!override.isActive : baseIsActive;
    return {
      ...slot,
      baseIsActive,
      isActive: effectiveIsActive,
      overrideApplied: !!override,
      overrideDate: override ? selectedDate : null,
    };
  });
};

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
    const ts = new TimeSlot({
      hour,
      label,
      isActive: isActive == null ? true : !!isActive,
      createdBy: req.user.id,
    });
    await ts.save();
    res.status(201).json({ message: 'TimeSlot created', timeSlot: ts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update TimeSlot (admin only)
export const updateTimeSlot = async (req, res) => {
  const { id } = req.params;
  const { hour, label, isActive, date } = req.body;
  try {
    const ts = await TimeSlot.findById(id);
    if (!ts) return res.status(404).json({ error: 'TimeSlot not found' });
    const selectedDate = normalizeDateISO(date);
    if (date != null && !selectedDate) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    if (hour != null) {
      const hNum = Number(hour);
      if (!Number.isFinite(hNum) || hNum < 0 || hNum > 23) return res.status(400).json({ error: 'hour must be a number between 0 and 23' });
      ts.hour = hour;
    }
    if (label != null) ts.label = label;
    if (isActive != null) {
      if (selectedDate) {
        await TimeSlotOverride.findOneAndUpdate(
          { timeSlotId: ts._id, date: selectedDate },
          { isActive: !!isActive, updatedBy: req.user?.id || null },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        ts.isActive = !!isActive;
      }
    }
    await ts.save();

    if (selectedDate) {
      const [merged] = await mergeDateOverrides([ts.toObject()], selectedDate);
      return res.status(200).json({ message: 'TimeSlot updated', timeSlot: merged, date: selectedDate });
    }
    res.status(200).json({ message: 'TimeSlot updated', timeSlot: ts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// List all timeSlots (authenticated)
export const listTimeSlots = async (req, res) => {
  try {
    const selectedDate = normalizeDateISO(req.query?.date);
    if (req.query?.date != null && !selectedDate) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const slots = await TimeSlot.find().sort({ hour: 1 }).lean();
    const merged = await mergeDateOverrides(slots, selectedDate);
    res.status(200).json({ timeSlots: merged, date: selectedDate || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List active timeSlots
export const listActiveTimeSlots = async (req, res) => {
  try {
    const selectedDate = normalizeDateISO(req.query?.date);
    if (req.query?.date != null && !selectedDate) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const slots = await TimeSlot.find().sort({ hour: 1 }).lean();
    const merged = await mergeDateOverrides(slots, selectedDate);
    const activeOnly = merged.filter((s) => !!s.isActive);
    res.status(200).json({ timeSlots: activeOnly, date: selectedDate || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default { createTimeSlot, updateTimeSlot, listTimeSlots, listActiveTimeSlots };
