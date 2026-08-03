export { useAnalyticsDashboard, nearestMoodLabel, MOOD_SCORE, WORKOUT_MINUTES, type DashboardData } from './useDashboard';
export { usePreviousPeriodStats, type PreviousPeriodStats } from './usePreviousPeriodStats';
export { useCheckinTrends, type CheckinTrends, type MetricTrend } from './useCheckinTrends';
export { movingAverage, sum, average, percentChange, correlationCoefficient, alignSeries, type Series } from './AnalyticsService';
export { generateActionableInsights, ActionableInsights } from './ActionableInsights';
export { MetricGrid, type MetricDomain, type MetricRow } from './MetricGrid';
