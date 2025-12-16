-- CRM Schema for Alive Customer Lab
-- Migrated from InstantDB to self-hosted Supabase

-- Create schema
CREATE SCHEMA IF NOT EXISTS crm;

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA crm TO anon, authenticated, service_role;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE crm.customer_type AS ENUM ('freelancer', 'studio', 'local business', 'startup');
CREATE TYPE crm.customer_status AS ENUM ('lead', 'active', 'past', 'lost');
CREATE TYPE crm.session_type AS ENUM ('discovery call', 'live build session', 'usability test', 'email thread', 'follow-up call');
CREATE TYPE crm.insight_kind AS ENUM ('Insight', 'Pain', 'Wish', 'Assumption', 'Success', 'Observation');
CREATE TYPE crm.insight_topic AS ENUM ('Onboarding', 'Editor', 'Pricing', 'Positioning', 'Branding', 'Other');
CREATE TYPE crm.insight_confidence AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE crm.insight_status AS ENUM ('draft', 'reviewed', 'validated', 'deprecated');
CREATE TYPE crm.experiment_type AS ENUM ('Experiment', 'Design change', 'Decision');
CREATE TYPE crm.experiment_status AS ENUM ('Idea', 'Planned', 'Running', 'Live', 'Scrapped');
CREATE TYPE crm.experiment_area AS ENUM ('Onboarding', 'Editor', 'Dashboard', 'Brand', 'Pricing', 'Other');
CREATE TYPE crm.signal_kind AS ENUM ('request', 'objection', 'constraint', 'urgency', 'bug');
CREATE TYPE crm.signal_status AS ENUM ('new', 'triaged', 'assigned', 'absorbed', 'closed');
CREATE TYPE crm.signal_area AS ENUM ('onboarding', 'editor', 'dashboard', 'brand', 'pricing', 'automations', 'other');
CREATE TYPE crm.signal_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE crm.signal_stage AS ENUM ('lead', 'onboarding', 'active', 'renewal', 'past', 'lost');
CREATE TYPE crm.signal_outcome AS ENUM ('none', 'backlog', 'experiment', 'playbook', 'not_fit', 'defer');
CREATE TYPE crm.backlog_item_type AS ENUM ('feature', 'bug', 'polish', 'tech_debt', 'ops');
CREATE TYPE crm.backlog_item_status AS ENUM ('inbox', 'next', 'in_progress', 'blocked', 'done');
CREATE TYPE crm.priority AS ENUM ('p0', 'p1', 'p2', 'p3');
CREATE TYPE crm.issue_status AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'canceled', 'blocked');
CREATE TYPE crm.blueprint_segment AS ENUM ('b2b_startup', 'local_service', 'studio_freelancer', 'portfolio', 'other');
CREATE TYPE crm.blueprint_status AS ENUM ('draft', 'active', 'deprecated');
CREATE TYPE crm.blueprint_tool AS ENUM ('google_calendar', 'hubspot', 'notion', 'gmail', 'zapier', 'other');
CREATE TYPE crm.blueprint_link_type AS ENUM ('required', 'enhancement');
CREATE TYPE crm.user_flow_actor AS ENUM ('visitor', 'business_owner', 'system');
CREATE TYPE crm.positioning_block_kind AS ENUM ('bullets', 'one_liner', 'two_column', 'timeline', 'risk_table', 'paragraph');

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Customers
CREATE TABLE crm.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company TEXT NOT NULL,
    contact TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    type crm.customer_type NOT NULL,
    status crm.customer_status NOT NULL DEFAULT 'lead',
    site_url TEXT,
    customer_goal TEXT,
    next_steps TEXT,
    next_step TEXT,
    next_step_due TIMESTAMPTZ,
    owner TEXT,
    last_touch_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions (customer interactions)
CREATE TABLE crm.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    type crm.session_type NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insights (learnings from sessions)
CREATE TABLE crm.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
    session_id UUID REFERENCES crm.sessions(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    kind crm.insight_kind NOT NULL,
    topic crm.insight_topic NOT NULL,
    confidence crm.insight_confidence NOT NULL DEFAULT 'Medium',
    cluster TEXT,
    job_situation TEXT,
    job_motivation TEXT,
    job_outcome TEXT,
    insight_status crm.insight_status DEFAULT 'draft',
    source_signal_id UUID, -- FK added after signals table
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Experiments
CREATE TABLE crm.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type crm.experiment_type NOT NULL,
    status crm.experiment_status NOT NULL DEFAULT 'Idea',
    area crm.experiment_area NOT NULL,
    problem TEXT,
    hypothesis TEXT,
    change_description TEXT,
    metric TEXT,
    baseline TEXT,
    target TEXT,
    result TEXT,
    decision TEXT,
    insight_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer Attributes (key-value store)
CREATE TABLE crm.customer_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_id, attribute_name)
);

