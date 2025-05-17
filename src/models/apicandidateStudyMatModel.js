const pool = require('../config/db');


module.exports = {
// Get list of study materials for a specific candidate
getStudyMaterialsListByCandidate:async (candidateId) => {
    try {
        // Query to get all study materials assigned to a candidate
        const [rows] = await pool.query(`
            SELECT 
                smc.id as assignment_id,
                smc.study_id,
                smc.access_date,
                sm.title as study_title,
                sm.description as study_description,
                sm.thumbnail
            FROM study_materials_candidates smc
            JOIN study_materials sm ON smc.study_id = sm.id
            WHERE smc.candidate_id = ?
            ORDER BY smc.access_date DESC
        `, [candidateId]);
        
        return {
            candidate_id: candidateId,
            total_materials: rows.length,
            study_materials: rows
        };
    } catch (error) {
        console.error('Error getting study materials list by candidate:', error);
        throw error;
    }
},

// Get detailed information about a specific study material for a candidate
getStudyMaterialDetailForCandidate: async (candidateId, studyId) => {
    try {
        // First check if the candidate has access to this study material
        const [accessRows] = await pool.query(`
            SELECT id, access_date
            FROM study_materials_candidates
            WHERE candidate_id = ? AND study_id = ?
        `, [candidateId, studyId]);
        
        if (accessRows.length === 0) {
            return null; // Candidate doesn't have access to this study material
        }
        
        // Get detailed study material information
        const [studyRows] = await pool.query(`
            SELECT 
                sm.id as study_id,
                sm.title,
                sm.description,
                sm.file_url,
                sm.thumbnail,
                sm.created_at,
                sm.updated_at,
                u.username as created_by_username
            FROM study_materials sm
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE sm.id = ?
        `, [studyId]);
        
        if (studyRows.length === 0) {
            return null; // Study material not found
        }
        
        return {
            assignment_id: accessRows[0].id,
            access_date: accessRows[0].access_date,
            candidate_id: candidateId,
            study_material: studyRows[0]
        };
    } catch (error) {
        console.error('Error getting study material detail for candidate:', error);
        throw error;
    }
}
};