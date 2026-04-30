-- Migration 036: Create Documentation System
-- Description: Adds documentation categories, articles, and files tables
-- Date: 2026-03-26

-- Create documentation_categories table
CREATE TABLE IF NOT EXISTS documentation_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    icon VARCHAR(100),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documentation_articles table
CREATE TABLE IF NOT EXISTS documentation_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES documentation_categories(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_id, slug)
);

-- Create documentation_files table
CREATE TABLE IF NOT EXISTS documentation_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES documentation_articles(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    stored_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for documentation_categories
CREATE INDEX IF NOT EXISTS idx_doc_categories_slug ON documentation_categories(slug);
CREATE INDEX IF NOT EXISTS idx_doc_categories_order ON documentation_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_doc_categories_active ON documentation_categories(is_active);

-- Add indexes for documentation_articles
CREATE INDEX IF NOT EXISTS idx_doc_articles_category ON documentation_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_doc_articles_slug ON documentation_articles(slug);
CREATE INDEX IF NOT EXISTS idx_doc_articles_order ON documentation_articles(display_order);
CREATE INDEX IF NOT EXISTS idx_doc_articles_active ON documentation_articles(is_active);

-- Add indexes for documentation_files
CREATE INDEX IF NOT EXISTS idx_doc_files_article ON documentation_files(article_id);

-- Add triggers for automatic updated_at timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_doc_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_doc_categories_updated_at
    BEFORE UPDATE ON documentation_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_doc_articles_updated_at'
  ) THEN
    CREATE TRIGGER update_doc_articles_updated_at
    BEFORE UPDATE ON documentation_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Seed initial documentation categories
INSERT INTO documentation_categories (name, description, slug, icon, display_order, is_active) VALUES
('Getting Started', 'Essential guides to help you get up and running quickly', 'getting-started', 'Rocket', 0, TRUE),
('Account Management', 'How to manage your account, profile, and security settings', 'account-management', 'User', 1, TRUE),
('Billing & Payments', 'Payment methods, invoices, and billing information', 'billing-payments', 'CreditCard', 2, TRUE),
('VPS Guide', 'Virtual Private Server documentation and tutorials', 'vps-guide', 'Server', 3, TRUE),
('API Reference', 'API documentation and integration guides', 'api-reference', 'Code', 4, TRUE)
ON CONFLICT (slug) DO NOTHING;
