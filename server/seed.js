/**
 * seed.js — populate the database with sample users, shifts, and swap requests
 * Run: node server/seed.js
 */

require('dotenv').config();
const mongoose  = require('mongoose');
const connectDB = require('./config/db');
const User         = require('./models/User');
const Shift        = require('./models/Shift');
const SwapRequest  = require('./models/SwapRequest');
const Notification = require('./models/Notification');

const DEPARTMENTS = ['العمليات', 'الدعم الفني', 'المبيعات', 'الإدارة'];
const SHIFT_TYPES = [
  { type: 'صبح',       start: '08:00', end: '16:00' },
  { type: 'مسا',       start: '16:00', end: '00:00' },
  { type: 'ليل',       start: '00:00', end: '08:00' },
  { type: 'نصف شيفت',  start: '08:00', end: '12:00' },
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function seed() {
  await connectDB();
  console.log('\n🌱 Starting seed...\n');

  // ─── Clear existing data ──────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Shift.deleteMany({}),
    SwapRequest.deleteMany({}),
    Notification.deleteMany({})
  ]);
  console.log('🗑  Cleared existing data');

  // ─── Create manager ───────────────────────────────────────────────────────
  const manager = await User.create({
    name:       'مصطفى إبراهيم',
    email:      'manager@shiftswap.com',
    password:   'manager123',
    role:       'manager',
    department: 'الإدارة'
  });
  console.log(`👔 Manager created: ${manager.email} / manager123`);

  // ─── Create employees ─────────────────────────────────────────────────────
  const employeeData = [
    { name: 'أحمد محمد',   email: 'ahmed@shiftswap.com',   department: 'العمليات'  },
    { name: 'سارة محمود',  email: 'sara@shiftswap.com',    department: 'العمليات'  },
    { name: 'محمد علي',    email: 'mohamed@shiftswap.com',  department: 'الدعم الفني' },
    { name: 'نور حسام',    email: 'nour@shiftswap.com',    department: 'الدعم الفني' },
    { name: 'كريم رضا',    email: 'karim@shiftswap.com',   department: 'المبيعات'  },
    { name: 'هبة منصور',   email: 'heba@shiftswap.com',    department: 'العمليات'  },
    { name: 'رامي سليم',   email: 'rami@shiftswap.com',    department: 'الدعم الفني' },
    { name: 'ياسمين عمر',  email: 'yasmin@shiftswap.com',  department: 'المبيعات'  },
    { name: 'عمر فاروق',   email: 'omar@shiftswap.com',    department: 'العمليات'  },
    { name: 'منى خالد',    email: 'mona@shiftswap.com',    department: 'الإدارة'   },
  ];

  const employees = await User.insertMany(
    employeeData.map(e => ({ ...e, password: 'emp123456', role: 'employee' }))
  );
  console.log(`👥 ${employees.length} employees created (password: emp123456)`);

  // ─── Create shifts for next 14 days ──────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shifts = [];

  for (const emp of employees) {
    for (let day = 0; day < 14; day++) {
      // Give each employee 5 shifts per week (skip 2 days as off)
      if (day % 7 === 5 || day % 7 === 6) continue;

      const template = randomItem(SHIFT_TYPES);
      shifts.push({
        user:       emp._id,
        date:       addDays(today, day),
        startTime:  template.start,
        endTime:    template.end,
        type:       template.type,
        department: emp.department,
        status:     'مؤكد'
      });
    }
  }

  const createdShifts = await Shift.insertMany(shifts, { ordered: false });
  console.log(`📅 ${createdShifts.length} shifts created`);

  // ─── Create sample swap requests ─────────────────────────────────────────
  const [ahmed, sara, nour, rami] = employees;

  // Pick a shift for Ahmed
  const ahmedShift = createdShifts.find(s => s.user.toString() === ahmed._id.toString());
  if (ahmedShift) {
    ahmedShift.status = 'محتاج تغطية';
    await ahmedShift.save();

    const swap1 = await SwapRequest.create({
      requester:      ahmed._id,
      requesterShift: ahmedShift._id,
      reason:         'إجازة عائلية مهمة',
      availableTimes: 'الجمعة والسبت كامل',
      urgency:        'متوسطة',
      status:         'مفتوح'
    });
    console.log(`🔄 Open swap request created (Ahmed → open)`);

    // Nour's shift + accepted swap (awaiting manager)
    const nourShift = createdShifts.find(s => s.user.toString() === nour._id.toString());
    if (nourShift) {
      nourShift.status = 'محتاج تغطية';
      await nourShift.save();

      const swap2 = await SwapRequest.create({
        requester:      nour._id,
        requesterShift: nourShift._id,
        acceptor:       rami._id,
        reason:         'ظرف صحي طارئ',
        urgency:        'عاجلة',
        status:         'مقبول'
      });

      await Notification.create({
        user:        nour._id,
        type:        'swap_accepted',
        title:       'قبول طلب التبديل',
        message:     `رامي سليم قبل طلب تبديلك — في انتظار موافقة المدير`,
        relatedSwap: swap2._id
      });
      console.log(`🔄 Accepted swap request created (Nour ↔ Rami, pending manager)`);
    }
  }

  // Sara's shift — already approved example
  const saraShift = createdShifts.find(s => s.user.toString() === sara._id.toString());
  if (saraShift) {
    saraShift.status = 'مُبدَّل';
    await saraShift.save();

    await SwapRequest.create({
      requester:      sara._id,
      requesterShift: saraShift._id,
      acceptor:       employees[8]._id, // Omar
      reason:         'سفر',
      urgency:        'عادية',
      status:         'موافق عليه',
      reviewedBy:     manager._id,
      reviewedAt:     new Date(),
      reviewNote:     'تمت الموافقة'
    });
    console.log(`✅ Approved swap created (Sara ↔ Omar)`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('  Manager  → manager@shiftswap.com / manager123');
  console.log('  Employee → ahmed@shiftswap.com   / emp123456');
  console.log('  (all employees use password: emp123456)');
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
