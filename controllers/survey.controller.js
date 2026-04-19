const Survey = require('../models/Survey');
const Lead = require('../models/Lead');
const User = require('../models/User');
const sendSMS = require('../utils/sendSMS');
const sendNotification = require('../utils/sendNotification');
const logGeo = require('../utils/geoLogger');

// POST /api/surveys  - schedule survey
exports.scheduleSurvey = async (req, res) => {
  try {
    const { leadId, surveyorId, scheduledDate, scheduledTime } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const surveyor = await User.findById(surveyorId);
    if (!surveyor || surveyor.role !== 'surveyor') {
      return res.status(400).json({ success: false, message: 'Invalid surveyor' });
    }

    const survey = await Survey.create({
      lead: leadId,
      assignedSurveyor: surveyorId,
      scheduledDate,
      scheduledTime,
      createdBy: req.user._id,
    });

    // Update lead status
    await Lead.findByIdAndUpdate(leadId, { status: 'assigned', assignedSurveyor: surveyorId, assignedAt: new Date() });

    // Notify surveyor
    await sendNotification({
      recipients: surveyorId,
      title: 'Survey Scheduled',
      message: `Survey ${survey.surveyId} scheduled for ${lead.customerName} on ${scheduledDate}`,
      type: 'survey_assigned',
      referenceId: survey._id,
      referenceModel: 'Survey',
    });

    // SMS to customer
    if (lead.customerContact) {
      const smsText = `Dear ${lead.customerName}, your site survey has been scheduled. Our surveyor will visit on ${scheduledDate}. Ref: ${survey.surveyId}`;
      const smsResult = await sendSMS(lead.customerContact, smsText);
      await Survey.findByIdAndUpdate(survey._id, {
        customerSmsStatus: smsResult.success ? 'sent' : 'failed',
        customerSmsSentAt: new Date(),
      });
    }

    const populated = await Survey.findById(survey._id).populate('lead').populate('assignedSurveyor', 'name mobile');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/surveys
exports.getSurveys = async (req, res) => {
  try {
    const { status, disposition, page = 1, limit = 20, surveyorId, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (disposition) filter.disposition = disposition;
    if (surveyorId) filter.assignedSurveyor = surveyorId;
    if (date) filter.scheduledDate = { $gte: new Date(date), $lt: new Date(new Date(date).getTime() + 86400000) };

    // Surveyors only see their own
    if (req.user.role === 'surveyor') filter.assignedSurveyor = req.user._id;

    const skip = (Number(page) - 1) * Number(limit);
    const [surveys, total] = await Promise.all([
      Survey.find(filter)
        .populate('lead', 'leadId customerName customerContact address surveyType priority')
        .populate('assignedSurveyor', 'name mobile')
        .populate('createdBy', 'name')
        .sort('-createdAt').skip(skip).limit(Number(limit)),
      Survey.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: surveys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/surveys/:id
exports.getSurvey = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id)
      .populate('lead')
      .populate('assignedSurveyor', 'name mobile email')
      .populate('createdBy', 'name');
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    res.json({ success: true, data: survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/surveys/:id/start  (Surveyor starts survey, captures geo)
exports.startSurvey = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    if (survey.assignedSurveyor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your survey' });
    }

    survey.status = 'in_progress';
    survey.startedAt = new Date();
    if (latitude && longitude) {
      survey.startLocation = { latitude, longitude, capturedAt: new Date() };
      await logGeo({ userId: req.user._id, event: 'survey_start', latitude, longitude, referenceId: survey._id });
    }
    await survey.save();
    await Lead.findByIdAndUpdate(survey.lead, { status: 'in_progress' });

    res.json({ success: true, data: survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/surveys/:id/submit  (Surveyor submits disposition + images)
exports.submitSurvey = async (req, res) => {
  try {
    const { disposition, dispositionNotes, disputeReason, disputeDetails, outOfScopeDetails, latitude, longitude } = req.body;
    const survey = await Survey.findById(req.params.id).populate('lead');
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    if (survey.assignedSurveyor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your survey' });
    }

    const validDispositions = ['work_completed', 'work_not_completed', 'dispute', 'out_of_scope'];
    if (!validDispositions.includes(disposition)) {
      return res.status(400).json({ success: false, message: 'Invalid disposition' });
    }

    survey.disposition = disposition;
    survey.dispositionNotes = dispositionNotes;
    survey.completedAt = new Date();

    // FIX: map disposition → survey status correctly
    const surveyStatusMap = {
      work_completed:     'completed',
      work_not_completed: 'work_not_completed',
      dispute:            'dispute',
      out_of_scope:       'out_of_scope',
    };
    survey.status = surveyStatusMap[disposition] || 'completed';

    if (disposition === 'dispute') {
      survey.disputeReason = disputeReason;
      survey.disputeDetails = disputeDetails;
    }
    if (disposition === 'out_of_scope') {
      survey.outOfScopeDetails = outOfScopeDetails;
    }

    if (latitude && longitude) {
      survey.completionLocation = { latitude, longitude, capturedAt: new Date() };
      await logGeo({ userId: req.user._id, event: 'survey_complete', latitude, longitude, referenceId: survey._id });
    }

    // Attach uploaded images
    if (req.files && req.files.length > 0) {
      survey.images = req.files.map((f) => f.path);
    }

    await survey.save();

    // FIX: map disposition → lead status correctly
    // Lead model enum: 'new','assigned','in_progress','completed','dispute','out_of_scope','cancelled'
    const leadStatusMap = {
      work_completed:     'completed',
      work_not_completed: 'in_progress',   // no matching lead status — keep in_progress
      dispute:            'dispute',
      out_of_scope:       'out_of_scope',
    };
    const leadStatus = leadStatusMap[disposition] || 'in_progress';
    await Lead.findByIdAndUpdate(survey.lead._id, { status: leadStatus });

    // Get managers and stakeholders for notifications
    const managers     = await User.find({ role: 'manager',     isActive: true }).select('_id');
    const stakeholders = await User.find({ role: 'stakeholder', isActive: true }).select('_id');
    const managerIds     = managers.map((m) => m._id);
    const stakeholderIds = stakeholders.map((s) => s._id);

    if (disposition === 'work_completed') {
      await sendNotification({
        recipients: managerIds,
        title: 'Survey Completed',
        message: `Survey ${survey.surveyId} completed by ${req.user.name}`,
        type: 'survey_completed',
        referenceId: survey._id,
        referenceModel: 'Survey',
      });
    }

    if (disposition === 'dispute') {
      await sendNotification({
        recipients: [...managerIds, ...stakeholderIds],
        title: 'Dispute Flagged',
        message: `Dispute raised on survey ${survey.surveyId}: ${disputeReason || ''}`,
        type: 'dispute_flagged',
        referenceId: survey._id,
        referenceModel: 'Survey',
      });
    }

    if (disposition === 'out_of_scope') {
      await sendNotification({
        recipients: managerIds,
        title: 'Out of Scope Flagged',
        message: `Survey ${survey.surveyId} flagged as out of scope`,
        type: 'out_of_scope_flagged',
        referenceId: survey._id,
        referenceModel: 'Survey',
      });
    }

    res.json({ success: true, data: survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/surveys/:id/reassign  (Manager reassigns survey to different surveyor)
exports.reassignSurvey = async (req, res) => {
  try {
    const { surveyorId } = req.body;
    const surveyor = await User.findById(surveyorId);
    if (!surveyor || surveyor.role !== 'surveyor') {
      return res.status(400).json({ success: false, message: 'Invalid surveyor' });
    }

    const survey = await Survey.findById(req.params.id).populate('lead');
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });

    const previousSurveyor = survey.assignedSurveyor;
    survey.reassignedFrom = previousSurveyor;
    survey.reassignedAt = new Date();
    survey.assignedSurveyor = surveyorId;
    survey.status = 'scheduled';
    await survey.save();

    // SMS customer again
    if (survey.lead && survey.lead.customerContact) {
      await sendSMS(survey.lead.customerContact, `Your survey has been reassigned. New surveyor will contact you. Ref: ${survey.surveyId}`);
    }

    await sendNotification({
      recipients: surveyorId,
      title: 'Survey Reassigned To You',
      message: `Survey ${survey.surveyId} has been assigned to you`,
      type: 'survey_reassigned',
      referenceId: survey._id,
      referenceModel: 'Survey',
    });

    res.json({ success: true, data: survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};