-- BhoomiSetu: Migration 0003 — Demo Seed Data
-- Provides enough data to power the end-to-end demo narrative:
--   Project alignment uploaded → parcels intersected → risk flagged → deadlines tracked → citizen lookup works

-- ============================================================
-- DEMO PROJECTS
-- ============================================================
INSERT INTO projects (id, name, land_requiring_body, ministry, state, district, project_type, current_stage, stage_started_at, status_flag, risk_score, alignment_geojson) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'NH-48 Expansion: Bangalore–Mangalore Highway Widening',
  'National Highways Authority of India (NHAI)',
  'Ministry of Road Transport & Highways',
  'Karnataka',
  'Dakshina Kannada',
  'highway',
  'section_11',
  '2025-03-15T00:00:00Z',
  'amber',
  42.50,
  '{"type":"LineString","coordinates":[[74.85,12.87],[74.88,12.89],[74.91,12.91],[74.94,12.93],[74.97,12.95]]}'
),
(
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Tungabhadra Irrigation Canal Extension',
  'Karnataka State Irrigation Department',
  'Ministry of Jal Shakti',
  'Karnataka',
  'Bellary',
  'irrigation',
  'award',
  '2024-11-01T00:00:00Z',
  'green',
  18.75,
  '{"type":"LineString","coordinates":[[76.30,15.35],[76.33,15.37],[76.36,15.39],[76.39,15.41]]}'
),
(
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'Mumbai–Nagpur Expressway (Samruddhi Mahamarg)',
  'Maharashtra State Road Development Corporation',
  'Ministry of Road Transport & Highways',
  'Maharashtra',
  'Nashik',
  'highway',
  'compensation',
  '2024-06-20T00:00:00Z',
  'red',
  78.25,
  '{"type":"LineString","coordinates":[[73.78,19.99],[73.85,20.05],[73.92,20.11],[73.99,20.17]]}'
);

-- ============================================================
-- DEMO PARCELS (with ULPINs)
-- ============================================================
INSERT INTO parcels (id, ulpin, project_id, survey_number, village, district, state, area_hectares, land_type, geometry_geojson, ownership_status, litigation_flag, risk_score) VALUES
-- Parcels for NH-48 project
(
  'd4e5f6a7-b8c9-0123-defa-234567890123',
  '29210301001001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'SY/123/A',
  'Bantwal',
  'Dakshina Kannada',
  'Karnataka',
  2.5000,
  'agricultural',
  '{"type":"Polygon","coordinates":[[[74.85,12.87],[74.86,12.87],[74.86,12.88],[74.85,12.88],[74.85,12.87]]]}',
  'clear',
  false,
  15.00
),
(
  'e5f6a7b8-c9d0-1234-efab-345678901234',
  '29210301001002',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'SY/124/B',
  'Bantwal',
  'Dakshina Kannada',
  'Karnataka',
  1.7500,
  'commercial',
  '{"type":"Polygon","coordinates":[[[74.87,12.88],[74.88,12.88],[74.88,12.89],[74.87,12.89],[74.87,12.88]]]}',
  'disputed',
  true,
  72.50
),
(
  'f6a7b8c9-d0e1-2345-fabc-456789012345',
  '29210301001003',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'SY/125/C',
  'Vitla',
  'Dakshina Kannada',
  'Karnataka',
  3.2000,
  'agricultural',
  '{"type":"Polygon","coordinates":[[[74.89,12.90],[74.91,12.90],[74.91,12.91],[74.89,12.91],[74.89,12.90]]]}',
  'clear',
  false,
  8.00
),
-- Parcels for Tungabhadra project
(
  'a7b8c9d0-e1f2-3456-abcd-567890123456',
  '29070102003001',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'SY/201/A',
  'Hospet',
  'Bellary',
  'Karnataka',
  4.0000,
  'agricultural',
  '{"type":"Polygon","coordinates":[[[76.30,15.35],[76.32,15.35],[76.32,15.36],[76.30,15.36],[76.30,15.35]]]}',
  'clear',
  false,
  5.00
),
(
  'b8c9d0e1-f2a3-4567-bcde-678901234567',
  '29070102003002',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'SY/202/B',
  'Hospet',
  'Bellary',
  'Karnataka',
  1.2000,
  'forest',
  '{"type":"Polygon","coordinates":[[[76.33,15.36],[76.35,15.36],[76.35,15.38],[76.33,15.38],[76.33,15.36]]]}',
  'under_verification',
  false,
  35.00
),
-- Parcels for Mumbai-Nagpur project
(
  'c9d0e1f2-a3b4-5678-cdef-789012345678',
  '27014503005001',
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'SY/501/A',
  'Sinnar',
  'Nashik',
  'Maharashtra',
  5.5000,
  'agricultural',
  '{"type":"Polygon","coordinates":[[[73.78,19.99],[73.82,19.99],[73.82,20.01],[73.78,20.01],[73.78,19.99]]]}',
  'disputed',
  true,
  85.00
),
(
  'd0e1f2a3-b4c5-6789-defa-890123456789',
  '27014503005002',
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'SY/502/B',
  'Sinnar',
  'Nashik',
  'Maharashtra',
  2.8000,
  'commercial',
  '{"type":"Polygon","coordinates":[[[73.84,20.04],[73.87,20.04],[73.87,20.06],[73.84,20.06],[73.84,20.04]]]}',
  'clear',
  false,
  22.00
),
(
  'e1f2a3b4-c5d6-7890-efab-901234567890',
  '27014503005003',
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'SY/503/C',
  'Igatpuri',
  'Nashik',
  'Maharashtra',
  1.5000,
  'forest',
  '{"type":"Polygon","coordinates":[[[73.90,20.09],[73.93,20.09],[73.93,20.12],[73.90,20.12],[73.90,20.09]]]}',
  'under_verification',
  false,
  45.00
);

