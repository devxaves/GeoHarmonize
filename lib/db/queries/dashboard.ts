/**
 * BhoomiSetu — Executive Dashboard Query Module (Raw SQL, No ORM)
 *
 * Implements Section 5.7 of the specification:
 * - Hand-written SQL aggregations (GROUP BY state/district, status_flag, date_trunc)
 * - CRITICAL: Explicitly separates Possession Rate from Mutation Completion Rate
 *   to track the statutory gap where physical possession has been taken but revenue title
 *   mutation lags behind.
 */

import { query } from "../pool";

export interface ExecutiveDashboardData {
  kpis: {
    totalProjects: number;
    totalParcels: number;
    totalAreaHectares: number;
    totalCompensationAssessed: number;
    totalCompensationDisbursed: number;
    disbursementRatePct: number;
    possessionRatePct: number;
    mutationCompletionRatePct: number;
    mutationLagParcelsCount: number;
    averageRiskScore: number;
  };
  statusBreakdown: {
    status: string;
    count: number;
  }[];
  stageDistribution: {
    stage: string;
    label: string;
    count: number;
  }[];
  districtBreakdown: {
    state: string;
    district: string;
    projectsCount: number;
    parcelsCount: number;
    areaHectares: number;
    mutationsCompleted: number;
    mutationRatePct: number;
  }[];
  monthlyTrajectory: {
    month: string;
    projects: number;
    notifications: number;
    mutations: number;
  }[];
}

