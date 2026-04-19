const Attendance = require('../models/Attendance');
const User = require('../models/User');
const sendNotification = require('../utils/sendNotification');
const logGeo = require('../utils/geoLogger');

// POST /api/attendance/checkin
exports.checkIn = async (req, res) => {
  try {
    const { workerName, workerId, siteLocation, latitude, longitude, address } = req.body;
    if (!workerName || !workerId) return res.status(400).json({ success: false, message: 'workerName and workerId are required' });

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const existing = await Attendance.findOne({ workerId, date: today });
    if (existing) return res.status(400).json({ success: false, message: 'Worker already checked in today' });

    const att = await Attendance.create({
      siteEngineer: req.user._id,
      workerName,
      workerId,
      date: today,
      siteLocation,
      checkInTime: new Date(),
      checkInLocation: { latitude, longitude, address },
      status: 'present',
    });

    if (latitude && longitude) {
      await logGeo({ userId: req.user._id, event: 'attendance_checkin', latitude, longitude, referenceId: att._id });
    }

    res.status(201).json({ success: true, data: att });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Worker already checked in today' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/attendance/:id/checkout
exports.checkOut = async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    if (att.siteEngineer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    att.checkOutTime = new Date();
    att.checkOutLocation = { latitude, longitude, address };
    await att.save();

    if (latitude && longitude) {
      await logGeo({ userId: req.user._id, event: 'attendance_checkout', latitude, longitude, referenceId: att._id });
    }

    res.json({ success: true, data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/attendance
exports.getAttendance = async (req, res) => {
  try {
    const { date, siteEngineer, workerId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (workerId) filter.workerId = workerId;

    // Site engineers see their own records only
    if (req.user.role === 'site_engineer') filter.siteEngineer = req.user._id;
    else if (siteEngineer) filter.siteEngineer = siteEngineer;

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      Attendance.find(filter).populate('siteEngineer', 'name employeeId').sort('-createdAt').skip(skip).limit(Number(limit)),
      Attendance.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/attendance/:id  - update status/notes
exports.updateAttendance = async (req, res) => {
  try {
    const att = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!att) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: att });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/attendance/swap-engineer  (Manager swaps site engineer)
exports.swapEngineer = async (req, res) => {
  try {
    const { currentEngineerId, newEngineerId, siteLocation, reason } = req.body;

    const newEngineer = await User.findById(newEngineerId);
    if (!newEngineer || newEngineer.role !== 'site_engineer') {
      return res.status(400).json({ success: false, message: 'Invalid new engineer' });
    }

    // Notify new engineer
    await sendNotification({
      recipients: newEngineerId,
      title: 'Site Reassignment',
      message: `You have been assigned to site: ${siteLocation || 'N/A'}. Reason: ${reason || 'Manager reassignment'}`,
      type: 'engineer_swapped',
    });

    // Notify current engineer if still active
    if (currentEngineerId) {
      await sendNotification({
        recipients: currentEngineerId,
        title: 'Site Reassignment',
        message: `You have been reassigned from site: ${siteLocation || 'N/A'}`,
        type: 'engineer_swapped',
      });
    }

    res.json({ success: true, message: 'Engineer swap notification sent', newEngineer: { _id: newEngineer._id, name: newEngineer.name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};