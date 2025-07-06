import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const isProd = process.env.NODE_ENV === 'production';

const mongoUri = isProd ? process.env.MONGODB_URI_ATLAS : process.env.MONGO_URI_DEV;

if (!mongoUri) {
  throw new Error('MONGO_URI is not defined in environment variables');
}

export const connectDB = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}; 