-- BhoomiSetu: Migration 0004 - Production Demo Seed
-- Covers all 14 tables with realistic inter-linked data spanning 5 projects,
-- 15 parcels, 3 states, full workflow stages, compensation payments, mutations,
-- risk scores, OCR documents, grievances, and audit trails.
-- Safe to run after 0003_seed.sql - uses ON CONFLICT DO NOTHING.

-- ============================================================
-- 1. USERS (system actors referenced in audit_log)
-- ============================================================
INSERT INTO users (id, clerk_id, email, role, jurisdiction) VALUES
  ('00000000-0000-0000-0000-000000000001', 'sys_collector_ka', 'collector.karnataka@bhoomisetu.gov.in', 'collector', 'Karnataka'),
  ('00000000-0000-0000-0000-000000000002', 'sys_admin_mh',     'admin.maharashtra@bhoomisetu.gov.in',  'state_admin', 'Maharashtra'),
  ('00000000-0000-0000-0000-000000000003', 'sys_ministry',     'ministry@bhoomisetu.gov.in',           'central_ministry', NULL),
  ('00000000-0000-0000-0000-000000000004', 'sys_lrb_raj',      'lrb.rajasthan@bhoomisetu.gov.in',      'lrb', 'Rajasthan')
ON CONFLICT (clerk_id) DO NOTHING;

-- ============================================================
-- 2. PROJECTS - 5 projects across all lifecycle stages
-- ============================================================
INSERT INTO projects (id, name, land_requiring_body, ministry, state, district, project_type, current_stage, stage_started_at, status_flag, risk_score, alignment_geojson) VALUES

-- PROJECT 1: Rajasthan Solar Park - early stage (SIA), GREEN
('10000000-0000-0000-0000-000000000001',
 'Jaisalmer Ultra Mega Solar Power Park',
 'Rajasthan Renewable Energy Corporation Ltd.',
 'Ministry of New and Renewable Energy',
 'Rajasthan', 'Jaisalmer', 'industrial',
 'sia', '2026-01-10T00:00:00Z', 'green', 12.50,
 '{"type":"Polygon","coordinates":[[[70.90,26.91],[71.20,26.91],[71.20,27.15],[70.90,27.15],[70.90,26.91]]]}'),

-- PROJECT 2: Delhi Metro Phase V - section_11 stage, AMBER
('10000000-0000-0000-0000-000000000002',
 'Delhi Metro Rail Phase V - Janakpuri West Extension',
 'Delhi Metro Rail Corporation (DMRC)',
 'Ministry of Housing and Urban Affairs',
 'Delhi', 'West Delhi', 'railway',
 'section_11', '2025-09-01T00:00:00Z', 'amber', 38.00,
 '{"type":"LineString","coordinates":[[77.07,28.63],[77.05,28.64],[77.03,28.65],[77.01,28.66]]}'),

-- PROJECT 3: Odisha Freight Corridor - section_19 stage, AMBER
('10000000-0000-0000-0000-000000000003',
 'East Coast Dedicated Freight Corridor - Paradeep Spur',
 'Dedicated Freight Corridor Corporation of India',
 'Ministry of Railways',
 'Odisha', 'Jagatsinghpur', 'railway',
 'section_19', '2025-04-20T00:00:00Z', 'amber', 55.75,
 '{"type":"LineString","coordinates":[[86.55,20.30],[86.58,20.32],[86.61,20.34],[86.64,20.36]]}'),

-- PROJECT 4: Pune Ring Road - possession stage, GREEN
('10000000-0000-0000-0000-000000000004',
 'Pune Metropolitan Ring Road - Southern Segment',
 'Maharashtra Road Development Corporation',
 'Ministry of Road Transport and Highways',
 'Maharashtra', 'Pune', 'highway',
 'possession', '2025-11-01T00:00:00Z', 'green', 22.00,
 '{"type":"LineString","coordinates":[[73.82,18.46],[73.88,18.43],[73.94,18.40],[74.00,18.37]]}'),

