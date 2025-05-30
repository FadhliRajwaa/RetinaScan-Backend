import express from 'express';
import auth from '../middleware/auth.js';
import Patient from '../models/Patient.js';
import Analysis from '../models/Analysis.js';

const router = express.Router();

// @route   GET api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    // Hitung total pasien
    const totalPatients = await Patient.countDocuments();
    
    // Hitung total scan
    const totalScans = await Analysis.countDocuments();
    
    // Hitung scan 7 hari terakhir
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentScans = await Analysis.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });
    
    // Hitung kondisi parah (severity >= 3)
    const severeConditions = await Analysis.countDocuments({
      'results.severity': { $gte: 3 }
    });
    
    res.json({
      totalPatients,
      totalScans,
      recentScans,
      severeConditions
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/dashboard/charts
// @desc    Get dashboard chart data
// @access  Private
router.get('/charts', auth, async (req, res) => {
  try {
    // Data untuk scan trends (30 hari terakhir)
    const scanTrends = await getScanTrendsData();
    
    // Data untuk distribusi kondisi
    const conditionDistribution = await getConditionDistribution();
    
    // Data untuk distribusi umur
    const ageDistribution = await getAgeDistribution();
    
    res.json({
      scanTrends,
      conditionDistribution,
      ageDistribution
    });
  } catch (err) {
    console.error('Error fetching dashboard chart data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/dashboard/severity
// @desc    Get severity distribution data
// @access  Private
router.get('/severity', auth, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || 'all';
    
    // Data untuk distribusi tingkat keparahan
    const severityData = await getSeverityDistribution(timeRange);
    
    res.json(severityData);
  } catch (err) {
    console.error('Error fetching severity data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function untuk mendapatkan data tren scan
async function getScanTrendsData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const analyses = await Analysis.find({
    createdAt: { $gte: thirtyDaysAgo }
  }).sort({ createdAt: 1 });
  
  // Buat array untuk 30 hari terakhir
  const labels = [];
  const data = [];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    
    const dateStr = date.toISOString().split('T')[0];
    labels.push(dateStr);
    
    // Hitung jumlah scan untuk tanggal ini
    const count = analyses.filter(analysis => {
      const analysisDate = new Date(analysis.createdAt).toISOString().split('T')[0];
      return analysisDate === dateStr;
    }).length;
    
    data.push(count);
  }
  
  return { labels, data };
}

// Helper function untuk mendapatkan distribusi kondisi
async function getConditionDistribution() {
  const analyses = await Analysis.find();
  
  // Hitung jumlah setiap kondisi
  const conditions = {};
  
  analyses.forEach(analysis => {
    if (analysis.results && analysis.results.condition) {
      const condition = analysis.results.condition;
      conditions[condition] = (conditions[condition] || 0) + 1;
    }
  });
  
  const labels = Object.keys(conditions);
  const data = Object.values(conditions);
  
  return { labels, data };
}

// Helper function untuk mendapatkan distribusi umur
async function getAgeDistribution() {
  const patients = await Patient.find();
  
  // Kelompokkan berdasarkan rentang umur
  const ageGroups = {
    '0-10': 0,
    '11-20': 0,
    '21-30': 0,
    '31-40': 0,
    '41-50': 0,
    '51-60': 0,
    '61+': 0
  };
  
  patients.forEach(patient => {
    if (patient.dateOfBirth) {
      const birthYear = new Date(patient.dateOfBirth).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      
      if (age <= 10) ageGroups['0-10']++;
      else if (age <= 20) ageGroups['11-20']++;
      else if (age <= 30) ageGroups['21-30']++;
      else if (age <= 40) ageGroups['31-40']++;
      else if (age <= 50) ageGroups['41-50']++;
      else if (age <= 60) ageGroups['51-60']++;
      else ageGroups['61+']++;
    }
  });
  
  const labels = Object.keys(ageGroups);
  const data = Object.values(ageGroups);
  
  return { labels, data };
}

// Helper function untuk mendapatkan distribusi tingkat keparahan
async function getSeverityDistribution(timeRange) {
  let query = {};
  
  // Filter berdasarkan timeRange
  if (timeRange === 'week') {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    query.createdAt = { $gte: oneWeekAgo };
  } else if (timeRange === 'month') {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    query.createdAt = { $gte: oneMonthAgo };
  } else if (timeRange === 'year') {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    query.createdAt = { $gte: oneYearAgo };
  }
  
  const analyses = await Analysis.find(query);
  
  // Hitung jumlah setiap tingkat keparahan
  const severityLevels = {
    'Normal (0)': 0,
    'Ringan (1)': 0,
    'Sedang (2)': 0,
    'Parah (3)': 0,
    'Sangat Parah (4)': 0,
    'Kritis (5)': 0
  };
  
  analyses.forEach(analysis => {
    if (analysis.results && typeof analysis.results.severity === 'number') {
      const severity = analysis.results.severity;
      
      if (severity === 0) severityLevels['Normal (0)']++;
      else if (severity === 1) severityLevels['Ringan (1)']++;
      else if (severity === 2) severityLevels['Sedang (2)']++;
      else if (severity === 3) severityLevels['Parah (3)']++;
      else if (severity === 4) severityLevels['Sangat Parah (4)']++;
      else if (severity === 5) severityLevels['Kritis (5)']++;
    }
  });
  
  const labels = Object.keys(severityLevels);
  const data = Object.values(severityLevels);
  
  return { labels, data };
}

export default router; 