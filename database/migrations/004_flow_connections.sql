-- Flow connections: cross-line equipment flow visualization
CREATE TABLE IF NOT EXISTS flow_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_equipment_id VARCHAR(50) NOT NULL,
    target_equipment_id VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#ff8800',
    line_style VARCHAR(20) DEFAULT 'solid',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(factory_id, source_equipment_id, target_equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_connections_factory
    ON flow_connections(factory_id);

ALTER TABLE flow_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for flow_connections" ON flow_connections
    FOR ALL USING (true) WITH CHECK (true);
