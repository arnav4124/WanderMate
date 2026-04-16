const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    user: { type: String, required: true }, // Firebase UID
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    category: {
        type: String,
        enum: ['accommodation', 'food', 'transport', 'activities', 'other'],
        required: true,
    },
    date: { type: Date, required: true },
    dayNumber: Number,
    splitAmong: [{ type: String }], // Firebase UIDs of people sharing this expense
}, {
    timestamps: true,
});

expenseSchema.index({ trip: 1, date: 1 });
expenseSchema.index({ trip: 1, user: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
