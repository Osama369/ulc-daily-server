import Data from "../models/Data.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";
import TimeSlot from "../models/TimeSlot.js";
import TimeSlotOverride from "../models/TimeSlotOverride.js";

// Build filter for date + timeSlot/timeSlotId. `date` should be YYYY-MM-DD or Date.
function buildDateSlotFilter({ date, timeSlot, timeSlotId }) {
    if (!date) return {};
    const d = (typeof date === 'string') ? new Date(date) : new Date(date);
    d.setHours(0,0,0,0);
    const filter = { date: d };
    if (timeSlotId) filter.timeSlotId = timeSlotId;
    else if (timeSlot) filter.timeSlot = timeSlot;
    return filter;
}

function escapeRegex(input = '') {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeDateISO(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function getSlotHourMinute(slotDoc) {
    if (!slotDoc) return null;
    if (typeof slotDoc.hour === 'number' && !Number.isNaN(slotDoc.hour)) {
        return { hour24: slotDoc.hour, minute: 0 };
    }

    const raw = String(slotDoc.label || '').trim();
    if (!raw) return null;

    const ampm = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (ampm) {
        const h = parseInt(ampm[1], 10);
        const m = parseInt(ampm[2] || '0', 10);
        const period = String(ampm[3]).toUpperCase();
        let hour24 = h % 12;
        if (period === 'PM') hour24 += 12;
        return { hour24, minute: m };
    }

    const hhmm = raw.match(/\b(\d{1,2}):(\d{2})\b/);
    if (hhmm) {
        return { hour24: parseInt(hhmm[1], 10), minute: parseInt(hhmm[2], 10) };
    }

    const hOnly = raw.match(/\b(\d{1,2})\b/);
    if (hOnly) return { hour24: parseInt(hOnly[1], 10), minute: 0 };
    return null;
}

function isClosedByTimeForDate(slotDoc, dateISO) {
    const hm = getSlotHourMinute(slotDoc);
    if (!hm || !dateISO) return false;

    const [y, m, d] = String(dateISO).split('-').map(Number);
    if (!y || !m || !d) return false;

    const closeAt = new Date(y, m - 1, d, hm.hour24, hm.minute, 0, 0);
    // Draw closes 10 minutes before slot time (same convention as frontend).
    closeAt.setMinutes(closeAt.getMinutes() - 10);
    return Date.now() >= closeAt.getTime();
}

async function isSlotClosedForRequest({ date, timeSlot, timeSlotId }) {
    let slotDoc = null;
    if (timeSlotId) slotDoc = await TimeSlot.findById(timeSlotId);
    else if (timeSlot) slotDoc = await TimeSlot.findOne({ label: timeSlot });
    if (!slotDoc) return false;

    let effectiveIsActive = !!slotDoc.isActive;
    const isoDate = normalizeDateISO(date);
    if (isoDate) {
        const override = await TimeSlotOverride.findOne({ timeSlotId: slotDoc._id, date: isoDate }).lean();
        if (override) effectiveIsActive = !!override.isActive;
    }

    if (effectiveIsActive === false) return true;
    if (isClosedByTimeForDate(slotDoc, isoDate)) return true;
    return false;
}

const addDataForTimeSlot = async (req, res) => {
    const { data, userId: targetUserIdBody, date, timeSlot, timeSlotId } = req.body;
    if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ error: 'data array is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });

    try {
        const slotDoc = timeSlotId ? await TimeSlot.findById(timeSlotId) : await TimeSlot.findOne({ label: timeSlot });
        if (!slotDoc) return res.status(404).json({ error: 'TimeSlot not found' });

        // Respect per-date override status first; fallback to base timeslot status.
        const isoDate = normalizeDateISO(date);
        let effectiveIsActive = !!slotDoc.isActive;
        if (isoDate) {
            const override = await TimeSlotOverride.findOne({ timeSlotId: slotDoc._id, date: isoDate }).lean();
            if (override) effectiveIsActive = !!override.isActive;
        }
        if (!effectiveIsActive) {
            return res.status(400).json({ error: `TimeSlot '${slotDoc.label}' is not active. Admin must activate it.` });
        }

        const d = (typeof date === 'string') ? new Date(date) : new Date(date);
        d.setHours(0,0,0,0);

        const totalAmount = data.reduce((sum, item) => sum + (Number(item.firstPrice) || 0) + (Number(item.secondPrice) || 0), 0);
        const effectiveUserId = targetUserIdBody || req.query.userId || req.user.id;
        const user = await User.findById(effectiveUserId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.balance < totalAmount) return res.status(400).json({ error: 'Insufficient balance', currentBalance: user.balance, requiredAmount: totalAmount });

        const payload = { userId: effectiveUserId, data, date: d, timeSlot: slotDoc.label, timeSlotId: slotDoc._id };

        const newData = new Data(payload);
        await newData.save();

        user.balance -= totalAmount;
        await user.save();

        res.status(201).json({ message: 'Data added successfully', newData, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const getDataForDate = async (req, res) => {
    const { date, timeSlot, timeSlotId } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });
    try {
        // If client requested enforcement that the timeslot must be closed before returning data
        if (req.query && req.query.requireClosed === 'true') {
            const isClosed = await isSlotClosedForRequest({ date, timeSlot, timeSlotId });
            if (!isClosed) return res.status(400).json({ error: 'Draw is not close yet' });
        }
        const filterBase = buildDateSlotFilter({ date, timeSlot, timeSlotId });
        filterBase.userId = req.user.id;
        const data = await Data.find(filterBase);
        if (!data || data.length === 0) return res.status(200).json({ data: [] });
        res.status(200).json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const deleteDataObjectById = async (req , res) => {
    const { id } = req.params;

    if(!id){
        return res.status(400).json({ error: "Id is required" });
    }

    try {
        const data = await Data.findById(id);
        if(!data){
            return res.status(404).json({ error: "No data associated to this id" });
        }
        if (data.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized: You can only delete your own data" });
        }

        const refundAmount = data.data.reduce((sum, item) => {
            return sum + item.firstPrice + item.secondPrice;
        }, 0);
        console.log("Refund Amount: ", refundAmount);
        // Find the user to refund the balance
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete the data
        await Data.findByIdAndDelete(id);

        // Refund the amount to user's balance
        user.balance += refundAmount;
        await user.save();
        return res.status(200).json({ message: "Data deleted successfully", newBalance: user.balance });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

// In your dataController.js
const deleteIndividualEntries = async (req, res) => {
    const { entryIds } = req.body; // Array of objectIds to delete
    console.log("Entry IDs to delete:", entryIds);
    console.log("User ID:", req.user.id);
    if (!entryIds || !Array.isArray(entryIds)) {
        return res.status(400).json({ error: "Entry IDs array is required" });
    }

    try {
        let totalRefund = 0;
        const deletedEntries = [];

        // Process each entry ID
        for (const entryId of entryIds) {
            // Find the parent document containing this entry
            const parentDocument = await Data.findOne({
                "data._id": entryId,
                userId: req.user.id
            });

            if (!parentDocument) {
                continue; // Skip if not found or doesn't belong to user
            }

            // Find the specific entry to calculate refund
            const entryToDelete = parentDocument.data.find(item => item._id.toString() === entryId);
            if (entryToDelete) {
                totalRefund += entryToDelete.firstPrice + entryToDelete.secondPrice;
                deletedEntries.push(entryToDelete);
            }

            // Remove the entry from the data array
            await Data.updateOne(
                { _id: parentDocument._id },
                { $pull: { data: { _id: entryId } } }
            );

            // Check if the document has no more entries, if so delete the whole document
            const updatedDocument = await Data.findById(parentDocument._id);
            if (updatedDocument.data.length === 0) {
                await Data.findByIdAndDelete(parentDocument._id);
            }
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Refund the balance to user
        if (totalRefund > 0) {
            user.balance += totalRefund;
            await user.save();
        }

        return res.status(200).json({
            message: "Selected entries deleted successfully",
            deletedCount: deletedEntries.length,
            refundAmount: totalRefund,
            newBalance: user?.balance
        });

    } catch (error) {
        console.error("Error deleting individual entries:", error);
        return res.status(500).json({ error: error.message });
    }
};

const getAllDocuments = async (req , res) => {
    try {
        const data = await Data.find();
        if(!data){
            return res.status(404).json({ error: "No data available" });
        }
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

const getWinningNumbers = async (req, res) => {
    const { date, timeSlot, timeSlotId } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });
    try {
        const d = (typeof date === 'string') ? new Date(date) : new Date(date);
        d.setHours(0,0,0,0);
        const filter = { date: d };
        if (timeSlotId) filter.timeSlotId = timeSlotId;
        else if (timeSlot) filter.timeSlot = timeSlot;

        const data = await Winner.findOne(filter);
        if (!data) return res.status(404).json({ error: 'No data found for the given date/timeSlot' });
        const winningNumbers = data.WinningNumbers.map(item => ({ number: item.number, type: item.type }));
        res.status(200).json({ winningNumbers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const setWinningNumbers = async (req, res) => {
    const { date, winningNumbers, timeSlot, timeSlotId } = req.body;
    if (!date || !winningNumbers || !Array.isArray(winningNumbers)) return res.status(400).json({ error: 'date and winningNumbers are required' });
    try {
        const d = (typeof date === 'string') ? new Date(date) : new Date(date);
        d.setHours(0,0,0,0);
        const filter = { date: d };
        if (timeSlotId) filter.timeSlotId = timeSlotId;
        else if (timeSlot) filter.timeSlot = timeSlot;

        const existingWinner = await Winner.findOne(filter);
        if (existingWinner) return res.status(400).json({ error: 'Winning numbers already set for this date/timeSlot' });
        const payload = { userId: req.user.id, date: d, WinningNumbers: winningNumbers.map(num => ({ number: num.number, type: num.type })) };
        if (timeSlot) payload.timeSlot = timeSlot;
        if (timeSlotId) payload.timeSlotId = timeSlotId;
        const newWinner = new Winner(payload);
        await newWinner.save();
        res.status(201).json({ message: 'Winning numbers set successfully', newWinner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const updateWinningNumbers = async (req, res) => {
    const { date, numbers, winningNumbers, timeSlot, timeSlotId } = req.body;
    const arr = numbers || winningNumbers || req.body.winningNumbers;
    if (!date || !arr || !Array.isArray(arr)) return res.status(400).json({ error: 'date and winningNumbers array are required' });
    try {
        const d = (typeof date === 'string') ? new Date(date) : new Date(date);
        d.setHours(0,0,0,0);
        const filter = { date: d };
        if (timeSlotId) filter.timeSlotId = timeSlotId;
        else if (timeSlot) filter.timeSlot = timeSlot;

        const existingWinner = await Winner.findOne(filter);
        if (!existingWinner) return res.status(404).json({ error: 'Winning numbers not found for this date/timeSlot' });
        existingWinner.WinningNumbers = arr.map(num => ({ number: num.number, type: num.type }));
        await existingWinner.save();
        res.status(200).json({ success: true, message: 'Winning numbers updated successfully', winner: existingWinner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const deleteWinningNumbers = async (req, res) => {
    const { date, timeSlot, timeSlotId } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });
    try {
        const d = (typeof date === 'string') ? new Date(date) : new Date(date);
        d.setHours(0,0,0,0);
        const filter = { date: d };
        if (timeSlotId) filter.timeSlotId = timeSlotId;
        else if (timeSlot) filter.timeSlot = timeSlot;

        const deleted = await Winner.findOneAndDelete(filter);
        if (!deleted) return res.status(404).json({ error: 'Winning numbers not found for this date/timeSlot' });
        res.status(200).json({ success: true, message: 'Winning numbers deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const getDataForClient = async (req, res) => {
    const { date, timeSlot, timeSlotId, userId } = req.query;
    if (!date || !userId) return res.status(400).json({ error: 'date and userId are required' });
    try {
        // Enforce closed timeslot when requested by client
        if (req.query && req.query.requireClosed === 'true') {
            const isClosed = await isSlotClosedForRequest({ date, timeSlot, timeSlotId });
            if (!isClosed) return res.status(400).json({ error: 'Draw is not close yet' });
        }
        const filterBase = buildDateSlotFilter({ date, timeSlot, timeSlotId });
        filterBase.userId = userId;
        const data = await Data.find(filterBase);
        if (!data || data.length === 0) return res.status(404).json({ error: 'No data found for the given date and user' });
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCombinedVoucherData = async (req, res) => {
    const { date, timeSlot, timeSlotId, userId } = req.query;
    
    // Require at least one of date/timeSlot/timeSlotId. Additionally,
    // when timeSlotId is provided we require a `date` to avoid returning
    // data across multiple dates for the same slot id.

    if (!date && !timeSlot && !timeSlotId) return res.status(400).json({ error: 'date or timeSlot/timeSlotId is required' });
    if (timeSlotId && !date) return res.status(400).json({ error: 'date is required when timeSlotId is provided' });
    try {
        // If client requested enforcement that the timeslot must be closed before returning data
        if (req.query && req.query.requireClosed === 'true') {
            const isClosed = await isSlotClosedForRequest({ date, timeSlot, timeSlotId });
            if (!isClosed) return res.status(400).json({ error: 'Draw is not close yet' });
        }
        const filter = buildDateSlotFilter({ date, timeSlot, timeSlotId });
        const role = req.user?.role;
        const requesterId = String(req.user?.id || '');

        // Scope data by requester role.
        if (role === 'user') {
            // Regular users can only see their own records.
            filter.userId = requesterId;
        } else if (role === 'distributor') {
            // Distributors can only see users/parties created under them.
            const clientUsers = await User.find({
                createdBy: requesterId,
                role: { $in: ['user', 'party'] },
            }).select('_id');
            const clientIds = clientUsers.map((u) => u._id);

            if (clientIds.length === 0) {
                return res.status(200).json({ data: [] });
            }

            if (userId) {
                const targetUserId = String(userId);
                const isOwnClient = clientIds.some((id) => String(id) === targetUserId);
                if (!isOwnClient) {
                    return res.status(403).json({ error: 'Unauthorized: selected user is not your client' });
                }
                filter.userId = targetUserId;
            } else {
                filter.userId = { $in: clientIds };
            }
        } else if (userId) {
            // Admin (or other privileged role): optional explicit user filter.
            filter.userId = userId;
        }

        // Populate user info so frontend can show dealer names
        const data = await Data.find(filter).populate('userId', 'username dealerId');
        if (!data || data.length === 0) return res.status(404).json({ error: 'No data found for the given filter' });
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const searchDataByNumber = async (req, res) => {
    const { date, timeSlot, timeSlotId, q, userId } = req.query;
    if (!date || !q) return res.status(400).json({ error: 'date and q are required' });

    try {
        const filter = buildDateSlotFilter({ date, timeSlot, timeSlotId });
        const role = req.user?.role;
        const requesterId = String(req.user?.id || '');

        if (role === 'user') {
            filter.userId = requesterId;
        } else if (role === 'distributor') {
            const clientUsers = await User.find({
                createdBy: requesterId,
                role: { $in: ['user', 'party'] },
            }).select('_id');
            const clientIds = clientUsers.map((u) => u._id);
            if (clientIds.length === 0) {
                return res.status(200).json({ data: [] });
            }
            filter.userId = { $in: clientIds };
        } else if (role === 'admin') {
            if (userId) filter.userId = userId;
        }

        const needle = String(q || '').trim();
        if (!needle) return res.status(200).json({ data: [] });
        const regex = new RegExp(`^${escapeRegex(needle)}$`);

        const docs = await Data.find(filter).populate('userId', 'username dealerId').lean();
        const rows = [];

        for (const doc of (docs || [])) {
            const owner = doc.userId || {};
            for (const item of (doc.data || [])) {
                const no = String(item.uniqueId || '');
                if (!regex.test(no)) continue;
                rows.push({
                    parentId: doc._id,
                    objectId: item._id,
                    no,
                    f: Number(item.firstPrice) || 0,
                    s: Number(item.secondPrice) || 0,
                    clientId: owner._id || null,
                    clientName: owner.username || '',
                    clientDealerId: owner.dealerId || '',
                    date: doc.date,
                    timeSlot: doc.timeSlot,
                    timeSlotId: doc.timeSlotId || null,
                });
            }
        }

        return res.status(200).json({ data: rows });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const searchDistributorCombinedByNumber = async (req, res) => {
    const { date, timeSlot, timeSlotId, q } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied, admin privileges required' });
        }

        if (req.query && req.query.requireClosed === 'true') {
            const isClosed = await isSlotClosedForRequest({ date, timeSlot, timeSlotId });
            if (!isClosed) return res.status(400).json({ error: 'Draw is not close yet' });
        }

        const filter = buildDateSlotFilter({ date, timeSlot, timeSlotId });
        const docs = await Data.find(filter).populate('userId', 'username dealerId createdBy role').lean();
        if (!docs || docs.length === 0) return res.status(200).json({ data: [] });

        const numberNeedle = String(q || '').trim();
        const hasNeedle = numberNeedle.length > 0;

        const distributorIdSet = new Set();
        const normalizedRows = [];

        for (const doc of docs) {
            const owner = doc.userId;
            if (!owner) continue;

            // If row owner is a distributor itself, keep it; otherwise map via createdBy.
            const distributorId = owner.role === 'distributor'
                ? String(owner._id)
                : (owner.createdBy ? String(owner.createdBy) : null);
            if (!distributorId) continue;

            distributorIdSet.add(distributorId);

            for (const item of (doc.data || [])) {
                const no = String(item?.uniqueId || '').trim();
                if (!no) continue;
                if (hasNeedle && no !== numberNeedle) continue;

                normalizedRows.push({
                    distributorId,
                    number: no,
                    first: Number(item.firstPrice) || 0,
                    second: Number(item.secondPrice) || 0,
                });
            }
        }

        if (!normalizedRows.length) return res.status(200).json({ data: [] });

        const distributorIds = Array.from(distributorIdSet);
        const distributors = await User.find({ _id: { $in: distributorIds } })
            .select('username dealerId')
            .lean();
        const distributorMap = new Map(distributors.map((d) => [String(d._id), d]));

        // Distributor-wise combined values by NO.
        const combinedMap = new Map();
        for (const row of normalizedRows) {
            const key = `${row.distributorId}::${row.number}`;
            if (!combinedMap.has(key)) {
                combinedMap.set(key, {
                    distributorId: row.distributorId,
                    number: row.number,
                    first: 0,
                    second: 0,
                });
            }
            const target = combinedMap.get(key);
            target.first += row.first;
            target.second += row.second;
        }

        const result = Array.from(combinedMap.values()).map((r) => {
            const dist = distributorMap.get(String(r.distributorId));
            return {
                distributorId: r.distributorId,
                distributorName: dist?.username || '',
                distributorDealerId: dist?.dealerId || '',
                number: r.number,
                first: r.first,
                second: r.second,
            };
        });

        result.sort((a, b) => {
            const da = `${a.distributorDealerId || ''}`;
            const db = `${b.distributorDealerId || ''}`;
            const dcmp = da.localeCompare(db, undefined, { numeric: true, sensitivity: 'base' });
            if (dcmp !== 0) return dcmp;

            const na = String(a.number || '').replace(/\+/g, '');
            const nb = String(b.number || '').replace(/\+/g, '');
            return na.localeCompare(nb, undefined, { numeric: true, sensitivity: 'base' });
        });

        return res.status(200).json({ data: result });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export {
    addDataForTimeSlot,
    getDataForDate,
    deleteDataObjectById,
    getAllDocuments,
    getWinningNumbers,
    setWinningNumbers,
    updateWinningNumbers,
    deleteWinningNumbers,
    deleteIndividualEntries,
    getDataForClient,
    getCombinedVoucherData,
    searchDataByNumber,
    searchDistributorCombinedByNumber
}

