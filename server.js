const express = require('express');
const app = express();
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const appStatusRoutes = require('./src/routes/appStatusRoutes');
const candidateRoutes = require('./src/routes/candidateRoutes');
const studyMaterialRoutes = require('./src/routes/studyMaterialRoutes');


app.use(express.json());
app.use('/api/admin', authRoutes);
app.use('/api/data_admin', adminRoutes);
app.use('/app-status', appStatusRoutes);
app.use('/api/admin/data_candidates', candidateRoutes);
app.use('/api/admin/study_material', studyMaterialRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
