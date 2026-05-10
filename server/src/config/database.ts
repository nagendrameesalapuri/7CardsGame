import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/seven-cards-show';

  mongoose.connection.on('connected', () => logger.info('[DB] MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('[DB] MongoDB error', err));
  mongoose.connection.on('disconnected', () => logger.warn('[DB] MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
  });
}