export async function getExecutiveDashboardStats(): Promise<ExecutiveDashboardData> {
  // 1. Overall KPIs
  const kpiSql = `
    SELECT
      COUNT(DISTINCT p.id)::int AS total_projects,
      COUNT(DISTINCT par.id)::int AS total_parcels,
      COALESCE(SUM(DISTINCT par.area_hectares), 0)::float AS total_area_ha,
      COALESCE(SUM(cp.amount_assessed), 0)::float AS comp_assessed,
      COALESCE(SUM(cp.amount_disbursed), 0)::float AS comp_disbursed,
      COUNT(DISTINCT par.id) FILTER (WHERE p.current_stage IN ('possession', 'rr', 'closed'))::int AS parcels_in_possession,
      COUNT(DISTINCT m.id) FILTER (WHERE m.mutation_status = 'completed')::int AS mutations_completed,
      COUNT(DISTINCT par.id) FILTER (
        WHERE p.current_stage IN ('possession', 'rr', 'closed')
          AND (m.mutation_status IS NULL OR m.mutation_status != 'completed')
      )::int AS mutation_lag_count,
      COALESCE(AVG(p.risk_score), 0)::float AS avg_risk
    FROM projects p
    LEFT JOIN parcels par ON par.project_id = p.id
    LEFT JOIN mutations m ON m.parcel_id = par.id
    LEFT JOIN awards a ON a.project_id = p.id
    LEFT JOIN compensation_payments cp ON cp.award_id = a.id
  `;

  // 2. Status flag breakdown (RAG)
  const statusSql = `
    SELECT
      status_flag AS status,
      COUNT(*)::int AS count
    FROM projects
    GROUP BY status_flag
    ORDER BY count DESC
  `;

  // 3. Stage distribution
  const stageSql = `
    SELECT
      current_stage AS stage,
      COUNT(*)::int AS count
    FROM projects
    GROUP BY current_stage
  `;

  // 4. District and State aggregations
  const districtSql = `
    SELECT
      p.state,
      p.district,
      COUNT(DISTINCT p.id)::int AS projects_count,
      COUNT(DISTINCT par.id)::int AS parcels_count,
      COALESCE(SUM(DISTINCT par.area_hectares), 0)::float AS area_hectares,
      COUNT(DISTINCT m.id) FILTER (WHERE m.mutation_status = 'completed')::int AS mutations_completed
    FROM projects p
    LEFT JOIN parcels par ON par.project_id = p.id
    LEFT JOIN mutations m ON m.parcel_id = par.id
    GROUP BY p.state, p.district
    ORDER BY projects_count DESC, parcels_count DESC
  `;

  // 5. Monthly trend trajectory
  const trajectorySql = `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW() - INTERVAL '5 months'),
        date_trunc('month', NOW()),
        '1 month'::interval
      ) AS m
    )
    SELECT
      to_char(months.m, 'Mon YYYY') AS month,
      COUNT(DISTINCT p.id)::int AS projects,
      COUNT(DISTINCT n.id)::int AS notifications,
      COUNT(DISTINCT m.id) FILTER (WHERE m.mutation_status = 'completed')::int AS mutations
    FROM months
    LEFT JOIN projects p ON date_trunc('month', p.created_at) = months.m
    LEFT JOIN notifications n ON date_trunc('month', n.created_at) = months.m
    LEFT JOIN mutations m ON date_trunc('month', m.completed_on) = months.m
    GROUP BY months.m
    ORDER BY months.m ASC
  `;

  const [kpiRes, statusRes, stageRes, districtRes, trajRes] = await Promise.all([
    query<any>(kpiSql),
    query<any>(statusSql),
    query<any>(stageSql),
    query<any>(districtSql),
    query<any>(trajectorySql),
  ]);

  const k = kpiRes.rows[0] || {};
  const totalParcels = Number(k.total_parcels || 0);
  const totalProjects = Number(k.total_projects || 0);
  const parcelsInPossession = Number(k.parcels_in_possession || 0);
  const mutationsCompleted = Number(k.mutations_completed || 0);
  const assessed = Number(k.comp_assessed || 0);
  const disbursed = Number(k.comp_disbursed || 0);

  const possessionRate = totalParcels > 0 ? Math.round((parcelsInPossession / totalParcels) * 1000) / 10 : 0;
  const mutationRate = totalParcels > 0 ? Math.round((mutationsCompleted / totalParcels) * 1000) / 10 : 0;
  const disbursementRate = assessed > 0 ? Math.round((disbursed / assessed) * 1000) / 10 : 0;

  const STAGE_ORDER_MAP: Record<string, string> = {
    proposal: "Proposal",
    sia: "SIA",
    section_11: "Sec 11",
    section_19: "Sec 19",
    award: "Award",
    compensation: "Compensation",
    mutation: "Mutation",
    possession: "Possession",
    rr: "R&R",
    closed: "Closed",
  };

  const stageCounts = Object.entries(STAGE_ORDER_MAP).map(([stage, label]) => {
    const match = stageRes.rows.find((r) => r.stage === stage);
    return {
      stage,
      label,
      count: match ? Number(match.count) : 0,
    };
  });

  return {
    kpis: {
      totalProjects,
      totalParcels,
      totalAreaHectares: Math.round(Number(k.total_area_ha || 0) * 100) / 100,
      totalCompensationAssessed: Math.round(assessed * 100) / 100,
      totalCompensationDisbursed: Math.round(disbursed * 100) / 100,
      disbursementRatePct: disbursementRate,
      possessionRatePct: possessionRate,
      mutationCompletionRatePct: mutationRate,
      mutationLagParcelsCount: Number(k.mutation_lag_count || 0),
      averageRiskScore: Math.round(Number(k.avg_risk || 0) * 10) / 10,
    },
    statusBreakdown: statusRes.rows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    stageDistribution: stageCounts,
    districtBreakdown: districtRes.rows.map((r) => {
      const parCount = Number(r.parcels_count || 0);
      const mutComp = Number(r.mutations_completed || 0);
      return {
        state: r.state,
        district: r.district,
        projectsCount: Number(r.projects_count || 0),
        parcelsCount: parCount,
        areaHectares: Math.round(Number(r.area_hectares || 0) * 100) / 100,
        mutationsCompleted: mutComp,
        mutationRatePct: parCount > 0 ? Math.round((mutComp / parCount) * 1000) / 10 : 0,
      };
    }),
    monthlyTrajectory: trajRes.rows.map((r) => ({
      month: r.month,
      projects: Number(r.projects || 0),
      notifications: Number(r.notifications || 0),
      mutations: Number(r.mutations || 0),
    })),
  };
}
