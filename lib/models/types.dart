/// SurakshaFlow — Data Models
/// Mirrors the TypeScript types from the web app.

enum UserRole { endUser, financialInstitution }

extension UserRoleExtension on UserRole {
  String get value {
    switch (this) {
      case UserRole.endUser:
        return 'end_user';
      case UserRole.financialInstitution:
        return 'financial_institution';
    }
  }

  static UserRole fromString(String s) {
    switch (s) {
      case 'financial_institution':
        return UserRole.financialInstitution;
      default:
        return UserRole.endUser;
    }
  }
}

class CyberEvent {
  final String id;
  final String timestamp;
  final String type;
  final String deviceId;
  final String ipLocation;
  final String accountId;
  final double riskScore;
  final Map<String, dynamic>? rawSignals;

  CyberEvent({
    required this.id,
    required this.timestamp,
    required this.type,
    required this.deviceId,
    required this.ipLocation,
    required this.accountId,
    required this.riskScore,
    this.rawSignals,
  });

  factory CyberEvent.fromJson(Map<String, dynamic> e) {
    return CyberEvent(
      id: e['id'] ?? '',
      timestamp: e['timestamp'] ?? '',
      type: e['event_type'] ?? e['type'] ?? 'login',
      deviceId: e['device_id'] ?? e['deviceId'] ?? '',
      ipLocation: e['ip_geo'] ?? e['ipLocation'] ?? '',
      accountId: e['account_id'] ?? e['accountId'] ?? '',
      riskScore: (e['anomaly_score'] ?? e['riskScore'] ?? 0).toDouble(),
      rawSignals: e['raw_signals'],
    );
  }
}

class FinancialTransaction {
  final String id;
  final String timestamp;
  final String senderId;
  final String receiverId;
  final double amount;
  final String type;
  final double riskScore;
  final List<String>? riskFlags;

  FinancialTransaction({
    required this.id,
    required this.timestamp,
    required this.senderId,
    required this.receiverId,
    required this.amount,
    required this.type,
    required this.riskScore,
    this.riskFlags,
  });

  factory FinancialTransaction.fromJson(Map<String, dynamic> t) {
    return FinancialTransaction(
      id: t['id'] ?? '',
      timestamp: t['timestamp'] ?? '',
      senderId: t['sender'] ?? t['senderId'] ?? '',
      receiverId: t['receiver'] ?? t['receiverId'] ?? '',
      amount: (t['amount'] ?? 0).toDouble(),
      type: t['method'] ?? t['type'] ?? 'upi',
      riskScore: (t['velocity_score'] ?? t['riskScore'] ?? 0).toDouble(),
      riskFlags: (t['risk_flags'] as List?)?.cast<String>(),
    );
  }
}

class Alert {
  final String id;
  final String timestamp;
  final String accountId;
  final List<String>? accountsFlagged;
  final double unifiedRiskScore;
  final List<CyberEvent> cyberEvents;
  final List<FinancialTransaction> financialTransactions;
  final String status;
  final String? severity;
  final String? geminiExplanation;
  final String? recommendedAction;
  final String? createdAt;

  Alert({
    required this.id,
    required this.timestamp,
    required this.accountId,
    this.accountsFlagged,
    required this.unifiedRiskScore,
    required this.cyberEvents,
    required this.financialTransactions,
    required this.status,
    this.severity,
    this.geminiExplanation,
    this.recommendedAction,
    this.createdAt,
  });

  factory Alert.fromJson(Map<String, dynamic> a) {
    final cyberList = (a['cyber_events'] ?? a['cyberEvents'] ?? []) as List;
    final txnList =
        (a['financial_transactions'] ?? a['financialTransactions'] ?? [])
            as List;
    return Alert(
      id: a['id'] ?? '',
      timestamp:
          a['created_at'] ?? a['timestamp'] ?? DateTime.now().toIso8601String(),
      accountId:
          (a['accounts_flagged'] as List?)?.firstOrNull ?? a['accountId'] ?? a['id'] ?? '',
      accountsFlagged: (a['accounts_flagged'] as List?)?.cast<String>(),
      unifiedRiskScore:
          (a['unified_risk_score'] ?? a['unifiedRiskScore'] ?? 0).toDouble(),
      cyberEvents: cyberList.map((e) => CyberEvent.fromJson(e)).toList(),
      financialTransactions:
          txnList.map((t) => FinancialTransaction.fromJson(t)).toList(),
      status: a['status'] ?? 'new',
      severity: a['severity'],
      geminiExplanation:
          a['gemini_explanation'] ?? a['geminiExplanation'],
      recommendedAction:
          a['recommended_action'] ?? a['recommendedAction'],
      createdAt: a['created_at'],
    );
  }
}