-- PROJECT 5: Rajasthan Canal - lapsed, RED
('10000000-0000-0000-0000-000000000005',
 'Indira Gandhi Nahar Extension - Barmer Branch',
 'Water Resources Department, Rajasthan',
 'Ministry of Jal Shakti',
 'Rajasthan', 'Barmer', 'irrigation',
 'section_11', '2024-02-15T00:00:00Z', 'lapsed', 91.00,
 '{"type":"LineString","coordinates":[[71.38,25.73],[71.42,25.76],[71.46,25.79],[71.50,25.82]]}')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. PARCELS - 15 parcels across 5 projects
-- ============================================================
INSERT INTO parcels (id, ulpin, project_id, survey_number, village, district, state, area_hectares, land_type, geometry_geojson, ownership_status, litigation_flag, risk_score) VALUES

-- Project 1: Jaisalmer Solar (3 parcels)
('20000000-0000-0000-0000-000000000001', '08JL0100100001', '10000000-0000-0000-0000-000000000001',
 'SY/45/A', 'Mokalsar', 'Jaisalmer', 'Rajasthan', 180.0000, 'barren',
 '{"type":"Polygon","coordinates":[[[70.91,26.92],[71.00,26.92],[71.00,27.00],[70.91,27.00],[70.91,26.92]]]}',
 'clear', false, 10.00),

('20000000-0000-0000-0000-000000000002', '08JL0100100002', '10000000-0000-0000-0000-000000000001',
 'SY/46/B', 'Mokalsar', 'Jaisalmer', 'Rajasthan', 220.5000, 'barren',
 '{"type":"Polygon","coordinates":[[[71.01,26.92],[71.10,26.92],[71.10,27.00],[71.01,27.00],[71.01,26.92]]]}',
 'under_verification', false, 18.00),

('20000000-0000-0000-0000-000000000003', '08JL0100100003', '10000000-0000-0000-0000-000000000001',
 'SY/47/C', 'Ramgarh', 'Jaisalmer', 'Rajasthan', 95.2500, 'agricultural',
 '{"type":"Polygon","coordinates":[[[71.11,26.92],[71.20,26.92],[71.20,27.00],[71.11,27.00],[71.11,26.92]]]}',
 'disputed', true, 42.00),

-- Project 2: Delhi Metro (3 parcels)
('20000000-0000-0000-0000-000000000004', '07DL0200200001', '10000000-0000-0000-0000-000000000002',
 'KH/12/2-A', 'Janakpuri', 'West Delhi', 'Delhi', 0.3500, 'commercial',
 '{"type":"Polygon","coordinates":[[[77.07,28.63],[77.075,28.63],[77.075,28.634],[77.07,28.634],[77.07,28.63]]]}',
 'clear', false, 20.00),

('20000000-0000-0000-0000-000000000005', '07DL0200200002', '10000000-0000-0000-0000-000000000002',
 'KH/12/2-B', 'Uttam Nagar', 'West Delhi', 'Delhi', 0.4800, 'commercial',
 '{"type":"Polygon","coordinates":[[[77.05,28.64],[77.055,28.64],[77.055,28.645],[77.05,28.645],[77.05,28.64]]]}',
 'disputed', true, 62.00),

('20000000-0000-0000-0000-000000000006', '07DL0200200003', '10000000-0000-0000-0000-000000000002',
 'KH/13/1-A', 'Dwarka Mor', 'West Delhi', 'Delhi', 0.2200, 'residential',
 '{"type":"Polygon","coordinates":[[[77.03,28.65],[77.035,28.65],[77.035,28.655],[77.03,28.655],[77.03,28.65]]]}',
 'clear', false, 15.00),

-- Project 3: Odisha Freight Corridor (3 parcels)
('20000000-0000-0000-0000-000000000007', '21JG0300300001', '10000000-0000-0000-0000-000000000003',
 'SY/102/A', 'Ersama', 'Jagatsinghpur', 'Odisha', 3.8000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[86.55,20.30],[86.57,20.30],[86.57,20.32],[86.55,20.32],[86.55,20.30]]]}',
 'clear', false, 30.00),

