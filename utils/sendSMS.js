// Replace with actual SMS provider (Twilio, MSG91, etc.)
const sendSMS = async (mobile, message) => {
  try {
    console.log(`[SMS] To: ${mobile} | Message: ${message}`);
    // Example with MSG91:
    // const response = await axios.post('https://api.msg91.com/api/v5/flow/', {
    //   authkey: process.env.SMS_API_KEY,
    //   recipients: [{ mobiles: mobile }],
    //   message,
    //   sender: process.env.SMS_SENDER_ID,
    // });
    return { success: true };
  } catch (err) {
    console.error('[SMS Error]', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = sendSMS;