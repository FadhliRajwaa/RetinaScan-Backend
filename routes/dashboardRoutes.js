import express from 'express';
import { authMiddleware as auth } from '../middleware/authMiddleware.js';
import Patient from '../models/Patient.js';
import RetinaAnalysis from '../models/RetinaAnalysis.js';

const router = express.Router();

// @route   GET api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    // Hitung total pasien
    const totalPatients = await Patient.countDocuments();
    
    // Hitung total scan
    const totalScans = await RetinaAnalysis.countDocuments();
    
    // Hitung scan 7 hari terakhir
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentScans = await RetinaAnalysis.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });
    
    // Hitung kondisi parah (Severe atau Proliferative DR)
    const severeConditions = await RetinaAnalysis.countDocuments({
      'results.classification': { $in: ['Severe', 'Proliferative DR'] }
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
  
  const analyses = await RetinaAnalysis.find({
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
  const analyses = await RetinaAnalysis.find();
  
  // Hitung jumlah setiap kondisi berdasarkan classification
  const conditions = {
    'No DR': 0,
    'Mild': 0,
    'Moderate': 0,
    'Severe': 0,
    'Proliferative DR': 0
  };
  
  analyses.forEach(analysis => {
    if (analysis.results && analysis.results.classification) {
      const classification = analysis.results.classification;
      conditions[classification] = (conditions[classification] || 0) + 1;
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
  
  const analyses = await RetinaAnalysis.find(query);
  
  // Hitung jumlah setiap tingkat keparahan berdasarkan classification
  const severityLevels = {
    'No DR (0)': 0,
    'Mild (1)': 0,
    'Moderate (2)': 0,
    'Severe (3)': 0,
    'Proliferative DR (4)': 0
  };
  
  analyses.forEach(analysis => {
    if (analysis.results && analysis.results.classification) {
      const classification = analysis.results.classification;
      
      if (classification === 'No DR') severityLevels['No DR (0)']++;
      else if (classification === 'Mild') severityLevels['Mild (1)']++;
      else if (classification === 'Moderate') severityLevels['Moderate (2)']++;
      else if (classification === 'Severe') severityLevels['Severe (3)']++;
      else if (classification === 'Proliferative DR') severityLevels['Proliferative DR (4)']++;
    }
  });
  
  const labels = Object.keys(severityLevels);
  const data = Object.values(severityLevels);
  
  return { labels, data };
}

export default router; 