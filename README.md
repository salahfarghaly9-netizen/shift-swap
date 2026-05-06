
# ShiftSwap — نظام تبديل الشيفتات

نظام كامل لإدارة وتبديل شيفتات الفريق مبني على **Node.js + Express + MongoDB + JWT**.

---

## 📁 هيكل المشروع

```
shiftswap/
├── server/
│   ├── index.js              ← نقطة البداية (server entry point)
│   ├── seed.js               ← ملء قاعدة البيانات ببيانات تجريبية
│   ├── config/
│   │   └── db.js             ← اتصال MongoDB
│   ├── middleware/
│   │   └── auth.js           ← JWT protect + managerOnly
│   ├── models/
│   │   ├── User.js           ← موديل المستخدمين
│   │   ├── Shift.js          ← موديل الشيفتات
│   │   ├── SwapRequest.js    ← موديل طلبات التبديل
│   │   └── Notification.js   ← موديل الإشعارات
│   └── routes/
│       ├── auth.js           ← /api/auth (login, register, me)
│       ├── users.js          ← /api/users
│       ├── shifts.js         ← /api/shifts
│       ├── swapRequests.js   ← /api/swaps
│       └── notifications.js  ← /api/notifications
├── client/
│   └── public/
│       └── index.html        ← الواجهة الأمامية
├── .env                      ← متغيرات البيئة (لا تنشرها!)
├── .env.example              ← نموذج متغيرات البيئة
└── package.json
```

---

## ⚙️ متطلبات التشغيل

| أداة     | الإصدار المطلوب |
|----------|----------------|
| Node.js  | v18 أو أحدث    |
| npm      | v9 أو أحدث     |
| MongoDB  | v6 أو أحدث     |

---

## 🚀 خطوات التشغيل (Step by Step)

### 1. تثبيت MongoDB

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu / Debian:**
```bash
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**Windows:**
حمّل المثبت من: https://www.mongodb.com/try/download/community
ثم شغّله كـ service.

**التحقق من التشغيل:**
```bash
mongosh --eval "db.adminCommand('ping')"
# يجب أن يظهر: { ok: 1 }
```

---

### 2. استنسخ / افتح مجلد المشروع

```bash
cd shiftswap
```

---

### 3. إعداد ملف البيئة

```bash
cp .env.example .env
```

افتح `.env` وعدّل القيم حسب بيئتك:

```env
MONGODB_URI=mongodb://localhost:27017/shiftswap
JWT_SECRET=غيّر_هذا_الكود_السري_قبل_الإنتاج
PORT=3000
NODE_ENV=development
```

---

### 4. تثبيت الحزم

```bash
npm install
```

---

### 5. ملء قاعدة البيانات ببيانات تجريبية

```bash
npm run seed
```

سيُنشئ هذا الأمر:
- مدير واحد: `manager@shiftswap.com` / `manager123`
- 10 موظفين (جميعهم بكلمة مرور: `emp123456`)
- شيفتات للأسبوعين القادمين
- طلبات تبديل في حالات مختلفة

---

### 6. تشغيل السيرفر

**وضع التطوير (مع إعادة تشغيل تلقائية):**
```bash
npm run dev
```

**وضع الإنتاج:**
```bash
npm start
```

✅ السيرفر يعمل على: http://localhost:3000  
✅ الواجهة الأمامية: http://localhost:3000 (في وضع الإنتاج)  
✅ فحص الصحة: http://localhost:3000/api/health  

---

## 🔑 نظام المصادقة (Auth)

كل المسارات المحمية تحتاج إلى إرسال التوكن في الـ header:

```
Authorization: Bearer <your_token>
```

---

## 📡 API Reference

### Auth

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/register` | تسجيل مستخدم جديد |
| POST | `/api/auth/login` | تسجيل الدخول |
| GET  | `/api/auth/me` | بيانات المستخدم الحالي |
| PATCH | `/api/auth/me` | تعديل بياناتك |

**مثال — تسجيل الدخول:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ahmed@shiftswap.com","password":"emp123456"}'
```

**الرد:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "_id": "...",
    "name": "أحمد محمد",
    "role": "employee",
    "department": "العمليات"
  }
}
```

---

### Users `/api/users`

| Method | URL | Description | صلاحية |
|--------|-----|-------------|--------|
| GET | `/api/users` | قائمة الفريق | الكل |
| GET | `/api/users/:id` | بيانات موظف | الكل |
| GET | `/api/users/:id/shifts` | شيفتات موظف | الكل |
| PATCH | `/api/users/:id` | تعديل موظف | مدير |
| DELETE | `/api/users/:id` | تعطيل موظف | مدير |

**Query params لـ GET /api/users:**
- `department` — فلتر بالقسم
- `role` — `employee` أو `manager`
- `page` — رقم الصفحة (default: 1)
- `limit` — عدد النتائج (default: 50, max: 100)

---

### Shifts `/api/shifts`

