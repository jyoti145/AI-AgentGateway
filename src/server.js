import 'dotenv/config';
import express from 'express';
import ConnectDB from './config/db.js';

await ConnectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/health' , (req,res) =>{
res.status(200).json({status:'ok'})
})

app.listen(PORT , ()=>{
console.log(` AI Agent Gateway is running on ${PORT}`);
})