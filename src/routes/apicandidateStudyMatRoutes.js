const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const pool = require('../config/db');
const redisClient = new redis();
const apiCandidateStudyMatModel = require('../models/apicandidateStudyMatModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();


// POST route to get list of study materials for a candidate
router.post('/list', validateGlobalToken, async (req, res) => {
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
router.post('/detail_study', validateGlobalToken, async (req, res) => {
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