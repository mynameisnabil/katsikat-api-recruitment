const pool = require('../config/db');

module.exports = {
    // Get list of exams available for a candidate
    getExamsListForCandidate: async (candidateId) => {
        try {
            // Get candidate information first to ensure the candidate exists
            const [candidateRows] = await pool.query(`
                SELECT id, full_name FROM candidates WHERE id = ?
            `, [candidateId]);
            
            if (candidateRows.length === 0) {
                return { error: 'Candidate not found' };
            }
            
            // Get only exams that are assigned to this candidate in exam_reports
            // This ensures we only show exams relevant to this specific candidate
            const [examsRows] = await pool.query(`
                SELECT 
                    e.id as exam_id,
                    e.title,
                    e.description,
                    e.created_at,
                    e.updated_at,
                    c.category,
                    (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count,
                    er.score,
                    er.is_completed = 1 as is_completed
                FROM exams e
                JOIN exam_reports er ON e.id = er.exam_id AND er.candidate_id = ?
                LEFT JOIN categories c ON e.category_id = c.id
                ORDER BY e.created_at DESC
            `, [candidateId]);
            
            // Convert is_completed integer to boolean for response
            const examsWithBooleanStatus = examsRows.map(exam => ({
                ...exam,
                is_completed: exam.is_completed === 1
            }));
            
            return {
                candidate_id: candidateId,
                candidate_name: candidateRows[0].full_name,
                total_exams: examsRows.length,
                exams: examsWithBooleanStatus
            };
        } catch (error) {
            console.error('Error getting exams list for candidate:', error);
            throw error;
        }
    },

    // Get detailed information about a specific exam for a candidate
     getExamDetailForCandidate: async (candidateId, examId) => {
        try {
            // First check if the candidate exists
            const [candidateRows] = await pool.query(`
                SELECT id, full_name FROM candidates WHERE id = ?
            `, [candidateId]);
            
            if (candidateRows.length === 0) {
                return { error: 'Candidate not found' };
            }
            
            // First check if this exam is assigned to this candidate
            const [assignmentCheck] = await pool.query(`
                SELECT id, is_completed FROM exam_reports 
                WHERE candidate_id = ? AND exam_id = ?
            `, [candidateId, examId]);
            
            if (assignmentCheck.length === 0) {
                return { error: 'This exam is not assigned to this candidate' };
            }
            
            // Get detailed exam information
            const [examRows] = await pool.query(`
                SELECT 
                    e.id as exam_id,
                    e.title,
                    e.description,
                    e.created_at,
                    e.updated_at,
                    c.category,
                    u.username as created_by_username
                FROM exams e
                LEFT JOIN categories c ON e.category_id = c.id
                LEFT JOIN users u ON e.created_by = u.id
                WHERE e.id = ?
            `, [examId]);
            
            if (examRows.length === 0) {
                return { error: 'Exam not found' };
            }
            
            // Get questions for this exam
            const [questionsRows] = await pool.query(`
                SELECT 
                    id as question_id,
                    question_text,
                    option_a,
                    option_b,
                    option_c,
                    option_d
                FROM questions
                WHERE exam_id = ?
                ORDER BY id ASC
            `, [examId]);
            
            // Get previous attempts info for this candidate and exam
            const [attemptsRows] = await pool.query(`
                SELECT 
                    id as report_id,
                    score,
                    report_date,
                    is_completed
                FROM exam_reports
                WHERE candidate_id = ? AND exam_id = ?
                ORDER BY report_date DESC
            `, [candidateId, examId]);
            
            // Check if the exam has been completed using is_completed column
            const isCompleted = assignmentCheck[0].is_completed === 1;
            
            // Convert is_completed integer to boolean for response
            const attemptsWithBooleanStatus = attemptsRows.map(attempt => ({
                ...attempt,
                is_completed: attempt.is_completed === 1
            }));
            
            return {
                candidate_id: candidateId,
                candidate_name: candidateRows[0].full_name,
                exam: examRows[0],
                questions: questionsRows,
                total_questions: questionsRows.length,
                previous_attempts: {
                    count: attemptsRows.length,
                    attempts: attemptsWithBooleanStatus
                },
                is_completed: isCompleted
            };
        } catch (error) {
            console.error('Error getting exam detail for candidate:', error);
            throw error;
        }
    },


    // Submit exam answers for a candidate
    submitExamAnswers: async (candidateId, examId, answers) => {
        try {
            // Begin transaction
            await pool.query('START TRANSACTION');
            
            // First, verify the candidate and exam exist
            const [candidateRows] = await pool.query(`
                SELECT id FROM candidates WHERE id = ?
            `, [candidateId]);
            
            if (candidateRows.length === 0) {
                await pool.query('ROLLBACK');
                return { error: 'Candidate not found' };
            }
            
            // Check if the exam exists
            const [examRows] = await pool.query(`
                SELECT id FROM exams WHERE id = ?
            `, [examId]);
            
            if (examRows.length === 0) {
                await pool.query('ROLLBACK');
                return { error: 'Exam not found' };
            }
            
            // Check if an exam_report record already exists
            const [existingReport] = await pool.query(`
                SELECT id, is_completed FROM exam_reports 
                WHERE candidate_id = ? AND exam_id = ?
            `, [candidateId, examId]);
            
            if (existingReport.length === 0) {
                await pool.query('ROLLBACK');
                return { error: 'This exam is not assigned to this candidate' };
            }
            
            // Check if exam is already completed
            if (existingReport[0].is_completed === 1) {
                await pool.query('ROLLBACK');
                return { error: 'This exam has already been completed' };
            }
            
            const reportId = existingReport[0].id;
            
            // Get all questions for this exam with their answer keys
            const [questionsRows] = await pool.query(`
                SELECT id, answer_key
                FROM questions
                WHERE exam_id = ?
            `, [examId]);
            
            if (questionsRows.length === 0) {
                await pool.query('ROLLBACK');
                return { error: 'No questions found for this exam' };
            }
            
            // Create a map of question_id to answer_key for easier lookup
            const questionAnswerMap = {};
            questionsRows.forEach(q => {
                questionAnswerMap[q.id] = q.answer_key;
            });
            
            // Calculate score based on correct answers
            let correctAnswers = 0;
            
            answers.forEach(answer => {
                if (questionAnswerMap[answer.question_id] && 
                    questionAnswerMap[answer.question_id] === answer.selected_option) {
                    correctAnswers++;
                }
            });
            
            const totalQuestions = questionsRows.length;
            const score = (correctAnswers / totalQuestions) * 100;
            
            // Update the existing exam report with score and mark as completed
            await pool.query(`
                UPDATE exam_reports 
                SET score = ?, is_completed = 1, updated_at = NOW()
                WHERE id = ?
            `, [score, reportId]);
            
            // The trigger on exam_reports will automatically update candidate_exam_reports
            
            // Commit transaction
            await pool.query('COMMIT');
            
            return {
                report_id: reportId,
                candidate_id: candidateId,
                exam_id: examId,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                score: score,
                is_completed: true,
                submission_date: new Date()
            };
        } catch (error) {
            // Rollback transaction in case of error
            await pool.query('ROLLBACK');
            console.error('Error submitting exam answers:', error);
            throw error;
        }
    },

    // Get list of exam reports for a candidate
    getExamReportsForCandidate: async (candidateId, examId = null) => {
        try {
            // First check if the candidate exists
            const [candidateRows] = await pool.query(`
                SELECT id, full_name FROM candidates WHERE id = ?
            `, [candidateId]);
            
            if (candidateRows.length === 0) {
                return { error: 'Candidate not found' };
            }
            
            // Base query for exam reports
            let query = `
                SELECT 
                    er.id as report_id,
                    er.exam_id,
                    e.title as exam_title,
                    er.score,
                    er.report_date,
                    c.category as exam_category,
                    er.is_completed
                FROM exam_reports er
                JOIN exams e ON er.exam_id = e.id
                LEFT JOIN categories c ON e.category_id = c.id
                WHERE er.candidate_id = ?
            `;
            
            const queryParams = [candidateId];
            
            // If exam_id is provided, filter by that specific exam
            if (examId) {
                query += ` AND er.exam_id = ?`;
                queryParams.push(examId);
            }
            
            query += ` ORDER BY er.report_date DESC`;
            
            const [reportsRows] = await pool.query(query, queryParams);
            
            // Get the candidate's average score across all exams
            const [avgScoreRows] = await pool.query(`
                SELECT 
                    avg_score,
                    total_exams
                FROM candidate_exam_reports
                WHERE candidate_id = ?
            `, [candidateId]);
            
            const avgScore = avgScoreRows.length > 0 ? avgScoreRows[0].avg_score : 0;
            const totalExams = avgScoreRows.length > 0 ? avgScoreRows[0].total_exams : 0;
            
            // Convert is_completed integer to boolean for response
            const reportsWithBooleanStatus = reportsRows.map(report => ({
                ...report,
                is_completed: report.is_completed === 1
            }));
            
            return {
                candidate_id: candidateId,
                candidate_name: candidateRows[0].full_name,
                total_reports: reportsRows.length,
                average_score: avgScore,
                total_exams_taken: totalExams,
                reports: reportsWithBooleanStatus
            };
        } catch (error) {
            console.error('Error getting exam reports for candidate:', error);
            throw error;
        }
    }
};