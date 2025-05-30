const pool = require('../config/db');

const interviewScheduleModel = {
    // Add candidate to interview schedule with up to 3 admins, now supports link
 addCandidateToInterviewSchedule: async (candidateId, candidatePositionId, interviewDate, interviewTime, notes, adminIds, link) => {
    try {
        // Convert to array if single ID is provided
        if (!Array.isArray(adminIds)) {
            adminIds = [adminIds];
        }
        
        // Remove duplicates, convert to numbers, and limit to 3 admins
        adminIds = [...new Set(adminIds.map(id => parseInt(id)))]
            .filter(id => !isNaN(id))
            .slice(0, 3); // Maksimal 3 admin
        
        if (adminIds.length === 0) {
            throw new Error('Admin ID tidak valid');
        }
        
        // Check if candidate exists
        const [candidateRows] = await pool.query(
            'SELECT id FROM candidates WHERE id = ?',
            [candidateId]
        );
        
        if (candidateRows.length === 0) {
            throw new Error('Kandidat tidak ditemukan');
        }
        
        // Check if candidate position exists
        const [positionRows] = await pool.query(
            'SELECT id FROM candidate_positions WHERE position_id = ? AND candidate_id = ?',
            [candidatePositionId, candidateId]
        );
        
        if (positionRows.length === 0) {
            throw new Error('Posisi kandidat tidak ditemukan');
        }
        
        // Validate admin IDs - check if they exist and have admin/superadmin role
        const adminPlaceholders = adminIds.map(() => '?').join(',');
        const [adminRows] = await pool.query(
            `SELECT id, username, full_name FROM users WHERE id IN (${adminPlaceholders}) AND role IN ('admin', 'superadmin')`,
            adminIds
        );
        
        if (adminRows.length !== adminIds.length) {
            const validAdminIds = adminRows.map(row => row.id);
            const invalidAdminIds = adminIds.filter(id => !validAdminIds.includes(id));
            throw new Error(`Admin ID tidak valid atau tidak memiliki role admin/superadmin: ${invalidAdminIds.join(', ')}`);
        }
        
        // Prepare admin values (fill remaining slots with NULL)
        const admin1 = adminIds[0] || null;
        const admin2 = adminIds[1] || null;
        const admin3 = adminIds[2] || null;
        
        // Check if interview schedule already exists for this candidate position
        const [existingRows] = await pool.query(
            'SELECT id FROM interview_schedules WHERE candidate_id = ? AND candidate_position_id = ?',
            [candidateId, candidatePositionId]
        );
        
        let scheduleId;
        let isUpdated = false;
        
        if (existingRows.length > 0) {
            // Update existing interview schedule
            scheduleId = existingRows[0].id;
            await pool.query(
                'UPDATE interview_schedules SET interview_date = ?, interview_time = ?, notes = ?, admin_1 = ?, admin_2 = ?, admin_3 = ?, link = ? WHERE id = ?',
                [interviewDate, interviewTime, notes, admin1, admin2, admin3, link, scheduleId]
            );
            isUpdated = true;
        } else {
            // Create new interview schedule
            const [result] = await pool.query(
                'INSERT INTO interview_schedules (candidate_id, candidate_position_id, interview_date, interview_time, notes, admin_1, admin_2, admin_3, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [candidateId, candidatePositionId, interviewDate, interviewTime, notes, admin1, admin2, admin3, link]
            );
            scheduleId = result.insertId;
        }
        
        // Update candidate_positions status_id to 4 for the specific candidate position
        await pool.query(
            'UPDATE candidate_positions SET status_id = 4 WHERE candidate_id = ? AND position_id = ?',
            [candidateId, candidatePositionId]
        );
        
        return {
            id: scheduleId,
            updated: isUpdated,
            assigned_admins: adminRows
        };
    } catch (error) {
        console.error('Error adding candidate to interview schedule:', error);
        throw error;
    }
},
    
    // Get interview schedules for candidate
    getInterviewSchedulesForCandidate: async (candidateId) => {
        try {
            // Check if candidate exists
            const [candidateRows] = await pool.query(
                'SELECT id FROM candidates WHERE id = ?',
                [candidateId]
            );
            
            if (candidateRows.length === 0) {
                throw new Error('Kandidat tidak ditemukan');
            }
            
            // Get all interview schedules for candidate with position info
            const [scheduleRows] = await pool.query(`
                SELECT 
                    isch.id,
                    isch.interview_date,
                    isch.interview_time,
                    isch.notes,
                    isch.link,
                    isch.admin_1,
                    isch.admin_2,
                    isch.admin_3,
                    p.position_name,
                    p.type,
                    p.work,
                    cp.date_of_application,
                    s.status_name
                FROM 
                    interview_schedules isch
                JOIN 
                    candidate_positions cp ON isch.candidate_position_id = cp.id
                JOIN 
                    positions p ON cp.position_id = p.id
                LEFT JOIN 
                    status s ON cp.status_id = s.id
                WHERE 
                    isch.candidate_id = ?
                ORDER BY 
                    isch.interview_date DESC, isch.interview_time ASC
            `, [candidateId]);
            
            if (scheduleRows.length === 0) {
                return [];
            }
            
            // Get all unique admin IDs
            const allAdminIds = [];
            scheduleRows.forEach(row => {
                if (row.admin_1) allAdminIds.push(row.admin_1);
                if (row.admin_2) allAdminIds.push(row.admin_2);
                if (row.admin_3) allAdminIds.push(row.admin_3);
            });
            
            const uniqueAdminIds = [...new Set(allAdminIds)];
            
            // Get admin details if there are any admin IDs
            let adminDetails = {};
            if (uniqueAdminIds.length > 0) {
                const adminPlaceholders = uniqueAdminIds.map(() => '?').join(',');
                const [adminRows] = await pool.query(
                    `SELECT id, username, full_name FROM users WHERE id IN (${adminPlaceholders})`,
                    uniqueAdminIds
                );
                
                adminDetails = adminRows.reduce((acc, admin) => {
                    acc[admin.id] = {
                        admin_id: admin.id,
                        username: admin.username,
                        full_name: admin.full_name
                    };
                    return acc;
                }, {});
            }
            
            // Format the data
            return scheduleRows.map(row => {
                const assignedAdmins = [];
                if (row.admin_1 && adminDetails[row.admin_1]) assignedAdmins.push(adminDetails[row.admin_1]);
                if (row.admin_2 && adminDetails[row.admin_2]) assignedAdmins.push(adminDetails[row.admin_2]);
                if (row.admin_3 && adminDetails[row.admin_3]) assignedAdmins.push(adminDetails[row.admin_3]);
                
                return {
                    schedule_id: row.id,
                    interview_date: row.interview_date,
                    interview_time: row.interview_time,
                    notes: row.notes,
                    link: row.link,
                    position: {
                        name: row.position_name,
                        type: row.type,
                        work: row.work
                    },
                    application_date: row.date_of_application,
                    status: row.status_name,
                    assigned_admins: assignedAdmins
                };
            });
        } catch (error) {
            console.error('Error getting interview schedules for candidate:', error);
            throw error;
        }
    },
    
    // Get specific interview schedule detail
    getInterviewScheduleDetail: async (scheduleId, candidateId) => {
        try {
            // Get interview schedule with detailed info
            const [scheduleRows] = await pool.query(`
                SELECT 
                    isch.id,
                    isch.interview_date,
                    isch.interview_time,
                    isch.notes,
                    isch.link,
                    isch.admin_1,
                    isch.admin_2,
                    isch.admin_3,
                    p.id as position_id,
                    p.position_name,
                    p.type,
                    p.work,
                    cp.id as candidate_position_id,
                    cp.date_of_application,
                    s.status_name
                FROM 
                    interview_schedules isch
                JOIN 
                    candidate_positions cp ON isch.candidate_position_id = cp.id
                JOIN 
                    positions p ON cp.position_id = p.id
                LEFT JOIN 
                    status s ON cp.status_id = s.id
                WHERE 
                    isch.id = ? AND isch.candidate_id = ?
            `, [scheduleId, candidateId]);
            
            if (scheduleRows.length === 0) {
                return null;
            }
            
            const row = scheduleRows[0];
            const adminIds = [row.admin_1, row.admin_2, row.admin_3].filter(id => id !== null);
            
            // Get admin details
            let assignedAdmins = [];
            if (adminIds.length > 0) {
                const adminPlaceholders = adminIds.map(() => '?').join(',');
                const [adminRows] = await pool.query(
                    `SELECT id, username, full_name, email FROM users WHERE id IN (${adminPlaceholders})`,
                    adminIds
                );
                
                assignedAdmins = adminRows.map(admin => ({
                    admin_id: admin.id,
                    username: admin.username,
                    full_name: admin.full_name,
                    email: admin.email
                }));
            }
            
            // Format the data
            return {
                schedule_id: row.id,
                interview_date: row.interview_date,
                interview_time: row.interview_time,
                notes: row.notes,
                link: row.link,
                position: {
                    id: row.position_id,
                    name: row.position_name,
                    type: row.type,
                    work: row.work
                },
                candidate_position_id: row.candidate_position_id,
                application_date: row.date_of_application,
                status: row.status_name,
                assigned_admins: assignedAdmins
            };
        } catch (error) {
            console.error('Error getting interview schedule detail:', error);
            throw error;
        }
    },
    
    // Get interview schedules for admin
    getInterviewSchedulesForAdmin: async (adminId) => {
        try {
            // Check if admin exists and has proper role
            const [adminRows] = await pool.query(
                'SELECT id, username, full_name FROM users WHERE id = ? AND role IN (\'admin\', \'superadmin\')',
                [adminId]
            );
            
            if (adminRows.length === 0) {
                throw new Error('Admin tidak ditemukan atau tidak memiliki role admin/superadmin');
            }
            
            // Get all interview schedules where this admin is assigned (any of the 3 columns)
            const [scheduleRows] = await pool.query(`
                SELECT 
                    isch.id,
                    isch.interview_date,
                    isch.interview_time,
                    isch.notes,
                    isch.link,
                    c.id as candidate_id,
                    c.full_name as candidate_name,
                    c.email as candidate_email,
                    c.phone_number as candidate_phone,
                    p.position_name,
                    p.type,
                    p.work,
                    cp.date_of_application,
                    s.status_name
                FROM 
                    interview_schedules isch
                JOIN 
                    candidates c ON isch.candidate_id = c.id
                JOIN 
                    candidate_positions cp ON isch.candidate_position_id = cp.id
                JOIN 
                    positions p ON cp.position_id = p.id
                LEFT JOIN 
                    status s ON cp.status_id = s.id
                WHERE 
                    isch.admin_1 = ? OR isch.admin_2 = ? OR isch.admin_3 = ?
                ORDER BY 
                    isch.interview_date ASC, isch.interview_time ASC
            `, [adminId, adminId, adminId]);
            
            // Format the data
            return scheduleRows.map(row => ({
                schedule_id: row.id,
                interview_date: row.interview_date,
                interview_time: row.interview_time,
                notes: row.notes,
                link: row.link,
                candidate: {
                    id: row.candidate_id,
                    name: row.candidate_name,
                    email: row.candidate_email,
                    phone: row.candidate_phone
                },
                position: {
                    name: row.position_name,
                    type: row.type,
                    work: row.work
                },
                application_date: row.date_of_application,
                status: row.status_name
            }));
        } catch (error) {
            console.error('Error getting interview schedules for admin:', error);
            throw error;
        }
    }
};

module.exports = interviewScheduleModel;