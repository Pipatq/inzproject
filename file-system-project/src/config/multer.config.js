// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// const uploadDir = 'uploads/';
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, uploadDir);
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, uniqueSuffix + '-' + file.originalname);
//     }
// });

// const upload = multer({ storage: storage });

// module.exports = upload;
// src/config/multer.config.js
const multer = require('multer');
const path = require('path');
const fs =require('fs');

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // --- START: ส่วนที่แก้ไขเพื่อรองรับภาษาไทย ---

        // 1. แปลงชื่อไฟล์ที่เข้ารหัสผิด (latin1) กลับไปเป็น Buffer
        const originalnameBuffer = Buffer.from(file.originalname, 'latin1');
        
        // 2. ถอดรหัส Buffer นั้นให้เป็น UTF-8 ที่ถูกต้อง
        const decodedOriginalname = originalnameBuffer.toString('utf8');

        // 3. (สำคัญ) แก้ไขค่า originalname ใน object `file` โดยตรง
        // เพื่อให้ Controller ที่เรียกใช้ทีหลังได้ชื่อที่ถูกต้องไปใช้งาน
        file.originalname = decodedOriginalname;

        // --- END: ส่วนที่แก้ไข ---


        // 4. สร้างชื่อไฟล์ใหม่สำหรับบันทึกลงดิสก์ (เหมือนเดิม)
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extension);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
