import app from '../api/app.js';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { query } from '../api/lib/database.js';
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();
const hash = await bcrypt.hash('TestAdmin123!', 12);
await query(
  'INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
  [id, 'TestAdm', 'route-check@example.com', hash, 'admin']
);

const loginRes = await request(app)
  .post('/api/auth/login')
  .send({ email: 'route-check@example.com', password: 'TestAdmin123!' });
const token = loginRes.body.token;
console.log('Login status:', loginRes.status);

const r1 = await request(app)
  .get('/api/admin/users')
  .set('Authorization', 'Bearer ' + token);
console.log('GET /api/admin/users status:', r1.status);

const r2 = await request(app)
  .get('/api/admin/users/users')
  .set('Authorization', 'Bearer ' + token);
console.log('GET /api/admin/users/users status:', r2.status);

const r3 = await request(app)
  .put(`/api/admin/users/${id}`)
  .set('Authorization', 'Bearer ' + token)
  .send({ name: 'NewName' });
console.log('PUT /api/admin/users/:id status:', r3.status);

const r4 = await request(app)
  .put(`/api/admin/users/users/${id}`)
  .set('Authorization', 'Bearer ' + token)
  .send({ name: 'NewName' });
console.log('PUT /api/admin/users/users/:id status:', r4.status);

await query('DELETE FROM users WHERE id = $1', [id]);
process.exit(0);