class DashboardSummary {
  final int totalAlerts;
  final int highRiskCount;
  final int transactionsMonitored;
  final int activeMuleRings;
  final List<RiskTrendPoint> riskTrend;

  DashboardSummary({
    required this.totalAlerts,
    required this.highRiskCount,
    required this.transactionsMonitored,
    required this.activeMuleRings,
    required this.riskTrend,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> d) {
    return DashboardSummary(
      totalAlerts: d['total_alerts'] ?? 0,
      highRiskCount: d['high_risk_count'] ?? 0,
      transactionsMonitored: d['transactions_monitored'] ?? 0,
      activeMuleRings: d['active_mule_rings'] ?? 0,
      riskTrend: ((d['risk_trend'] ?? []) as List)
          .map((r) => RiskTrendPoint.fromJson(r))
          .toList(),
    );
  }
}

class RiskTrendPoint {
  final String time;
  final double risk;
  final int? alerts;

  RiskTrendPoint({required this.time, required this.risk, this.alerts});

  factory RiskTrendPoint.fromJson(Map<String, dynamic> r) {
    return RiskTrendPoint(
      time: r['time'] ?? '',
      risk: (r['risk'] ?? 0).toDouble(),
      alerts: r['alerts'],
    );
  }
}

class UserRiskResponse {
  final String accountId;
  final double unifiedScore;
  final double cyberScore;
  final double financialScore;
  final double graphScore;
  final double? mlScore;
  final String riskLevel;
  final String? explanation;
  final String? recommendedAction;

  UserRiskResponse({
    required this.accountId,
    required this.unifiedScore,
    required this.cyberScore,
    required this.financialScore,
    required this.graphScore,
    this.mlScore,
    required this.riskLevel,
    this.explanation,
    this.recommendedAction,
  });

  factory UserRiskResponse.fromJson(Map<String, dynamic> u) {
    return UserRiskResponse(
      accountId: u['account_id'] ?? '',
      unifiedScore: (u['unified_score'] ?? 0).toDouble(),
      cyberScore: (u['cyber_score'] ?? 0).toDouble(),
      financialScore: (u['financial_score'] ?? 0).toDouble(),
      graphScore: (u['graph_score'] ?? 0).toDouble(),
      mlScore: u['ml_score']?.toDouble(),
      riskLevel: u['risk_level'] ?? 'low',
      explanation: u['explanation'],
      recommendedAction: u['recommended_action'],
    );
  }
}

class GeminiExplanation {
  final String explanation;
  final String recommendation;
  final double confidence;
  final List<String> keyIndicators;

  GeminiExplanation({
    required this.explanation,
    required this.recommendation,
    required this.confidence,
    required this.keyIndicators,
  });

  factory GeminiExplanation.fromJson(Map<String, dynamic> g) {
    return GeminiExplanation(
      explanation: g['explanation'] ?? '',
      recommendation: g['recommendation'] ?? '',
      confidence: (g['confidence'] ?? 0).toDouble(),
      keyIndicators: (g['key_indicators'] as List?)?.cast<String>() ?? [],
    );
  }
}

class SMSAnalysisResult {
  final bool isScam;
  final double confidence;
  final String explanation;
  final List<String> riskIndicators;

  SMSAnalysisResult({
    required this.isScam,
    required this.confidence,
    required this.explanation,
    required this.riskIndicators,
  });

  factory SMSAnalysisResult.fromJson(Map<String, dynamic> s) {
    return SMSAnalysisResult(
      isScam: s['is_scam'] ?? false,
      confidence: (s['confidence'] ?? 0).toDouble(),
      explanation: s['explanation'] ?? '',
      riskIndicators: (s['risk_indicators'] as List?)?.cast<String>() ?? [],
    );
  }
}

class EmailAnalysisResult {
  final bool isPhishing;
  final double confidence;
  final String explanation;
  final List<String> riskIndicators;
  final String recommendedAction;
  final String threatType;

  EmailAnalysisResult({
    required this.isPhishing,
    required this.confidence,
    required this.explanation,
    required this.riskIndicators,
    required this.recommendedAction,
    required this.threatType,
  });

  factory EmailAnalysisResult.fromJson(Map<String, dynamic> e) {
    return EmailAnalysisResult(
      isPhishing: e['is_phishing'] ?? false,
      confidence: (e['confidence'] ?? 0).toDouble(),
      explanation: e['explanation'] ?? '',
      riskIndicators: (e['risk_indicators'] as List?)?.cast<String>() ?? [],
      recommendedAction: e['recommended_action'] ?? '',
      threatType: e['threat_type'] ?? '',
    );
  }
}

class SimulationResult {
  final SimNoAction noAction;
  final SimOptimalAction optimalAction;