-- ============================================================
-- DEMO OWNERS
-- ============================================================
INSERT INTO owners (parcel_id, name, contact, bank_ref, is_current) VALUES
('d4e5f6a7-b8c9-0123-defa-234567890123', 'Ramesh Shetty', '+91-XXXXX-X1234', '****5678', true),
('e5f6a7b8-c9d0-1234-efab-345678901234', 'Lakshmi Poojary', '+91-XXXXX-X2345', '****6789', true),
('e5f6a7b8-c9d0-1234-efab-345678901234', 'Suresh Gowda', '+91-XXXXX-X3456', '****7890', true), -- disputed: two owners
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'Manjunath Hegde', '+91-XXXXX-X4567', '****8901', true),
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'Basavaraju H.', '+91-XXXXX-X5678', '****9012', true),
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'Girish Naik', '+91-XXXXX-X6789', '****0123', true),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'Prashant Deshmukh', '+91-XXXXX-X7890', '****1234', true),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'Anjali Deshmukh', '+91-XXXXX-X8901', '****2345', true), -- disputed: two owners
('d0e1f2a3-b4c5-6789-defa-890123456789', 'Vijay Patil', '+91-XXXXX-X9012', '****3456', true),
('e1f2a3b4-c5d6-7890-efab-901234567890', 'Sunita Wagh', '+91-XXXXX-X0123', '****4567', true);

-- ============================================================
-- DEMO NOTIFICATIONS (Statutory deadlines)
-- ============================================================
INSERT INTO notifications (project_id, section, notified_on, deadline_on) VALUES
-- NH-48: Section 11 issued March 2025 → deadline March 2026 (past → should be amber/red)
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'section_11', '2025-03-15', '2026-03-15'),
-- Tungabhadra: Section 11 + Section 19 both done
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'section_11', '2024-01-10', '2025-01-10'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'section_19', '2024-08-01', '2025-08-01'),
-- Mumbai-Nagpur: Section 11 + 19 done, now in compensation stage
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'section_11', '2023-06-01', '2024-06-01'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'section_19', '2024-01-15', '2025-01-15');

-- ============================================================
-- DEMO AWARDS (for projects past the award stage)
-- ============================================================
INSERT INTO awards (project_id, parcel_id, award_date, market_value, solatium_pct, additional_amount_pct, total_compensation) VALUES
-- Tungabhadra awards
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a7b8c9d0-e1f2-3456-abcd-567890123456', '2024-12-01', 3200000.00, 100, 12, 6720000.00),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'b8c9d0e1-f2a3-4567-bcde-678901234567', '2024-12-15', 1800000.00, 100, 12, 3780000.00),
-- Mumbai-Nagpur awards
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'c9d0e1f2-a3b4-5678-cdef-789012345678', '2024-07-01', 8500000.00, 100, 12, 17850000.00),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'd0e1f2a3-b4c5-6789-defa-890123456789', '2024-07-15', 4200000.00, 100, 12, 8820000.00);

-- ============================================================
-- DEMO AFFECTED FAMILIES
-- ============================================================
INSERT INTO affected_families (parcel_id, family_ref, displaced, compensation_status, housing_status, employment_status, livelihood_restored) VALUES
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'FAM-NSK-001', true, 'disbursed', 'pending', 'pending', false),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'FAM-NSK-002', true, 'sanctioned', 'pending', 'pending', false),
('d0e1f2a3-b4c5-6789-defa-890123456789', 'FAM-NSK-003', false, 'assessed', 'pending', 'pending', false),
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'FAM-BLY-001', false, 'disbursed', 'completed', 'completed', true),
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'FAM-BLY-002', false, 'sanctioned', 'pending', 'pending', false);

-- ============================================================
-- DEMO MUTATIONS
-- ============================================================
INSERT INTO mutations (parcel_id, mutation_status, filed_on, completed_on) VALUES
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'completed', '2025-01-10', '2025-03-01'),
('b8c9d0e1-f2a3-4567-bcde-678901234567', 'filed', '2025-02-15', NULL),
('c9d0e1f2-a3b4-5678-cdef-789012345678', 'pending', NULL, NULL),
('d0e1f2a3-b4c5-6789-defa-890123456789', 'pending', NULL, NULL);
