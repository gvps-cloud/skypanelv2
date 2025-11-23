import { query } from '../api/lib/database.js';
import dotenv from 'dotenv';

dotenv.config();

const defaultTemplates = [
  {
    name: 'Node.js Express API',
    slug: 'nodejs-express',
    description: 'RESTful API built with Node.js and Express.js',
    category: 'backend',
    repository_url: 'https://github.com/expressjs/express',
    repository_branch: 'master',
    deploy_method: 'buildpack',
    default_env_vars: { NODE_ENV: 'production', PORT: '3000' },
    default_ports: [{ containerPort: 3000, protocol: 'https' }],
    tags: ['nodejs', 'express', 'api', 'javascript'],
    is_active: true
  },
  {
    name: 'Python FastAPI',
    slug: 'python-fastapi',
    description: 'Modern Python API with FastAPI',
    category: 'backend',
    repository_url: 'https://github.com/tiangolo/fastapi',
    repository_branch: 'master',
    deploy_method: 'buildpack',
    default_env_vars: { PYTHONUNBUFFERED: '1', PORT: '8000' },
    default_ports: [{ containerPort: 8000, protocol: 'https' }],
    tags: ['python', 'fastapi', 'api'],
    is_active: true
  },
  {
    name: 'React SPA',
    slug: 'react-spa',
    description: 'Single Page Application built with React',
    category: 'frontend',
    repository_url: 'https://github.com/facebook/create-react-app',
    repository_branch: 'main',
    deploy_method: 'buildpack',
    default_env_vars: { NODE_ENV: 'production' },
    default_ports: [{ containerPort: 3000, protocol: 'https' }],
    tags: ['react', 'spa', 'javascript', 'frontend'],
    is_active: true
  },
  {
    name: 'Go REST API',
    slug: 'go-api',
    description: 'High-performance Go REST API',
    category: 'backend',
    repository_url: 'https://github.com/gorilla/mux',
    repository_branch: 'main',
    deploy_method: 'buildpack',
    default_env_vars: { PORT: '8080' },
    default_ports: [{ containerPort: 8080, protocol: 'https' }],
    tags: ['go', 'golang', 'api'],
    is_active: true
  },
  {
    name: 'Static HTML Site',
    slug: 'static-site',
    description: 'Simple static HTML/CSS/JS website',
    category: 'frontend',
    repository_url: 'https://github.com/h5bp/html5-boilerplate',
    repository_branch: 'main',
    deploy_method: 'buildpack',
    default_env_vars: {},
    default_ports: [{ containerPort: 8080, protocol: 'https' }],
    tags: ['html', 'static', 'website'],
    is_active: true
  }
];

async function seedMarketplace() {
  console.log('🌱 Seeding marketplace templates...\n');

  try {
    for (const template of defaultTemplates) {
      // Check if template already exists
      const existing = await query(
        'SELECT id FROM paas_marketplace_templates WHERE slug = $1',
        [template.slug]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Template already exists: ${template.name}`);
        continue;
      }

      // Insert template
      await query(
        `INSERT INTO paas_marketplace_templates 
         (name, slug, description, category, repository_url, repository_branch,
          deploy_method, default_env_vars, default_ports, tags, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          template.name,
          template.slug,
          template.description,
          template.category,
          template.repository_url,
          template.repository_branch,
          template.deploy_method,
          JSON.stringify(template.default_env_vars),
          JSON.stringify(template.default_ports),
          JSON.stringify(template.tags),
          template.is_active
        ]
      );

      console.log(`✅ Created template: ${template.name}`);
    }

    console.log('\n✨ Marketplace seeding complete!\n');
    console.log('💡 View templates at: /paas/marketplace\n');
    
  } catch (error) {
    console.error('❌ Error seeding marketplace:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

seedMarketplace();
