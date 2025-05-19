const pool = require('../config/db');


// Interview Schedule Model
const interviewScheduleModel = {
    // Add candidate to interview schedule
    addCandidateToInterviewSchedule: async (candidateId, candidatePositionId, interviewDate, interviewTime, notes) => {
        try {
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
                'SELECT id FROM candidate_positions WHERE id = ? AND candidate_id = ?',
                [candidatePositionId, candidateId]
            );
            
            if (positionRows.length === 0) {
                throw new Error('Posisi kandidat tidak ditemukan');
            }
            
            // Check if interview schedule already exists for this candidate position
            const [existingRows] = await pool.query(
                'SELECT id FROM interview_schedules WHERE candidate_id = ? AND candidate_position_id = ?',
                [candidateId, candidatePositionId]
            );
            
            let result;
            
            if (existingRows.length > 0) {
                // Update existing interview schedule
                [result] = await pool.query(
                    'UPDATE interview_schedules SET interview_date = ?, interview_time = ?, notes = ? WHERE id = ?',
                    [interviewDate, interviewTime, notes, existingRows[0].id]
                );
                
                return {
                    id: existingRows[0].id,
                    updated: true
                };
            } else {
                // Create new interview schedule
                [result] = await pool.query(
                    'INSERT INTO interview_schedules (candidate_id, candidate_position_id, interview_date, interview_time, notes) VALUES (?, ?, ?, ?, ?)',
                    [candidateId, candidatePositionId, interviewDate, interviewTime, notes]
                );
                
                return {
                    id: result.insertId,
                    updated: false
                };
            }
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
                    is.id,
                    is.interview_date,
                    is.interview_time,
                    is.notes,
                    p.position_name,
                    p.type,
                    p.work,
                    cp.date_of_application,
                    s.status_name
                FROM 
                    interview_schedules is
                JOIN 
                    candidate_positions cp ON is.candidate_position_id = cp.id
                JOIN 
                    positions p ON cp.position_id = p.id
                LEFT JOIN 
                    status s ON cp.status_id = s.id
                WHERE 
                    is.candidate_id = ?
                ORDER BY 
                    is.interview_date DESC, is.interview_time ASC
            `, [candidateId]);
            
            if (scheduleRows.length === 0) {
                return [];
            }
            
            // Format the data
            return scheduleRows.map(row => ({
                schedule_id: row.id,
                interview_date: row.interview_date,
                interview_time: row.interview_time,
                notes: row.notes,
                position: {
                    name: row.position_name,
                    type: row.type,
                    work: row.work
                },
                application_date: row.date_of_application,
                status: row.status_name
            }));
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
                    is.id,
                    is.interview_date,
                    is.interview_time,
                    is.notes,
                    p.id as position_id,
                    p.position_name,
                    p.type,
                    p.work,
                    cp.id as candidate_position_id,
                    cp.date_of_application,
                    s.status_name
                FROM 
                    interview_schedules is
                JOIN 
                    candidate_positions cp ON is.candidate_position_id = cp.id
                JOIN 
                    positions p ON cp.position_id = p.id
                LEFT JOIN 
                    status s ON cp.status_id = s.id
                WHERE 
                    is.id = ? AND is.candidate_id = ?
            `, [scheduleId, candidateId]);
            
            if (scheduleRows.length === 0) {
                return null;
            }
            
            const row = scheduleRows[0];
            
            // Format the data
            return {
                schedule_id: row.id,
                interview_date: row.interview_date,
                interview_time: row.interview_time,
                notes: row.notes,
                position: {
                    id: row.position_id,
                    name: row.position_name,
                    type: row.type,
                    work: row.work
                },
                candidate_position_id: row.candidate_position_id,
                application_date: row.date_of_application,
                status: row.status_name
            };
        } catch (error) {
            console.error('Error getting interview schedule detail:', error);
            throw error;
        }
    }
};