('20000000-0000-0000-0000-000000000008', '21JG0300300002', '10000000-0000-0000-0000-000000000003',
 'SY/103/B', 'Badakul', 'Jagatsinghpur', 'Odisha', 2.1000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[86.58,20.31],[86.60,20.31],[86.60,20.33],[86.58,20.33],[86.58,20.31]]]}',
 'disputed', true, 72.00),

('20000000-0000-0000-0000-000000000009', '21JG0300300003', '10000000-0000-0000-0000-000000000003',
 'SY/104/C', 'Tirtol', 'Jagatsinghpur', 'Odisha', 1.5500, 'forest',
 '{"type":"Polygon","coordinates":[[[86.61,20.33],[86.63,20.33],[86.63,20.35],[86.61,20.35],[86.61,20.33]]]}',
 'under_verification', false, 55.00),

-- Project 4: Pune Ring Road (3 parcels)
('20000000-0000-0000-0000-000000000010', '27PN0400400001', '10000000-0000-0000-0000-000000000004',
 'SY/800/A', 'Hadapsar', 'Pune', 'Maharashtra', 4.2000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[73.82,18.46],[73.84,18.46],[73.84,18.48],[73.82,18.48],[73.82,18.46]]]}',
 'clear', false, 10.00),

('20000000-0000-0000-0000-000000000011', '27PN0400400002', '10000000-0000-0000-0000-000000000004',
 'SY/801/B', 'Wanowrie', 'Pune', 'Maharashtra', 2.6000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[73.88,18.43],[73.90,18.43],[73.90,18.45],[73.88,18.45],[73.88,18.43]]]}',
 'clear', false, 8.00),

('20000000-0000-0000-0000-000000000012', '27PN0400400003', '10000000-0000-0000-0000-000000000004',
 'SY/802/C', 'Kondhwa', 'Pune', 'Maharashtra', 1.8000, 'commercial',
 '{"type":"Polygon","coordinates":[[[73.94,18.40],[73.96,18.40],[73.96,18.42],[73.94,18.42],[73.94,18.40]]]}',
 'clear', false, 6.00),

-- Project 5: Rajasthan Canal lapsed (3 parcels)
('20000000-0000-0000-0000-000000000013', '08BR0500500001', '10000000-0000-0000-0000-000000000005',
 'SY/200/A', 'Sindhari', 'Barmer', 'Rajasthan', 12.0000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[71.38,25.73],[71.42,25.73],[71.42,25.77],[71.38,25.77],[71.38,25.73]]]}',
 'disputed', true, 88.00),

('20000000-0000-0000-0000-000000000014', '08BR0500500002', '10000000-0000-0000-0000-000000000005',
 'SY/201/B', 'Gudamalani', 'Barmer', 'Rajasthan', 8.7500, 'agricultural',
 '{"type":"Polygon","coordinates":[[[71.43,25.76],[71.47,25.76],[71.47,25.80],[71.43,25.80],[71.43,25.76]]]}',
 'disputed', true, 92.00),

('20000000-0000-0000-0000-000000000015', '08BR0500500003', '10000000-0000-0000-0000-000000000005',
 'SY/202/C', 'Baytoo', 'Barmer', 'Rajasthan', 6.3000, 'agricultural',
 '{"type":"Polygon","coordinates":[[[71.46,25.79],[71.50,25.79],[71.50,25.83],[71.46,25.83],[71.46,25.79]]]}',
 'clear', false, 78.00)

ON CONFLICT (ulpin) DO NOTHING;