  SimulationResult({required this.noAction, required this.optimalAction});

  factory SimulationResult.fromJson(Map<String, dynamic> s) {
    return SimulationResult(
      noAction: SimNoAction.fromJson(s['no_action'] ?? {}),
      optimalAction: SimOptimalAction.fromJson(s['optimal_action'] ?? {}),
    );
  }
}

class SimNoAction {
  final int downstreamAccounts;
  final double totalExposure;

  SimNoAction({required this.downstreamAccounts, required this.totalExposure});

  factory SimNoAction.fromJson(Map<String, dynamic> n) {
    return SimNoAction(
      downstreamAccounts: n['downstream_accounts'] ?? 0,
      totalExposure: (n['total_exposure'] ?? 0).toDouble(),
    );
  }
}

class SimOptimalAction {
  final String accountToFreeze;
  final double preventedLoss;
  final double preventedPercentage;
  final double? moneySavedBySurakshaflow;
  final String? message;

  SimOptimalAction({
    required this.accountToFreeze,
    required this.preventedLoss,
    required this.preventedPercentage,
    this.moneySavedBySurakshaflow,
    this.message,
  });

  factory SimOptimalAction.fromJson(Map<String, dynamic> o) {
    return SimOptimalAction(
      accountToFreeze: o['account_to_freeze'] ?? '',
      preventedLoss: (o['prevented_loss'] ?? 0).toDouble(),
      preventedPercentage: (o['prevented_percentage'] ?? 0).toDouble(),
      moneySavedBySurakshaflow:
          o['money_saved_by_surakshaflow']?.toDouble(),
      message: o['message'],
    );
  }
}

class GraphNode {
  final String id;
  final String type;
  final double riskScore;
  final String label;
  final int? community;

  GraphNode({
    required this.id,
    required this.type,
    required this.riskScore,
    required this.label,
    this.community,
  });

  factory GraphNode.fromJson(Map<String, dynamic> n) {
    return GraphNode(
      id: n['id'] ?? '',
      type: n['type'] ?? 'account',
      riskScore: (n['risk_score'] ?? n['riskScore'] ?? 0).toDouble(),
      label: n['node_label'] ?? n['label'] ?? n['id'] ?? '',
      community: n['community'],
    );
  }
}

class GraphEdge {
  final String source;
  final String target;
  final String type;
  final double weight;

  GraphEdge({
    required this.source,
    required this.target,
    required this.type,
    required this.weight,
  });

  factory GraphEdge.fromJson(Map<String, dynamic> e) {
    return GraphEdge(
      source: e['source'] ?? '',
      target: e['target'] ?? '',
      type: e['type'] ?? 'transaction',
      weight: (e['weight'] ?? 1).toDouble(),
    );
  }
}

class GraphData {
  final List<GraphNode> nodes;
  final List<GraphEdge> edges;

  GraphData({required this.nodes, required this.edges});

  factory GraphData.fromJson(Map<String, dynamic> g) {
    return GraphData(
      nodes: ((g['nodes'] ?? []) as List)
          .map((n) => GraphNode.fromJson(n))
          .toList(),
      edges: ((g['edges'] ?? []) as List)
          .map((e) => GraphEdge.fromJson(e))
          .toList(),
    );
  }
}

class FreezeResult {
  final bool success;
  final String accountId;
  final String status;
  final double moneySaved;
  final String message;
  final int downstreamProtected;
  final double disruptionEffectiveness;

  FreezeResult({
    required this.success,
    required this.accountId,
    required this.status,
    required this.moneySaved,
    required this.message,
    required this.downstreamProtected,
    required this.disruptionEffectiveness,
  });

  factory FreezeResult.fromJson(Map<String, dynamic> f) {
    return FreezeResult(
      success: f['success'] ?? false,
      accountId: f['account_id'] ?? '',
      status: f['status'] ?? '',
      moneySaved: (f['money_saved'] ?? 0).toDouble(),
      message: f['message'] ?? '',
      downstreamProtected: f['downstream_protected'] ?? 0,
      disruptionEffectiveness:
          (f['disruption_effectiveness'] ?? 0).toDouble(),
    );
  }
}

class LiveEvent {
  final int tick;
  final String timestamp;
  final String scenarioType;
  final bool isSuspicious;
  final Map<String, dynamic>? cyberEvent;
  final Map<String, dynamic>? transaction;
  final RiskScores riskScores;
  final List<String> changes;
  final Map<String, dynamic>? alert;
  final List<RiskTrendPoint> riskTrend;
  final bool requiresGemini;
  final GeminiLiveAnalysis? geminiAnalysis;