-- Signals (customer feedback/requests)
CREATE TABLE crm.signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
    kind crm.signal_kind NOT NULL,
    title TEXT NOT NULL,
    status crm.signal_status NOT NULL DEFAULT 'new',
    area crm.signal_area NOT NULL,
    severity crm.signal_severity NOT NULL DEFAULT 'medium',
    session_id UUID REFERENCES crm.sessions(id) ON DELETE SET NULL,
    verbatim TEXT,
    context TEXT,
    stage crm.signal_stage,
    urgency_date TIMESTAMPTZ,
    owner TEXT,
    outcome crm.signal_outcome,
    review_at TIMESTAMPTZ,
    linked_insight_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from insights to signals
ALTER TABLE crm.insights
    ADD CONSTRAINT fk_insights_source_signal
    FOREIGN KEY (source_signal_id) REFERENCES crm.signals(id) ON DELETE SET NULL;

-- Backlog Items
CREATE TABLE crm.backlog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type crm.backlog_item_type NOT NULL,
    status crm.backlog_item_status NOT NULL DEFAULT 'inbox',
    priority crm.priority NOT NULL DEFAULT 'p2',
    area crm.signal_area NOT NULL,
    owner TEXT,
    customer_id UUID REFERENCES crm.customers(id) ON DELETE SET NULL,
    signal_id UUID REFERENCES crm.signals(id) ON DELETE SET NULL,
    insight_id UUID REFERENCES crm.insights(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES crm.experiments(id) ON DELETE SET NULL,
    acceptance_criteria TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Issues (like Jira tickets)
CREATE TABLE crm.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE, -- "ALI-1", "ALI-2", etc.
    title TEXT NOT NULL,
    description TEXT,
    status crm.issue_status NOT NULL DEFAULT 'backlog',
    priority crm.priority NOT NULL DEFAULT 'p2',
    rank INTEGER NOT NULL DEFAULT 0,
    assignee TEXT,
    labels TEXT[] DEFAULT '{}',
    customer_id UUID REFERENCES crm.customers(id) ON DELETE SET NULL,
    signal_id UUID REFERENCES crm.signals(id) ON DELETE SET NULL,
    insight_id UUID REFERENCES crm.insights(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES crm.experiments(id) ON DELETE SET NULL,
    solution TEXT,
    based_on_signals TEXT,
    what_we_wont_do TEXT,
    how_we_know_it_works TEXT,
    ready_for_dev BOOLEAN DEFAULT FALSE,
    needs_po BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Docs (documentation pages)
CREATE TABLE crm.docs (
    id TEXT PRIMARY KEY, -- fixed ids: "positioning", "values", etc.
    title TEXT NOT NULL,
    content TEXT, -- Markdown
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- =============================================================================
-- BLUEPRINT TABLES
-- =============================================================================

-- Blueprints (templates)
CREATE TABLE crm.blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    segment crm.blueprint_segment NOT NULL,
    one_liner TEXT,
    use_case TEXT,
    status crm.blueprint_status NOT NULL DEFAULT 'draft',
    included_sections TEXT[] DEFAULT '{}',
    customization_variables TEXT[] DEFAULT '{}',
    proof_summary TEXT,
    outcomes JSONB DEFAULT '[]', -- [{metric, value, notes}]
    thumbnail_url TEXT,
    demo_url TEXT,
    internal_notes TEXT,
    owner TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blueprint Workflows
CREATE TABLE crm.blueprint_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    inputs TEXT[] DEFAULT '{}',
    outputs TEXT[] DEFAULT '{}',
    steps TEXT[] DEFAULT '{}',
    default_settings JSONB DEFAULT '{}',
    status crm.blueprint_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blueprint Integrations
CREATE TABLE crm.blueprint_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    tool crm.blueprint_tool NOT NULL,
    purpose TEXT,
    data_in TEXT[] DEFAULT '{}',
    data_out TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blueprint-Customer links
CREATE TABLE crm.blueprint_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blueprint_id, customer_id)
);

-- Blueprint-Issue links
CREATE TABLE crm.blueprint_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES crm.issues(id) ON DELETE CASCADE,
    type crm.blueprint_link_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blueprint_id, issue_id)
);

-- Blueprint-Insight links
CREATE TABLE crm.blueprint_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    insight_id UUID NOT NULL REFERENCES crm.insights(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blueprint_id, insight_id)
);

