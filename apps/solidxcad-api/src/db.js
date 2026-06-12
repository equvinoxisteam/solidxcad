import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './config.js';

// Windows + Node often fails SRV lookup (querySrv ECONNREFUSED); use public DNS.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('[db] connected to MongoDB');
}
