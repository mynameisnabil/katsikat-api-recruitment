const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const redisClient = new redis();
const examModel = require('../models/examModel');
const { validateGlobalToken } = require('../middleware/authMiddleware');
require('dotenv').config();

// Middleware to verify if user is admin or superadmin via token in body
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

// POST /api/add → Tambah exam baru
router.post('/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { created_by, category_id, title, description } = req.body;
    
    if (!created_by || !category_id || !title || !description) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (created_by, category_id, title, description) harus diisi"
        });
    }
    
    try {
        const newExam = await examModel.addExam({
            created_by, category_id, title, description
        });
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Exam berhasil ditambahkan",
            exam: newExam
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan exam"
        });
    }
});

// POST /api/list → Ambil daftar exam
router.post('/list', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const { exams, total } = await examModel.getAllExams();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar exam",
            total,
            exams
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar exam"
        });
    }
});

// POST /api/detail → Ambil detail exam ada soal
router.post('/detail', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { exam_id } = req.body;
    
    if (!exam_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID exam diperlukan"
        });
    }
    
    try {
        const exam = await examModel.getExamById(exam_id);
        
        if (!exam) {
            return res.status(404).json({
                status: "FAILED",
                message: "Exam tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil detail exam",
            exam
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil detail exam"
        });
    }
});

// POST /api/update → Update exam
router.post('/update', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { exam_id, category_id, title, description } = req.body;
    
    if (!exam_id || !category_id || !title || !description) {
        return res.status(400).json({
            status: "FAILED",
            message: "Field wajib (exam_id, category_id, title, description) harus diisi"
        });
    }
    
    try {
        const updated = await examModel.updateExam(exam_id, {
            category_id, title, description
        });
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Exam tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Exam berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat memperbarui exam"
        });
    }
});

// POST /api/delete → Hapus exam
router.post('/delete', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { exam_id } = req.body;
    
    if (!exam_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID exam diperlukan"
        });
    }
    
    try {
        const deleted = await examModel.deleteExam(exam_id);
        
        if (!deleted) {
            return res.status(404).json({
                status: "FAILED",
                message: "Exam tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Exam berhasil dihapus"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menghapus exam"
        });
    }
});

// POST /api/add_question → Tambah pertanyaan ke exam
router.post('/add_question', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { exam_id, question, option_A, option_B, option_C, option_D, answer_key } = req.body;
    
    if (!exam_id || !question || !option_A || !option_B || !option_C || !option_D || !answer_key) {
        return res.status(400).json({
            status: "FAILED",
            message: "Semua field wajib diisi (exam_id, question, option_A, option_B, option_C, option_D, answer_key)"
        });
    }
    
    try {
        const newQuestion = await examModel.addQuestionToExam({
            exam_id, question, option_A, option_B, option_C, option_D, answer_key
        });
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Pertanyaan berhasil ditambahkan ke exam",
            question: newQuestion
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat menambahkan pertanyaan"
        });
    }
});

// POST /api/admin/exams/add_multiple_questions → Tambah beberapa pertanyaan sekaligus ke exam
router.post('/add_multiple_questions', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { exam_id, questions } = req.body;
    
    if (!exam_id || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
            status: "FAILED",
            message: "exam_id dan array questions diperlukan"
        });
    }
    
    // Validate each question has all required fields
    for (const q of questions) {
        if (!q.question || !q.option_A || !q.option_B || !q.option_C || !q.option_D || !q.answer_key) {
            return res.status(400).json({
                status: "FAILED",
                message: "Setiap pertanyaan harus memiliki field: question, option_A, option_B, option_C, option_D, dan answer_key"
            });
        }
    }
    
    try {
        const addedQuestions = await examModel.addMultipleQuestionsToExam(exam_id, questions);
        
        return res.status(201).json({
            status: "SUCCESS",
            message: `${addedQuestions.length} pertanyaan berhasil ditambahkan ke exam`,
            questions: addedQuestions
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat menambahkan pertanyaan"
        });
    }
});

// POST /api/update_question → Update pertanyaan
router.post('/update_question', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { question_id, question, option_A, option_B, option_C, option_D, answer_key } = req.body;
    
    if (!question_id || !question || !option_A || !option_B || !option_C || !option_D || !answer_key) {
        return res.status(400).json({
            status: "FAILED",
            message: "Semua field wajib diisi (question_id, question, option_A, option_B, option_C, option_D, answer_key)"
        });
    }
    
    try {
        const updated = await examModel.updateQuestion(question_id, {
            question, option_A, option_B, option_C, option_D, answer_key
        });
        
        if (!updated) {
            return res.status(404).json({
                status: "FAILED",
                message: "Pertanyaan tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Pertanyaan berhasil diperbarui"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: error.message || "Terjadi kesalahan saat memperbarui pertanyaan"
        });
    }
});

// POST /api/delete_question → Hapus pertanyaan
router.post('/delete_question', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { question_id } = req.body;
    
    if (!question_id) {
        return res.status(400).json({
            status: "FAILED",
            message: "ID pertanyaan diperlukan"
        });
    }
    
    try {
        const deleted = await examModel.deleteQuestion(question_id);
        
        if (!deleted) {
            return res.status(404).json({
                status: "FAILED",
                message: "Pertanyaan tidak ditemukan"
            });
        }
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Pertanyaan berhasil dihapus"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menghapus pertanyaan"
        });
    }
});

// GET /api/admin/categories/list → Ambil daftar kategori
router.post('/admin/categories/list', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const categories = await examModel.getAllCategories();
        
        return res.status(200).json({
            status: "SUCCESS",
            message: "Berhasil mengambil daftar kategori",
            categories
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat mengambil daftar kategori"
        });
    }
});

// POST /api/admin/categories/add → Tambah kategori baru
router.post('/admin/categories/add', validateGlobalToken, isAdminOrSuperAdmin, async (req, res) => {
    const { category } = req.body;
    
    if (!category) {
        return res.status(400).json({
            status: "FAILED",
            message: "Nama kategori diperlukan"
        });
    }
    
    try {
        const newCategory = await examModel.addCategory(category);
        
        return res.status(201).json({
            status: "SUCCESS",
            message: "Kategori berhasil ditambahkan",
            category: newCategory
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "FAILED",
            message: "Terjadi kesalahan saat menambahkan kategori"
        });
    }
});

module.exports = router;