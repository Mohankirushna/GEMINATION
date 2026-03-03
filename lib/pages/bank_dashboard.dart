/// SurakshaFlow — Bank Intelligence Dashboard
/// Live simulation with risk scores, alerts, ML models, Gemini AI.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';

import '../models/types.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart' as app;
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import '../widgets/risk_gauge.dart';
import '../widgets/risk_badge.dart';
import '../widgets/stat_card.dart';
import '../widgets/section_header.dart';

class BankDashboard extends StatefulWidget {
  const BankDashboard({super.key});

  @override
  State<BankDashboard> createState() => _BankDashboardState();
}

class _BankDashboardState extends State<BankDashboard> {
  // Simulation
  Timer? _simTimer;
  bool _simRunning = true;
  int _totalTicks = 0;
  LiveEvent? _currentEvent;
  final List<LiveEvent> _eventHistory = [];
  final List<Alert> _liveAlerts = [];
  List<RiskTrendPoint> _riskTrend = [];
  int _highRiskCount = 0;
  int _transactionsMonitored = 0;
  int _activeMuleRings = 0;
  String? _simError;

  // UI state
  Alert? _selectedAlert;
  bool _detailLoading = false;
  GeminiExplanation? _geminiResult;
  bool _geminiLoading = false;
  SimulationResult? _twinResult;
  bool _twinLoading = false;
  FreezeResult? _freezeResult;
  bool _freezeLoading = false;
  MLModelStatus? _mlStatus;
  String _sessionId = '';
  bool _showGeminiPanel = true;

  @override
  void initState() {
    super.initState();
    _startSession();
    _fetchMLStatus();
    _startSimulation();
  }

  @override
  void dispose() {
    _simTimer?.cancel();
    super.dispose();
  }

  Future<void> _startSession() async {
    try {
      final info = await ApiService.startSession();
      if (mounted) {
        setState(() => _sessionId = info['session_id'] ?? '');
      }
    } catch (_) {
      if (mounted) {
        setState(() =>
            _sessionId = 'session_${DateTime.now().millisecondsSinceEpoch}');
      }
    }
  }

  Future<void> _fetchMLStatus() async {
    try {
      final status = await ApiService.fetchMLStatus();
      if (mounted) setState(() => _mlStatus = status);
    } catch (_) {
      // API unreachable — use demo ML status
      if (mounted) setState(() => _mlStatus = ApiService.generateDemoMLStatus());
    }
  }

