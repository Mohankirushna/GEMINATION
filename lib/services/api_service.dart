/// SurakshaFlow — API Service Layer
/// All calls go through the configured API_BASE.
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import '../models/types.dart';

class ApiService {
  // Auto-detect the right base URL per platform.
  // Change _lanIp to your Mac's WiFi IP for physical devices.
  static const String _lanIp = '10.49.140.222';

  static String apiBase = _defaultBase();

  static String _defaultBase() {
    if (kIsWeb) return 'http://localhost:8000/api';
    if (Platform.isAndroid) return 'http://10.0.2.2:8000/api';
    // iOS simulator uses localhost; physical device uses LAN IP
    return 'http://$_lanIp:8000/api';
  }

  static void setBaseUrl(String url) {
    apiBase = url;
  }

  static Future<T> _request<T>(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    T Function(dynamic)? parser,
  }) async {
    final url = Uri.parse('$apiBase$path');
    http.Response res;

    final headers = {'Content-Type': 'application/json'};

    switch (method) {
      case 'POST':
        res = await http.post(
          url,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        ).timeout(const Duration(seconds: 8));
        break;
      default:
        res = await http.get(url, headers: headers)
            .timeout(const Duration(seconds: 8));
    }

    if (res.statusCode >= 400) {
      throw Exception('API ${res.statusCode}: ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    if (parser != null) return parser(decoded);
    return decoded as T;
  }

  // ── Bank Dashboard ──
  static Future<DashboardSummary> fetchBankSummary() =>
      _request('/dashboard/bank/summary',
          parser: (d) => DashboardSummary.fromJson(d));

  static Future<List<Alert>> fetchAlerts({String? status}) async {
    final q = status != null ? '?status=$status' : '';
    return _request('/dashboard/bank/alerts$q',
        parser: (d) => (d as List).map((a) => Alert.fromJson(a)).toList());
  }

  static Future<Alert> fetchAlertDetail(String alertId) =>
      _request('/dashboard/bank/alert/$alertId',
          parser: (d) => Alert.fromJson(d));

  static Future<Map<String, dynamic>> performAccountAction(
    String alertId,
    String action, {
    String? reason,
  }) =>
      _request('/dashboard/bank/alert/$alertId/action',
          method: 'POST',
          body: {'action': action, 'reason': reason ?? ''},
          parser: (d) => d as Map<String, dynamic>);

  // ── User Dashboard ──
  static Future<UserRiskResponse> fetchUserRisk(String accountId) =>
      _request('/dashboard/user/$accountId/risk',
          parser: (d) => UserRiskResponse.fromJson(d));

  static Future<Map<String, dynamic>> fetchUserEvents(String accountId) =>
      _request('/dashboard/user/$accountId/events',
          parser: (d) => d as Map<String, dynamic>);

  // ── Graph Intelligence ──
  static Future<GraphData> fetchGraphData() =>
      _request('/graph/network', parser: (d) => GraphData.fromJson(d));

  static Future<GraphData> fetchCluster(String accountId, {int hops = 2}) =>
      _request('/graph/cluster/$accountId?hops=$hops',
          parser: (d) => GraphData.fromJson(d));

  // ── Gemini AI ──
  static Future<GeminiExplanation> explainAlert(String alertId) =>
      _request('/gemini/explain',
          method: 'POST',
          body: {'alert_id': alertId},
          parser: (d) => GeminiExplanation.fromJson(d));

  static Future<SMSAnalysisResult> analyzeSMS(String message) =>
      _request('/gemini/analyze-sms',
          method: 'POST',
          body: {'text': message},
          parser: (d) => SMSAnalysisResult.fromJson(d));

  static Future<EmailAnalysisResult> analyzeEmail(
    String emailContent, {
    String senderEmail = '',
    String subject = '',
  }) =>
      _request('/gemini/analyze-email',
          method: 'POST',
          body: {
            'email_content': emailContent,
            'sender_email': senderEmail,
            'subject': subject,
          },
          parser: (d) => EmailAnalysisResult.fromJson(d));

  // ── STR Report ──
  static Future<Map<String, dynamic>> generateSTR(String alertId) =>
      _request('/str/generate/$alertId',
          method: 'POST', parser: (d) => d as Map<String, dynamic>);

  static String getSTRDownloadUrl(String reportId) =>
      '$apiBase/str/download/$reportId';

  // ── Digital Twin Simulation ──
  static Future<SimulationResult> runSimulation({String? accountId}) =>
      _request('/simulation/digital-twin',
          method: 'POST',
          body: {'account_to_freeze': accountId ?? 'acc_A'},
          parser: (d) => SimulationResult.fromJson(d));

  // ── Live Simulation ──
  static Future<LiveEvent> fetchLiveEvent() =>
      _request('/simulation/live-event',
          parser: (d) => LiveEvent.fromJson(d));

  static Future<UserLiveEvent> fetchUserLiveEvent(String accountId) =>
      _request('/simulation/user-event/$accountId',
          parser: (d) => UserLiveEvent.fromJson(d));

  // ── Account Freeze ──
  static Future<FreezeResult> freezeAccount(String accountId) =>
      _request('/account/freeze/$accountId',
          method: 'POST', parser: (d) => FreezeResult.fromJson(d));

  static Future<Map<String, dynamic>> unfreezeAccount(String accountId) =>
      _request('/account/unfreeze/$accountId',
          method: 'POST', parser: (d) => d as Map<String, dynamic>);

  // ── Session Management ──
  static Future<Map<String, dynamic>> startSession() =>
      _request('/session/start',
          method: 'POST', parser: (d) => d as Map<String, dynamic>);

  static Future<SessionHistory> getSessionHistory({String period = 'all'}) =>
      _request('/session/history?period=$period',
          parser: (d) => SessionHistory.fromJson(d));

  // ── ML Models ──
  static Future<MLModelStatus> fetchMLStatus() =>
      _request('/ml/status', parser: (d) => MLModelStatus.fromJson(d));

  static Future<Map<String, dynamic>> fetchMLGraphClassification() =>
      _request('/ml/graph-classification',
          parser: (d) => d as Map<String, dynamic>);

  static Future<Map<String, dynamic>> retrainMLModels() =>
      _request('/ml/retrain',
          method: 'POST', parser: (d) => d as Map<String, dynamic>);

  // ── User Data Generation ──
  static Future<Map<String, dynamic>> generateUserData(
    String accountId, {
    String email = '',
  }) =>
      _request('/user/generate-data',
          method: 'POST',
          body: {'account_id': accountId, 'email': email},
          parser: (d) => d as Map<String, dynamic>);

  // ── Demo ──
  static Future<Map<String, dynamic>> seedDemo() =>
      _request('/demo/seed',
          method: 'POST', parser: (d) => d as Map<String, dynamic>);

  // ══════════════════════════════════════════════════════════════
  // Demo / fallback data generators (used when API is unreachable)
  // ══════════════════════════════════════════════════════════════
  static final _rng = Random();
  static int _demoTick = 0;

  static LiveEvent generateDemoLiveEvent() {
    _demoTick++;
    final scenarios = ['clean', 'suspicious_login', 'rapid_transfer', 'mule_ring'];
    final scenario = scenarios[_rng.nextInt(scenarios.length)];
    final isSuspicious = scenario != 'clean';
    final cyber = _rng.nextDouble() * 0.6 + (isSuspicious ? 0.3 : 0);
    final fin = _rng.nextDouble() * 0.5 + (isSuspicious ? 0.35 : 0);
    final graph = _rng.nextDouble() * 0.4 + (isSuspicious ? 0.2 : 0);
    final unified = (cyber * 0.3 + fin * 0.4 + graph * 0.3).clamp(0.0, 1.0);

    final trend = List.generate(
      min(_demoTick, 20),
      (i) => RiskTrendPoint(
        time: 'T${_demoTick - min(_demoTick, 20) + i + 1}',
        risk: (_rng.nextDouble() * 0.6 + 0.1),
      ),
    );

    Map<String, dynamic>? alert;
    if (isSuspicious && _rng.nextDouble() > 0.5) {
      alert = {
        'id': 'alert_demo_$_demoTick',
        'created_at': DateTime.now().toIso8601String(),
        'accounts_flagged': ['acc_A', 'acc_B'],
        'unified_risk_score': unified,
        'cyber_events': [
          {
            'id': 'ce_$_demoTick',
            'timestamp': DateTime.now().toIso8601String(),
            'event_type': scenario == 'suspicious_login' ? 'login' : 'device_change',
            'device_id': 'dev_${_rng.nextInt(999)}',
            'ip_geo': 'Mumbai, IN',
            'account_id': 'acc_A',
            'anomaly_score': cyber,
          }
        ],
        'financial_transactions': [
          {
            'id': 'tx_$_demoTick',
            'timestamp': DateTime.now().toIso8601String(),
            'sender': 'acc_A',
            'receiver': 'acc_B',
            'amount': (_rng.nextDouble() * 50000 + 1000).roundToDouble(),
            'method': 'upi',
            'velocity_score': fin,
          }
        ],
        'status': 'new',
        'severity': unified > 0.7 ? 'critical' : 'medium',
      };
    }

    return LiveEvent(
      tick: _demoTick,
      timestamp: DateTime.now().toIso8601String(),
      scenarioType: scenario,
      isSuspicious: isSuspicious,
      cyberEvent: {
        'id': 'ce_$_demoTick',
        'timestamp': DateTime.now().toIso8601String(),
        'event_type': 'login',
        'device_id': 'dev_${_rng.nextInt(999)}',
        'ip_geo': isSuspicious ? 'Unknown VPN' : 'Mumbai, IN',
        'account_id': 'acc_A',
        'anomaly_score': cyber,
      },
      transaction: {
        'id': 'tx_$_demoTick',
        'timestamp': DateTime.now().toIso8601String(),
        'sender': 'acc_A',
        'receiver': 'acc_${String.fromCharCode(66 + _rng.nextInt(5))}',
        'amount': (_rng.nextDouble() * 45000 + 500).roundToDouble(),
        'method': ['upi', 'neft', 'imps'][_rng.nextInt(3)],
        'velocity_score': fin,
      },
      riskScores: RiskScores(
        cyberScore: cyber,
        financialScore: fin,
        graphScore: graph,
        unifiedScore: unified,
      ),
      changes: isSuspicious
          ? ['Anomalous login pattern detected', 'Risk score elevated']
          : ['Normal activity'],
      alert: alert,
      riskTrend: trend,
      requiresGemini: isSuspicious && unified > 0.7,
      geminiAnalysis: null,
    );
  }

  static UserLiveEvent generateDemoUserLiveEvent(String accountId) {
    _demoTick++;
    final isAnomaly = _rng.nextDouble() > 0.7;
    final cyber = _rng.nextDouble() * 0.4 + (isAnomaly ? 0.3 : 0);
    final fin = _rng.nextDouble() * 0.3 + (isAnomaly ? 0.25 : 0);
    final graph = _rng.nextDouble() * 0.3;
    final unified = (cyber * 0.3 + fin * 0.4 + graph * 0.3).clamp(0.0, 1.0);
    final riskLevel = unified > 0.7 ? 'high' : (unified > 0.4 ? 'medium' : 'low');

    return UserLiveEvent(
      tick: _demoTick,
      timestamp: DateTime.now().toIso8601String(),
      accountId: accountId,
      isAnomaly: isAnomaly,
      riskScores: RiskScores(
        cyberScore: cyber,
        financialScore: fin,
        graphScore: graph,
        unifiedScore: unified,
      ),
      riskLevel: riskLevel,
      changes: isAnomaly
          ? ['Unusual activity detected on your account']
          : ['All clear — no suspicious activity'],
      warnings: isAnomaly
          ? [
              UserWarning(
                type: 'login',
                severity: 'warning',
                title: 'Unfamiliar login location',
                detail: 'A login was attempted from an unrecognized device.',
                action: 'Review your recent logins.',
              )
            ]
          : [],
      procedures: isAnomaly ? ['Change password', 'Enable 2FA'] : [],
      riskTrend: List.generate(
        min(_demoTick, 15),
        (i) => RiskTrendPoint(
          time: 'T${_demoTick - min(_demoTick, 15) + i + 1}',
          risk: (_rng.nextDouble() * 0.5 + 0.05),
        ),
      ),
      requiresGemini: false,
      geminiAnalysis: null,
    );
  }

  static GraphData generateDemoGraphData() {
    final nodes = <GraphNode>[
      GraphNode(id: 'acc_A', type: 'account', riskScore: 0.82, label: 'Account A', community: 0),
      GraphNode(id: 'acc_B', type: 'account', riskScore: 0.65, label: 'Account B', community: 0),
      GraphNode(id: 'acc_C', type: 'account', riskScore: 0.30, label: 'Account C', community: 1),
      GraphNode(id: 'acc_D', type: 'account', riskScore: 0.91, label: 'Account D (Mule)', community: 0),
      GraphNode(id: 'acc_E', type: 'account', riskScore: 0.15, label: 'Account E', community: 1),
      GraphNode(id: 'dev_1', type: 'device', riskScore: 0.70, label: 'Device 1', community: 0),
      GraphNode(id: 'dev_2', type: 'device', riskScore: 0.20, label: 'Device 2', community: 1),
      GraphNode(id: 'ip_vpn', type: 'ip', riskScore: 0.85, label: 'VPN Node', community: 0),
    ];
    final edges = <GraphEdge>[
      GraphEdge(source: 'acc_A', target: 'acc_B', type: 'transaction', weight: 0.8),
      GraphEdge(source: 'acc_B', target: 'acc_D', type: 'transaction', weight: 0.9),
      GraphEdge(source: 'acc_A', target: 'acc_C', type: 'transaction', weight: 0.3),
      GraphEdge(source: 'acc_C', target: 'acc_E', type: 'transaction', weight: 0.2),
      GraphEdge(source: 'acc_A', target: 'dev_1', type: 'device_link', weight: 0.7),
      GraphEdge(source: 'acc_D', target: 'dev_1', type: 'device_link', weight: 0.8),
      GraphEdge(source: 'acc_C', target: 'dev_2', type: 'device_link', weight: 0.3),
      GraphEdge(source: 'acc_D', target: 'ip_vpn', type: 'ip_link', weight: 0.9),
      GraphEdge(source: 'acc_B', target: 'ip_vpn', type: 'ip_link', weight: 0.6),
    ];
    return GraphData(nodes: nodes, edges: edges);
  }

  static MLModelStatus generateDemoMLStatus() {
    return MLModelStatus(
      mlEnabled: true,
      fraudPredictor: MLFraudPredictor(
        trained: true,
        metrics: {'accuracy': 0.94, 'precision': 0.91, 'recall': 0.88, 'f1_score': 0.89},
      ),
      temporalGnn: MLTemporalGnn(
        trained: true,
        metrics: {'accuracy': 0.92, 'auc_roc': 0.95},
      ),
    );
  }
}
