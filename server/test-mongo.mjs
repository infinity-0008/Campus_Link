import mongoose from 'mongoose';

const uri = "mongodb://yadavab002_db_user:codesangam@ac-t2ydfnb-shard-00-00.s0otyrb.mongodb.net:27017,ac-t2ydfnb-shard-00-01.s0otyrb.mongodb.net:27017,ac-t2ydfnb-shard-00-02.s0otyrb.mongodb.net:27017/test?ssl=true&replicaSet=atlas-megqfs-shard-0&authSource=admin";

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

// All users with their roles
const users = await db.collection('users').find({}).toArray();
console.log("\nAll users in 'test' DB:");
users.forEach(u => console.log(`  ${u.email} | role: ${u.role} | status: ${u.status}`));

// Check studentprofiles
const students = await db.collection('studentprofiles').countDocuments();
const recruiters = await db.collection('recruiterprofiles').countDocuments();
console.log(`\nstudentprofiles: ${students}, recruiterprofiles: ${recruiters}`);

await mongoose.disconnect();
