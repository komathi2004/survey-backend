const Notification = require('../models/Notification');

const sendNotification = async ({ recipients, title, message, type, referenceId, referenceModel }) => {
  try {
    const ids = Array.isArray(recipients) ? recipients : [recipients];
    const notifications = ids.map((recipient) => ({
      recipient,
      title,
      message,
      type,
      referenceId,
      referenceModel,
    }));
    await Notification.insertMany(notifications);
  } catch (err) {
    console.error('[Notification Error]', err.message);
  }
};

module.exports = sendNotification;