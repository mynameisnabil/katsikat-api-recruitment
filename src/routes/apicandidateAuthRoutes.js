const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const pool = require('../config/db');
const redisClient = new redis();
const apiCandidateAuthModel = require('../models/apicandidateAuthModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();






router.post('/login', validateGlobalToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ status: "FAILED", message: "Username dan password harus diisi" });
    }

    const user = await apiCandidateAuthModel.checkLoginCandidate(username, password);
    if (!user) {
        return res.status(400).json({ status: "FAILED", message: "Username atau password salah" });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    await redisClient.set(`token:${user.username}`, token, 'EX', 86400);

    return res.status(200).json({ 
        status: "SUCCESS", 
        message: "Login berhasil", 
        role: user.role, 
        user_id: user.id, // Adding user ID to the response
        token 
    });
});

router.post('/logout', validateGlobalToken, async (req, res) => {
    // Get token from request body
    const { token } = req.body;

    if (!token) {
        return res.status(401).json({ status: "FAILED", message: "Token diperlukan" });
    }

    try {
        // Verify token using JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Log decoded information for debugging
        console.log("Decoded token:", decoded);

        // Delete token from Redis
        const result = await redisClient.del(`token:${decoded.username}`);
        if (result === 0) {
            console.warn("Token tidak ditemukan di Redis, mungkin sudah dihapus sebelumnya.");
        } else {
            console.log("Token berhasil dihapus dari Redis.");
        }

        return res.status(200).json({
            status: "SUCCESS",
            message: "Logout berhasil"
        });
    } catch (err) {
        console.error("Error verifying or deleting token:", err);
        return res.status(401).json({
            status: "FAILED",
            message: "Token tidak valid",
            error: err.message
        });
    }
});

router.post('/profile_candidate', validateGlobalToken, async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ status: "FAILED", message: "Token harus diisi" });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token:", decoded);
        
        // Check if token exists in Redis
        const storedToken = await redisClient.get(`token:${decoded.username}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ status: "FAILED", message: "Token tidak valid atau kadaluarsa" });
        }
        
        // Get user details for the token owner
        const userDetails = await apiCandidateAuthModel.getCandidateByUsername(decoded.username);
        console.log("User details:", userDetails);
        if (!userDetails) {
            return res.status(404).json({ status: "FAILED", message: "User tidak ditemukan" });
        }

        return res.status(200).json({ 
            status: "SUCCESS", 
            user: userDetails
        });
    } catch (err) {
        console.error(err);
        return res.status(401).json({ status: "FAILED", message: "Token tidak valid" });
    }
});



module.exports = router;



