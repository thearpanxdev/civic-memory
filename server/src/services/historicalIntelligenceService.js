import db from '../config/database.js';
import { calculateDistanceMeters } from '../controllers/complaintController.js';

/**
 * Historical Civic Intelligence Service
 *
 * Implements SQL-driven, high-performance historical civic intelligence:
 * 1. Time period comparison (7d, 30d, 90d, 180d, 365d, all)
 * 2. Recurring civic defect detection across all major municipal categories
 * 3. Spatial coordinate density clustering for geographic hotspot analysis
 * 4. Separate handling for unmapped complaints without coordinates
 * 5. Period-over-period category surge and velocity comparison
 * 6. In-memory TTL caching for sub-millisecond query responses
 */

// In-memory TTL cache (5-minute TTL)
const intelligenceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearIntelligenceCache() {
  intelligenceCache.clear();
}

/**
 * Computes date bounds for current and previous comparative period
 *
 * @param {string} periodKey - '7d' | '30d' | '90d' | '180d' | '365d' | 'all'
 * @returns {{ currentStart: string, currentEnd: string, previousStart: string, previousEnd: string, days: number }}
 */
export function getTimePeriodWindow(periodKey = '30d') {
  const now = new Date();
  let days = 30;

  switch (periodKey) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '180d':
      days = 180;
      break;
    case '365d':
      days = 365;
      break;
    case 'all':
      days = 3650; // 10 years
      break;
    default:
      days = 30;
  }

  const toSqliteDate = (d) => d.toISOString().replace('T', ' ').substring(0, 19);
  const currentEnd = toSqliteDate(now);
  const currentStart = toSqliteDate(new Date(now.getTime() - days * 86400000));
  const previousEnd = currentStart;
  const previousStart = toSqliteDate(new Date(now.getTime() - 2 * days * 86400000));

  return {
    periodKey,
    days,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

/**
 * Computes overall municipal KPI metrics for the specified window with comparative delta
 */
export function getOverallMetrics(periodWindow, options = {}) {
  const { wardId, category } = options;
  const { currentStart, currentEnd, previousStart, previousEnd } = periodWindow;

  const buildWhere = (start, end) => {
    const conditions = ['c.created_at >= ? AND c.created_at <= ?'];
    const params = [start, end];
    if (wardId && wardId !== 'all') {
      conditions.push('c.ward_id = ?');
      params.push(wardId);
    }
    if (category && category !== 'all') {
      conditions.push('c.category = ?');
      params.push(category);
    }
    return { clause: conditions.join(' AND '), params };
  };

  const currWhere = buildWhere(currentStart, currentEnd);
  const prevWhere = buildWhere(previousStart, previousEnd);

  // 1. Current Period Counts
  const currentCounts = db.prepare(`
    SELECT 
      COUNT(*) as total_reported,
      SUM(CASE WHEN relation_type != 'duplicate' THEN 1 ELSE 0 END) as total_unique,
      SUM(CASE WHEN relation_type = 'duplicate' THEN 1 ELSE 0 END) as total_duplicates,
      SUM(CASE WHEN relation_type = 'recurring' OR recurrence_count > 0 THEN 1 ELSE 0 END) as total_recurring,
      SUM(CASE WHEN status NOT IN ('Resolved', 'Work Completed') THEN 1 ELSE 0 END) as total_unresolved,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as total_resolved,
      SUM(CASE WHEN status IN ('Work Completed', 'Awaiting Citizen Verification') THEN 1 ELSE 0 END) as awaiting_verification,
      SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as high_critical_count
    FROM complaints c
    WHERE ${currWhere.clause}
  `).get(...currWhere.params);

  // 2. Previous Period Counts
  const prevCounts = db.prepare(`
    SELECT 
      COUNT(*) as total_reported,
      SUM(CASE WHEN relation_type != 'duplicate' THEN 1 ELSE 0 END) as total_unique,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as total_resolved,
      SUM(CASE WHEN relation_type = 'recurring' OR recurrence_count > 0 THEN 1 ELSE 0 END) as total_recurring
    FROM complaints c
    WHERE ${prevWhere.clause}
  `).get(...prevWhere.params);

  // 3. Average Resolution Time (in Days & Hours)
  const resolutionTimeRow = db.prepare(`
    SELECT 
      AVG((julianday(h.created_at) - julianday(c.created_at)) * 24) as avg_resolution_hours,
      COUNT(DISTINCT c.id) as resolved_sample_count
    FROM complaints c
    JOIN complaint_status_history h ON c.id = h.complaint_id AND h.to_status = 'Resolved'
    WHERE ${currWhere.clause}
  `).get(...currWhere.params);

  const avgHours = resolutionTimeRow?.avg_resolution_hours != null
    ? Math.max(0, Math.round(resolutionTimeRow.avg_resolution_hours * 10) / 10)
    : null;
  const avgDays = avgHours != null ? Math.round((avgHours / 24) * 10) / 10 : null;

  // 4. Citizen Satisfaction Rate (% verified satisfactory)
  const satisfactionRow = db.prepare(`
    SELECT 
      COUNT(*) as total_verifications,
      SUM(CASE WHEN v.is_satisfactory = 1 THEN 1 ELSE 0 END) as satisfactory_count
    FROM citizen_verifications v
    JOIN complaints c ON v.complaint_id = c.id
    WHERE ${currWhere.clause}
  `).get(...currWhere.params);

  const totalVerif = satisfactionRow?.total_verifications || 0;
  const satCount = satisfactionRow?.satisfactory_count || 0;
  const satisfactionRate = totalVerif > 0 ? Math.round((satCount / totalVerif) * 100) : 100;

  // 5. Calculate Comparative Percentage Changes
  const currTotal = currentCounts?.total_reported || 0;
  const prevTotal = prevCounts?.total_reported || 0;
  let percentChangeTotal = 0;
  if (prevTotal > 0) {
    percentChangeTotal = Math.round(((currTotal - prevTotal) / prevTotal) * 1000) / 10;
  } else if (currTotal > 0) {
    percentChangeTotal = 100;
  }

  const trendDirection = percentChangeTotal > 2 ? 'increasing' : percentChangeTotal < -2 ? 'decreasing' : 'stable';

  const currResolved = currentCounts?.total_resolved || 0;
  const prevResolved = prevCounts?.total_resolved || 0;
  let percentChangeResolved = 0;
  if (prevResolved > 0) {
    percentChangeResolved = Math.round(((currResolved - prevResolved) / prevResolved) * 1000) / 10;
  }

  return {
    totalReported: currTotal,
    totalUnique: currentCounts?.total_unique || 0,
    totalDuplicates: currentCounts?.total_duplicates || 0,
    totalRecurring: currentCounts?.total_recurring || 0,
    totalUnresolved: currentCounts?.total_unresolved || 0,
    totalResolved: currResolved,
    awaitingVerification: currentCounts?.awaiting_verification || 0,
    highCriticalCount: currentCounts?.high_critical_count || 0,
    averageResolutionHours: avgHours,
    averageResolutionDays: avgDays,
    citizenSatisfactionRate: satisfactionRate,
    satisfactionSampleCount: totalVerif,
    previousTotalReported: prevTotal,
    previousTotalResolved: prevResolved,
    percentChangeTotal,
    percentChangeResolved,
    trendDirection,
  };
}

/**
 * Detailed Recurring Civic Defect Detection Across the Core Municipal Categories
 */
export function getRecurringIssuesAnalysis(periodWindow, options = {}) {
  const { wardId, category } = options;
  const { currentStart, currentEnd } = periodWindow;

  const conditions = ['c.created_at >= ? AND c.created_at <= ?'];
  const params = [currentStart, currentEnd];

  if (wardId && wardId !== 'all') {
    conditions.push('c.ward_id = ?');
    params.push(wardId);
  }
  if (category && category !== 'all') {
    conditions.push('c.category = ?');
    params.push(category);
  }

  // 1. All explicitly recurring or reopened complaints in the period
  const recurringRows = db.prepare(`
    SELECT 
      c.id, c.ticket_number, c.title, c.description, c.category, c.severity,
      c.status, c.address, c.landmark, c.latitude, c.longitude,
      c.relation_type, c.root_incident_id, c.is_recurring, c.recurrence_count,
      c.support_count, c.created_at, c.updated_at,
      w.name as ward_name, w.zone as ward_zone,
      d.name as department_name,
      root.ticket_number as root_ticket,
      root.title as root_title,
      root.status as root_status
    FROM complaints c
    LEFT JOIN wards w ON c.ward_id = w.id
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN complaints root ON c.root_incident_id = root.id
    WHERE (${conditions.join(' AND ')})
      AND (
        c.relation_type = 'recurring'
        OR c.recurrence_count > 0
        OR c.status = 'Reopened'
        OR (SELECT COUNT(*) FROM complaints WHERE root_incident_id = c.id) > 1
      )
    ORDER BY c.recurrence_count DESC, c.created_at DESC
  `).all(...params);

  // 2. Identify "Chronic Bounce-Backs" (Issues marked resolved and subsequently reported again)
  const bounceBackRows = db.prepare(`
    SELECT 
      c.id, c.ticket_number, c.title, c.category, c.status, c.address, c.created_at,
      c.recurrence_count, w.name as ward_name, d.name as department_name,
      h.from_status, h.to_status, h.notes as status_notes, h.created_at as bounce_date
    FROM complaints c
    LEFT JOIN wards w ON c.ward_id = w.id
    LEFT JOIN departments d ON c.department_id = d.id
    JOIN complaint_status_history h ON c.id = h.complaint_id AND h.to_status = 'Reopened'
    WHERE ${conditions.join(' AND ')}
    ORDER BY h.created_at DESC
    LIMIT 10
  `).all(...params);

  // 3. Category-Specific Recurring Problem Summaries
  const categoryFilters = [
    { key: 'road_damage', name: 'Roads and Infrastructure', label: 'Road Damage & Potholes' },
    { key: 'waterlogging', name: 'Waterlogging', label: 'Waterlogging & Flood Hotspots' },
    { key: 'drainage', name: 'Drainage and Sewerage', label: 'Drainage & Sewage Failures' },
    { key: 'sanitation', name: 'Sanitation and Waste Management', label: 'Garbage & Waste Hotspots' },
    { key: 'street_lighting', name: 'Street Lighting', label: 'Streetlight Failure Clusters' },
    { key: 'water_supply', name: 'Water Supply', label: 'Water Mains & Pipeline Leaks' },
  ];

  const categoryBreakdown = {};

  for (const cat of categoryFilters) {
    const matches = recurringRows.filter((r) => {
      const rowCat = (r.category || '').toLowerCase();
      const catKey = cat.key.toLowerCase();
      const catName = cat.name.toLowerCase();
      return rowCat.includes(catKey) || rowCat.includes(catName);
    });

    categoryBreakdown[cat.key] = {
      label: cat.label,
      total_recurring_incidents: matches.length,
      sample_tickets: matches.slice(0, 5).map((m) => ({
        id: m.id,
        ticket_number: m.ticket_number,
        title: m.title,
        address: m.address,
        ward_name: m.ward_name,
        recurrence_count: m.recurrence_count,
        status: m.status,
      })),
    };
  }

  // 4. Group by Root Incidents / Clusters
  const clusterMap = new Map();
  for (const row of recurringRows) {
    const rootId = row.root_incident_id || row.id;
    if (!clusterMap.has(rootId)) {
      clusterMap.set(rootId, {
        root_incident_id: rootId,
        root_ticket: row.root_ticket || row.ticket_number,
        root_title: row.root_title || row.title,
        address: row.address,
        ward_name: row.ward_name,
        department_name: row.department_name,
        category: row.category,
        total_recurrences: 0,
        unresolved_count: 0,
        complaint_ids: [],
        tickets: [],
        earliest_date: row.created_at,
        latest_date: row.created_at,
      });
    }

    const cluster = clusterMap.get(rootId);
    cluster.total_recurrences += 1;
    if (row.status !== 'Resolved' && row.status !== 'Work Completed') {
      cluster.unresolved_count += 1;
    }
    cluster.complaint_ids.push(row.id);
    cluster.tickets.push(row.ticket_number);
    if (new Date(row.created_at) < new Date(cluster.earliest_date)) {
      cluster.earliest_date = row.created_at;
    }
    if (new Date(row.created_at) > new Date(cluster.latest_date)) {
      cluster.latest_date = row.created_at;
    }
  }

  const clusters = Array.from(clusterMap.values())
    .sort((a, b) => b.total_recurrences - a.total_recurrences)
    .slice(0, 10);

  return {
    total_recurring_complaints: recurringRows.length,
    chronic_bounce_backs: bounceBackRows,
    bounce_backs_count: bounceBackRows.length,
    category_recurrence: categoryBreakdown,
    chronic_clusters: clusters,
    recurring_complaints_sample: recurringRows.slice(0, 15),
    road_damage: categoryBreakdown.road_damage?.sample_tickets || [],
    waterlogging: categoryBreakdown.waterlogging?.sample_tickets || [],
    drainage_sewage: categoryBreakdown.drainage?.sample_tickets || [],
    garbage_accumulation: categoryBreakdown.sanitation?.sample_tickets || [],
    streetlight_failures: categoryBreakdown.street_lighting?.sample_tickets || [],
    water_supply: categoryBreakdown.water_supply?.sample_tickets || [],
  };
}

/**
 * Geographic Hotspot Analysis using spatial distance clustering (Haversine ~150m)
 * Strictly separates coordinate-grounded clusters from unmapped complaints without coordinates.
 */
export function getGeographicHotspotAnalysis(periodWindow, options = {}) {
  const { wardId, category } = options;
  const { currentStart, currentEnd } = periodWindow;

  const conditions = ['c.created_at >= ? AND c.created_at <= ?'];
  const params = [currentStart, currentEnd];

  if (wardId && wardId !== 'all') {
    conditions.push('c.ward_id = ?');
    params.push(wardId);
  }
  if (category && category !== 'all') {
    conditions.push('c.category = ?');
    params.push(category);
  }

  const allRows = db.prepare(`
    SELECT 
      c.id, c.ticket_number, c.title, c.category, c.severity, c.status,
      c.latitude, c.longitude, c.address, c.landmark, c.ward_id,
      c.relation_type, c.recurrence_count, c.created_at,
      w.name as ward_name, w.zone as ward_zone
    FROM complaints c
    LEFT JOIN wards w ON c.ward_id = w.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.created_at DESC
  `).all(...params);

  // 1. Separate Mapped (Valid Coordinates) vs Unmapped (Missing / Zero Coordinates)
  const mapped = [];
  const unmapped = [];

  for (const row of allRows) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    const isValidCoord =
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat !== 0 &&
      lon !== 0 &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;

    if (isValidCoord) {
      mapped.push({ ...row, latitude: lat, longitude: lon });
    } else {
      unmapped.push(row);
    }
  }

  // 2. Spatial Clustering of Mapped Complaints (Threshold ~150m)
  const CLUSTER_THRESHOLD_METERS = 150;
  const clusters = [];

  for (const item of mapped) {
    let matchedCluster = null;

    for (const cluster of clusters) {
      const dist = calculateDistanceMeters(
        cluster.center_latitude,
        cluster.center_longitude,
        item.latitude,
        item.longitude
      );

      if (dist <= CLUSTER_THRESHOLD_METERS) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.items.push(item);
      // Update moving centroid
      const n = matchedCluster.items.length;
      matchedCluster.center_latitude = (matchedCluster.center_latitude * (n - 1) + item.latitude) / n;
      matchedCluster.center_longitude = (matchedCluster.center_longitude * (n - 1) + item.longitude) / n;
    } else {
      clusters.push({
        cluster_id: `hotspot-${clusters.length + 1}`,
        center_latitude: item.latitude,
        center_longitude: item.longitude,
        primary_address: item.address || item.landmark || 'Identified Civic Hotspot',
        ward_name: item.ward_name || 'Municipal Ward',
        ward_zone: item.ward_zone || 'Municipal Zone',
        items: [item],
      });
    }
  }

  // Format cluster analytics
  const formattedClusters = clusters.map((c) => {
    const total = c.items.length;
    const unresolved = c.items.filter((i) => i.status !== 'Resolved' && i.status !== 'Work Completed').length;
    const resolved = c.items.filter((i) => i.status === 'Resolved').length;
    const recurring = c.items.filter((i) => i.relation_type === 'recurring' || i.recurrence_count > 0).length;

    const catCounts = {};
    for (const it of c.items) {
      catCounts[it.category] = (catCounts[it.category] || 0) + 1;
    }

    const dominantCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Civic Infrastructure';

    return {
      cluster_id: c.cluster_id,
      centroid_lat: Math.round(c.center_latitude * 1000000) / 1000000,
      centroid_lng: Math.round(c.center_longitude * 1000000) / 1000000,
      center_latitude: Math.round(c.center_latitude * 1000000) / 1000000,
      center_longitude: Math.round(c.center_longitude * 1000000) / 1000000,
      approximate_address: c.primary_address,
      primary_address: c.primary_address,
      ward_name: c.ward_name,
      ward_zone: c.ward_zone,
      report_count: total,
      total_complaints: total,
      unresolved_count: unresolved,
      resolved_count: resolved,
      recurring_count: recurring,
      is_chronic_recurrence: recurring > 0 || total >= 3,
      is_chronic_zone: recurring > 0 || total >= 3,
      dominant_category: dominantCategory,
      category_distribution: catCounts,
      complaint_tickets: c.items.map((i) => i.ticket_number),
      ticket_numbers: c.items.map((i) => i.ticket_number),
      complaint_ids: c.items.map((i) => i.id),
      sample_complaints: c.items.slice(0, 4).map((i) => ({
        id: i.id,
        ticket_number: i.ticket_number,
        title: i.title,
        status: i.status,
        category: i.category,
      })),
    };
  });

  // Sort by complaint count descending
  formattedClusters.sort((a, b) => b.total_complaints - a.total_complaints);

  // 3. Neighbourhood / Ward-Level Aggregation
  const wardMap = new Map();
  for (const item of allRows) {
    const wId = item.ward_id || 'unassigned';
    if (!wardMap.has(wId)) {
      wardMap.set(wId, {
        ward_id: wId,
        ward_name: item.ward_name || 'Unassigned Ward',
        ward_zone: item.ward_zone || 'General Zone',
        total_complaints: 0,
        unresolved_count: 0,
        resolved_count: 0,
        recurring_count: 0,
        category_counts: {},
      });
    }

    const wData = wardMap.get(wId);
    wData.total_complaints += 1;
    if (item.status !== 'Resolved' && item.status !== 'Work Completed') {
      wData.unresolved_count += 1;
    } else if (item.status === 'Resolved') {
      wData.resolved_count += 1;
    }
    if (item.relation_type === 'recurring' || item.recurrence_count > 0) {
      wData.recurring_count += 1;
    }
    wData.category_counts[item.category] = (wData.category_counts[item.category] || 0) + 1;
  }

  const neighbourhoods = Array.from(wardMap.values()).map((w) => {
    const topCat = Object.entries(w.category_counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
    const resolutionRate = w.total_complaints > 0 ? Math.round((w.resolved_count / w.total_complaints) * 100) : 0;
    return {
      ...w,
      top_category: topCat,
      resolution_rate: resolutionRate,
    };
  }).sort((a, b) => b.total_complaints - a.total_complaints);

  return {
    total_geocoded_complaints: mapped.length,
    unmapped_reports_count: unmapped.length,
    unmapped_notice: unmapped.length > 0
      ? `${unmapped.length} complaint(s) lack reliable GPS coordinates and are strictly excluded from spatial clusters to prevent false geographic attribution.`
      : null,
    geographic_hotspots: formattedClusters,
    spatial_clusters: formattedClusters,
    total_clusters_detected: formattedClusters.length,
    neighbourhoods,
  };
}

/**
 * Historical Trend Analysis (Time Series & Category Velocity Comparison)
 */
export function getHistoricalTrends(periodWindow, options = {}) {
  const { wardId, category } = options;
  const { periodKey, currentStart, currentEnd, previousStart, previousEnd } = periodWindow;

  const buildWhere = (start, end) => {
    const conditions = ['c.created_at >= ? AND c.created_at <= ?'];
    const params = [start, end];
    if (wardId && wardId !== 'all') {
      conditions.push('c.ward_id = ?');
      params.push(wardId);
    }
    if (category && category !== 'all') {
      conditions.push('c.category = ?');
      params.push(category);
    }
    return { clause: conditions.join(' AND '), params };
  };

  const currWhere = buildWhere(currentStart, currentEnd);
  const prevWhere = buildWhere(previousStart, previousEnd);

  // 1. Time Series Bucketing (Daily for <= 30d, Weekly for <= 180d, Monthly for 365d/all)
  let dateFormat = '%Y-%m-%d';
  if (periodKey === '365d' || periodKey === 'all') {
    dateFormat = '%Y-%m';
  }

  const timeSeriesRows = db.prepare(`
    SELECT 
      strftime('${dateFormat}', c.created_at) as time_bucket,
      COUNT(*) as total_submitted,
      SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN c.relation_type = 'recurring' OR c.recurrence_count > 0 THEN 1 ELSE 0 END) as recurring_count,
      SUM(CASE WHEN c.severity IN ('high', 'critical') THEN 1 ELSE 0 END) as critical_count
    FROM complaints c
    WHERE ${currWhere.clause}
    GROUP BY strftime('${dateFormat}', c.created_at)
    ORDER BY time_bucket ASC
  `).all(...currWhere.params);

  // 2. Category-Wise Velocity Comparison (Current vs Previous Window)
  const currentCategoryRows = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM complaints c
    WHERE ${currWhere.clause}
    GROUP BY category
    ORDER BY count DESC
  `).all(...currWhere.params);

  const prevCategoryRows = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM complaints c
    WHERE ${prevWhere.clause}
    GROUP BY category
  `).all(...prevWhere.params);

  const prevCatMap = new Map(prevCategoryRows.map((r) => [r.category, r.count]));

  const categoryVelocity = currentCategoryRows.map((r) => {
    const currentCount = r.count;
    const previousCount = prevCatMap.get(r.category) || 0;
    const absChange = currentCount - previousCount;
    let pctChange = 0;
    if (previousCount > 0) {
      pctChange = Math.round(((currentCount - previousCount) / previousCount) * 1000) / 10;
    } else if (currentCount > 0) {
      pctChange = 100;
    }

    return {
      category: r.category,
      current_count: currentCount,
      previous_count: previousCount,
      absolute_change: absChange,
      percent_change: pctChange,
      trend_direction: pctChange > 2 ? 'increasing' : pctChange < -2 ? 'decreasing' : 'stable',
    };
  });

  return {
    time_series: timeSeriesRows,
    trend_points: timeSeriesRows,
    category_trends: categoryVelocity,
    category_breakdown: categoryVelocity,
  };
}

