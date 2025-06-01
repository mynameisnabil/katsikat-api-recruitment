const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const apiCandidateExamModel = require('../models/apicandidateExamModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();
const redis = require('ioredis');
const redisClient = new redis();
const jwt = require('jsonwebtoken');


const isCandidate = async (req, res, next) => {
    // Ambil token dari header Authorization
    const token = req.body.token
    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token JWT diperlukan" });
    }

    try {
        // Verifikasi token menggunakan JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Periksa apakah role adalah candidate
        if (decoded.role !== 'candidate') {
            return res.status(403).json({ status: "FAILED", message: "Hanya candidate valid yang diperbolehkan" });
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
        console.error("Error in isCandidate middleware:", err);

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

// POST route to get list of exams available for a candidate
router.post('/list', validateGlobalToken,isCandidate, async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const result = await apiCandidateExamModel.getExamsListForCandidate(candidate_id);
        
        if (result.error) {
            return res.status(404).json({
                status: "FAILED",
                message: result.error
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: result.total_exams > 0 
                ? "Berhasil mendapatkan daftar ujian" 
                : "Tidak ada ujian yang tersedia untuk kandidat ini",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar ujian"
        });
    }
});

// POST route to get detailed information about a specific exam for a candidate
router.post('/detail', validateGlobalToken, isCandidate,async (req, res) => {
    const { candidate_id, exam_id } = req.body;
    
    if (!candidate_id || !exam_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat dan ID ujian diperlukan"
        });
    }
    
    try {
        const result = await apiCandidateExamModel.getExamDetailForCandidate(candidate_id, exam_id);
        
        if (result.error) {
            return res.status(404).json({
                status: "FAILED",
                message: result.error
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mendapatkan detail ujian",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail ujian"
        });
    }
});

// POST route to submit exam answers
router.post('/submit', validateGlobalToken, isCandidate,async (req, res) => {
    const { candidate_id, exam_id, answers } = req.body;
    
    if (!candidate_id || !exam_id || !answers || !Array.isArray(answers)) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat, ID ujian, dan array jawaban diperlukan"
        });
    }
    
    // Validate that each answer has a question_id and selected_option
    for (let i = 0; i < answers.length; i++) {
        if (!answers[i].question_id || !answers[i].selected_option) {
            return res.status(400).json({
                status: "FAILED",
                message: `Jawaban pada indeks ${i} tidak valid. Setiap jawaban harus memiliki question_id dan selected_option`
            });
        }
    }
    
    try {
        const result = await apiCandidateExamModel.submitExamAnswers(candidate_id, exam_id, answers);
        
        if (result.error) {
            return res.status(404).json({
                status: "FAILED",
                message: result.error
            });
        }
        
        // Add warning message if there are unanswered questions
        let message = "Jawaban ujian berhasil dikirim";
        if (result.unanswered_questions > 0) {
            message += `. Terdapat ${result.unanswered_questions} soal yang tidak dijawab dan dianggap salah`;
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: message,
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengirim jawaban ujian"
        });
    }
});
// POST route to get exam reports for a candidate
router.post('/exam_report', validateGlobalToken,isCandidate, async (req, res) => {
    const { candidate_id, exam_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const result = await apiCandidateExamModel.getExamReportsForCandidate(candidate_id, exam_id);
        
        if (result.error) {
            return res.status(404).json({
                status: "FAILED",
                message: result.error
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: result.total_reports > 0 
                ? "Berhasil mendapatkan laporan hasil ujian" 
                : "Tidak ada laporan hasil ujian untuk kandidat ini",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil laporan hasil ujian"
        });
    }
});

module.exports = router;