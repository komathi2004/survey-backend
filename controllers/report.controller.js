const Survey = require('../models/Survey');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

// ─── helpers ──────────────────────────────────────────────────────────────────

const buildSurveyFilter = (query) => {
  const { status, disposition, from, to, surveyorId } = query;
  const filter = {};
  if (status) filter.status = status;
  if (disposition) filter.disposition = disposition;
  if (surveyorId) filter.assignedSurveyor = surveyorId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
};

const buildAttendanceFilter = (query) => {
  const { from, to, siteEngineer } = query;
  const filter = {};
  if (siteEngineer) filter.siteEngineer = siteEngineer;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return filter;
};

// ─── Survey Status Report ─────────────────────────────────────────────────────

exports.surveyStatusReport = async (req, res) => {
  try {
    const surveys = await Survey.find(buildSurveyFilter(req.query))
      .populate('lead', 'leadId customerName customerContact address surveyType priority')
      .populate('assignedSurveyor', 'name mobile')
      .sort('-createdAt')
      .lean();

    const rows = surveys.map((s) => ({
      'Survey ID': s.surveyId,
      'Lead ID': s.lead?.leadId || '',
      'Customer': s.lead?.customerName || '',
      'Contact': s.lead?.customerContact || '',
      'Address': s.lead?.address || '',
      'Survey Type': s.lead?.surveyType || '',
      'Surveyor': s.assignedSurveyor?.name || '',
      'Scheduled Date': s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : '',
      'Status': s.status,
      'Disposition': s.disposition || '',
      'Dispute Reason': s.disputeReason || '',
      'Notes': s.dispositionNotes || '',
      'Started At': s.startedAt ? new Date(s.startedAt).toLocaleString() : '',
      'Completed At': s.completedAt ? new Date(s.completedAt).toLocaleString() : '',
    }));

    return sendReport(req, res, rows, 'Survey_Status_Report', surveys, (doc) => {
      doc.fontSize(10);
      surveys.forEach((s) => {
        doc.text(`${s.surveyId} | ${s.lead?.customerName || ''} | ${s.assignedSurveyor?.name || ''} | ${s.status} | ${s.disposition || '-'}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Surveyor Performance Report ─────────────────────────────────────────────

exports.surveyorPerformanceReport = async (req, res) => {
  try {
    const data = await Survey.aggregate([
      {
        $group: {
          _id: '$assignedSurveyor',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$disposition', 'work_completed'] }, 1, 0] } },
          notCompleted: { $sum: { $cond: [{ $eq: ['$disposition', 'work_not_completed'] }, 1, 0] } },
          disputes: { $sum: { $cond: [{ $eq: ['$disposition', 'dispute'] }, 1, 0] } },
          outOfScope: { $sum: { $cond: [{ $eq: ['$disposition', 'out_of_scope'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'surveyor' } },
      { $unwind: { path: '$surveyor', preserveNullAndEmpty: true } },
      { $sort: { completed: -1 } },
    ]);

    const rows = data.map((d) => ({
      'Surveyor': d.surveyor?.name || 'Unknown',
      'Employee ID': d.surveyor?.employeeId || '',
      'Mobile': d.surveyor?.mobile || '',
      'Total Assigned': d.total,
      'Completed': d.completed,
      'Not Completed': d.notCompleted,
      'Disputes': d.disputes,
      'Out of Scope': d.outOfScope,
      'Completion Rate': d.total > 0 ? `${((d.completed / d.total) * 100).toFixed(1)}%` : '0%',
    }));

    return sendReport(req, res, rows, 'Surveyor_Performance_Report', data, (doc) => {
      doc.fontSize(10);
      data.forEach((d) => {
        doc.text(`${d.surveyor?.name || 'Unknown'} | Total: ${d.total} | Completed: ${d.completed} | Disputes: ${d.disputes}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Dispute Report ───────────────────────────────────────────────────────────

exports.disputeReport = async (req, res) => {
  try {
    const surveys = await Survey.find({ disposition: 'dispute', ...buildSurveyFilter(req.query) })
      .populate('lead', 'leadId customerName customerContact address')
      .populate('assignedSurveyor', 'name mobile')
      .lean();

    const rows = surveys.map((s) => ({
      'Survey ID': s.surveyId,
      'Customer': s.lead?.customerName || '',
      'Contact': s.lead?.customerContact || '',
      'Address': s.lead?.address || '',
      'Surveyor': s.assignedSurveyor?.name || '',
      'Dispute Reason': s.disputeReason || '',
      'Dispute Details': s.disputeDetails || '',
      'Date': s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '',
    }));

    return sendReport(req, res, rows, 'Dispute_Report', surveys, (doc) => {
      doc.fontSize(10);
      surveys.forEach((s) => {
        doc.text(`${s.surveyId} | ${s.lead?.customerName || ''} | ${s.disputeReason || ''} | ${s.disputeDetails || ''}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Out of Scope Report ──────────────────────────────────────────────────────

exports.outOfScopeReport = async (req, res) => {
  try {
    const surveys = await Survey.find({ disposition: 'out_of_scope', ...buildSurveyFilter(req.query) })
      .populate('lead', 'leadId customerName customerContact address surveyType')
      .populate('assignedSurveyor', 'name mobile')
      .lean();

    const rows = surveys.map((s) => ({
      'Survey ID': s.surveyId,
      'Customer': s.lead?.customerName || '',
      'Survey Type': s.lead?.surveyType || '',
      'Address': s.lead?.address || '',
      'Surveyor': s.assignedSurveyor?.name || '',
      'Out of Scope Details': s.outOfScopeDetails || '',
      'Date': s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '',
    }));

    return sendReport(req, res, rows, 'OutOfScope_Report', surveys, (doc) => {
      doc.fontSize(10);
      surveys.forEach((s) => {
        doc.text(`${s.surveyId} | ${s.lead?.customerName || ''} | ${s.outOfScopeDetails || ''}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Attendance Report ────────────────────────────────────────────────────────

exports.attendanceReport = async (req, res) => {
  try {
    const records = await Attendance.find(buildAttendanceFilter(req.query))
      .populate('siteEngineer', 'name employeeId')
      .sort('-date')
      .lean();

    const rows = records.map((r) => ({
      'Site Engineer': r.siteEngineer?.name || '',
      'Employee ID': r.siteEngineer?.employeeId || '',
      'Worker Name': r.workerName,
      'Worker ID': r.workerId,
      'Date': r.date,
      'Status': r.status,
      'Check-In': r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '',
      'Check-Out': r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '',
      'Site': r.siteLocation || '',
      'Check-In Lat': r.checkInLocation?.latitude || '',
      'Check-In Lng': r.checkInLocation?.longitude || '',
      'Notes': r.notes || '',
    }));

    return sendReport(req, res, rows, 'Attendance_Report', records, (doc) => {
      doc.fontSize(10);
      records.forEach((r) => {
        doc.text(`${r.date} | ${r.workerName} (${r.workerId}) | ${r.status} | Engineer: ${r.siteEngineer?.name || ''}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Site Engineer Activity Report ───────────────────────────────────────────

exports.engineerActivityReport = async (req, res) => {
  try {
    const data = await Attendance.aggregate([
      {
        $group: {
          _id: '$siteEngineer',
          totalMarked: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'engineer' } },
      { $unwind: { path: '$engineer', preserveNullAndEmpty: true } },
      { $sort: { totalMarked: -1 } },
    ]);

    const rows = data.map((d) => ({
      'Site Engineer': d.engineer?.name || 'Unknown',
      'Employee ID': d.engineer?.employeeId || '',
      'Total Attendance Marked': d.totalMarked,
      'Present': d.present,
      'Absent': d.absent,
      'Half Day': d.halfDay,
    }));

    return sendReport(req, res, rows, 'Engineer_Activity_Report', data, (doc) => {
      doc.fontSize(10);
      data.forEach((d) => {
        doc.text(`${d.engineer?.name || 'Unknown'} | Marked: ${d.totalMarked} | Present: ${d.present} | Absent: ${d.absent}`)
          .moveDown(0.3);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Shared export helper (Excel or PDF based on ?format=) ───────────────────

function sendReport(req, res, rows, filename, rawData, pdfWriter) {
  const format = (req.query.format || 'excel').toLowerCase();

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(16).text(filename.replace(/_/g, ' '), { align: 'center' }).moveDown();
    doc.fontSize(11).text(`Generated: ${new Date().toLocaleString()}`).moveDown();
    pdfWriter(doc);
    doc.end();
  } else {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'Report');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buf);
  }
}