const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// สร้าง Connection Pool
const pool = mysql.createPool(dbConfig);

// ฟังก์ชันสำหรับตรวจสอบสถานะการเชื่อมต่อ
const checkDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return { status: 'Connected', message: 'Database connection is healthy.' };
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return { status: 'Error', message: error.message };
    }
};

// --- THIS IS THE FIX ---
// Export ทั้ง pool และฟังก์ชัน checkDbConnection ออกไปในรูปแบบของ Object
module.exports = { pool, checkDbConnection };