const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const pool = require('../config/db');
const redisClient = new redis();
const apiCandidateStudyMatModel = require('../models/apicandidateStudyMatModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

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

// POST route to get list of study materials for a candidate
router.post('/list', validateGlobalToken, isCandidate,  async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const result = await apiCandidateStudyMatModel.getStudyMaterialsListByCandidate(candidate_id);
        
        return res.status(200).json({
            status: "SUCCESS",
            message: result.total_materials > 0 
                ? "Berhasil mendapatkan daftar materi pembelajaran" 
                : "Tidak ada materi pembelajaran untuk kandidat ini",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar materi pembelajaran"
        });
    }
});

// POST route to get detailed information about a specific study material for a candidate
router.post('/detail_study', validateGlobalToken, isCandidate, async (req, res) => {
    const { candidate_id, study_id } = req.body;
    
    if (!candidate_id || !study_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat dan ID materi pembelajaran diperlukan"
        });
    }
    
    try {
        const result = await apiCandidateStudyMatModel.getStudyMaterialDetailForCandidate(candidate_id, study_id);
        
        if (!result) {
            return res.status(404).json({
                status: "FAILED",
                message: "Materi pembelajaran tidak ditemukan atau kandidat tidak memiliki akses"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mendapatkan detail materi pembelajaran",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail materi pembelajaran"
        });
    }
});


module.exports = router;