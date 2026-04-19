const GeoLog = require('../models/GeoLog');

const logGeo = async ({ userId, event, latitude, longitude, address, referenceId }) => {
  try {
    await GeoLog.create({ user: userId, event, latitude, longitude, address, referenceId });
  } catch (err) {
    console.error('[GeoLog Error]', err.message);
  }
};

module.exports = logGeo;