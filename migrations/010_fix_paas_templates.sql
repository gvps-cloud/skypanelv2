-- Migration 010: Fix marketplace template git sources
-- Ensure default templates reference working repositories and the correct default branches.

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/heroku/node-js-getting-started',
    git_branch = 'main'
WHERE slug = 'nodejs-express';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/netlify-templates/vite-react-tailwind',
    git_branch = 'main'
WHERE slug = 'react-spa';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/vercel/nextjs-portfolio-starter',
    git_branch = 'main'
WHERE slug = 'nextjs';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/encode/rest-framework-tutorial',
    git_branch = 'master'
WHERE slug = 'django-rest';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/heroku/python-sample',
    git_branch = 'master'
WHERE slug = 'flask-api';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/laravel/laravel',
    git_branch = '12.x'
WHERE slug = 'laravel';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/WordPress/WordPress',
    git_branch = 'master'
WHERE slug = 'wordpress';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/TryGhost/Ghost',
    git_branch = 'main'
WHERE slug = 'ghost';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/strapi/strapi-starter-next-blog',
    git_branch = 'master'
WHERE slug = 'strapi';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/netlify-templates/vite-vue-tailwind',
    git_branch = 'main'
WHERE slug = 'vue-spa';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/nuxt-community/starter-template',
    git_branch = 'master'
WHERE slug = 'nuxtjs';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/sveltejs/kit-template-default',
    git_branch = 'main'
WHERE slug = 'sveltekit';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/tiangolo/full-stack-fastapi-template',
    git_branch = 'master'
WHERE slug = 'fastapi';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/heroku/ruby-getting-started',
    git_branch = 'main'
WHERE slug = 'rails';

UPDATE paas_marketplace_templates
SET git_url = 'https://github.com/eddycjy/go-gin-example',
    git_branch = 'master'
WHERE slug = 'go-gin';