  void _startSimulation() {
    // Fetch immediately instead of waiting for the first timer tick
    _fetchSimEvent();
    _simTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_simRunning) return;
      _fetchSimEvent();
    });
  }

  Future<void> _fetchSimEvent() async {
    LiveEvent event;
    try {
      event = await ApiService.fetchLiveEvent();
    } catch (_) {
      // API unreachable — use locally generated demo data
      event = ApiService.generateDemoLiveEvent();
    }
    if (!mounted) return;
    setState(() {
      _currentEvent = event;
      _totalTicks++;
      _eventHistory.insert(0, event);
      if (_eventHistory.length > 50) _eventHistory.removeLast();
      _riskTrend = event.riskTrend.isNotEmpty
          ? event.riskTrend
          : _eventHistory
              .take(20)
              .toList()
              .reversed
              .map((e) => RiskTrendPoint(
                    time: 'T${e.tick}',
                    risk: e.riskScores.unifiedScore,
                  ))
              .toList();

      if (event.alert != null) {
        _liveAlerts.insert(0, Alert.fromJson(event.alert!));
        if (_liveAlerts.length > 100) _liveAlerts.removeLast();
      }
      _highRiskCount =
          _liveAlerts.where((a) => a.unifiedRiskScore >= 0.7).length;
      _transactionsMonitored = _totalTicks;
      _activeMuleRings = (_liveAlerts.length / 5).ceil();
      _simError = null;
    });
  }

  void _toggleSim() => setState(() => _simRunning = !_simRunning);

  Future<void> _openAlert(Alert alert) async {
    setState(() {
      _detailLoading = true;
      _geminiResult = null;
      _twinResult = null;
      _freezeResult = null;
    });
    try {
      final detail = await ApiService.fetchAlertDetail(alert.id);
      if (mounted) setState(() => _selectedAlert = detail);
    } catch (_) {
      setState(() => _selectedAlert = alert);
    } finally {
      if (mounted) setState(() => _detailLoading = false);
    }
  }

  Future<void> _explainAlert() async {
    if (_selectedAlert == null) return;
    setState(() => _geminiLoading = true);
    try {
      final res = await ApiService.explainAlert(_selectedAlert!.id);
      if (mounted) setState(() => _geminiResult = res);
    } catch (_) {
      if (mounted) {
        setState(() => _geminiResult = GeminiExplanation(
              explanation: 'Unable to get AI explanation at this time.',
              recommendation: 'Please review the alert manually.',
              confidence: 0,
              keyIndicators: [],
            ));
      }
    } finally {
      if (mounted) setState(() => _geminiLoading = false);
    }
  }

  Future<void> _runTwin() async {
    if (_selectedAlert == null) return;
    setState(() => _twinLoading = true);
    try {
      final accountId =
          _selectedAlert!.accountsFlagged?.firstOrNull ??
              _selectedAlert!.accountId;
      final res = await ApiService.runSimulation(accountId: accountId);
      if (mounted) setState(() => _twinResult = res);
    } catch (_) {}
    if (mounted) setState(() => _twinLoading = false);
  }

  Future<void> _freezeAccountAction() async {
    if (_selectedAlert == null) return;
    setState(() => _freezeLoading = true);
    try {
      final accountId =
          _selectedAlert!.accountsFlagged?.firstOrNull ??
              _selectedAlert!.accountId;
      final res = await ApiService.freezeAccount(accountId);
      if (mounted) setState(() => _freezeResult = res);
    } catch (_) {
      if (mounted) {
        setState(() => _freezeResult = FreezeResult(
              success: false,
              accountId: _selectedAlert!.accountId,
              status: 'error',
              moneySaved: 0,
              message: 'Failed to freeze account.',
              downstreamProtected: 0,
              disruptionEffectiveness: 0,
            ));
      }
    }
    if (mounted) setState(() => _freezeLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    final scores = _currentEvent?.riskScores;
    final unified = scores?.unifiedScore ?? 0;
    final geminiAnalysis = _currentEvent?.geminiAnalysis;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.radio_button_checked,
              size: 16,
              color: _simRunning ? AppTheme.emerald : Colors.grey,
            ),
            const SizedBox(width: 8),
            const Flexible(child: Text('Intelligence Dashboard', overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.red.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'LIVE',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.red,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _simRunning ? Icons.pause : Icons.play_arrow,
              color: _simRunning ? AppTheme.amber : AppTheme.emerald,
            ),
            onPressed: _toggleSim,
            tooltip: _simRunning ? 'Pause' : 'Resume',
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: () {
              context.read<app.AuthProvider>().signOut();
              Navigator.of(context).pushReplacementNamed('/auth');
            },
          ),
        ],
      ),
      body: _currentEvent == null && _totalTicks == 0
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppTheme.cyan),
                  SizedBox(height: 16),
                  Text(
                    'Initializing live simulation…',
                    style: TextStyle(color: AppTheme.cyan, fontSize: 14),
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Tick bar
                Row(
                  children: [
                    Text(
                      'Tick #$_totalTicks',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _currentEvent?.scenarioType == 'money_laundering'
                          ? '🔴 ML Scenario'
                          : '🟢 Clean',
                      style: TextStyle(color: Colors.grey[400], fontSize: 12),
                    ),
                    const Spacer(),
                    Text(
                      'Session: ${_sessionId.length > 12 ? _sessionId.substring(0, 12) : _sessionId}',
                      style: TextStyle(
                          color: AppTheme.cyan,
                          fontSize: 10,
                          fontFamily: 'monospace'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Live Event Banner
                if (_currentEvent != null) _buildLiveEventBanner(unified, scores, geminiAnalysis),
                const SizedBox(height: 16),

                // Stat cards (2x2 grid)
                GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 2.2,
                  children: [
                    StatCard(
                      icon: Icons.shield,
                      label: 'Total Alerts',
                      value: _liveAlerts.length,
                      color: AppTheme.cyan,
                    ),
                    StatCard(
                      icon: Icons.warning_amber,
                      label: 'High Risk',
                      value: _highRiskCount,
                      color: AppTheme.red,
                    ),
                    StatCard(
                      icon: Icons.trending_up,
                      label: 'Monitored',
                      value: _transactionsMonitored,
                      color: AppTheme.emerald,
                    ),
                    StatCard(
                      icon: Icons.hub,
                      label: 'Mule Rings',
                      value: _activeMuleRings,
                      color: AppTheme.amber,
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Risk Trend Chart
                _buildRiskTrendChart(),
                const SizedBox(height: 16),

                // Risk Breakdown
                _buildRiskBreakdown(scores),
                const SizedBox(height: 16),

                // ML Status Panel
                if (_mlStatus != null) _buildMLPanel(),
                const SizedBox(height: 16),

                // Alerts List
                _buildAlertsList(),

                // Error indicator
                if (_simError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      'Simulation Error: $_simError',
                      style:
                          const TextStyle(color: AppTheme.red, fontSize: 11),
                    ),
                  ),
              ],
            ),
      // Alert Detail Bottom Sheet
      bottomSheet:
          _selectedAlert != null ? _buildAlertDetail() : null,
    );
  }

  Widget _buildLiveEventBanner(
      double unified, RiskScores? scores, GeminiLiveAnalysis? geminiAnalysis) {
    final color = AppTheme.riskColor(unified);
    final changes = _currentEvent?.changes ?? [];
    return GlassCard(
      borderColor: color.withValues(alpha: 0.3),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.bolt, size: 18, color: AppTheme.amber),
                const SizedBox(width: 6),
                Text(
                  'Live Event — Tick #${_currentEvent?.tick ?? 0}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 8),
                RiskBadge(score: unified),
                const Spacer(),
                RiskGauge(score: unified, size: 56, label: 'Unified'),
              ],
            ),
            if (changes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: changes.map((c) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      c,
                      style: TextStyle(color: Colors.grey[300], fontSize: 10),
                    ),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 10),
            // Risk scores row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _scoreChip(
                    'Unified', unified, AppTheme.riskColor(unified)),
                _scoreChip(
                    'Cyber', scores?.cyberScore ?? 0, AppTheme.cyan),
                _scoreChip(
                    'Financial', scores?.financialScore ?? 0, AppTheme.amber),
                _scoreChip(
                    'Graph', scores?.graphScore ?? 0, AppTheme.purple),
              ],
            ),

            // Gemini Analysis
            if (geminiAnalysis != null && _showGeminiPanel) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: AppTheme.purple.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.psychology,
                            size: 16, color: AppTheme.purple),
                        const SizedBox(width: 6),
                        const Text(
                          'Gemini AI Analysis',
                          style: TextStyle(
                            color: AppTheme.purple,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () =>
                              setState(() => _showGeminiPanel = false),
                          child: const Icon(Icons.close,
                              size: 16, color: Colors.grey),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      geminiAnalysis.explanation,
                      style: TextStyle(
                          color: Colors.grey[300], fontSize: 12, height: 1.4),
                    ),
                    if (geminiAnalysis.recommendation.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Recommendation: ${geminiAnalysis.recommendation}',
                        style: const TextStyle(
                            color: AppTheme.amber, fontSize: 12),
                      ),
                    ],
                    if (geminiAnalysis.keyIndicators.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        children: geminiAnalysis.keyIndicators.map((k) {
                          return Chip(
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                            label: Text(k, style: const TextStyle(fontSize: 9)),
                            backgroundColor:
                                AppTheme.purple.withValues(alpha: 0.2),
                            labelStyle:
                                const TextStyle(color: AppTheme.purple),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          );
                        }).toList(),
                      ),
                    ],
                    if (geminiAnalysis.strRequired == true)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.red.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            '⚠ STR Filing Required',
                            style: TextStyle(
                                color: AppTheme.red, fontSize: 11),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _scoreChip(String label, double score, Color color) {
    return Column(
      children: [
        Text(label,
            style: TextStyle(color: Colors.grey[500], fontSize: 10)),
        const SizedBox(height: 2),
        Text(
          '${(score * 100).toInt()}%',
          style: TextStyle(
              color: color, fontSize: 14, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildRiskTrendChart() {
    if (_riskTrend.isEmpty) return const SizedBox.shrink();
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            icon: Icons.trending_up,
            iconColor: AppTheme.cyan,
            title: 'Live Risk Trend',
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 180,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: 1,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: Colors.white.withValues(alpha: 0.05),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 35,
                      getTitlesWidget: (v, _) => Text(
                        '${(v * 100).toInt()}%',
                        style: TextStyle(
                            color: Colors.grey[600], fontSize: 9),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (v, _) {
                        final i = v.toInt();
                        if (i >= 0 && i < _riskTrend.length) {
                          return Text(
                            _riskTrend[i].time,
                            style: TextStyle(
                                color: Colors.grey[600], fontSize: 8),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                      interval: (_riskTrend.length / 5).ceilToDouble(),
                    ),
                  ),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: List.generate(
                      _riskTrend.length,
                      (i) => FlSpot(i.toDouble(), _riskTrend[i].risk),
                    ),
                    isCurved: true,
                    color: AppTheme.red,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppTheme.red.withValues(alpha: 0.1),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiskBreakdown(RiskScores? scores) {
    if (scores == null) return const SizedBox.shrink();
    final data = [
      _BarItem('Cyber', scores.cyberScore, AppTheme.cyan),
      _BarItem('Financial', scores.financialScore, AppTheme.amber),
      _BarItem('Graph', scores.graphScore, AppTheme.purple),
      _BarItem('Unified', scores.unifiedScore, AppTheme.riskColor(scores.unifiedScore)),
    ];
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            icon: Icons.bar_chart,
            iconColor: AppTheme.amber,
            title: 'Risk Breakdown',
          ),
          const SizedBox(height: 16),
          ...data.map((d) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(d.label,
                            style: TextStyle(
                                color: Colors.grey[400], fontSize: 12)),
                        Text(
                          '${(d.value * 100).toInt()}%',
                          style: TextStyle(
                            color: d.color,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: d.value,
                        backgroundColor: Colors.white.withValues(alpha: 0.05),
                        color: d.color,
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildMLPanel() {
    return GlassCard(
      borderColor: AppTheme.purple.withValues(alpha: 0.2),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.memory, size: 16, color: AppTheme.purple),
              const SizedBox(width: 8),
              const Text(
                'ML & AI Models',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.emerald.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                      color: AppTheme.emerald.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _mlStatus!.mlEnabled ? 'ONLINE' : 'FALLBACK',
                  style: TextStyle(
                    color: _mlStatus!.mlEnabled
                        ? AppTheme.emerald
                        : AppTheme.amber,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Model cards
          Row(
            children: [
              Expanded(
                child: _mlModelCard(
                  'Isolation Forest',
                  Icons.layers,
                  AppTheme.purple,
                  _mlStatus!.fraudPredictor?.trained ?? false,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _mlModelCard(
                  'Temporal GNN',
                  Icons.hub,
                  AppTheme.amber,
                  _mlStatus!.temporalGnn?.trained ?? false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _mlModelCard(
                  'RF + GB Ensemble',
                  Icons.account_tree,
                  AppTheme.cyan,
                  _mlStatus!.fraudPredictor?.trained ?? false,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _mlModelCard(
                  'Gemini 2.5',
                  Icons.auto_awesome,
                  AppTheme.emerald,
                  true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mlModelCard(String name, IconData icon, Color color, bool trained) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            trained ? '✓ Trained' : 'Fallback',
            style: TextStyle(
              color: trained ? AppTheme.emerald : AppTheme.amber,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsList() {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            icon: Icons.shield,
            iconColor: AppTheme.red,
            title: 'Live Alerts Feed',
            trailing: Text(
              '${_liveAlerts.length} alerts',
              style: TextStyle(color: Colors.grey[500], fontSize: 11),
            ),
          ),
          const SizedBox(height: 12),
          if (_liveAlerts.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  'Waiting for suspicious activity…',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
              ),
            )
          else
            ...List.generate(
              _liveAlerts.length.clamp(0, 20),
              (i) {
                final alert = _liveAlerts[i];
                final score = alert.unifiedRiskScore;
                return InkWell(
                  onTap: () => _openAlert(alert),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.white.withValues(alpha: 0.04),
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        // Time
                        SizedBox(
                          width: 60,
                          child: Text(
                            _formatTime(alert.timestamp),
                            style: TextStyle(
                                color: Colors.grey[500], fontSize: 10),
                          ),
                        ),
                        // Account
                        Expanded(
                          child: Text(
                            alert.accountId,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontFamily: 'monospace',
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // Risk
                        Text(
                          '${(score * 100).toInt()}%',
                          style: TextStyle(
                            color: AppTheme.riskColor(score),
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 8),
                        RiskBadge(score: score),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.visibility,
                          size: 14,
                          color: AppTheme.cyan,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildAlertDetail() {
    final alert = _selectedAlert!;
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.3,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border.all(color: AppTheme.border),
          ),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[700],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Header
              Row(
                children: [
                  const Icon(Icons.shield, color: AppTheme.red, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Alert Detail',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () =>
                        setState(() => _selectedAlert = null),
                    icon: const Icon(Icons.close, color: Colors.grey),
                    iconSize: 20,
                  ),
                ],
              ),
              const SizedBox(height: 16),

              if (_detailLoading)
                const Center(
                    child: CircularProgressIndicator(color: AppTheme.cyan))
              else ...[
                // Summary row
                Row(
                  children: [
                    RiskGauge(score: alert.unifiedRiskScore, size: 70),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Account: ${alert.accountId}',
                            style: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 12,
                              fontFamily: 'monospace',
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Text('Status: ',
                                  style: TextStyle(
                                      color: Colors.grey, fontSize: 12)),
                              RiskBadge(score: alert.unifiedRiskScore),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatTime(alert.timestamp),
                            style: TextStyle(
                                color: Colors.grey[600], fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Cyber Events
                if (alert.cyberEvents.isNotEmpty) ...[
                  Text(
                    'CYBER EVENTS (${alert.cyberEvents.length})',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...alert.cyberEvents.map((e) => Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.03),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment:
                              MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${e.type} — ${e.ipLocation.isNotEmpty ? e.ipLocation : "N/A"}',
                              style: TextStyle(
                                  color: Colors.grey[300], fontSize: 11),
                            ),
                            Text(
                              '${(e.riskScore * 100).toInt()}%',
                              style: TextStyle(
                                color: AppTheme.riskColor(e.riskScore),
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      )),
                  const SizedBox(height: 12),
                ],

                // Transactions
                if (alert.financialTransactions.isNotEmpty) ...[
                  Text(
                    'TRANSACTIONS (${alert.financialTransactions.length})',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...alert.financialTransactions.map((t) => Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.03),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${t.senderId} → ${t.receiverId}  ₹${t.amount.toStringAsFixed(0)}',
                                style: TextStyle(
                                    color: Colors.grey[300], fontSize: 11),
                              ),
                            ),
                            Text(
                              '${(t.riskScore * 100).toInt()}%',
                              style: TextStyle(
                                color: AppTheme.riskColor(t.riskScore),
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      )),
                  const SizedBox(height: 12),
                ],

                // AI Explanation from alert
                if (alert.geminiExplanation != null &&
                    alert.geminiExplanation!.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.purple.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppTheme.purple.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.psychology,
                            size: 14, color: AppTheme.purple),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            alert.geminiExplanation!,
                            style: const TextStyle(
                                color: AppTheme.purple, fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Action Buttons
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _actionBtn(
                      'AI Explain',
                      Icons.psychology,
                      AppTheme.purple,
                      _geminiLoading,
                      _explainAlert,
                    ),
                    _actionBtn(
                      'Digital Twin',
                      Icons.hub,
                      AppTheme.amber,
                      _twinLoading,
                      _runTwin,
                    ),
                    if (alert.unifiedRiskScore >= 0.6)
                      _actionBtn(
                        '🚨 Freeze',
                        Icons.ac_unit,
                        AppTheme.red,
                        _freezeLoading,
                        _freezeAccountAction,
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // Gemini result
                if (_geminiResult != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.purple.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppTheme.purple.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'AI Explanation',
                          style: TextStyle(
                            color: AppTheme.purple,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _geminiResult!.explanation,
                          style: TextStyle(
                              color: Colors.grey[300], fontSize: 11),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Recommendation: ${_geminiResult!.recommendation}',
                          style: const TextStyle(
                              color: AppTheme.amber, fontSize: 11),
                        ),
                        if (_geminiResult!.keyIndicators.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 4,
                            children:
                                _geminiResult!.keyIndicators.map((k) {
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.purple
                                      .withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  k,
                                  style: const TextStyle(
                                      color: AppTheme.purple,
                                      fontSize: 9),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Twin result
                if (_twinResult != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.amber.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppTheme.amber.withValues(alpha: 0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Digital Twin Simulation',
                          style: TextStyle(
                            color: AppTheme.amber,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text('No Action Exposure',
                                      style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 10)),
                                  Text(
                                    '₹${_twinResult!.noAction.totalExposure.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      color: AppTheme.red,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text('Saved by Freeze',
                                      style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 10)),
                                  Text(
                                    '₹${_twinResult!.optimalAction.preventedLoss.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      color: AppTheme.emerald,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Freeze result
                if (_freezeResult != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: (_freezeResult!.success
                              ? AppTheme.emerald
                              : AppTheme.red)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: (_freezeResult!.success
                                ? AppTheme.emerald
                                : AppTheme.red)
                            .withValues(alpha: 0.2),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.ac_unit,
                              size: 16,
                              color: _freezeResult!.success
                                  ? AppTheme.emerald
                                  : AppTheme.red,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _freezeResult!.success
                                  ? 'Account Frozen'
                                  : 'Freeze Failed',
                              style: TextStyle(
                                color: _freezeResult!.success
                                    ? AppTheme.emerald
                                    : AppTheme.red,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _freezeResult!.message,
                          style: TextStyle(
                              color: Colors.grey[300], fontSize: 11),
                        ),
                        if (_freezeResult!.success &&
                            _freezeResult!.moneySaved > 0) ...[
                          const SizedBox(height: 6),
                          Text(
                            '₹${_freezeResult!.moneySaved.toStringAsFixed(0)} saved by SurakshaFlow',
                            style: const TextStyle(
                              color: AppTheme.emerald,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _actionBtn(String label, IconData icon, Color color, bool loading,
      VoidCallback onTap) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            loading
                ? SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: color,
                    ),
                  )
                : Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(
              loading ? '…' : label,
              style: TextStyle(color: color, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String ts) {
    try {
      final dt = DateTime.parse(ts);
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';
    } catch (_) {
      return ts;
    }
  }
}

class _BarItem {
  final String label;
  final double value;
  final Color color;
  _BarItem(this.label, this.value, this.color);
}
