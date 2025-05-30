const pool = require('../config/db');

// Add a new exam
const addExam = async (examData) => {
    const { created_by, category_id, title, description } = examData;
    
    const [result] = await pool.query(
        'INSERT INTO exams (created_by, category_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [created_by, category_id, title, description]
    );
    
    return { id: result.insertId, ...examData };
};

// Get list of all exams with question count
const getAllExams = async () => {
    const [exams] = await pool.query(`
        SELECT e.*, u.username as created_by, c.category, 
               (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN categories c ON e.category_id = c.id
        ORDER BY e.created_at DESC
    `);
    
    // Get total count of exams
    const [totalCount] = await pool.query('SELECT COUNT(*) as total FROM exams');
    
    return {
        exams,
        total: totalCount[0].total
    };
};

// Get exam detail by id including questions
const getExamById = async (examId) => {
    // Get exam information
    const [examRows] = await pool.query(`
        SELECT e.*, u.username as created_by, c.category
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE e.id = ?
    `, [examId]);
    
    if (examRows.length === 0) {
        return null;
    }
    
    const exam = examRows[0];
    
    // Get questions for this exam
    const [questionsRows] = await pool.query(`
        SELECT id as question_id, exam_id, question_text, option_A, option_B, option_C, option_D, answer_key, created_at, updated_at
        FROM questions
        WHERE exam_id = ?
        ORDER BY id ASC
    `, [examId]);
    
    exam.questions = questionsRows.length > 0 ? questionsRows : [];
    exam.question_count = questionsRows.length;
    exam.total_question = questionsRows.length;
    
    // Get reports for this exam
    const [reportsRows] = await pool.query(`
        SELECT er.*, c.full_name as candidate_name, c.email as candidate_email
        FROM exam_reports er
        JOIN candidates c ON er.candidate_id = c.id
        WHERE er.exam_id = ?
        ORDER BY er.report_date DESC
    `, [examId]);
    
    exam.reports = reportsRows.length > 0 ? reportsRows : [];
    exam.report_count = reportsRows.length;
    
    return exam;
};

// Update exam
const updateExam = async (examId, examData) => {
    const { category_id, title, description } = examData;
    
    const [result] = await pool.query(
        'UPDATE exams SET category_id = ?, title = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [category_id, title, description, examId]
    );
    
    return result.affectedRows > 0;
};

// Delete exam and related questions
const deleteExam = async (examId) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // Hapus exam_reports dulu (FK ke exam_id)
        await connection.query('DELETE FROM exam_reports WHERE exam_id = ?', [examId]);

        // Hapus questions
        await connection.query('DELETE FROM questions WHERE exam_id = ?', [examId]);

        // Terakhir, hapus exam
        const [result] = await connection.query('DELETE FROM exams WHERE id = ?', [examId]);

        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};


// src/models/examModel.js

