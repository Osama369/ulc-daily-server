import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Date of the entry (YYYY-MM-DD, time portion should be zeroed)
    date: {
        type: Date,
        required: true,
    },

    // TimeSlot information (admin-created). Keep both label and optional ref.
    timeSlot: {
        type: String,
        required: true,
    },
    timeSlotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimeSlot',
        required: false,
    },

    // Minimal data entries: uniqueId, firstPrice, secondPrice
    data: [
        {
            uniqueId: {
                type: String,
                required: true,
            },
            firstPrice: {
                type: Number,
                required: true,
            },
            secondPrice: {
                type: Number,
                required: true,
            },
        }
    ],
}, {
    timestamps: true,
});

export default mongoose.model("Data", dataSchema);