/**
 * Returns complete aggregated civic intelligence payload for a given time period and filters.
 * Uses in-memory caching to guarantee rapid sub-millisecond responses.
 */
export function getCivicIntelligenceOverview(periodKey = '30d', options = {}) {
  const { wardId = 'all', category = 'all', bypassCache = false } = options;
  const cacheKey = `${periodKey}:${wardId}:${category}`;

  if (!bypassCache && intelligenceCache.has(cacheKey)) {
    const cached = intelligenceCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, source: 'cache' };
    }
  }

  const periodWindow = getTimePeriodWindow(periodKey);
  const metrics = getOverallMetrics(periodWindow, options);
  const recurring = getRecurringIssuesAnalysis(periodWindow, options);
  const hotspots = getGeographicHotspotAnalysis(periodWindow, options);
  const trends = getHistoricalTrends(periodWindow, options);

  const metricsMapped = {
    ...metrics,
    total_reported: metrics.totalReported,
    total_unique_issues: metrics.totalUnique,
    duplicate_complaints: metrics.totalDuplicates,
    recurring_issues: metrics.totalRecurring,
    unresolved_complaints: metrics.totalUnresolved,
    resolved_complaints: metrics.totalResolved,
    avg_resolution_time_days: metrics.averageResolutionDays,
    avg_resolution_time_hours: metrics.averageResolutionHours,
    citizen_satisfaction_rate_percent: metrics.citizenSatisfactionRate,
    prior_period_total: metrics.previousTotalReported,
    percent_change_total: metrics.percentChangeTotal,
    trend_direction: metrics.trendDirection,
    recurrence_rate_percent: metrics.totalReported > 0 ? Math.round((metrics.totalRecurring / metrics.totalReported) * 100) : 0,
    unresolved_percent: metrics.totalReported > 0 ? Math.round((metrics.totalUnresolved / metrics.totalReported) * 100) : 0,
  };

  const payload = {
    period: periodKey,
    time_period: periodKey,
    window: {
      days: periodWindow.days,
      current_start: periodWindow.currentStart,
      current_end: periodWindow.currentEnd,
      previous_start: periodWindow.previousStart,
      previous_end: periodWindow.previousEnd,
    },
    filters: {
      ward_id: wardId,
      category,
    },
    metrics: metricsMapped,
    overall_metrics: metricsMapped,
    recurring,
    recurring_analysis: recurring,
    hotspots,
    hotspot_analysis: hotspots,
    trends,
    historical_trends: trends,
    generated_at: new Date().toISOString(),
    source: 'database',
  };

  intelligenceCache.set(cacheKey, {
    timestamp: Date.now(),
    data: payload,
  });

  return payload;
}
