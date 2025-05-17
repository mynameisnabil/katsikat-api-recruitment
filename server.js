const express = require('express');
const app = express();
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const appStatusRoutes = require('./src/routes/appStatusRoutes');
const candidateRoutes = require('./src/routes/candidateRoutes');
const studyMaterialRoutes = require('./src/routes/studyMaterialRoutes');
const examRoutes = require('./src/routes/examRoutes'); 
const statusRoutes = require('./src/routes/statusRoutes');
const positionRoutes = require('./src/routes/positionRoutes');
const apicandidateAuthRoutes = require('./src/routes/apicandidateAuthRoutes');


app.use(express.json());
app.use('/api/super_admin', authRoutes);
app.use('/app-status', appStatusRoutes);
app.use('/api/admin/data_admin', adminRoutes);
app.use('/api/admin/data_candidates', candidateRoutes);
app.use('/api/admin/study_material', studyMaterialRoutes);
app.use('/api/admin/exam', examRoutes);
app.use('/api/admin/status', statusRoutes);
app.use('/api/admin/position', positionRoutes);
app.use('/api/candidate/auth', apicandidateAuthRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