  LiveEvent({
    required this.tick,
    required this.timestamp,
    required this.scenarioType,
    required this.isSuspicious,
    this.cyberEvent,
    this.transaction,
    required this.riskScores,
    required this.changes,
    this.alert,
    required this.riskTrend,
    required this.requiresGemini,
    this.geminiAnalysis,
  });

  factory LiveEvent.fromJson(Map<String, dynamic> e) {
    return LiveEvent(
      tick: e['tick'] ?? 0,
      timestamp: e['timestamp'] ?? '',
      scenarioType: e['scenario_type'] ?? 'clean',
      isSuspicious: e['is_suspicious'] ?? false,
      cyberEvent: e['cyber_event'],
      transaction: e['transaction'],
      riskScores: RiskScores.fromJson(e['risk_scores'] ?? {}),
      changes: (e['changes'] as List?)?.cast<String>() ?? [],
      alert: e['alert'],
      riskTrend: ((e['risk_trend'] ?? []) as List)
          .map((r) => RiskTrendPoint.fromJson(r))
          .toList(),
      requiresGemini: e['requires_gemini'] ?? false,
      geminiAnalysis: e['gemini_analysis'] != null
          ? GeminiLiveAnalysis.fromJson(e['gemini_analysis'])
          : null,
    );
  }
}

class RiskScores {
  final double cyberScore;
  final double financialScore;
  final double graphScore;
  final double unifiedScore;

  RiskScores({
    required this.cyberScore,
    required this.financialScore,
    required this.graphScore,
    required this.unifiedScore,
  });

  factory RiskScores.fromJson(Map<String, dynamic> r) {
    return RiskScores(
      cyberScore: (r['cyber_score'] ?? 0).toDouble(),
      financialScore: (r['financial_score'] ?? 0).toDouble(),
      graphScore: (r['graph_score'] ?? 0).toDouble(),
      unifiedScore: (r['unified_score'] ?? 0).toDouble(),
    );
  }
}

class GeminiLiveAnalysis {
  final String explanation;
  final String recommendation;
  final double confidence;
  final List<String> keyIndicators;
  final List<String>? immediateSteps;
  final List<String>? accountsToFreeze;
  final bool? strRequired;

  GeminiLiveAnalysis({
    required this.explanation,
    required this.recommendation,
    required this.confidence,
    required this.keyIndicators,
    this.immediateSteps,
    this.accountsToFreeze,
    this.strRequired,
  });

  factory GeminiLiveAnalysis.fromJson(Map<String, dynamic> g) {
    return GeminiLiveAnalysis(
      explanation: g['explanation'] ?? '',
      recommendation: g['recommendation'] ?? '',
      confidence: (g['confidence'] ?? 0).toDouble(),
      keyIndicators: (g['key_indicators'] as List?)?.cast<String>() ?? [],
      immediateSteps: (g['immediate_steps'] as List?)?.cast<String>(),
      accountsToFreeze: (g['accounts_to_freeze'] as List?)?.cast<String>(),
      strRequired: g['str_required'],
    );
  }
}

class UserLiveEvent {
  final int tick;
  final String timestamp;
  final String accountId;
  final bool isAnomaly;
  final RiskScores riskScores;
  final String riskLevel;
  final List<String> changes;
  final List<UserWarning> warnings;
  final List<String> procedures;
  final List<RiskTrendPoint> riskTrend;
  final bool requiresGemini;
  final UserGeminiAnalysis? geminiAnalysis;

  UserLiveEvent({
    required this.tick,
    required this.timestamp,
    required this.accountId,
    required this.isAnomaly,
    required this.riskScores,
    required this.riskLevel,
    required this.changes,
    required this.warnings,
    required this.procedures,
    required this.riskTrend,
    required this.requiresGemini,
    this.geminiAnalysis,
  });

