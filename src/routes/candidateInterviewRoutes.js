const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const pool = require('../config/db');
const redisClient = new redis();
const candidateInterviewModel = require('../models/interviewModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

router.post('/my_interviews', validateGlobalToken, async (req, res) => {
    const { candidate_id } = req.body;
    
    if (!candidate_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat diperlukan"
        });
    }
    
    try {
        const schedules = await candidateInterviewModel.getInterviewSchedulesForCandidate(candidate_id);
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mendapatkan jadwal interview",
            data: {
                candidate_id: candidate_id,
                total_schedules: schedules.length,
                schedules: schedules
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat mengambil jadwal interview"
        });
    }
});

// Get specific interview schedule detail for candidate
router.post('/interview_detail', validateGlobalToken, async (req, res) => {
    const { candidate_id, schedule_id } = req.body;
    
    if (!candidate_id || !schedule_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID kandidat dan ID jadwal interview diperlukan"
        });
    }
    
    try {
        const scheduleDetail = await candidateInterviewModel.getInterviewScheduleDetail(schedule_id, candidate_id);
        
        if (!scheduleDetail) {
            return res.status(404).json({
                status: "FAILED",
                message: "Jadwal interview tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mendapatkan detail jadwal interview",
            data: scheduleDetail
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat mengambil detail jadwal interview"
        });
    }
});

module.exports = router;