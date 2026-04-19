const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const User = require('./models/User');

const users = [
  {
    name: 'Pentagon Manager',
    email: 'manager@pentagon.com',
    mobile: '9000000001',
    password: 'Manager@123',
    role: 'manager',
    employeeId: 'EMP-001',
    isActive: true,
  },
  {
    name: 'Pentagon Surveyor',
    email: 'surveyor@pentagon.com',
    mobile: '9000000002',
    password: 'Surveyor@123',
    role: 'surveyor',
    employeeId: 'EMP-002',
    isActive: true,
  },
  {
    name: 'Pentagon Site Engineer',
    email: 'engineer@pentagon.com',
    mobile: '9000000003',
    password: 'Engineer@123',
    role: 'site_engineer',
    employeeId: 'EMP-003',
    isActive: true,
  },
  {
    name: 'Pentagon Stakeholder',
    email: 'stakeholder@pentagon.com',
    mobile: '9000000004',
    password: 'Stake@123',
    role: 'stakeholder',
    employeeId: 'EMP-004',
    isActive: true,
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // Clear existing users
    await User.deleteMany({});
    console.log('Existing users cleared...');

    // Hash passwords and insert
    for (const userData of users) {
      const user = new User(userData);
      await user.save(); // triggers bcrypt hash in pre-save hook
      console.log(`✅ Created: ${user.role} → ${user.email}`);
    }

    console.log('\n---------------------------------');
    console.log('All users seeded successfully!');
    console.log('---------------------------------');
    console.log('Manager      → manager@pentagon.com     / Manager@123');
    console.log('Surveyor     → surveyor@pentagon.com    / Surveyor@123');
    console.log('Site Engineer→ engineer@pentagon.com    / Engineer@123');
    console.log('Stakeholder  → stakeholder@pentagon.com / Stake@123');
    console.log('---------------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed Error:', err.message);
    process.exit(1);
  }
};

seedDB();

