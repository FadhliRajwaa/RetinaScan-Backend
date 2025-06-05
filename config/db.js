import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/retinascan';
    console.log('Connecting to MongoDB with URI:', mongoURI);
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected Aman Bro');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

export default connectDB;