  factory UserLiveEvent.fromJson(Map<String, dynamic> e) {
    return UserLiveEvent(
      tick: e['tick'] ?? 0,
      timestamp: e['timestamp'] ?? '',
      accountId: e['account_id'] ?? '',
      isAnomaly: e['is_anomaly'] ?? false,
      riskScores: RiskScores.fromJson(e['risk_scores'] ?? {}),
      riskLevel: e['risk_level'] ?? 'low',
      changes: (e['changes'] as List?)?.cast<String>() ?? [],
      warnings: ((e['warnings'] ?? []) as List)
          .map((w) => UserWarning.fromJson(w))
          .toList(),
      procedures: (e['procedures'] as List?)?.cast<String>() ?? [],
      riskTrend: ((e['risk_trend'] ?? []) as List)
          .map((r) => RiskTrendPoint.fromJson(r))
          .toList(),
      requiresGemini: e['requires_gemini'] ?? false,
      geminiAnalysis: e['gemini_analysis'] != null
          ? UserGeminiAnalysis.fromJson(e['gemini_analysis'])
          : null,
    );
  }
}

class UserWarning {
  final String type;
  final String severity;
  final String title;
  final String detail;
  final String action;

  UserWarning({
    required this.type,
    required this.severity,
    required this.title,
    required this.detail,
    required this.action,
  });

  factory UserWarning.fromJson(Map<String, dynamic> w) {
    return UserWarning(
      type: w['type'] ?? '',
      severity: w['severity'] ?? 'info',
      title: w['title'] ?? '',
      detail: w['detail'] ?? '',
      action: w['action'] ?? '',
    );
  }
}

class UserGeminiAnalysis {
  final String explanation;
  final String urgency;
  final double confidence;
  final List<String> stepsToTake;
  final List<String> preventionTips;
  final bool shouldContactBank;

  UserGeminiAnalysis({
    required this.explanation,
    required this.urgency,
    required this.confidence,
    required this.stepsToTake,
    required this.preventionTips,
    required this.shouldContactBank,
  });

  factory UserGeminiAnalysis.fromJson(Map<String, dynamic> g) {
    return UserGeminiAnalysis(
      explanation: g['explanation'] ?? '',
      urgency: g['urgency'] ?? 'safe',
      confidence: (g['confidence'] ?? 0).toDouble(),
      stepsToTake: (g['steps_to_take'] as List?)?.cast<String>() ?? [],
      preventionTips: (g['prevention_tips'] as List?)?.cast<String>() ?? [],
      shouldContactBank: g['should_contact_bank'] ?? false,
    );
  }
}

class UserProfile {
  final String uid;
  final String email;
  final String displayName;
  final UserRole role;
  final List<String> linkedAccounts;
  final String? photoURL;

  UserProfile({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.role,
    required this.linkedAccounts,
    this.photoURL,
  });
}

class MLModelStatus {
  final bool mlEnabled;
  final MLFraudPredictor? fraudPredictor;
  final MLTemporalGnn? temporalGnn;

  MLModelStatus({
    required this.mlEnabled,
    this.fraudPredictor,
    this.temporalGnn,
  });

  factory MLModelStatus.fromJson(Map<String, dynamic> m) {
    return MLModelStatus(
      mlEnabled: m['ml_enabled'] ?? false,
      fraudPredictor: m['fraud_predictor'] != null
          ? MLFraudPredictor.fromJson(m['fraud_predictor'])
          : null,
      temporalGnn: m['temporal_gnn'] != null
          ? MLTemporalGnn.fromJson(m['temporal_gnn'])
          : null,
    );
  }
}

class MLFraudPredictor {
  final bool trained;
  final Map<String, dynamic> metrics;

  MLFraudPredictor({required this.trained, required this.metrics});

  factory MLFraudPredictor.fromJson(Map<String, dynamic> f) {
    return MLFraudPredictor(
      trained: f['trained'] ?? false,
      metrics: f['metrics'] ?? {},
    );
  }
}

class MLTemporalGnn {
  final bool trained;
  final Map<String, dynamic> metrics;

  MLTemporalGnn({required this.trained, required this.metrics});

  factory MLTemporalGnn.fromJson(Map<String, dynamic> t) {
    return MLTemporalGnn(
      trained: t['trained'] ?? false,
      metrics: t['metrics'] ?? {},
    );
  }
}

class SessionHistory {
  final String period;
  final Map<String, dynamic> currentSession;
  final List<Map<String, dynamic>> pastSessions;
  final int totalHistoricalAlerts;

  SessionHistory({
    required this.period,
    required this.currentSession,
    required this.pastSessions,
    required this.totalHistoricalAlerts,
  });

  factory SessionHistory.fromJson(Map<String, dynamic> s) {
    return SessionHistory(
      period: s['period'] ?? '',
      currentSession: s['current_session'] ?? {},
      pastSessions:
          ((s['past_sessions'] ?? []) as List).cast<Map<String, dynamic>>(),
      totalHistoricalAlerts: s['total_historical_alerts'] ?? 0,
    );
  }
}
