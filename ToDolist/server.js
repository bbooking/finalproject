// server.js
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const multer = require('multer');
const path = require('path');

// กำหนดที่เก็บไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // เช่น 123456.jpg
  }
});

const upload = multer({ storage });

// ให้ Express เข้าถึงไฟล์ในโฟลเดอร์ uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static('public'));



// ✅ เชื่อมต่อฐานข้อมูล MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // ถ้ามีรหัสผ่านให้ใส่
  database: 'memberDB'
});

db.connect((err) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ MySQL:', err);
  } else {
    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');
  }
});

// ✅ สมัครสมาชิก (POST /register)
app.post('/register', (req, res) => {
  const { firstname, lastname, email, password, phone } = req.body;
  if (!firstname || !lastname || !email || !password || !phone) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  const fullName = `${firstname} ${lastname}`;

  db.query(
    'INSERT INTO users (username, password, email, phone) VALUES (?, ?, ?, ?)',
    [fullName, password, email, phone],
    (err, result) => {
      if (err) {
        console.error('❌ เกิดข้อผิดพลาดในการสมัคร:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัคร' });
      }
      res.json({ message: 'สมัครสมาชิกสำเร็จ!', id: result.insertId });
    }
  );
});

// ✅ เข้าสู่ระบบ (POST /login)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  db.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) {
        console.error('❌ เกิดข้อผิดพลาดในการเข้าสู่ระบบ:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
      }
      if (results.length > 0) {
        res.json({ message: 'เข้าสู่ระบบสำเร็จ!', user: results[0] });
      } else {
        res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      }
    }
  );
});

// ดึงข้อมูลทุก task จากฐานข้อมูล (GET /api/tasks)
app.get('/api/tasks', (req, res) => {
  const sql = 'SELECT * FROM tasks';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
    res.json(results);  // ส่งข้อมูลกลับเป็น JSON
  });
});


// 📥 รับข้อมูล task จาก client
app.post('/api/tasks', (req, res) => {
  const { task_name, status, due_date } = req.body;

console.log('📥 POST /api/tasks', { task_name, status, due_date });

if (!task_name || !status || !due_date) {
  return res.status(400).json({ error: 'task_name, status และ due_date ห้ามว่าง' });
}

const query = 'INSERT INTO tasks (task_name, status, due_date) VALUES (?, ?, ?)';
db.query(query, [task_name, status, due_date], (err, result) => {
  if (err) {
    console.error('❌ Insert failed:', err.sqlMessage || err);
    return res.status(500).json({ error: 'Insert failed', details: err.sqlMessage });
  }

  console.log('✅ Task inserted:', result.insertId);
  res.status(201).json({ message: 'Task created', id: result.insertId });
});
});


// 📥 อัปโหลดไฟล์แนบให้ Task (POST /tasks/:id/upload)
app.post('/api/upload/:taskId', upload.single('file'), (req, res) => {
  const taskId = req.params.taskId;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const filePath = `/uploads/${file.filename}`; // เส้นทางแบบ public (จะใช้ใน HTML)
  const sql = "UPDATE tasks SET file_path = ? WHERE id = ?";
  db.query(sql, [filePath, taskId], (err, result) => {
    if (err) {
      console.error("❌ MySQL error:", err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, filePath });
  });
});


const fs = require('fs'); // ต้องใช้สำหรับลบไฟล์

// ✅ ลบไฟล์แนบของ Task
app.delete('/api/upload/:taskId', (req, res) => {
  const taskId = req.params.taskId;

  // 1. ดึง path ของไฟล์แนบจากฐานข้อมูล
  const selectQuery = 'SELECT file_path FROM tasks WHERE id = ?';
  db.query(selectQuery, [taskId], (err, results) => {
    if (err) {
      console.error("❌ Database error (select):", err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'ไม่พบ Task' });
    }

    const filePath = results[0].file_path;
    if (!filePath) {
      return res.status(400).json({ message: 'Task นี้ไม่มีไฟล์แนบ' });
    }

    // 2. ลบไฟล์จากระบบไฟล์ (filesystem)
    const fullFilePath = path.join(__dirname, 'public', filePath);
    fs.unlink(fullFilePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("❌ Error deleting file:", unlinkErr);
        return res.status(500).json({ message: 'ลบไฟล์ไม่สำเร็จ' });
      }

      // 3. อัปเดต database ล้างค่า file_path
      const updateQuery = 'UPDATE tasks SET file_path = NULL WHERE id = ?';
      db.query(updateQuery, [taskId], (updateErr) => {
        if (updateErr) {
          console.error("❌ Database error (update):", updateErr);
          return res.status(500).json({ message: 'ไม่สามารถอัปเดตฐานข้อมูล' });
        }

        res.json({ message: 'ลบไฟล์สำเร็จ' });
      });
    });
  });
});




app.get('/api/profile', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'กรุณาระบุอีเมล' });
  }

  db.query('SELECT username, email, phone FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    if (results.length === 0) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    res.json(results[0]);
  });
});


// ✅ อัปเดต Status (PUT /tasks/:id/status)
app.put('/tasks/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // ✅ Log ค่าที่รับเข้ามาไว้เช็กว่าค่าส่งมาถูกไหม
  console.log('🔥 PUT /tasks/:id/status -> id:', id, '| status:', status); // เพิ่ม log นี้


  db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบ Task ที่ต้องการอัปเดต หรือค่าเดิมเหมือนเดิม' });
    }

    res.json({ message: 'อัปเดต Status สำเร็จ' });
  });
});







app.put('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { task_name } = req.body;

  // ✅ Log ค่าที่จะถูกใช้ในการอัปเดต
  console.log('Updating Task:', { taskId, task_name });

  // ✅ ตรวจสอบว่า task_name ถูกส่งมาหรือไม่
  if (!task_name) {
    return res.status(400).json({ error: 'ต้องใส่ชื่อ task ด้วย' });
  }

  const query = 'UPDATE tasks SET task_name = ? WHERE id = ?';
  db.query(query, [task_name, taskId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database update failed' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบ Task ที่ต้องการอัปเดต' });
    }

    res.status(200).json({ message: 'Task updated successfully' });
  });
});





// ✅ ลบ Task (DELETE /tasks/:id)
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM tasks WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'ลบ Task สำเร็จ' });
  });
});


// ✅ เริ่มรันเซิร์ฟเวอร์
app.listen(3000, () => {
  console.log('🚀 Server รันที่ http://localhost:3000');
});
