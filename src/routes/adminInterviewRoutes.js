const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const interviewScheduleModel = require('../models/interviewModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

const isAdminOrSuperAdmin = async (req, res, next) => {
    // Ambil token dari header Authorization
    const token = req.body.token
    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token JWT diperlukan" });
    }

    try {
        // Verifikasi token menggunakan JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Periksa apakah role adalah admin atau superadmin
        if (decoded.role !== 'superadmin' && decoded.role !== 'admin') {
            return res.status(403).json({ status: "FAILED", message: "Hanya admin dan superadmin yang diperbolehkan" });
        }

        // Periksa token di Redis
        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }

        // Simpan informasi pengguna ke dalam request
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Error in isAdminOrSuperAdmin middleware:", err);

        // Tangani error JWT
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ status: "FAILED", message: "Token telah kedaluwarsa" });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
        }

        // Tangani error lainnya
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan pada server" });
    }
};


// Add or update interview schedule
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id, candidate_position_id, interview_date, interview_time, notes, admin_ids, link } = req.body;
    
    // Validate required fields
    if (!candidate_id || !candidate_position_id || !interview_date || !interview_time || !admin_ids) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat, ID posisi kandidat, tanggal interview, waktu interview, dan admin ID diperlukan"
        });
    }
    
    // Validate admin_ids format
    if (!Array.isArray(admin_ids) && typeof admin_ids !== 'number') {
        return res.status(400).json({
            status: "FAILED",
            message: "Admin ID harus berupa array atau angka"
        });
    }
    
    // Convert to array and validate maximum 3 admins
    let adminIdsArray = Array.isArray(admin_ids) ? admin_ids : [admin_ids];
    if (adminIdsArray.length > 3) {
        return res.status(400).json({
            status: "FAILED",
            message: "Maksimal 3 admin yang dapat ditugaskan untuk satu interview"
        });
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(interview_date)) {
        return res.status(400).json({
            status: "FAILED",
            message: "Format tanggal interview harus YYYY-MM-DD"
        });
    }
    
    // Validate time format (HH:MM:SS or HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timeRegex.test(interview_time)) {
        return res.status(400).json({
            status: "FAILED",
            message: "Format waktu interview harus HH:MM:SS atau HH:MM"
        });
    }
    
    try {
        const result = await interviewScheduleModel.addCandidateToInterviewSchedule(
            candidate_id, 
            candidate_position_id, 
            interview_date, 
            interview_time,
            notes || '',
            adminIdsArray,
            link || null // <-- tambahkan link di sini
        );
        
        // Create appropriate message based on results
        let message = result.updated 
            ? "Jadwal interview berhasil diperbarui" 
            : "Jadwal interview berhasil dibuat";
        
        return res.status(200).json({
            status: "SUCCESS",
            message: message,
            data: {
                schedule_id: result.id,
                candidate_id: candidate_id,
                candidate_position_id: candidate_position_id,
                interview_date: interview_date,
                interview_time: interview_time,
                notes: notes || '',
                link: link || null, // <-- tambahkan link di response
                updated: result.updated,
                assigned_admins: result.assigned_admins,
                total_assigned_admins: result.assigned_admins.length
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat menambahkan jadwal interview"
        });
    }
});


// Get interview schedules for admin
router.post('/my_schedules', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { admin_id } = req.body;
    
    if (!admin_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID admin diperlukan"
        });
    }
    
    try {
        const schedules = await interviewScheduleModel.getInterviewSchedulesForAdmin(admin_id);

        // schedules sudah mengandung field link di setiap objek schedule
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mendapatkan jadwal interview admin",
            data: {
                admin_id: admin_id,
                total_schedules: schedules.length,
                schedules: schedules.map(sch => ({
                    ...sch,
                    link: sch.link || null // pastikan field link selalu ada
                }))
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat mengambil jadwal interview admin"
        });
    }
});

module.exports = router;