-- BhoomiSetu: Migration 0002 — Performance Indexes
-- Applied after the initial schema to optimize query patterns

-- Project-scoped parcel lookups
CREATE INDEX idx_parcels_project_id ON parcels(project_id);

-- ULPIN-based lookups (citizen portal, parcel search)
CREATE INDEX idx_parcels_ulpin ON parcels(ulpin);

-- Award lookups by parcel
CREATE INDEX idx_awards_parcel_id ON awards(parcel_id);

-- Award lookups by project
CREATE INDEX idx_awards_project_id ON awards(project_id);

-- Deadline scanning (statutory compliance cron)
CREATE INDEX idx_notifications_deadline_on ON notifications(deadline_on);

-- Notification lookups by project
CREATE INDEX idx_notifications_project_id ON notifications(project_id);

-- GIN index on parcel geometry for jsonb containment queries
CREATE INDEX idx_parcels_geometry_gin ON parcels USING GIN (geometry_geojson);

-- GIN index on project alignment for spatial queries
CREATE INDEX idx_projects_alignment_gin ON projects USING GIN (alignment_geojson);

-- Risk score entity lookups
CREATE INDEX idx_risk_scores_entity ON risk_scores(entity_type, entity_id);

-- Audit log lookups
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);

-- Grievance lookups
CREATE INDEX idx_grievances_parcel ON grievances(parcel_id);
CREATE INDEX idx_grievances_status ON grievances(status);

-- Compensation payment lookups
CREATE INDEX idx_compensation_award ON compensation_payments(award_id);

-- Mutation lookups
CREATE INDEX idx_mutations_parcel ON mutations(parcel_id);

-- Affected families lookups
CREATE INDEX idx_affected_families_parcel ON affected_families(parcel_id);

-- Owners by parcel
CREATE INDEX idx_owners_parcel ON owners(parcel_id);

-- Projects by district + state for dashboard aggregations
CREATE INDEX idx_projects_district ON projects(district);
CREATE INDEX idx_projects_state ON projects(state);
CREATE INDEX idx_projects_status_flag ON projects(status_flag);
