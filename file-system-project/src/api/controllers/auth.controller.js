// src/api/controllers/auth.controller.js
const axios = require('axios');
const jwt = require('jsonwebtoken');

// // --- Controller Functions ---
// const login = async (req, res) => {
//     try {
//         const { username, password } = req.body;

//         // --- จุดที่แก้ไข ---
//         // เปลี่ยน URL ให้ตรงกับ Flask API
//         const response = await axios.post(`${process.env.BILLING_API_URL}/api/auth/login`, {
//             username,
//             password
//         });
        
//         const { token } = response.data;

//         res.cookie('token', token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             maxAge: 2 * 60 * 60 * 1000 // 2 hours
//         });

//         res.status(200).json({ 
//             message: 'Login successful', 
//             redirectUrl: '/admin' 
//         });

//     } catch (error) {
//         const statusCode = error.response?.status || 500;
//         const message = error.response?.data?.message || 'An internal server error occurred.';
//         res.status(statusCode).json({ message });
//     }
// };
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const response = await axios.post(`${process.env.BILLING_API_URL}/api/auth/login`, {
            username,
            password
        });

        const { token } = response.data;

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 2 * 60 * 60 * 1000
        });

        // --- START: เพิ่มโค้ดส่วนนี้ ---
        const jsonResponse = { 
            message: 'Login successful', 
            redirectUrl: '/admin' 
        };
        console.log('DEBUG: Sending hardcoded JSON response:', jsonResponse);
        console.log('Backend is sending this JSON response:', jsonResponse); // นี่คือกล้องของเรา
        res.status(200).json(jsonResponse);
        // --- END: เพิ่มโค้ดส่วนนี้ ---

    } catch (error) {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.message || 'An internal server error occurred.';
        res.status(statusCode).json({ message });
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/files');
};

// --- Auth Middleware ---
const verifySuperadmin = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/files');
    }

    try {
        const decoded = jwt.verify(token, process.env.FLASK_SECRET_KEY);
        if (decoded.role !== 'super admin') {
            return res.status(403).redirect('/files');
        }
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('token');
        return res.redirect('/files');
    }
};

module.exports = {
    login,
    logout,
    verifySuperadmin
};