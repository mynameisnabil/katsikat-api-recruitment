const pool = require('../config/db');

// Add a new candidate
const addCandidate = async (candidateData) => {
    const { user_id, age, birthdate, gender, email, phone_number, full_name } = candidateData;
    
    const [result] = await pool.query(
        'INSERT INTO candidates (user_id, age, birthdate, gender, email, phone_number, full_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, age, birthdate, gender, email, phone_number, full_name]
    );
    
    return { id: result.insertId, ...candidateData };
};

const getAllCandidates = async () => {
    const [candidates] = await pool.query(`
        SELECT 
            c.id as candidate_id, 
            c.*, 
            u.username, 
            COALESCE(s.status_name, '-') as status_name,
            COALESCE(p.position_name, '-') as position_name
        FROM candidates c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN candidate_positions cp ON c.id = cp.candidate_id
        LEFT JOIN status s ON cp.status_id = s.id
        LEFT JOIN positions p ON cp.position_id = p.id
    `);
    
    // Handle candidates that don't have positions assigned yet
    return candidates.map(candidate => {
        // Remove the duplicate 'id' field if it exists
        const { id, ...rest } = candidate;
        return {
            ...rest,
            candidate_id: candidate.candidate_id || '-', 
            status_name: candidate.status_name || '-',
            position_name: candidate.position_name || '-'
        };
    });
};

// Get candidate details by id
const getCandidateById = async (candidateId) => {
    // Get candidate basic information
    const [candidateRows] = await pool.query(`
        SELECT c.id as candidate_id, c.*, u.username, u.email as user_email
        FROM candidates c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    `, [candidateId]);
    
    if (candidateRows.length === 0) {
        return null;
    }
    
    const candidate = candidateRows[0];
    
    // Get candidate positions with status
    const [positionsRows] = await pool.query(`
        SELECT 
            cp.candidate_id,
            cp.position_id,
            cp.status_id,
            cp.date_of_application,
            p.position_name, 
            p.type, 
            p.work, 
            COALESCE(s.status_name, '-') as status_name
        FROM candidate_positions cp
        JOIN positions p ON cp.position_id = p.id
        LEFT JOIN status s ON cp.status_id = s.id
        WHERE cp.candidate_id = ?
    `, [candidateId]);
    
    // Set default empty array if no positions found
    candidate.data_user = positionsRows.length > 0 ? positionsRows : [{ 
        position_name: '-', 
        status_name: '-' 
    }];
    
    // Get interview schedules
    const [interviewRows] = await pool.query(`
        SELECT * FROM interview_schedules
        WHERE candidate_id = ?
    `, [candidateId]);
    
    // Set default empty array if no interviews found
    candidate.interviews = interviewRows.length > 0 ? interviewRows : [{ 
        interview_date: '-', 
        interview_time: '-', 
        notes: '-' 
    }];
    
    // Get exam reports
    const [examReportRows] = await pool.query(`
        SELECT 
            er.*, 
            COALESCE(e.title, '-') as exam_title
        FROM exam_reports er
        LEFT JOIN exams e ON er.exam_id = e.id
        WHERE er.candidate_id = ?
    `, [candidateId]);
    
    // Set default empty array if no exam reports found
    candidate.exam_reports = examReportRows.length > 0 ? examReportRows : [{ 
        exam_title: '-', 
        score: '-', 
        report_date: '-' 
    }];
    
    // Get candidate summary report if exists
    const [summaryReportRows] = await pool.query(`
        SELECT * FROM candidate_exam_reports
        WHERE candidate_id = ?
    `, [candidateId]);
    
    if (summaryReportRows.length > 0) {
        candidate.summary_report = summaryReportRows[0];
    } else {
        candidate.summary_report = { 
            average_score: '-', 
            total_exams: '-' 
        };
    }
    
    // Get study materials for candidate
    const [studyMaterialRows] = await pool.query(`
        SELECT 
            sm.id,
            sm.title,
            sm.description,
            sm.file_url,
            sm.thumbnail,
            sm.created_at as material_created_at,
            sm.updated_at as material_updated_at,
            smc.access_date,
            COALESCE(u.full_name, u.username, '-') as created_by_name
        FROM study_materials_candidates smc
        JOIN study_materials sm ON smc.study_id = sm.id
        LEFT JOIN users u ON sm.created_by = u.id
        WHERE smc.candidate_id = ?
        ORDER BY smc.access_date DESC
    `, [candidateId]);
    
    // Set default empty array if no study materials found
    candidate.study_materials = studyMaterialRows.length > 0 ? studyMaterialRows : [{ 
        title: '-', 
        description: '-', 
        access_date: '-',
        created_by_name: '-'
    }];
    
    // Remove 'candidate_position_id' from the response
    const { candidate_position_id, ...rest } = candidate;
    return rest;
};






// Update candidate status in a position
const updateCandidateStatus = async (candidateId, positionId, statusId) => {
    const [result] = await pool.query(
        'UPDATE candidate_positions SET status_id = ? WHERE candidate_id = ? AND position_id = ?',
        [statusId, candidateId, positionId]
    );
    
    return result.affectedRows > 0;
};

// Assign candidate to a position
const assignCandidateToPosition = async (candidateId, positionId, statusId) => {
    // Check if assignment already exists
    const [existingRows] = await pool.query(
        'SELECT * FROM candidate_positions WHERE candidate_id = ? AND position_id = ?',
        [candidateId, positionId]
    );
    
    if (existingRows.length > 0) {
        // Update existing assignment
        await pool.query(
            'UPDATE candidate_positions SET status_id = ? WHERE candidate_id = ? AND position_id = ?',
            [statusId, candidateId, positionId]
        );
        return { updated: true }; // ✅ hanya return updated
    } else {
        // Create new assignment
        await pool.query(
            'INSERT INTO candidate_positions (candidate_id, position_id, status_id, date_of_application) VALUES (?, ?, ?, NOW())',
            [candidateId, positionId, statusId]
        );
        return { created: true }; // ✅ hanya return created
    }
};



module.exports = {
    addCandidate,
    getAllCandidates,
    getCandidateById,
    updateCandidateStatus,
    assignCandidateToPosition
};