-- ============================================================
-- 4. OWNERS
-- ============================================================
INSERT INTO owners (parcel_id, name, contact, bank_ref, is_current) VALUES
-- Jaisalmer Solar
('20000000-0000-0000-0000-000000000001', 'Hemraj Bhati', '+91-94610-XXXXX', '****4321', true),
('20000000-0000-0000-0000-000000000002', 'Ratan Singh Tanwar', '+91-98290-XXXXX', '****5432', true),
('20000000-0000-0000-0000-000000000003', 'Govind Lal Meghwal', '+91-94141-XXXXX', '****6543', true),
('20000000-0000-0000-0000-000000000003', 'Mani Devi (legal heir)', '+91-99285-XXXXX', '****7654', true),
-- Delhi Metro
('20000000-0000-0000-0000-000000000004', 'Rajesh Arora', '+91-98118-XXXXX', '****3210', true),
('20000000-0000-0000-0000-000000000005', 'Santosh Kumar Sharma', '+91-99999-XXXXX', '****2109', true),
('20000000-0000-0000-0000-000000000005', 'Deepa Gupta (co-owner)', '+91-87654-XXXXX', '****1098', true),
('20000000-0000-0000-0000-000000000006', 'Arun Tiwari', '+91-98765-XXXXX', '****0987', true),
-- Odisha Freight
('20000000-0000-0000-0000-000000000007', 'Biswanath Jena', '+91-94370-XXXXX', '****8765', true),
('20000000-0000-0000-0000-000000000008', 'Subash Pradhan', '+91-96580-XXXXX', '****7654', true),
('20000000-0000-0000-0000-000000000008', 'Saraswati Pradhan (widow)', '+91-99380-XXXXX', '****6543', true),
('20000000-0000-0000-0000-000000000009', 'Tribhuban Nayak', '+91-78945-XXXXX', '****5432', true),
-- Pune Ring Road
('20000000-0000-0000-0000-000000000010', 'Prakash Bhosale', '+91-98906-XXXXX', '****4321', true),
('20000000-0000-0000-0000-000000000011', 'Sudha Mane', '+91-94230-XXXXX', '****3210', true),
('20000000-0000-0000-0000-000000000012', 'Ravi Shinde', '+91-91306-XXXXX', '****2109', true),
-- Rajasthan Canal lapsed
('20000000-0000-0000-0000-000000000013', 'Narayan Ram Vishnoi', '+91-96724-XXXXX', '****1234', true),
('20000000-0000-0000-0000-000000000013', 'Durga Devi Vishnoi (wife)', '+91-99820-XXXXX', '****2345', true),
('20000000-0000-0000-0000-000000000014', 'Bhura Ram Jat', '+91-94614-XXXXX', '****3456', true),
('20000000-0000-0000-0000-000000000015', 'Hanuman Singh Deol', '+91-98282-XXXXX', '****4567', true);

-- ============================================================
-- 5. NOTIFICATIONS (statutory deadlines)
-- ============================================================
INSERT INTO notifications (project_id, section, notified_on, deadline_on) VALUES
('10000000-0000-0000-0000-000000000002', 'section_11', '2025-09-01', '2026-09-01'),
('10000000-0000-0000-0000-000000000003', 'section_11', '2024-09-20', '2025-09-20'),
('10000000-0000-0000-0000-000000000003', 'section_19', '2025-04-20', '2026-04-20'),
('10000000-0000-0000-0000-000000000004', 'section_11', '2024-05-01', '2025-05-01'),
('10000000-0000-0000-0000-000000000004', 'section_19', '2024-11-01', '2025-11-01'),
('10000000-0000-0000-0000-000000000005', 'section_11', '2024-02-15', '2025-02-15');

-- ============================================================
-- 6. AWARDS
-- ============================================================
INSERT INTO awards (id, project_id, parcel_id, award_date, market_value, solatium_pct, additional_amount_pct, total_compensation) VALUES
('30000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000010',
 '2025-02-01', 6300000.00, 100, 12, 13230000.00),
('30000000-0000-0000-0000-000000000002',
 '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000011',
 '2025-02-15', 3900000.00, 100, 12, 8190000.00),
