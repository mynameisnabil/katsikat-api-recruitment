const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const candidateModel = require('../models/candidateModel');
const statusModel = require('../models/statusModel');
const positionModel = require('../models/positionModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

// Middleware to verify if user is admin or superadmin via token in body
const isAdminOrSuperAdmin = async (req, res, next) => {
    const token = req.body.token;
    if (!token) return res.status(401).json({ status: "FAILED", message: "Token JWT diperlukan" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
            return res.status(403).json({ status: "FAILED", message: "Hanya admin dan superadmin yang diperbolehkan" });
        }
        
        // Verify token exists in Redis
        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }
        
        req.user = decoded;
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({ status: "FAILED", message: "Token JWT tidak valid" });
    }
};

// Add a new candidate
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { user_id, age, birthdate, gender, email, phone_number, full_name } = req.body;
    
    if (!user_id || !age || !birthdate || !gender || !email || !phone_number) {
        return res.status(400).json({ 
            status: "FAILED", 
            message: "Semua field wajib (user_id, age, birthdate, gender, email, phone_number) harus diisi" 
        });
    }

    try {
        const newCandidate = await candidateModel.addCandidate({
            user_id, age, birthdate, gender, email, phone_number, full_name
        });
        
        return res.status(201).json({ 
            status: "SUCCESS", 
            message: "Kandidat berhasil ditambahkan", 
            candidate: newCandidate 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "FAILED", message: "Terjadi kesalahan saat menambahkan kandidat" });
    }
});

// POST /api/list → Ambil daftar kandidat
router.post('/list', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const candidates = await candidateModel.getAllCandidates();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar kandidat",
            candidates
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Terjadi kesalahan saat mengambil daftar kandidat" 
        });
    }
});

router.post('/list_position', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const position = await positionModel.getAllPositions();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar kandidat",
            data : position
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Terjadi kesalahan saat mengambil daftar kandidat" 
        });
    }
});

router.post('/list_status', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const status = await statusModel.getAllStatuses();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar kandidat",
            data : status
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Terjadi kesalahan saat mengambil daftar kandidat" 
        });
    }
});

// POST /api/detail → Ambil detail kandidat
router.post('/detail', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const candidate = await candidateModel.getCandidateById(candidate_id);
        
        if (!candidate) {
            return res.status(404).json({
                status: "FAILED",
                message: "Kandidat tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail kandidat",
            data : candidate
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail kandidat"
        });
    }
});

router.post('/status_candidate', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const status = await statusModel.getStatusById(candidate_id);
        
        if (!status) {
            return res.status(404).json({
                status: "FAILED",
                message: "Kandidat tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail kandidat",
            data: {
                candidate_id,
                ...status
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail kandidat"
        });
    }
});

router.post('/position_candidate', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const position = await positionModel.getPositionById(candidate_id);
        
        if (!position) {
            return res.status(404).json({
                status: "FAILED",
                message: "Kandidat tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail kandidat",
            data: {
                candidate_id,
                ...position
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail kandidat"
        });
    }
});




// POST /api/admin/candidates/status → Update status kandidat
router.post('/update_status',validateGlobalToken,  isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id, position_id, status_id } = req.body;
    
    if (!candidate_id || !position_id || !status_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat, ID posisi, dan ID status diperlukan"
        });
    }
    
    try {
        const updated = await candidateModel.updateCandidateStatus(candidate_id, position_id, status_id);
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Kandidat atau posisi tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Status kandidat berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat memperbarui status kandidat"
        });
    }
});

// POST /api/admin/assign → Assign kandidat
router.post('/assign', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { candidate_id, position_id, status_id } = req.body;
    
    if (!candidate_id || !position_id || !status_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat, ID posisi, dan ID status diperlukan"
        });
    }
    
    try {
        const result = await candidateModel.assignCandidateToPosition(candidate_id, position_id, status_id);
        
        return res.status(200).json({
            status: "SUCCESS",
            message: result.created 
                ? "Kandidat berhasil diassign ke posisi baru" 
                : "Kandidat berhasil diupdate untuk posisi",
            result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengassign kandidat"
        });
    }
});

module.exports = router;