-- Blueprint-Signal links
CREATE TABLE crm.blueprint_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    signal_id UUID NOT NULL REFERENCES crm.signals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blueprint_id, signal_id)
);

-- Positioning Blocks
CREATE TABLE crm.positioning_blocks (
    id TEXT PRIMARY KEY, -- fixed ids: current_focus, one_liner, icp, etc.
    title TEXT NOT NULL,
    kind crm.positioning_block_kind NOT NULL,
    data JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- Blueprint User Flows
CREATE TABLE crm.blueprint_user_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES crm.blueprints(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    primary_actor crm.user_flow_actor NOT NULL DEFAULT 'visitor',
    secondary_actors TEXT[] DEFAULT '{}',
    trigger TEXT,
    preconditions TEXT[] DEFAULT '{}',
    happy_path JSONB DEFAULT '[]', -- [{step, text}]
    decisions JSONB DEFAULT '[]', -- [{id, condition, ifTrue, ifFalse}]
    states JSONB DEFAULT '[]', -- [{state, meaning, enterWhen, exitWhen, ui, sideEffects}]
    data_effects TEXT[] DEFAULT '{}',
    notifications TEXT[] DEFAULT '{}',
    edge_cases JSONB DEFAULT '[]', -- [{case, expected}]
    success_metrics TEXT[] DEFAULT '{}',
    telemetry TEXT[] DEFAULT '{}',
    out_of_scope TEXT[] DEFAULT '{}',
    owner TEXT,
    status crm.blueprint_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_customers_status ON crm.customers(status);
CREATE INDEX idx_customers_type ON crm.customers(type);
CREATE INDEX idx_customers_owner ON crm.customers(owner);

CREATE INDEX idx_sessions_customer_id ON crm.sessions(customer_id);
CREATE INDEX idx_sessions_date ON crm.sessions(date DESC);

CREATE INDEX idx_insights_customer_id ON crm.insights(customer_id);
CREATE INDEX idx_insights_session_id ON crm.insights(session_id);
CREATE INDEX idx_insights_kind ON crm.insights(kind);
CREATE INDEX idx_insights_topic ON crm.insights(topic);

CREATE INDEX idx_signals_customer_id ON crm.signals(customer_id);
CREATE INDEX idx_signals_status ON crm.signals(status);
CREATE INDEX idx_signals_kind ON crm.signals(kind);

CREATE INDEX idx_backlog_items_status ON crm.backlog_items(status);
CREATE INDEX idx_backlog_items_priority ON crm.backlog_items(priority);

CREATE INDEX idx_issues_status ON crm.issues(status);
CREATE INDEX idx_issues_priority ON crm.issues(priority);
CREATE INDEX idx_issues_assignee ON crm.issues(assignee);

CREATE INDEX idx_blueprints_status ON crm.blueprints(status);
CREATE INDEX idx_blueprints_segment ON crm.blueprints(segment);

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION crm.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON crm.customers
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER experiments_updated_at BEFORE UPDATE ON crm.experiments
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER signals_updated_at BEFORE UPDATE ON crm.signals
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER backlog_items_updated_at BEFORE UPDATE ON crm.backlog_items
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER issues_updated_at BEFORE UPDATE ON crm.issues
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER blueprints_updated_at BEFORE UPDATE ON crm.blueprints
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER blueprint_workflows_updated_at BEFORE UPDATE ON crm.blueprint_workflows
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

CREATE TRIGGER blueprint_user_flows_updated_at BEFORE UPDATE ON crm.blueprint_user_flows
    FOR EACH ROW EXECUTE FUNCTION crm.update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE crm.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.customer_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.positioning_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.blueprint_user_flows ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (simple policy for internal tool)
-- In production, you may want more restrictive policies

CREATE POLICY "Allow all for authenticated" ON crm.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.insights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.experiments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.customer_attributes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.signals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.backlog_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.docs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_integrations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_signals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.positioning_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON crm.blueprint_user_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow service_role (for migrations and admin)
CREATE POLICY "Allow all for service_role" ON crm.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.experiments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.customer_attributes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.backlog_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.issues FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.docs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprints FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_issues FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.positioning_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON crm.blueprint_user_flows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA crm TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA crm TO authenticated, service_role;

-- =============================================================================
-- ISSUE KEY SEQUENCE
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS crm.issue_key_seq START 1;

CREATE OR REPLACE FUNCTION crm.generate_issue_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.key IS NULL OR NEW.key = '' THEN
        NEW.key := 'ALI-' || nextval('crm.issue_key_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_generate_key BEFORE INSERT ON crm.issues
    FOR EACH ROW EXECUTE FUNCTION crm.generate_issue_key();