const assignCandidateToExam = async (examId, candidateId) => {
    const connection = await pool.getConnection();

    try {
        // Cek apakah examId ada
        const [exam] = await connection.query(
            'SELECT id FROM exams WHERE id = ?',
            [examId]
        );
        if (exam.length === 0) {
            return { success: false, message: "Exam tidak ditemukan" };
        }

        // Cek apakah candidateId ada
        const [candidate] = await connection.query(
            'SELECT id FROM candidates WHERE id = ?',
            [candidateId]
        );
        if (candidate.length === 0) {
            return { success: false, message: "Candidate tidak ditemukan" };
        }

        // Cek apakah sudah ada data exam_report kandidat ini untuk exam yang sama
        const [existing] = await connection.query(
            'SELECT id FROM exam_reports WHERE exam_id = ? AND candidate_id = ?',
            [examId, candidateId]
        );
        if (existing.length > 0) {
            return { success: false, message: "Candidate sudah terdaftar pada exam ini" };
        }

        // Insert data baru dengan created_at dan updated_at
        await connection.query(
            `INSERT INTO exam_reports 
            (exam_id, candidate_id, score, report_date, created_at, updated_at) 
            VALUES (?, ?, ?, CURRENT_DATE, NOW(), NOW())`,
            [examId, candidateId, 0]
        );

        // Update candidate_positions status_id to 3 for the candidate
        await connection.query(
            'UPDATE candidate_positions SET status_id = 3 WHERE candidate_id = ?',
            [candidateId]
        );

        return { success: true, message: "Candidate berhasil ditambahkan ke exam" };
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};




// Add a question to an exam
const addQuestionToExam = async (questionData) => {
    const { exam_id, question, option_A, option_B, option_C, option_D, answer_key } = questionData;
    
    // Check if exam exists
    const [examExists] = await pool.query('SELECT COUNT(*) as count FROM exams WHERE id = ?', [exam_id]);
    if (examExists[0].count === 0) {
        throw new Error('Exam not found');
    }
    
    // Check if exam already has 50 questions
    const [questionCount] = await pool.query('SELECT COUNT(*) as count FROM questions WHERE exam_id = ?', [exam_id]);
    if (questionCount[0].count >= 50) {
        throw new Error('Maximum number of questions (50) already reached for this exam');
    }
    
    // Validate answer key is one of A, B, C, D
    if (!['A', 'B', 'C', 'D'].includes(answer_key)) {
        throw new Error('Answer key must be one of: A, B, C, D');
    }
    
    const [result] = await pool.query(
        'INSERT INTO questions (exam_id, question, option_A, option_B, option_C, option_D, answer_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [exam_id, question, option_A, option_B, option_C, option_D, answer_key]
    );
    
    return { id: result.insertId, ...questionData };
};

// Add multiple questions to an exam
const addMultipleQuestionsToExam = async (exam_id, questionsArray) => {
    // Check if exam exists
    const [examExists] = await pool.query('SELECT COUNT(*) as count FROM exams WHERE id = ?', [exam_id]);
    if (examExists[0].count === 0) {
        throw new Error('Exam not found');
    }
    
    // Check current question count
    const [questionCount] = await pool.query('SELECT COUNT(*) as count FROM questions WHERE exam_id = ?', [exam_id]);
    const currentCount = questionCount[0].count;
    
    // Check if adding these questions would exceed the 50 question limit
    if (currentCount + questionsArray.length > 50) {
        throw new Error(`Cannot add ${questionsArray.length} questions. Exam already has ${currentCount} questions and maximum is 50`);
    }
    
    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const addedQuestions = [];
        
        for (const questionData of questionsArray) {
            const { question, option_A, option_B, option_C, option_D, answer_key } = questionData;
            
            // Validate answer key is one of A, B, C, D
            if (!['A', 'B', 'C', 'D'].includes(answer_key)) {
                throw new Error('Answer key must be one of: A, B, C, D');
            }
            
            const [result] = await connection.query(
                'INSERT INTO questions (exam_id, question_text, option_A, option_B, option_C, option_D, answer_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [exam_id, question, option_A, option_B, option_C, option_D, answer_key]
            );
            
            addedQuestions.push({ 
                id: result.insertId, 
                exam_id,
                question, 
                option_A, 
                option_B, 
                option_C, 
                option_D, 
                answer_key 
            });
        }
        
        await connection.commit();
        return addedQuestions;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Update a question
const updateQuestion = async (questionId, questionData) => {
    const { question, option_A, option_B, option_C, option_D, answer_key } = questionData;
    
    // Validate answer key is one of A, B, C, D
    if (!['A', 'B', 'C', 'D'].includes(answer_key)) {
        throw new Error('Answer key must be one of: A, B, C, D');
    }
    
    const [result] = await pool.query(
        'UPDATE questions SET question_text = ?, option_A = ?, option_B = ?, option_C = ?, option_D = ?, answer_key = ?, updated_at = NOW() WHERE id = ?',
        [question, option_A, option_B, option_C, option_D, answer_key, questionId]
    );
    
    return result.affectedRows > 0;
};

// Delete a question
const deleteQuestion = async (questionId) => {
    const [result] = await pool.query('DELETE FROM questions WHERE id = ?', [questionId]);
    return result.affectedRows > 0;
};

// Get categories
const getAllCategories = async () => {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY category');
    return categories;
};

// Add a category
const addCategory = async (categoryName) => {
    const [result] = await pool.query('INSERT INTO categories (category) VALUES (?)', [categoryName]);
    return { id: result.insertId, category: categoryName };
};

module.exports = {
    addExam,
    getAllExams,
    getExamById,
    updateExam,
    deleteExam,
    addQuestionToExam,
    updateQuestion,
    deleteQuestion,
    getAllCategories,
    addCategory,
    addMultipleQuestionsToExam,
    assignCandidateToExam
};