('30000000-0000-0000-0000-000000000003',
 '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000012',
 '2025-03-01', 5200000.00, 100, 12, 10920000.00),
('30000000-0000-0000-0000-000000000004',
 '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000007',
 '2025-07-10', 4750000.00, 100, 12, 9975000.00),
('30000000-0000-0000-0000-000000000005',
 '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000008',
 '2025-07-20', 2800000.00, 100, 12, 5880000.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. COMPENSATION PAYMENTS
-- ============================================================
INSERT INTO compensation_payments (id, award_id, amount_assessed, amount_disbursed, status, disbursed_on, mock_pfms_ref) VALUES
('40000000-0000-0000-0000-000000000001',
 '30000000-0000-0000-0000-000000000001', 13230000.00, 13230000.00,
 'disbursed', '2025-04-10', 'PFMS-MOCK-2025-0001'),
('40000000-0000-0000-0000-000000000002',
 '30000000-0000-0000-0000-000000000002', 8190000.00, 0,
 'sanctioned', NULL, 'PFMS-MOCK-2025-0002'),
('40000000-0000-0000-0000-000000000003',
 '30000000-0000-0000-0000-000000000003', 10920000.00, 0,
 'failed', NULL, 'PFMS-MOCK-2025-0003-FAIL'),
('40000000-0000-0000-0000-000000000004',
 '30000000-0000-0000-0000-000000000004', 9975000.00, 0,
 'assessed', NULL, NULL),
('40000000-0000-0000-0000-000000000005',
 '30000000-0000-0000-0000-000000000005', 5880000.00, 0,
 'assessed', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. MUTATIONS
-- ============================================================
INSERT INTO mutations (parcel_id, mutation_status, filed_on, completed_on) VALUES
('20000000-0000-0000-0000-000000000010', 'completed', '2025-05-01', '2025-07-15'),
('20000000-0000-0000-0000-000000000011', 'filed',     '2025-06-10', NULL),
('20000000-0000-0000-0000-000000000012', 'pending',    NULL, NULL),
('20000000-0000-0000-0000-000000000007', 'pending', NULL, NULL),
('20000000-0000-0000-0000-000000000008', 'pending', NULL, NULL),
('20000000-0000-0000-0000-000000000001', 'pending', NULL, NULL);

-- ============================================================
-- 9. AFFECTED FAMILIES
-- ============================================================
INSERT INTO affected_families (parcel_id, family_ref, displaced, compensation_status, housing_status, employment_status, livelihood_restored) VALUES
('20000000-0000-0000-0000-000000000007', 'FAM-JG-001', false, 'assessed',   'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000007', 'FAM-JG-002', false, 'assessed',   'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000008', 'FAM-JG-003', true,  'disbursed',  'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000008', 'FAM-JG-004', true,  'sanctioned', 'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000009', 'FAM-JG-005', true,  'assessed',   'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000004', 'FAM-DL-001', true,  'sanctioned', 'completed', 'completed', true),
('20000000-0000-0000-0000-000000000005', 'FAM-DL-002', true,  'assessed',   'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000005', 'FAM-DL-003', true,  'assessed',   'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000006', 'FAM-DL-004', false, 'disbursed',  'completed', 'completed', true),
('20000000-0000-0000-0000-000000000013', 'FAM-BR-001', false, 'pending',    'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000013', 'FAM-BR-002', false, 'pending',    'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000014', 'FAM-BR-003', false, 'pending',    'pending',   'pending',   false),
('20000000-0000-0000-0000-000000000010', 'FAM-PN-001', false, 'disbursed',  'completed', 'completed', true),
('20000000-0000-0000-0000-000000000011', 'FAM-PN-002', false, 'sanctioned', 'pending',   'completed', false);

-- ============================================================
-- 10. DOCUMENTS with OCR/NER and discrepancy flags
-- ============================================================
INSERT INTO documents (id, project_id, filename, doc_type, raw_ocr_text, ner_entities, discrepancy_flags) VALUES
('50000000-0000-0000-0000-000000000001',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'NH48_Section11_Notification_2025.pdf',
 'notification',
 'Government of Karnataka Section 11 Notification under RFCTLARR Act 2013. ULPIN: 29210301001001. Survey No. SY/123/A, Village: Bantwal. Area: 3.2 hectares. Award Amount: Rs 5200000. Date: 15-Mar-2025.',
 '{"ulpin":"29210301001001","survey_number":"SY/123/A","section_ref":"section_11","notified_on":"2025-03-15","area_hectares":3.2,"amount":5200000,"district":"Dakshina Kannada","village":"Bantwal"}',
 '[{"field":"area_hectares","extracted":3.2,"db_value":2.5,"delta":0.7,"severity":"high","message":"Extracted area (3.2 ha) exceeds parcel record (2.5 ha) by 28%. Possible mis-inclusion of adjacent plot."}]'),
('50000000-0000-0000-0000-000000000002',
 '10000000-0000-0000-0000-000000000002',
 'DMRC_PhaseV_Award_KH12_2025.pdf',
 'award',
 'Award under Section 23 RFCTLARR ULPIN 07DL0200200001. Survey No. KH/12/2-A, Janakpuri, West Delhi. Market Value: Rs 6300000. Solatium: 100%. Total Award: Rs 13230000. Dated 28-Feb-2025.',
 '{"ulpin":"07DL0200200001","survey_number":"KH/12/2-A","section_ref":"award","award_date":"2025-02-28","market_value":6300000,"total_compensation":13230000,"district":"West Delhi","village":"Janakpuri"}',
 '[]'),
('50000000-0000-0000-0000-000000000003',
 '10000000-0000-0000-0000-000000000003',
 'Paradeep_Spur_SIA_Report_2024.pdf',
 'sia_report',
 'Social Impact Assessment East Coast Dedicated Freight Corridor Paradeep Spur. District: Jagatsinghpur, Odisha. Estimated affected families: 14. Displaced households: 5. Date: 20-Sep-2024.',
 '{"district":"Jagatsinghpur","section_ref":"sia","notified_on":"2024-09-20","affected_families":14,"displaced_households":5}',
 '[{"field":"affected_families","extracted":14,"db_value":5,"delta":9,"severity":"medium","message":"SIA report estimates 14 affected families; only 5 recorded in R&R database. Update required."}]'),
('50000000-0000-0000-0000-000000000004',
 '10000000-0000-0000-0000-000000000005',
 'IGN_Barmer_Section11_2024.pdf',
 'notification',
 'Section 11 Notification Indira Gandhi Nahar Extension Barmer Branch. ULPINs: 08BR0500500001 08BR0500500002 08BR0500500003. Date: 15-Feb-2024. Deadline: 15-Feb-2025.',
 '{"ulpin":"08BR0500500001","section_ref":"section_11","notified_on":"2024-02-15","deadline_on":"2025-02-15","district":"Barmer","village":"Sindhari"}',
 '[{"field":"deadline_status","extracted":"2025-02-15","db_value":"lapsed","delta":null,"severity":"critical","message":"Statutory 12-month Section 11 deadline crossed on 15-Feb-2025. No Section 19 filed. Project is LAPSED."}]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. RISK SCORES
-- ============================================================
INSERT INTO risk_scores (entity_type, entity_id, score, reasons) VALUES
('project', '10000000-0000-0000-0000-000000000005', 91.00,
 '[{"factor":"lapsed_deadline","weight":35,"score":35,"explanation":"Section 11 statutory deadline expired on 2025-02-15. Project is legally lapsed."},{"factor":"litigation","weight":20,"score":20,"explanation":"2 of 3 parcels have active litigation flags."},{"factor":"disputed_ownership","weight":20,"score":18,"explanation":"2 of 3 parcels have disputed ownership."},{"factor":"discrepancy","weight":15,"score":15,"explanation":"Critical area/deadline discrepancy in OCR document."},{"factor":"rr_completeness","weight":10,"score":3,"explanation":"0 of 3 families have R&R restored."}]'),
('project', '10000000-0000-0000-0000-000000000002', 38.00,
 '[{"factor":"stage_dwell","weight":35,"score":18,"explanation":"Delhi Metro at section_11 for 8 months; statutory window 65% elapsed."},{"factor":"disputed_ownership","weight":20,"score":12,"explanation":"KH/12/2-B has co-owner dispute."},{"factor":"litigation","weight":20,"score":8,"explanation":"1 parcel under active litigation."}]'),
('project', '10000000-0000-0000-0000-000000000003', 55.75,
 '[{"factor":"stage_dwell","weight":35,"score":22,"explanation":"Section 19 stage for 5 months; 45% through statutory window."},{"factor":"discrepancy","weight":15,"score":12,"explanation":"SIA family count mismatch (14 vs 5)."},{"factor":"disputed_ownership","weight":20,"score":14,"explanation":"Parcel 21JG0300300002 is disputed with widow succession claim."},{"factor":"rr_completeness","weight":10,"score":7.75,"explanation":"5 families, 0 restored. 0% restoration rate."}]'),
('parcel', '20000000-0000-0000-0000-000000000014', 92.00,
 '[{"factor":"litigation","weight":40,"score":40,"explanation":"Active litigation flag on SY/201/B."},{"factor":"disputed_ownership","weight":30,"score":30,"explanation":"Multiple ownership claimants."},{"factor":"lapsed_project","weight":20,"score":20,"explanation":"Parent project (Barmer Canal) is lapsed."},{"factor":"discrepancy","weight":10,"score":2,"explanation":"No document discrepancy for this parcel."}]'),
('parcel', '20000000-0000-0000-0000-000000000008', 72.00,
 '[{"factor":"disputed_ownership","weight":40,"score":35,"explanation":"Widow succession dispute on SY/103/B unresolved."},{"factor":"litigation","weight":30,"score":30,"explanation":"Active court case on possession."},{"factor":"stage_dwell","weight":20,"score":7,"explanation":"Section 19 stage for 5 months."}]');

-- ============================================================
-- 12. GRIEVANCES
-- ============================================================
INSERT INTO grievances (parcel_id, submitted_by, message, status) VALUES
('20000000-0000-0000-0000-000000000005',
 '07DL0200200002',
 'I have not received any notice about my property KH/12/2-B in Uttam Nagar. I was told compensation was awarded but nothing has been communicated to me. Please expedite.',
 'in_review'),
('20000000-0000-0000-0000-000000000013',
 '08BR0500500001',
 'Our village has been waiting for over a year since the Section 11 notification for the Barmer canal project. The deadline has passed but we have received no compensation or any update. This is causing extreme hardship.',
 'open'),
('20000000-0000-0000-0000-000000000008',
 '21JG0300300002',
 'My widowed mother Saraswati Pradhan is the rightful inheritor of SY/103/B. The mutation has not been updated. The compensation award is in the wrong name. Please correct records before disbursement.',
 'open'),
('20000000-0000-0000-0000-000000000010',
 '27PN0400400001',
 'Compensation was disbursed but the amount is short by approximately Rs 240000 compared to the award letter I received. Requesting reconciliation.',
 'resolved');

-- ============================================================
-- 13. AUDIT LOG
-- ============================================================
INSERT INTO audit_log (actor_id, entity_type, entity_id, action, before_state, after_state) VALUES
('00000000-0000-0000-0000-000000000001',
 'project', '10000000-0000-0000-0000-000000000002',
 'stage_advance',
 '{"stage":"proposal","status_flag":"green"}',
 '{"stage":"sia","status_flag":"green","advanced_by":"collector.karnataka@bhoomisetu.gov.in","advanced_at":"2025-07-01T10:00:00Z"}'),
('00000000-0000-0000-0000-000000000001',
 'project', '10000000-0000-0000-0000-000000000002',
 'stage_advance',
 '{"stage":"sia","status_flag":"green"}',
 '{"stage":"section_11","status_flag":"amber","advanced_by":"collector.karnataka@bhoomisetu.gov.in","advanced_at":"2025-09-01T09:00:00Z"}'),
(NULL,
 'project', '10000000-0000-0000-0000-000000000003',
 'deadline_escalation',
 '{"status_flag":"green","days_elapsed":215}',
 '{"status_flag":"amber","days_elapsed":215,"triggered_by":"CRON_SCANNER","reason":"Section 19 deadline 55% elapsed with no award filed"}'),
('00000000-0000-0000-0000-000000000002',
 'project', '10000000-0000-0000-0000-000000000004',
 'compensation_disbursed',
 '{"payment_status":"sanctioned","amount_disbursed":0}',
 '{"payment_status":"disbursed","amount_disbursed":13230000,"mock_pfms_ref":"PFMS-MOCK-2025-0001","disbursed_at":"2025-04-10T14:30:00Z"}'),
(NULL,
 'project', '10000000-0000-0000-0000-000000000005',
 'lapse_detected',
 '{"status_flag":"red","current_stage":"section_11"}',
 '{"status_flag":"lapsed","current_stage":"section_11","triggered_by":"CRON_SCANNER","reason":"Section 11 deadline 2025-02-15 crossed. No Section 19 filed. Project marked LAPSED.","lapsed_at":"2025-02-16T00:01:00Z"}'),
('00000000-0000-0000-0000-000000000003',
 'project', '10000000-0000-0000-0000-000000000005',
 'risk_recomputed',
 '{"score":72.00}',
 '{"score":91.00,"reasons_count":5,"triggered_by":"ministry@bhoomisetu.gov.in","recomputed_at":"2025-03-01T08:00:00Z"}');

-- ============================================================
-- 14. MOCK ADAPTER LOG
-- ============================================================
INSERT INTO mock_adapter_log (source, request, response) VALUES
('mock-PFMS',
 '{"action":"disburse","award_id":"30000000-0000-0000-0000-000000000001","amount":13230000,"beneficiary":"Prakash Bhosale","bank_ref":"****4321"}',
 '{"status":"success","pfms_ref":"PFMS-MOCK-2025-0001","timestamp":"2025-04-10T14:30:00Z","message":"Payment processed via PFMS sandbox"}'),
('mock-PFMS',
 '{"action":"disburse","award_id":"30000000-0000-0000-0000-000000000003","amount":10920000,"beneficiary":"Ravi Shinde","bank_ref":"****2109"}',
 '{"status":"failed","pfms_ref":"PFMS-MOCK-2025-0003-FAIL","error":"ACCOUNT_VERIFICATION_FAILED","message":"Bank account could not be verified. Please resubmit with corrected IFSC/account details."}'),
('mock-DILRMP',
 '{"action":"lookup","ulpin":"27PN0400400001","district":"Pune","state":"Maharashtra"}',
 '{"status":"found","ulpin":"27PN0400400001","survey_number":"SY/800/A","area_hectares":4.2,"land_type":"agricultural","owner":"Prakash Bhosale","mutation_status":"completed"}'),
('mock-BhoomiRashi',
 '{"action":"market_value_query","village":"Hadapsar","district":"Pune","land_type":"agricultural","area_hectares":4.2}',
 '{"status":"success","market_value_per_hectare":1500000,"total_market_value":6300000,"reference_year":2024,"source":"DLC_RATES_PUNE_2024"}'),
('mock-LACRRIS',
 '{"action":"litigation_check","ulpin":"21JG0300300002","state":"Odisha"}',
 '{"status":"active_case","court":"District Court Jagatsinghpur","case_number":"RC-2024-1842","filed_on":"2024-11-05","nature":"Title Dispute - Succession Claim","plaintiff":"Saraswati Pradhan"}');
