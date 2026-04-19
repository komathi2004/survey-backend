const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/leads',         require('./routes/lead.routes'));
app.use('/api/surveys',       require('./routes/survey.routes'));
app.use('/api/attendance',    require('./routes/attendance.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/dashboard',     require('./routes/dashboard.routes'));
app.use('/api/reports',       require('./routes/report.routes'));

app.get('/', (req, res) => res.json({ message: 'Survey & Workforce API running' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend working ✅" });
});