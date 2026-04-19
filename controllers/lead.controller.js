const Lead = require('../models/Lead');
const xlsx = require('xlsx');
const sendNotification = require('../utils/sendNotification');
const User = require('../models/User');

// POST /api/leads  - create single lead
exports.createLead = async (req, res) => {
  try {
    const lead = await Lead.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/leads
exports.getLeads = async (req, res) => {
  try {
    const { status, priority, assignedSurveyor, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedSurveyor) filter.assignedSurveyor = assignedSurveyor;

    if (req.user.role === 'surveyor') filter.assignedSurveyor = req.user._id;

    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { leadId: { $regex: search, $options: 'i' } },
        { customerContact: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('assignedSurveyor', 'name mobile')
        .populate('createdBy', 'name')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Lead.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/leads/:id
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedSurveyor', 'name mobile email')
      .populate('createdBy', 'name');
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/:id/assign
exports.assignLead = async (req, res) => {
  try {
    const { surveyorId } = req.body;

    const surveyor = await User.findById(surveyorId);
    if (!surveyor || surveyor.role !== 'surveyor') {
      return res.status(400).json({ success: false, message: 'Invalid surveyor' });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { assignedSurveyor: surveyorId, assignedAt: new Date(), status: 'assigned' },
      { new: true }
    ).populate('assignedSurveyor', 'name mobile');

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    await sendNotification({
      recipients: [surveyorId],
      title: 'New Lead Assigned',
      message: `You have been assigned lead ${lead.leadId} for ${lead.customerName}`,
      type: 'survey_assigned',
      referenceId: lead._id,
      referenceModel: 'Lead',
    });

    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/import  - bulk import from Excel
exports.importLeads = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required' });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows.length) return res.status(400).json({ success: false, message: 'No data found in file' });

    const batchId = `IMPORT-${Date.now()}`;
    const leads = rows.map((row) => ({
      customerName: row['Customer Name'] || row['customerName'],
      customerContact: row['Contact'] || row['customerContact'],
      customerEmail: row['Email'] || row['customerEmail'],
      address: row['Address'] || row['address'],
      surveyType: row['Survey Type'] || row['surveyType'],
      priority: (row['Priority'] || 'medium').toLowerCase(),
      leadSource: 'import',
      importBatch: batchId,
      createdBy: req.user._id,
    })).filter((l) => l.customerName && l.customerContact && l.address);

    const inserted = await Lead.insertMany(leads, { ordered: false });
    res.json({ success: true, imported: inserted.length, batchId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};