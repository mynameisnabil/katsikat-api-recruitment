const pool = require('../config/db');

// Add a new study material
const addStudyMaterial = async (studyMaterialData) => {
    const { created_by, title, description, file_url, thumbnail } = studyMaterialData;
    
    const [result] = await pool.query(
        'INSERT INTO study_materials (created_by, title, description, file_url, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [created_by, title, description, file_url, thumbnail]
    );
    
    return { id: result.insertId, ...studyMaterialData };
};

// Get list of all study materials
const getAllStudyMaterials = async () => {
    const [materials] = await pool.query(`
        SELECT sm.*, u.username as created_by
        FROM study_materials sm
        LEFT JOIN users u ON sm.created_by = u.id
        ORDER BY sm.created_at DESC
    `);
    
    return materials;
};

// Get study material detail by id
const getStudyMaterialById = async (materialId) => {
    // Get study material information
    const [materialRows] = await pool.query(`
        SELECT sm.*, u.username as created_by
        FROM study_materials sm
        LEFT JOIN users u ON sm.created_by = u.id
        WHERE sm.id = ?
    `, [materialId]);
    
    if (materialRows.length === 0) {
        return null;
    }
    
    const material = materialRows[0];
    
    // Get candidates assigned to this study material
    const [candidatesRows] = await pool.query(`
        SELECT smc.*, c.full_name, c.email, u.username
        FROM study_materials_candidates smc
        JOIN candidates c ON smc.candidate_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE smc.study_id = ?
        ORDER BY smc.access_date DESC
    `, [materialId]);
    
    material.assigned_candidates = candidatesRows.length > 0 ? candidatesRows : [];
    
    return material;
};

// Update study material
const updateStudyMaterial = async (materialId, studyMaterialData) => {
    const { title, description, file_url, thumbnail } = studyMaterialData;
    
    const [result] = await pool.query(
        'UPDATE study_materials SET title = ?, description = ?, file_url = ?, thumbnail = ?, updated_at = NOW() WHERE id = ?',
        [title, description, file_url, thumbnail, materialId]
    );
    
    return result.affectedRows > 0;
};

// Delete study material
const deleteStudyMaterial = async (materialId) => {
    // Delete candidate associations first
    await pool.query('DELETE FROM study_materials_candidates WHERE study_id = ?', [materialId]);
    
    // Then delete the study material
    const [result] = await pool.query('DELETE FROM study_materials WHERE id = ?', [materialId]);
    
    return result.affectedRows > 0;
};

// // Add candidate to study material
// const addCandidateToStudyMaterial = async (studyId, candidateId) => {
//     // Check if assignment already exists
//     const [existingRows] = await pool.query(
//         'SELECT * FROM study_materials_candidates WHERE study_id = ? AND candidate_id = ?',
//         [studyId, candidateId]
//     );
    
//     if (existingRows.length > 0) {
//         // Update access date if already exists
//         await pool.query(
//             'UPDATE study_materials_candidates SET access_date = NOW() WHERE study_id = ? AND candidate_id = ?',
//             [studyId, candidateId]
//         );
//         return { updated: true }; // ✅ hanya return updated
//     } else {
//         // Create new assignment
//         await pool.query(
//             'INSERT INTO study_materials_candidates (study_id, candidate_id, access_date) VALUES (?, ?, NOW())',
//             [studyId, candidateId]
//         );
//         return { created: true }; // ✅ hanya return created
//     }
// };

// Model: Modified to handle multiple study IDs
const addCandidateToStudyMaterial = async (studyIds, candidateId) => {
    // Convert to array if single ID is provided
    if (!Array.isArray(studyIds)) {
        studyIds = [studyIds];
    }
    
    const results = {
        created: [],
        updated: []
    };
    
    // Process each study ID
    for (const studyId of studyIds) {
        // Check if assignment already exists
        const [existingRows] = await pool.query(
            'SELECT * FROM study_materials_candidates WHERE study_id = ? AND candidate_id = ?',
            [studyId, candidateId]
        );
        
        if (existingRows.length > 0) {
            // Update access date if already exists
            await pool.query(
                'UPDATE study_materials_candidates SET access_date = NOW() WHERE study_id = ? AND candidate_id = ?',
                [studyId, candidateId]
            );
            results.updated.push(studyId);
        } else {
            // Create new assignment
            await pool.query(
                'INSERT INTO study_materials_candidates (study_id, candidate_id, access_date) VALUES (?, ?, NOW())',
                [studyId, candidateId]
            );
            results.created.push(studyId);
        }
    }
    
    return results;
};



module.exports = {
    addStudyMaterial,
    getAllStudyMaterials,
    getStudyMaterialById,
    updateStudyMaterial,
    deleteStudyMaterial,
    addCandidateToStudyMaterial
};