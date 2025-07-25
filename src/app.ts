import 'reflect-metadata';
import express from 'express';
import { connectDB } from './config/db';
import partRoutes from './routes/part';

const app = express();

app.use(express.json());
app.use('/api/part', partRoutes);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app; 