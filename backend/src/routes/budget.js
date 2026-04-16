const express = require('express');
const Expense = require('../models/Expense');
const Trip = require('../models/Trip');
const { firebaseDB } = require('../config/firebase');

const router = express.Router();

// GET /api/budget/:tripId - Get all expenses for a trip
router.get('/:tripId', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const expenses = await Expense.find({ trip: req.params.tripId }).sort({ date: 1 });

        // Calculate summaries
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);

        const byCategory = expenses.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {});

        const byDay = expenses.reduce((acc, e) => {
            const dayKey = e.dayNumber || 'unassigned';
            acc[dayKey] = (acc[dayKey] || 0) + e.amount;
            return acc;
        }, {});

        // Calculate split per person (FR-14)
        const participants = new Set([trip.owner, ...trip.collaborators]);
        const perPerson = total / participants.size;

        res.json({
            expenses,
            summary: {
                total,
                byCategory,
                byDay,
                participantCount: participants.size,
                perPerson: Math.round(perPerson * 100) / 100,
            },
        });
    } catch (error) {
        console.error('Get budget error:', error);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

// POST /api/budget/:tripId - Add expense
router.post('/:tripId', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.owner !== req.user.uid && !trip.collaborators.includes(req.user.uid)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { description, amount, category, date, dayNumber, currency } = req.body;

        if (!description || !amount || !category || !date) {
            return res.status(400).json({ error: 'description, amount, category, and date are required' });
        }

        const expense = new Expense({
            trip: req.params.tripId,
            user: req.user.uid,
            description,
            amount,
            currency: currency || 'USD',
            category,
            date: new Date(date),
            dayNumber,
            splitAmong: [trip.owner, ...trip.collaborators],
        });

        await expense.save();

        // Real-time sync to Firebase (FR-15)
        await firebaseDB.ref(`budgets/${req.params.tripId}/lastUpdate`).set({
            updatedAt: Date.now(),
            updatedBy: req.user.uid,
        });

        res.status(201).json(expense);
    } catch (error) {
        console.error('Add expense error:', error);
        res.status(500).json({ error: 'Failed to add expense' });
    }
});

// PUT /api/budget/:tripId/:expenseId - Update expense
router.put('/:tripId/:expenseId', async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.expenseId,
            trip: req.params.tripId,
        });

        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        const updates = req.body;
        Object.assign(expense, updates);
        await expense.save();

        await firebaseDB.ref(`budgets/${req.params.tripId}/lastUpdate`).set({
            updatedAt: Date.now(),
            updatedBy: req.user.uid,
        });

        res.json(expense);
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

// DELETE /api/budget/:tripId/:expenseId - Delete expense
router.delete('/:tripId/:expenseId', async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({
            _id: req.params.expenseId,
            trip: req.params.tripId,
        });

        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        await firebaseDB.ref(`budgets/${req.params.tripId}/lastUpdate`).set({
            updatedAt: Date.now(),
            updatedBy: req.user.uid,
        });

        res.json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

module.exports = router;
