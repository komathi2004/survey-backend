const Lead = require('../models/Lead');
const Survey = require('../models/Survey');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// GET /api/dashboard/manager
exports.managerDashboard = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    const [
      totalLeads,
      newLeads,
      assignedLeads,
      completedLeads,
      disputeLeads,
      outOfScopeLeads,
      totalSurveys,
      scheduledSurveys,
      inProgressSurveys,
      completedSurveys,
      disputeSurveys,
      outOfScopeSurveys,
      totalSurveyors,
      activeSurveyors,
    ] = await Promise.all([
      Lead.countDocuments({ ...dateFilter }),
      Lead.countDocuments({ status: 'new', ...dateFilter }),
      Lead.countDocuments({ status: 'assigned', ...dateFilter }),
      Lead.countDocuments({ status: 'completed', ...dateFilter }),
      Lead.countDocuments({ status: 'dispute', ...dateFilter }),
      Lead.countDocuments({ status: 'out_of_scope', ...dateFilter }),
      Survey.countDocuments({ ...dateFilter }),
      Survey.countDocuments({ status: 'scheduled', ...dateFilter }),
      Survey.countDocuments({ status: 'in_progress', ...dateFilter }),
      Survey.countDocuments({ status: 'completed', ...dateFilter }),
      Survey.countDocuments({ disposition: 'dispute', ...dateFilter }),
      Survey.countDocuments({ disposition: 'out_of_scope', ...dateFilter }),
      User.countDocuments({ role: 'surveyor' }),
      User.countDocuments({ role: 'surveyor', isActive: true }),
    ]);

    // Surveyor productivity: completed surveys per surveyor
    const surveyorProductivity = await Survey.aggregate([
      { $match: { disposition: 'work_completed' } },
      { $group: { _id: '$assignedSurveyor', completedCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'surveyor' } },
      { $unwind: '$surveyor' },
      { $project: { name: '$surveyor.name', completedCount: 1 } },
      { $sort: { completedCount: -1 } },
      { $limit: 10 },
    ]);

    // Daily activity: surveys created last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyActivity = await Survey.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Completion rate
    const completionRate = totalSurveys > 0 ? ((completedSurveys / totalSurveys) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        leads: { total: totalLeads, new: newLeads, assigned: assignedLeads, completed: completedLeads, dispute: disputeLeads, outOfScope: outOfScopeLeads },
        surveys: { total: totalSurveys, scheduled: scheduledSurveys, inProgress: inProgressSurveys, completed: completedSurveys, dispute: disputeSurveys, outOfScope: outOfScopeSurveys, completionRate: `${completionRate}%` },
        workforce: { totalSurveyors, activeSurveyors },
        surveyorProductivity,
        dailyActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/stakeholder
exports.stakeholderDashboard = async (req, res) => {
  try {
    const [
      totalSurveys,
      completedSurveys,
      disputeCount,
      outOfScopeCount,
      totalLeads,
    ] = await Promise.all([
      Survey.countDocuments(),
      Survey.countDocuments({ disposition: 'work_completed' }),
      Survey.countDocuments({ disposition: 'dispute' }),
      Survey.countDocuments({ disposition: 'out_of_scope' }),
      Lead.countDocuments(),
    ]);

    const completionRate = totalSurveys > 0 ? ((completedSurveys / totalSurveys) * 100).toFixed(1) : 0;

    // Regional distribution by lead address (simple grouping)
    const regionalDistribution = await Lead.aggregate([
      { $group: { _id: '$surveyType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Monthly trend last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Survey.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$disposition', 'work_completed'] }, 1, 0] } },
          disputes: { $sum: { $cond: [{ $eq: ['$disposition', 'dispute'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalLeads,
        totalSurveys,
        completedSurveys,
        completionRate: `${completionRate}%`,
        disputeCount,
        outOfScopeCount,
        regionalDistribution,
        monthlyTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/surveyor  (surveyor's own stats)
exports.surveyorDashboard = async (req, res) => {
  try {
    const id = req.user._id;
    const [total, completed, pending, dispute, outOfScope, inProgress] = await Promise.all([
      Survey.countDocuments({ assignedSurveyor: id }),
      Survey.countDocuments({ assignedSurveyor: id, disposition: 'work_completed' }),
      Survey.countDocuments({ assignedSurveyor: id, status: 'scheduled' }),
      Survey.countDocuments({ assignedSurveyor: id, disposition: 'dispute' }),
      Survey.countDocuments({ assignedSurveyor: id, disposition: 'out_of_scope' }),
      Survey.countDocuments({ assignedSurveyor: id, status: 'in_progress' }),
    ]);

    const recent = await Survey.find({ assignedSurveyor: id })
      .populate('lead', 'customerName address')
      .sort('-createdAt')
      .limit(5);

    res.json({ success: true, data: { total, completed, pending, dispute, outOfScope, inProgress, recentSurveys: recent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};