| Method | URL | Description | صلاحية |
|--------|-----|-------------|--------|
| GET | `/api/shifts` | كل الشيفتات (فلتر) | الكل |
| GET | `/api/shifts/my` | شيفتاتك هذا الأسبوع | موظف |
| GET | `/api/shifts/:id` | تفاصيل شيفت | الكل |
| POST | `/api/shifts` | إنشاء شيفت | مدير |
| POST | `/api/shifts/bulk` | إنشاء شيفتات دفعة | مدير |
| PATCH | `/api/shifts/:id` | تعديل شيفت | مدير / صاحبه |
| DELETE | `/api/shifts/:id` | حذف شيفت | مدير |

**Query params لـ GET /api/shifts:**
- `userId` — شيفتات مستخدم معين
- `from` — من تاريخ (ISO 8601)
- `to` — لحد تاريخ
- `department`, `type`, `status`

**مثال — إنشاء شيفت (مدير):**
```bash
curl -X POST http://localhost:3000/api/shifts \
  -H "Authorization: Bearer <manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user_id>",
    "date": "2026-05-10",
    "startTime": "08:00",
    "endTime": "16:00",
    "department": "العمليات",
    "type": "صبح"
  }'
```

---

### Swap Requests `/api/swaps`

| Method | URL | Description | صلاحية |
|--------|-----|-------------|--------|
| GET | `/api/swaps` | الطلبات المفتوحة | الكل |
| GET | `/api/swaps?mine=true` | طلباتك أنت | الكل |
| GET | `/api/swaps/:id` | تفاصيل طلب | الكل |
| POST | `/api/swaps` | نشر طلب تبديل | موظف |
| POST | `/api/swaps/:id/accept` | قبول طلب | موظف آخر |
| POST | `/api/swaps/:id/withdraw` | سحب طلب | صاحب الطلب |
| POST | `/api/swaps/:id/approve` | موافقة المدير ✓ | مدير |
| POST | `/api/swaps/:id/reject` | رفض المدير ✗ | مدير |
| GET | `/api/swaps/stats/summary` | إحصائيات | مدير |

**دورة حياة طلب التبديل:**
```
مفتوح → مقبول (قبول موظف) → موافق عليه (موافقة مدير)
                          ↘ مرفوض (رفض مدير)
       ↘ منسحب (سحب صاحبه)
```

**مثال — نشر طلب:**
```bash
curl -X POST http://localhost:3000/api/swaps \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftId": "<shift_id>",
    "reason": "ظرف عائلي",
    "urgency": "متوسطة",
    "availableTimes": "الجمعة والسبت"
  }'
```

---

### Notifications `/api/notifications`

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/notifications` | إشعاراتك |
| GET | `/api/notifications?unread=true` | غير مقروءة فقط |
| PATCH | `/api/notifications/:id/read` | تعليم كمقروء |
| PATCH | `/api/notifications/read-all` | تعليم الكل كمقروء |

---

## 🗄️ نماذج البيانات (Schema)

### User
```js
{
  name, email, password (hashed),
  role: 'employee' | 'manager',
  department: 'العمليات' | 'الدعم الفني' | 'المبيعات' | 'الإدارة',
  isActive: Boolean,
  swapStats: { sent, received, completed }
}
```

### Shift
```js
{
  user: ObjectId,
  date: Date,
  startTime: "HH:MM",
  endTime:   "HH:MM",
  department, type, 
  status: 'مؤكد' | 'معلق' | 'محتاج تغطية' | 'مُبدَّل',
  notes
}
```

### SwapRequest
```js
{
  requester: ObjectId,        // من يعرض شيفته
  requesterShift: ObjectId,
  acceptor: ObjectId,         // من قبل التغطية
  isPartial, partialStart, partialEnd,
  reason, availableTimes,
  urgency: 'عادية' | 'متوسطة' | 'عاجلة',
  status: 'مفتوح' | 'مقبول' | 'موافق عليه' | 'مرفوض' | 'منسحب' | 'منتهي',
  reviewedBy, reviewedAt, reviewNote,
  expiresAt  // auto-set to +72h
}
```

---

## 🔒 الأمان

- كلمات المرور مشفرة بـ **bcryptjs** (salt rounds = 12)
- JWT تنتهي صلاحيتها بعد **7 أيام**
- `managerOnly` middleware تحمي كل عمليات المدير
- Mongoose validation على كل الحقول
- لا تُعيد الـ API كلمة المرور أبدًا

---

## 🛠️ أوامر مفيدة

```bash
# تشغيل السيرفر
npm run dev

# إعادة ملء قاعدة البيانات
npm run seed

# الاتصال بـ MongoDB مباشرة
mongosh mongodb://localhost:27017/shiftswap

# عرض كل المستخدمين
mongosh shiftswap --eval "db.users.find({},{name:1,email:1,role:1}).pretty()"

# عرض طلبات التبديل المفتوحة
mongosh shiftswap --eval "db.swaprequests.find({status:'مفتوح'}).pretty()"
```

---

## 🧩 الخطوات التالية (للتوسعة)

- [ ] WebSocket لإشعارات real-time بدل polling
- [ ] إرسال إيميل عند كل إشعار (Nodemailer)
- [ ] Rate limiting لحماية الـ API
- [ ] نظام إجازات مدمج
- [ ] تقارير PDF قابلة للتصدير
- [ ] تطبيق موبايل (React Native)
update  
